import { describe, expect, it } from 'vitest'
import { surgeConfig } from './config'
import { fetchDayBars, minutes, replayDay, DayBars } from './replay'

const row = (hhmm: string, close: number, value: number, date = '20261006') =>
  ({ stck_bsop_date: date, stck_cntg_hour: `${hhmm}00`, stck_prpr: String(close), stck_hgpr: String(close), stck_lwpr: String(close), acml_tr_pbmn: String(value) })
describe('surge replay', () => {
  it('pages minute bars backwards until the open and keeps only the requested day', async () => {
    const calls: string[] = []
    const get = async (_p: string, _t: string, params: Record<string, string>) => {
      calls.push(params.FID_INPUT_HOUR_1)
      const end = params.FID_INPUT_HOUR_1.slice(0, 4)
      const bars = minutes('0900', end).slice(-30).reverse().map(h => row(h, 100, 1))
      return { output1: { stck_prdy_clpr: '90' }, output2: [...bars, row('1529', 1, 1, '20261005')] }
    }
    const day = await fetchDayBars('000001', '2026-10-06', get as any)
    expect(day.prevClose).toBe(90)
    expect(day.bars).toHaveLength(minutes().length)
    expect(day.bars[0].hhmm).toBe('0900'); expect(calls[0]).toBe('153000'); expect(calls[1]).toBe('150000')
  })
  it('replays a day minute by minute with the checklist and enters after the hold', () => {
    const pool = Object.fromEntries(['a', 'b', 'c'].map(c => [c, { name: c.toUpperCase(), themes: ['태양광'], high60: 100, surges: 2, hotTheme: true, historyReady: true }]))
    const series = (pct: number, perMinute: number): DayBars => ({ prevClose: 90, bars: minutes().map((hhmm, i) => ({
      hhmm, close: 90 * (1 + pct / 100), high: 90 * (1 + pct / 100), low: 90, value: 20e9 + i * perMinute })) })
    const data = { a: series(12, 6e9), b: series(5, 6e9), c: series(1, 1e9) }
    const config = { ...surgeConfig(), comparisonGates: [], gapMs: 120_000, executionAgeMs: 90_000, quoteAgeMs: 180_000 }
    const result = replayDay('2026-10-06', pool, data, config, ['0930'])
    const entry = result.events.find(e => e.kind === 'ENTRY')!
    expect(entry.trade).toMatchObject({ code: 'a', themeName: '태양광' })
    expect(new Date(entry.at).toISOString()).toBe('2026-10-06T00:08:00.000Z') // 09:08 KST: 09:05 start + 3 minutes held
    expect(result.events.at(-1)?.kind).toBe('CLOSE')
    expect(result.snapshots[0]).toMatchObject({ hhmm: '0930', themes: [{ name: '태양광', leader: 'A' }] })
  })
})
