import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeFlow, FlowSample } from './flowAnalysis'
const mocks = vi.hoisted(() => ({ reports: vi.fn(), calendar: vi.fn(), snapshot: vi.fn(), count: vi.fn(), reserve: vi.fn(), update: vi.fn(), create: vi.fn(), transaction: vi.fn(), generate: vi.fn(), jobs: vi.fn() }))
vi.mock('../prisma', () => ({ default: { flowReport: { findMany: mocks.reports }, flowSnapshot: { findFirst: mocks.snapshot }, flowPrediction: { count: mocks.count, create: mocks.create }, flowAutoRun: { create: mocks.reserve, update: mocks.update, findMany: mocks.jobs }, $transaction: mocks.transaction } }))
vi.mock('./kisFlow', () => ({ kisConfigured: () => true, isKisTradingDay: mocks.calendar }))
vi.mock('./flowAgent', async () => ({ ...await vi.importActual<typeof import('./flowAgent')>('./flowAgent'), generateJudgment: mocks.generate, agentConfig: () => ({ configured: true, model: 'fixture' }) }))
import { automationSlot, runFlowAutomation, automationStatus } from './flowAutomation'
const at = new Date('2026-09-22T00:15:20Z')
function sample(minute: number): FlowSample {
  const time = new Date(Date.UTC(2026, 8, 22, 0, minute, 10)).toISOString()
  return { date: '2026-09-22', observedAt: time, values: { cash: minute, futures: minute, nonArb: minute, totalNonArb: minute, kospi: 3000 + minute, kospiPct: 0 }, sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(k => [k, { status: 'ok', fetchedAt: time, sourceAt: null, message: null }])) as FlowSample['sources'] }
}
function record() { const history = Array.from({ length: 16 }, (_, i) => sample(i)); return { version: 1, sample: history[15], analyses: { '15': analyzeFlow(history[15], history.slice(0, 15), 15) }, moneyUnits: { cash: 'raw', nonArb: 'raw' } } }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at)
  vi.stubEnv('FLOW_AUTO_ENABLED', 'true'); vi.stubEnv('FLOW_AUTO_USER_ID', '41')
  mocks.reports.mockResolvedValue([]); mocks.calendar.mockResolvedValue(true); mocks.snapshot.mockResolvedValue({ id: 7, payload: record() }); mocks.count.mockResolvedValue(0)
  mocks.reserve.mockResolvedValue({ id: 1 }); mocks.update.mockResolvedValue({}); mocks.create.mockResolvedValue({ id: 9 }); mocks.transaction.mockImplementation((items: Promise<unknown>[]) => Promise.all(items))
  mocks.generate.mockResolvedValue({ direction: 'up', summary: '수급 유입', reasons: ['관측'], risks: ['변동'], invalidation: ['역전'], citations: [] })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
