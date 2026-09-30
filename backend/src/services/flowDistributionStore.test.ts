import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock('../prisma', () => ({ default: { flowSnapshot: { findMany: mocks.findMany } } }))
import { captureFlowDistribution } from './flowDistributionStore'
import type { RecordedFlow } from './flowCollector'
const record = { version: 1, moneyUnits: { cash: 'raw', nonArb: 'raw' }, analyses: {}, sample: {
  date: '2026-09-30', observedAt: '2026-09-30T01:00:20.000Z', values: { cash: 10 }, sources: { cash: { status: 'ok' } },
} } as RecordedFlow
beforeEach(() => vi.resetAllMocks())
it('queries only earlier dates and bounded same-time observations, retaining the source sample', async () => {
  const old = { ...record, sample: { ...record.sample, date: '2026-09-29', observedAt: '2026-09-29T01:00:10.000Z', values: { cash: 3 } } }
  mocks.findMany.mockResolvedValueOnce([{ date: '2026-09-29' }]).mockResolvedValueOnce([{ payload: old }])
  const result = await captureFlowDistribution(record)
  expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: { date: { lt: '2026-09-30' }, observedAt: { lt: new Date(record.sample.observedAt) } }, take: 20 })
  expect(mocks.findMany.mock.calls[1][0].where).toEqual({ date: '2026-09-29', observedAt: { gte: new Date('2026-09-29T00:57:50Z'), lte: new Date('2026-09-29T01:00:20Z') } })
  expect(result.samples).toEqual([{ date: '2026-09-29', observedAt: old.sample.observedAt, value: 3 }])
})
it('records unavailable without failing the prediction or inventing a percentile', async () => {
  mocks.findMany.mockRejectedValue(new Error('offline'))
  expect(await captureFlowDistribution(record)).toMatchObject({ status: 'unavailable', percentile: null, samples: [] })
})
