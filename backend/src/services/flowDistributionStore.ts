import prisma from '../prisma'
import { recordedFlow, type RecordedFlow } from './flowCollector'
import { buildFlowDistribution, type FlowDistribution } from './flowDistribution'

export async function captureFlowDistribution(record: RecordedFlow): Promise<FlowDistribution> {
  try {
    const cutoff = new Date(record.sample.observedAt)
    const dates = await prisma.flowSnapshot.findMany({
      where: { date: { lt: record.sample.date }, observedAt: { lt: cutoff, gte: new Date(cutoff.getTime() - 60 * 86400000) } },
      distinct: ['date'], select: { date: true }, orderBy: { date: 'desc' }, take: 20,
    })
    const time = new Date(cutoff.getTime() + 9 * 3600000).toISOString().slice(11, 19)
    const groups = await Promise.all(dates.map(async ({ date }) => {
      const target = Date.parse(`${date}T${time}+09:00`)
      // DB timestamps are minute-rounded; payload timestamps are checked precisely below.
      return prisma.flowSnapshot.findMany({ where: { date, observedAt: { gte: new Date(target - 150000), lte: new Date(target) } }, orderBy: { observedAt: 'desc' } })
    }))
    return buildFlowDistribution(record, groups.flat().flatMap(s => { const r = recordedFlow(s.payload); return r ? [r] : [] }))
  } catch {
    // Diagnostic failure must not discard a paid AI judgment.
    return { version: 'cash-same-time-v1', status: 'unavailable', metric: 'cash', asOf: record.sample.observedAt,
      unit: record.moneyUnits.cash, value: record.sample.values.cash, percentile: null, band: null, samples: [] }
  }
}