describe('durable cloud flow scheduler', () => {
  it('has exactly 26 weekday slots, excludes weekend, close and late catch-up', () => {
    const slots = Array.from({ length: 1440 }, (_, m) => automationSlot(new Date(Date.UTC(2026, 8, 21, 15, m)))).filter(s => s !== null)
    expect(new Set(slots).size).toBe(26)
    expect(automationSlot(new Date('2026-09-26T00:15:20Z'))).toBeNull()
    expect(automationSlot(new Date('2026-09-22T06:15:20Z'))).toBe(915)
    expect(automationSlot(new Date('2026-09-22T06:30:20Z'))).toBe(930)
    expect(automationSlot(new Date('2026-09-22T06:33:00Z'))).toBeNull()
    expect(automationSlot(new Date('2026-09-22T06:45:00Z'))).toBeNull()
    expect(automationSlot(new Date('2026-09-22T00:18:00Z'))).toBeNull()
  })
  it('does not call AI on exchange holidays or when calendar lookup fails', async () => {
    mocks.calendar.mockResolvedValue(false); await runFlowAutomation(at)
    mocks.calendar.mockRejectedValue(new Error('calendar unavailable')); await runFlowAutomation(at)
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('does not pay for stale, incomplete or warming-up observations', async () => {
    for (const payload of [ { ...record(), sample: sample(12) }, { ...record(), analyses: { '15': { ...record().analyses['15'], baselineAt: null } } }, { ...record(), sample: { ...sample(15), values: { ...sample(15).values, totalNonArb: null } } } ]) {
      mocks.snapshot.mockResolvedValue({ id: 7, payload }); await runFlowAutomation(at)
    }
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('reserves before the paid call and persists a flow-only live forecast atomically', async () => {
    mocks.generate.mockImplementation(async () => { expect(mocks.reserve).toHaveBeenCalledOnce(); return { direction: 'wait' } })
    await runFlowAutomation(at)
    expect(mocks.generate).toHaveBeenCalledWith(record(), [], 15)
    expect(mocks.reserve).toHaveBeenCalledWith({ data: { userId: 41, date: '2026-09-22', slot: 555, snapshotId: 7, reservedCalls: 1 } })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ userId: 41, variant: 'flow', mode: 'live', horizon: 15 })
    expect(mocks.create.mock.calls[0][0].data.payload.validationContext.status).toBe('unavailable')
    expect(mocks.generate.mock.calls[0][0]).not.toHaveProperty('validationContext')
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })
  it('does not call again when a different process already reserved the slot', async () => {
    mocks.reserve.mockRejectedValue({ code: 'P2002' }); await runFlowAutomation(at)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('does not retry an uncertain paid call after failure or restart', async () => {
    mocks.generate.mockRejectedValue({ status: 429 }); await runFlowAutomation(at)
    expect(mocks.update.mock.calls[0][0].data.status).toBe('failed')
    mocks.reserve.mockRejectedValue({ code: 'P2002' }); await runFlowAutomation(at)
    expect(mocks.generate).toHaveBeenCalledOnce()
  })
  it('does not reserve or call when disabled, or an existing forecast is present', async () => {
    vi.stubEnv('FLOW_AUTO_ENABLED', 'false'); await runFlowAutomation(at)
    vi.stubEnv('FLOW_AUTO_ENABLED', 'true'); mocks.count.mockResolvedValue(1); await runFlowAutomation(at)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it('keeps another user from seeing the owner job history', async () => {
    expect(await automationStatus(45, '2026-09-22')).toEqual({ enabled: false })
    expect(mocks.jobs).not.toHaveBeenCalled()
  })
})

it('passes only available PDF excerpts to the single paid call and stores the same evidence', async () => {
  const doc = { id: 1, filename: 'morning.pdf', date: '2026-09-22', createdAt: new Date('2026-09-22T00:00:00Z'), ragChunks: Array.from({length: 9}, (_, i) => ({ page: i + 1, text: '코스피 외국인 현물 선물 비차익 수급 관련 오전 전망' })) }
  mocks.reports.mockResolvedValue([doc, {...doc,id:2,createdAt:new Date('2026-09-22T00:16:00Z')}, {...doc,id:3,date:'2026-09-23'}, {...doc,id:4,date:'2026-09-21'}])
  await runFlowAutomation(at)
  expect(mocks.reports).toHaveBeenCalledWith(expect.objectContaining({where:{userId:41,ragStatus:'ready',date:'2026-09-22',createdAt:{lte:new Date(sample(15).observedAt)}}}))
  expect(mocks.generate).toHaveBeenCalledOnce()
  const evidence = mocks.generate.mock.calls[0][1]
  expect(evidence).toHaveLength(6)
  expect(evidence.every((e: {reportId:number}) => e.reportId === 1)).toBe(true)
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({variant:'rag',payload:{evidence}})
  expect(mocks.reserve.mock.calls[0][0].data.reservedCalls).toBe(1)
})
it('skips the paid call if PDF retrieval makes the observation stale', async () => {
  mocks.reports.mockImplementation(async () => {vi.setSystemTime(new Date(at.getTime()+120000));return []})
  await runFlowAutomation(at)
  expect(mocks.generate).not.toHaveBeenCalled()
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({status:'skipped',reservedCalls:0})
})
