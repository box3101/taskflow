import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate, signToken } from '../middleware/auth'
import { analyzeFlow, FlowSample } from '../services/flowAnalysis'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), snapshot: vi.fn(), snapshots: vi.fn(), reports: vi.fn(), report: vi.fn(), update: vi.fn(), generate: vi.fn(), extract: vi.fn() }))
vi.mock('../prisma', () => ({ default: { $transaction: (rows: Promise<unknown>[]) => Promise.all(rows), flowPrediction: { findUnique: mocks.findUnique, findMany: mocks.findMany, count: mocks.count, create: mocks.create }, flowSnapshot: { findUnique: mocks.snapshot, findMany: mocks.snapshots }, flowReport: { findMany: mocks.reports, findFirst: mocks.report, updateMany: mocks.update } } }))
vi.mock('../services/flowAgent', async () => ({ ...await vi.importActual<typeof import('../services/flowAgent')>('../services/flowAgent'), generateJudgment: mocks.generate, agentConfig: () => ({ configured: true, model: 'fixture', version: 'v1' }) }))
vi.mock('../services/flowRag', async () => ({ ...await vi.importActual<typeof import('../services/flowRag')>('../services/flowRag'), extractPdf: mocks.extract }))
import router from './flowAgent'
const app = express(); app.use(express.json()); app.use('/flow', authenticate, router)
const authorization = `Bearer ${signToken({ id: 12, email: 'fixture@example.test', role: 'member' })}`
const at = '2026-09-22T00:15:00.000Z'
const sample: FlowSample = { date: '2026-09-22', observedAt: at, values: { cash: 10, futures: 20, nonArb: 30, totalNonArb: 40, kospi: 3000, kospiPct: 0 }, sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(key => [key, { status: 'ok', fetchedAt: at, sourceAt: null, message: null }])) as FlowSample['sources'] }
const record = { version: 1, sample, analyses: { '15': analyzeFlow(sample, [], 15) }, moneyUnits: { cash: 'eok', nonArb: 'eok' } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.findUnique.mockResolvedValue(null); mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([])
  mocks.snapshot.mockResolvedValue({ id: 7, payload: record }); mocks.snapshots.mockResolvedValue([])
  mocks.reports.mockResolvedValue([]); mocks.create.mockResolvedValue({ id: 1 })
  mocks.generate.mockResolvedValue({ direction: 'wait', summary: '대기', reasons: ['누락'], risks: ['관측 부족'], invalidation: ['추가 수집'], citations: [] })
})
describe('flow agent routes', () => {
  it('compares identical inputs with and without PDF and a shared evaluation start', async () => {
    mocks.reports.mockResolvedValue([{ id: 5, filename: 'report.pdf', date: sample.date, createdAt: new Date(at), ragChunks: [{ page: 1, text: '코스피 외국인 현물 선물 비차익 분석' }] }])
    const response = await request(app).post('/flow/agent/compare').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })
    expect(response.status).toBe(201)
    expect(mocks.generate.mock.calls[0]).toEqual([record, [], 15])
    expect(mocks.generate.mock.calls[1][0]).toEqual(record)
    expect(mocks.generate.mock.calls[1][1]).toHaveLength(1)
    const [flow, rag] = mocks.create.mock.calls.map(c => c[0].data)
    expect([flow.variant, rag.variant]).toEqual(['flow', 'rag'])
    expect(flow.payload.generatedAt).toBe(rag.payload.generatedAt)
    expect(flow.payload.comparisonId).toBe(rag.payload.comparisonId)
    expect(flow.payload.evidence).toEqual([])
    expect(rag.payload.evidence).toHaveLength(1)
    expect(flow.payload.validationContext).toMatchObject({ status: 'insufficient', samples: [] })
    expect(rag.payload.validationContext).toEqual(flow.payload.validationContext)
    expect(mocks.generate.mock.calls[0][0]).not.toHaveProperty('validationContext')
  })
  it('does not save half a comparison when one generation fails', async () => {
    mocks.generate.mockRejectedValueOnce(new Error('failed'))
    expect((await request(app).post('/flow/agent/compare').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })).status).toBe(502)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('requires authentication and validates input before calling AI', async () => {
    expect((await request(app).post('/flow/agent').send({ snapshotId: 7, horizon: 15 })).status).toBe(401)
    expect((await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 7 })).status).toBe(400)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('does not regenerate an existing prediction', async () => {
    mocks.findUnique.mockResolvedValue({ id: 4 })
    const response = await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })
    expect(response.body.data.id).toBe(4)
    expect(mocks.findUnique.mock.calls[0][0].where.userId_snapshotId_horizon_variant).toEqual({ userId: 12, snapshotId: 7, horizon: 15, variant: 'rag' })
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('only sends owned documents known by the observation and saves a reproducible input', async () => {
    const response = await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 30, userId: 999 })
    expect(response.status).toBe(201)
    expect(mocks.reports.mock.calls[0][0].where).toMatchObject({ userId: 12, date: { lte: '2026-09-22' }, createdAt: { lte: new Date(at) }, ragStatus: 'ready' })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ userId: 12, snapshotId: 7, horizon: 30, payload: { record, cutoff: at } })
  })
  it('does not persist failed model responses', async () => {
    mocks.generate.mockRejectedValue(new Error('invalid output'))
    expect((await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })).status).toBe(502)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('preserves a paid judgment even if diagnostic history cannot be read', async () => {
    mocks.snapshots.mockRejectedValue(new Error('diagnostic query failed'))
    const response = await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })
    expect(response.status).toBe(201)
    expect(mocks.create.mock.calls[0][0].data.payload.validationContext.status).toBe('unavailable')
    expect(mocks.generate.mock.calls[0][0]).not.toHaveProperty('validationContext')
  })
  it('limits costly generations before making the request', async () => {
    mocks.count.mockResolvedValue(80)
    expect((await request(app).post('/flow/agent').set('Authorization', authorization).send({ snapshotId: 7, horizon: 15 })).status).toBe(429)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('scopes evaluation and PDF lists to the authenticated user', async () => {
    const response = await request(app).get('/flow/agent?date=2026-09-22').set('Authorization', authorization)
    expect(response.status).toBe(200)
    expect(response.body.data.stats[0].accuracy).toBeNull()
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ userId: 12, date: '2026-09-22' })
    expect(mocks.reports.mock.calls[0][0].where.userId).toBe(12)
    expect((await request(app).get('/flow/agent?date=2026-02-30').set('Authorization', authorization)).status).toBe(400)
  })
  it('does not index another user PDF', async () => {
    mocks.report.mockResolvedValue(null)
    expect((await request(app).post('/flow/reports/5/index').set('Authorization', authorization)).status).toBe(404)
    expect(mocks.report.mock.calls[0][0].where).toEqual({ id: 5, userId: 12 })
    expect(mocks.extract).not.toHaveBeenCalled()
  })
  it('stores extraction failure honestly and allows a later retry', async () => {
    mocks.report.mockResolvedValue({ id: 5, content: new Uint8Array(), ragStatus: 'pending' })
    mocks.extract.mockRejectedValueOnce(new Error('읽을 수 없는 PDF'))
    expect((await request(app).post('/flow/reports/5/index').set('Authorization', authorization)).status).toBe(422)
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ where: { id: 5, userId: 12 }, data: { ragStatus: 'error' } })
    mocks.extract.mockResolvedValue([{ page: 1, text: '현물 수급 분석' }])
    expect((await request(app).post('/flow/reports/5/index').set('Authorization', authorization)).status).toBe(200)
    expect(mocks.update.mock.calls[1][0].data.ragStatus).toBe('ready')
  })
})
