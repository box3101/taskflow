import { clock, median, Pool, Quote } from '../spikeCloudRules'
import { SurgeConfig, variantId } from './config'

export type ExitReason = 'STOP_LOSS' | 'THEME_DROP' | 'LEADER_CHANGE' | 'CLOSE'
export type MarketQuote = Quote & { vi?: boolean; limitUp?: boolean; executionUnknown?: boolean }
export type Candidate = { code: string; name: string; theme: string; themeName: string; dayPct: number; turnover: number; median: number; themeRank: number }
export type Theme = { id: string; name: string; codes: string[]; turnover: number; median: number; rank: number }
export type Trade = { id: string; variant: string; code: string; name: string; theme: string; themeName: string;
  entryAt: number; entry: number; dayPct: number; turnover: number; median: number; themeRank: number;
  lastAt: number; lastPrice: number; status: 'holding' | 'closed'; exitAt?: number; exit?: number;
  reason?: ExitReason; grossPct?: number; netPct?: number; excluded: boolean; exclusion?: string; seenAt?: number }
export type Event = { id: string; tradeId: string; date: string; variant: string; at: number;
  kind: 'ENTRY' | ExitReason; trade: Trade; next?: Candidate; previousPct?: number;
  themeRank?: number; topTheme?: string; blockedReason?: string }
type Timer = { code: string; since: number; sourceAt: number; lastAt: number }
export type Arm = { variant: string; gate: number; timers: Record<string, Timer>; confirmed: Record<string, string>; trades: Trade[]; blocked: Record<string, string> }
export type SurgeState = { version: string; date: string; config: SurgeConfig; lastAt: number; arms: Arm[]; themes: Theme[]; complete: boolean;
  missing?: { count: number; sample: { code: string; reason: string }[] } }
