import { describe, expect, it } from 'vitest'
import { surgeConfig } from './config'
import { tickSurge, SurgeState, MarketQuote, themeBoard, candidateFor, summarize } from './engine'
const base = Date.parse('2026-10-06T09:05:00+09:00')
const config = () => ({ ...surgeConfig(), comparisonGates: [] })
const pool = { a: { name: 'A', themes: ['조선'] }, b: { name: 'B', themes: ['조선'] }, c: { name: 'C', themes: ['조선'] } }
const q = (at: number, dayPct: number, value = 20e9, price = 100): MarketQuote => ({ price, high: 130, low: 80, dayPct, value, sourceAt: at, receivedAt: at, halted: false })
const quotes = (at: number, leader = 'a') => ({ a: q(at, leader === 'a' ? 10 : 8), b: q(at, leader === 'b' ? 12 : 5), c: q(at, 0) })
function held() {
  let state: SurgeState | undefined
  for (let sec = 0; sec <= 180; sec += 10) state = tickSurge(state, pool, quotes(base + sec * 1000), base + sec * 1000, config()).state
  return state!
}
describe('100억 leader rotation (pure, no orders or LLM)', () => {
  it('uses turnover only as eligibility and full-theme median', () => {
    const qs = quotes(base); qs.a.value = 9e9; qs.c.dayPct = -5; qs.b.value = 10e9
    const board = themeBoard(pool, qs, base, config())
    expect(candidateFor(board.themes[0], pool, qs, 10e9)?.code).toBe('b')
    expect(board.themes[0].median).toBe(5)
    expect(tickSurge(undefined, pool, qs, base, config()).state.arms[0].timers).toEqual({})
  })
  it('waits three continuously observed minutes before first entry, without breakout', () => {
    const state = held(), trade = state.arms[0].trades[0]
    expect(trade).toMatchObject({ code: 'a', entry: 100, entryAt: base + 180000, status: 'holding' })
    expect(state.arms[0].trades).toHaveLength(1)
    expect(tickSurge(state, pool, quotes(base + 180000), base + 180000, config()).events).toEqual([])
  })
  it('keeps old holding until replacement confirms, emits exit before entry', () => {
    let state = held(), result
    for (let sec = 190; sec <= 370; sec += 10) {
      result = tickSurge(state, pool, quotes(base + sec * 1000, 'b'), base + sec * 1000, config()); state = result.state
      if (sec < 370) expect(result.events).toHaveLength(0)
    }
    expect(result!.events.map(e => e.kind)).toEqual(['LEADER_CHANGE', 'ENTRY'])
    expect(result!.events[0].next).toMatchObject({ code: 'b', name: 'B', dayPct: 12 })
    expect(state.arms[0].trades.map(t => t.status)).toEqual(['closed', 'holding'])
  })
  it('continues replacement exits after entry cutoff without opening a new position', () => {
    const cfg = { ...config(), end: '09:09:00' }
    let state: SurgeState | undefined, result
    for (let sec = 0; sec <= 420; sec += 10) {
      const at = base + sec * 1000
      result = tickSurge(state, pool, quotes(at, sec >= 240 ? 'b' : 'a'), at, cfg)
      state = result.state
    }
    expect(result!.events.map(e => e.kind)).toEqual(['LEADER_CHANGE'])
    expect(state!.arms[0].trades).toHaveLength(1)
    expect(state!.arms[0].trades[0].status).toBe('closed')
  })
  it('closes at market close even though new entries have ended', () => {
    const state = held(), at = Date.parse('2026-10-06T15:30:00+09:00')
    state.lastAt = at - 10000; state.arms[0].trades[0].lastAt = at - 10000
    const result = tickSurge(state, pool, quotes(at), at, config())
    expect(result.events.map(e => e.kind)).toEqual(['CLOSE'])
    expect(result.events[0].trade.excluded).toBe(false)
  })
  it('cancels a flickering challenger and preserves incumbent on ties', () => {
    let state = held()
    state = tickSurge(state, pool, quotes(base + 190000, 'b'), base + 190000, config()).state
    state = tickSurge(state, pool, quotes(base + 200000), base + 200000, config()).state
    expect(state.arms[0].timers['조선'].code).toBe('a')
    const qs = quotes(base + 210000); qs.b.dayPct = qs.a.dayPct
    state = tickSurge(state, pool, qs, base + 210000, config()).state
    // With three peers a top tie equals the median: keep holding, but reset eligibility.
    expect(state.arms[0].timers['조선']).toBeUndefined()
    const theme = themeBoard(pool, qs, base + 210000, config()).themes[0]
    expect(candidateFor(theme, pool, qs, 10e9, 'a')?.code).toBe('a')
    expect(state.arms[0].trades).toHaveLength(1)
  })
  it('does not confirm during stale or missing observations', () => {
    let state = held()
    const at = base + 190000
    const missing = quotes(at) as any; delete missing.c
    state = tickSurge(state, pool, missing, at, config()).state
    expect(state.complete).toBe(false); expect(state.arms[0].timers).toEqual({})
    expect(state.arms[0].trades[0].status).toBe('holding')
  })
  it('does not bridge a collector gap and excludes unseen stop paths', () => {
    const result = tickSurge(held(), pool, quotes(base + 240000, 'b'), base + 240000, config())
    expect(result.state.arms[0].timers['조선'].since).toBe(base + 240000)
    expect(result.state.arms[0].trades[0].excluded).toBe(true)
    expect(result.events).toHaveLength(0)
  })
  it('stops immediately while challenger timer is pending', () => {
    const at = base + 190000, qs = quotes(at, 'b'); qs.a.price = 96
    const result = tickSurge(held(), pool, qs, at, config())
    expect(result.events.map(e => e.kind)).toEqual(['STOP_LOSS'])
    expect(result.events[0].trade.netPct).toBeCloseTo(-4.21)
  })
  it('exits a genuine theme drop, but never one manufactured by missing data', () => {
    const at = base + 190000, expanded = { ...pool }, qs: Record<string, MarketQuote> = quotes(at)
    for (const code of ['d', 'e', 'f']) { (expanded as any)[code] = { name: code, themes: [code] }; qs[code] = q(at, 5, 100e9) }
    expect(tickSurge(held(), expanded, qs, at, config()).events[0].kind).toBe('THEME_DROP')
    delete qs.f
    expect(tickSurge(held(), expanded, qs, at, config()).events).toEqual([])
  })
  it('enforces the entry cap independently per variant and still exits', () => {
    let state = held(); state.config.maxEntries = 1
    let result
    for (let sec = 190; sec <= 370; sec += 10) {
      result = tickSurge(state, pool, quotes(base + sec * 1000, 'b'), base + sec * 1000, config()); state = result.state
    }
    expect(result!.events.map(e => e.kind)).toEqual(['LEADER_CHANGE'])
    expect(result!.events[0].blockedReason).toBe('DAILY_LIMIT')
  })
  it.each(['vi', 'limitUp', 'executionUnknown'] as const)('blocks %s without making a successful entry', flag => {
    let state: SurgeState | undefined
    for (let sec = 0; sec <= 180; sec += 10) {
      const at = base + sec * 1000, qs = quotes(at); qs.a[flag] = true
      state = tickSurge(state, pool, qs, at, config()).state
    }
    expect(state!.arms[0].trades).toHaveLength(0)
    expect(Object.values(state!.arms[0].blocked)).toHaveLength(1)
  })
  it('allows singleton UNMAPPED and resets at the next trading day', () => {
    let state: SurgeState | undefined
    for (let sec = 0; sec <= 180; sec += 10) {
      const at = base + sec * 1000
      state = tickSurge(state, { a: { name: 'A', themes: [] } }, { a: q(at, 7) }, at, config()).state
    }
    expect(state!.arms[0].trades).toHaveLength(1)
    const next = base + 86400000
    expect(tickSurge(state, pool, quotes(next), next, config()).state.arms[0].trades).toHaveLength(0)
  })
  it('holds config fixed for the day and runs independent gate arms', () => {
    const cfg = { ...config(), comparisonGates: [50e9] }
    let state: SurgeState | undefined
    for (let sec = 0; sec <= 180; sec += 10) { const at = base + sec * 1000; state = tickSurge(state, pool, quotes(at), at, cfg).state }
    expect(state!.arms.map(a => a.trades.length)).toEqual([1, 0])
    expect(summarize(state!.arms)[0].count).toBe(1)
    const at = base + 190000
    expect(tickSurge(state, pool, quotes(at), at, { ...cfg, gateWon: 999e9 }).state.config.gateWon).toBe(10e9)
  })
})
