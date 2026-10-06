import { kisGet, rows, apiNumber } from '../kisFlow'
import { clock } from '../spikeCloudRules'
import { SurgeConfig } from './config'
import { tickSurge, SurgeState, SurgePool, MarketQuote, Event, candidateFor } from './engine'

// After-hours replay of one trading day on 1-minute bars. KIS only serves the current day's
// minute chart, so this must run on the same day (after the close, before the next open).
export type Bar = { hhmm: string; close: number; high: number; low: number; value: number }
export type DayBars = { prevClose: number; bars: Bar[] }

export function parseBars(output2: unknown, date: string): Bar[] {
  const day = date.replace(/-/g, '')
  return rows(output2).flatMap(r => {
    const hhmm = String(r.stck_cntg_hour || '').slice(0, 4), close = apiNumber(r.stck_prpr), high = apiNumber(r.stck_hgpr),
      low = apiNumber(r.stck_lwpr), value = apiNumber(r.acml_tr_pbmn)
    if (String(r.stck_bsop_date) !== day || !/^\d{4}$/.test(hhmm) || !close || !high || !low || value === null) return []
    return [{ hhmm, close, high, low, value }]
  })
}
const minusMinute = (hhmm: string) => {
  const m = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2)) - 1
  return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`
}
export async function fetchDayBars(ticker: string, date: string, get = kisGet): Promise<DayBars> {
  const byMinute = new Map<string, Bar>()
  let hour = '153000', prevClose = 0
  for (let call = 0; call < 16; call++) {
    const data = await get('/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice', 'FHKST03010200', {
      FID_ETC_CLS_CODE: '', FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: ticker, FID_INPUT_HOUR_1: hour, FID_PW_DATA_INCU_YN: 'Y',
    })
    prevClose ||= apiNumber(rows(data.output1)[0]?.stck_prdy_clpr) || 0
    const bars = parseBars(data.output2, date), before = byMinute.size
    for (const b of bars) if (!byMinute.has(b.hhmm)) byMinute.set(b.hhmm, b)
    const earliest = bars.map(b => b.hhmm).sort()[0]
    if (!earliest || byMinute.size === before || earliest <= '0900') break
    hour = minusMinute(earliest)
  }
  return { prevClose, bars: [...byMinute.values()].sort((a, b) => a.hhmm.localeCompare(b.hhmm)) }
}

const minuteAt = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00+09:00`)
export function minutes(from = '0900', to = '1530') {
  const out: string[] = []
  for (let m = Number(from.slice(0, 2)) * 60 + Number(from.slice(2)); m <= Number(to.slice(0, 2)) * 60 + Number(to.slice(2)); m++)
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`)
  return out
}
// One quote per stock per minute. A bar's data is treated as known at the end of that minute
// (no look-ahead). Minutes without a trade carry the last state with an old trade time.
export function replayDay(date: string, pool: SurgePool, data: Record<string, DayBars>, config: SurgeConfig, snapshotsAt: string[] = []) {
  const quotes: Record<string, MarketQuote> = {}, events: Event[] = [], snapshots: { hhmm: string; themes: { name: string; turnover: number; leader?: string }[] }[] = []
  const index: Record<string, Map<string, Bar>> = {}, day: Record<string, { high: number; low: number }> = {}
  for (const [code, d] of Object.entries(data)) index[code] = new Map(d.bars.map(b => [b.hhmm, b]))
  let state: SurgeState | undefined
  for (const hhmm of minutes()) {
    const at = minuteAt(date, hhmm) + 60_000
    for (const [code, d] of Object.entries(data)) {
      const bar = index[code].get(hhmm), prev = quotes[code]
      if (!bar) { if (prev) { prev.receivedAt = at; prev.minuteValue = 0 } continue }
      if (!(d.prevClose > 0)) continue
      const range = day[code] = { high: Math.max(day[code]?.high || 0, bar.high), low: Math.min(day[code]?.low || Infinity, bar.low) }
      quotes[code] = { price: bar.close, high: range.high, low: range.low, dayPct: (bar.close / d.prevClose - 1) * 100, value: bar.value,
        sourceAt: at, receivedAt: at, halted: false, executionUnknown: false, minuteValue: prev ? bar.value - prev.value! : undefined }
    }
    const result = tickSurge(state, pool, quotes, at, config)
    state = result.state; events.push(...result.events)
    if (snapshotsAt.includes(hhmm)) snapshots.push({ hhmm, themes: state.themes.filter(t => t.rank <= config.topThemes).map(t => ({
      name: t.name, turnover: t.turnover, leader: candidateFor(t, pool, quotes, config.gateWon, undefined, config)?.name })) })
  }
  return { state: state!, events, snapshots }
}
export const replayClock = (at: number) => clock(at).slice(11, 16)