const time = (at: number) => clock(at).slice(11, 19)
export function validQuote(q: MarketQuote | undefined, at: number, age: number): q is MarketQuote {
  return !!q && [q.price, q.dayPct, q.value, q.sourceAt, q.receivedAt].every(v => typeof v === 'number' && Number.isFinite(v)) &&
    q.price > 0 && q.value! >= 0 && q.sourceAt <= at && at - q.sourceAt <= age && q.receivedAt <= at && at - q.receivedAt <= age &&
    clock(q.sourceAt).slice(0, 10) === clock(at).slice(0, 10)
}
// Board membership only needs a quote we received recently for today. A stale trade time
// (VI single-price auction, thin trading) is the current state, not a collection failure.
// Entry candidates still use validQuote with the stricter execution age.
export function boardQuoteIssue(q: MarketQuote | undefined, at: number, age: number) {
  if (!q) return 'NO_QUOTE'
  if (![q.price, q.dayPct, q.value, q.sourceAt, q.receivedAt].every(v => typeof v === 'number' && Number.isFinite(v)) || q.price <= 0 || q.value! < 0) return 'INVALID'
  if (q.receivedAt > at || at - q.receivedAt > age) return 'STALE_RECEIVED'
  if (q.sourceAt > at || clock(q.sourceAt).slice(0, 10) !== clock(at).slice(0, 10)) return 'NOT_TODAY'
  return null
}
export function themeBoard(pool: Pool, quotes: Record<string, MarketQuote>, at: number, config: SurgeConfig) {
  const groups = new Map<string, string[]>()
  for (const [code, p] of Object.entries(pool)) {
    // One primary daily mapping per stock avoids double-counting turnover.
    const theme = p.themes[0] || `UNMAPPED:${code}`
    groups.set(theme, [...(groups.get(theme) || []), code])
  }
  const issues = Object.keys(pool).flatMap(code => {
    const reason = boardQuoteIssue(quotes[code], at, config.quoteAgeMs)
    return reason ? [{ code, reason }] : []
  })
  const bad = new Set(issues.map(i => i.code))
  const complete = Object.keys(pool).length > 0 && !issues.length
  const themes: Theme[] = [...groups].flatMap(([id, codes]) => {
    if (codes.some(c => bad.has(c))) return []
    return [{ id, name: id.startsWith('UNMAPPED:') ? `미분류 · ${pool[codes[0]].name}` : id, codes,
      turnover: codes.reduce((s, c) => s + quotes[c].value!, 0), median: median(codes.map(c => quotes[c].dayPct)), rank: 0 }]
  }).sort((a, b) => b.turnover - a.turnover || a.id.localeCompare(b.id))
  themes.forEach((t, i) => { t.rank = i + 1 })
  return { themes, complete, missing: { count: issues.length, sample: issues.slice(0, 20) } }
}
export function candidateFor(theme: Theme, pool: Pool, quotes: Record<string, MarketQuote>, gate: number, incumbent?: string): Candidate | undefined {
  const qualified = theme.codes.filter(c => !quotes[c].halted && quotes[c].value! >= gate)
    .sort((a, b) => quotes[b].dayPct - quotes[a].dayPct || Number(b === incumbent) - Number(a === incumbent) || a.localeCompare(b))
  const code = qualified[0]
  if (!code) return
  return { code, name: pool[code].name, theme: theme.id, themeName: theme.name, dayPct: quotes[code].dayPct,
    turnover: quotes[code].value!, median: theme.median, themeRank: theme.rank }
}
export function blockedExecution(q: MarketQuote | undefined, at: number, config: SurgeConfig) {
  if (!validQuote(q, at, config.executionAgeMs)) return 'STALE_QUOTE'
  if (q.executionUnknown) return 'EXECUTION_STATUS_UNKNOWN'
  if (q.halted) return 'HALTED'
  if (q.vi) return 'VI'
  if (q.limitUp || q.dayPct >= config.limitPct) return 'LIMIT_UP'
  return null
}
export function tickSurge(prior: SurgeState | undefined, pool: Pool, quotes: Record<string, MarketQuote>, at: number, config: SurgeConfig) {
  const date = clock(at).slice(0, 10)
  const state: SurgeState = prior?.date === date ? prior : { version: config.version, date, config,
    lastAt: 0, arms: [...new Set([config.gateWon, ...config.comparisonGates])].map(gate => ({
      variant: variantId(gate, config.stableMs / 1000), gate, timers: {}, confirmed: {}, trades: [], blocked: {},
    })), themes: [], complete: false }
  const events: Event[] = []
  if (at <= state.lastAt) return { state, events }
  config = state.config
  const board = themeBoard(pool, quotes, at, config)
  state.themes = board.themes; state.complete = board.complete; state.missing = board.missing
  const gap = state.lastAt > 0 && at - state.lastAt > config.gapMs
  const tm = time(at), active = tm >= config.start && tm < config.end
  const monitoring = tm >= config.start && tm < config.close
  for (const arm of state.arms) {
    if (gap || !board.complete || !monitoring) arm.timers = {}
    arm.blocked = {}
    const eligible = new Map<string, Candidate>()
    if (board.complete && monitoring) for (const theme of board.themes.filter(t => t.rank <= config.topThemes)) {
      const c = candidateFor(theme, pool, quotes, arm.gate, arm.timers[theme.id]?.code || arm.confirmed[theme.id])
      if (!c || !(c.dayPct > theme.median || (theme.codes.length === 1 && config.singleton))) continue
      if (!validQuote(quotes[c.code], at, config.executionAgeMs)) continue
      eligible.set(theme.id, c)
      const old = arm.timers[theme.id], q = quotes[c.code]
      if (!old || old.code !== c.code || at - old.lastAt > config.gapMs) {
        arm.timers[theme.id] = { code: c.code, since: at, sourceAt: q.sourceAt, lastAt: at }
      } else if (q.sourceAt > old.sourceAt) {
        old.sourceAt = q.sourceAt; old.lastAt = at
      } else if (at - old.lastAt > config.executionAgeMs) {
        delete arm.timers[theme.id]; eligible.delete(theme.id)
      }
    }
    for (const id of Object.keys(arm.timers)) if (!eligible.has(id)) delete arm.timers[id]
    const ready = (theme: string) => {
      const timer = arm.timers[theme]
      return !!timer && timer.lastAt === at && at - timer.since >= config.stableMs
    }
    const close = (trade: Trade, reason: ExitReason, next?: Candidate) => {
      const q = quotes[trade.code]
      trade.status = 'closed'; trade.exitAt = at; trade.exit = q.price; trade.reason = reason
      trade.grossPct = (q.price / trade.entry - 1) * 100; trade.netPct = trade.grossPct - config.costPct
      const theme = board.themes.find(t => t.id === trade.theme)
      events.push({ id: `${trade.id}:EXIT`, tradeId: trade.id, date, variant: arm.variant, at, kind: reason,
        trade: { ...trade }, next, previousPct: q.dayPct, themeRank: theme?.rank, topTheme: board.themes[0]?.name })
    }
    for (const trade of arm.trades.filter(t => t.status === 'holding')) {
      const q = quotes[trade.code]
      // A missing price path cannot be scored as if stop-loss monitoring had continued.
      const auction = time(trade.lastAt) >= '15:19:30' && tm <= '15:32:00'
      // Exclude only when our observation stopped (collector gap or no fresh receipt), not when the
      // stock itself had no trade for a while (VI single-price auction, thin trading).
      if (q && Number.isFinite(q.receivedAt) && q.receivedAt <= at && at - q.receivedAt <= config.executionAgeMs) trade.seenAt = Math.max(trade.seenAt || 0, q.receivedAt)
      if ((gap || at - (trade.seenAt ?? trade.lastAt) > config.gapMs) && !auction) {
        trade.excluded = true; trade.exclusion = 'OBSERVATION_GAP'
      }
      if (!validQuote(q, at, config.executionAgeMs) || q.halted || q.vi || q.sourceAt <= trade.lastAt) continue
      trade.lastAt = q.sourceAt; trade.lastPrice = q.price
      const theme = board.themes.find(t => t.id === trade.theme)
      if (q.price <= trade.entry * (1 - config.stopPct / 100)) close(trade, 'STOP_LOSS')
      else if (time(q.sourceAt) >= config.close) close(trade, 'CLOSE')
      else if (board.complete && theme && theme.rank > config.topThemes) close(trade, 'THEME_DROP')
      else if (board.complete && ready(trade.theme) && eligible.get(trade.theme)?.code !== trade.code) {
        close(trade, 'LEADER_CHANGE', eligible.get(trade.theme))
      }
    }
    if (!active || !board.complete) continue
    for (const [theme, c] of eligible) {
      if (!ready(theme) || arm.trades.some(t => t.status === 'holding' && t.theme === theme)) continue
      // Do not repeatedly re-enter an unchanged leader after a stop or a blocked entry.
      if (arm.confirmed[theme] === c.code) continue
      const blocked = arm.trades.length >= config.maxEntries ? 'DAILY_LIMIT' :
        arm.trades.some(t => t.status === 'holding' && t.code === c.code) ? 'ALREADY_HELD' : blockedExecution(quotes[c.code], at, config)
      if (blocked) {
        arm.blocked[theme] = blocked
        const event = events.find(e => e.variant === arm.variant && e.kind === 'LEADER_CHANGE' && e.trade.theme === theme)
        if (event) event.blockedReason = blocked
        continue
      }
      arm.confirmed[theme] = c.code
      const q = quotes[c.code], id = `${date}:${arm.variant}:${arm.trades.length + 1}`
      const trade: Trade = { id, variant: arm.variant, ...c, entryAt: at, entry: q.price, lastAt: q.sourceAt,
        lastPrice: q.price, status: 'holding', excluded: false, seenAt: at }
      arm.trades.push(trade)
      events.push({ id: `${id}:ENTRY`, tradeId: id, date, variant: arm.variant, at, kind: 'ENTRY', trade: { ...trade } })
    }
  }
  state.lastAt = at
  return { state, events }
}
export function summarize(arms: Arm[]) {
  return arms.map(arm => {
    const done = arm.trades.filter(t => t.status === 'closed' && !t.excluded && Number.isFinite(t.netPct))
    return { variant: arm.variant, count: arm.trades.length, completed: done.length,
      holding: arm.trades.filter(t => t.status === 'holding').length, excluded: arm.trades.filter(t => t.excluded).length,
      mean: done.length ? done.reduce((n, t) => n + t.netPct!, 0) / done.length : null,
      win: done.length ? 100 * done.filter(t => t.netPct! > 0).length / done.length : null,
      reasons: Object.fromEntries(['STOP_LOSS', 'THEME_DROP', 'LEADER_CHANGE', 'CLOSE'].map(reason => [reason, done.filter(t => t.reason === reason).length])),
      averageEntrySeconds: arm.trades.length ? arm.trades.reduce((n, t) => {
        const [h, m, s] = time(t.entryAt).split(':').map(Number); return n + h * 3600 + m * 60 + s
      }, 0) / arm.trades.length : null }
  })
}
