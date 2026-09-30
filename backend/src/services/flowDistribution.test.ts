import { expect, it } from 'vitest'
import { buildFlowDistribution } from './flowDistribution'
import type { RecordedFlow } from './flowCollector'

function row(day: number, value: number, time = '10:00:00'): RecordedFlow {
  const date = `2026-09-${String(day).padStart(2, '0')}`
  return { version: 1, moneyUnits: { cash: 'raw', nonArb: 'raw' }, analyses: {}, sample: {
    date, observedAt: new Date(`${date}T${time}+09:00`).toISOString(),
    values: { cash: value, futures: 0, nonArb: 0, totalNonArb: 0, kospi: 3000, kospiPct: 0 },
    sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(k => [k, { status: 'ok' }])) as any,
  } }
}
it('uses signed cash levels, one sample per prior day, and never mutates AI input', () => {
  const current = row(30, -1), before = JSON.stringify(current)
  const history = Array.from({ length: 20 }, (_, i) => row(i + 1, i - 21))
  const result = buildFlowDistribution(current, [...history, row(20, -999, '09:59:00'), row(30, 999)])
  expect(result.samples).toHaveLength(20)
  expect(result.percentile).toBe(100)
  expect(result.band).toBe('upper') // Upper does not necessarily mean net buying.
  expect(JSON.stringify(current)).toBe(before)
})
it('treats ties neutrally and requires ten valid same-unit days', () => {
  const history = Array.from({ length: 10 }, (_, i) => row(i + 1, 5))
  expect(buildFlowDistribution(row(30, 5), history)).toMatchObject({ status: 'ready', percentile: 50, band: 'middle' })
  history[0]!.moneyUnits.cash = 'won'
  expect(buildFlowDistribution(row(30, 5), history)).toMatchObject({ status: 'insufficient', percentile: null, band: null })
})
it('rejects future time-of-day, stale, missing, and future-day observations', () => {
  const missing = row(3, 1); missing.sample.sources.cash.status = 'error'
  const result = buildFlowDistribution(row(29, 2), [row(1, 1, '10:00:01'), row(2, 1, '09:58:29'), missing, row(30, 1), row(4, 1, '09:58:30')])
  expect(result.samples.map(r => r.date)).toEqual(['2026-09-04'])
})
it('caps the reference at the most recent twenty recorded dates', () => {
  const result = buildFlowDistribution(row(30, 100), Array.from({ length: 29 }, (_, i) => row(i + 1, i)))
  expect(result.samples).toHaveLength(20)
  expect(result.samples.at(-1)?.date).toBe('2026-09-10')
})
