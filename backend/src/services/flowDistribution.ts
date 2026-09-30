import type { RecordedFlow } from './flowCollector'
import { koreanClock } from './flowAnalysis'

export interface FlowDistribution {
  version: 'cash-same-time-v1'
  status: 'ready' | 'insufficient' | 'unavailable'
  metric: 'cash'
  asOf: string
  unit: string
  value: number | null
  percentile: number | null
  band: 'upper' | 'middle' | 'lower' | null
  samples: { date: string; observedAt: string; value: number }[]
}

// Diagnostic only. Keep this outside RecordedFlow so it never enters the AI prompt.
export function buildFlowDistribution(record: RecordedFlow, history: RecordedFlow[]): FlowDistribution {
  const current = record.sample, cutoff = Date.parse(current.observedAt)
  const clock = koreanClock(new Date(cutoff))
  const result: FlowDistribution = { version: 'cash-same-time-v1', status: 'insufficient', metric: 'cash',
    asOf: current.observedAt, unit: record.moneyUnits.cash, value: current.values.cash,
    percentile: null, band: null, samples: [] }
  if (!Number.isFinite(cutoff) || clock.date !== current.date || clock.minute < 540 || clock.minute > 930 ||
    current.sources.cash?.status !== 'ok' || !Number.isFinite(current.values.cash)) return result
  const oldest = cutoff - 60 * 86400000
  const candidates = history.filter(r => r.sample.date < current.date && Date.parse(r.sample.observedAt) >= oldest && Date.parse(r.sample.observedAt) < cutoff)
  const dates = [...new Set(candidates.map(r => r.sample.date))].sort().reverse().slice(0, 20)
  for (const date of dates) {
    const time = new Date(cutoff + 9 * 3600000).toISOString().slice(11, 23)
    const target = Date.parse(`${date}T${time}+09:00`)
    // At most one observation per date, no later than the matching wall-clock time.
    const row = candidates.filter(r => r.sample.date === date &&
      Date.parse(r.sample.observedAt) <= target && Date.parse(r.sample.observedAt) >= target - 90000 &&
      koreanClock(new Date(r.sample.observedAt)).date === date &&
      koreanClock(new Date(r.sample.observedAt)).minute >= 540 &&
      r.moneyUnits.cash === record.moneyUnits.cash && r.sample.sources.cash?.status === 'ok' && Number.isFinite(r.sample.values.cash))
      .sort((a, b) => b.sample.observedAt.localeCompare(a.sample.observedAt))[0]
    if (row) result.samples.push({ date, observedAt: row.sample.observedAt, value: row.sample.values.cash! })
  }
  if (result.samples.length < 10) return result
  const less = result.samples.filter(r => r.value < current.values.cash!).length
  const equal = result.samples.filter(r => r.value === current.values.cash).length
  result.percentile = (less + equal / 2) / result.samples.length * 100
  result.band = result.percentile >= 80 ? 'upper' : result.percentile <= 20 ? 'lower' : 'middle'
  result.status = 'ready'
  return result
}
