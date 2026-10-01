import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate, signToken } from '../middleware/auth'
import { analyzeFlow, FlowSample } from '../services/flowAnalysis'
import { closeAvailable, conflictSignals } from '../services/flowExpert'

const m = vi.hoisted(() => ({ existing: vi.fn(), list: vi.fn(), count: vi.fn(), create: vi.fn(), snapshot: vi.fn(), snapshots: vi.fn(), reports: vi.fn(), predictions: vi.fn(), generate: vi.fn() }))
vi.mock('../prisma', () => ({ default: {
  flowExpertReview: { findUnique: m.existing, findMany: m.list, count: m.count, create: m.create },
  flowSnapshot: { findUnique: m.snapshot, findMany: m.snapshots }, flowReport: { findMany: m.reports }, flowPrediction: { findMany: m.predictions },
} }))
vi.mock('../services/flowExpert', async () => ({ ...await vi.importActual<typeof import('../services/flowExpert')>('../services/flowExpert'), generateExpert: m.generate }))
import router from './flowExpert'
const app = express(); app.use(express.json()); app.use('/flow', authenticate, router)
const auth = `Bearer ${signToken({ id: 12, email: 'fixture@example.test', role: 'member' })}`
const at = '2026-09-22T00:15:00.000Z'
const sample: FlowSample = { date: '2026-09-22', observedAt: at, values: { cash: 10, futures: 20, nonArb: 30, totalNonArb: 40, kospi: 3000, kospiPct: 0 }, sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(k => [k, { status: 'ok', fetchedAt: at, sourceAt: null, message: null }])) as FlowSample['sources'] }
const record = { version: 1 as const, sample, analyses: { '15': analyzeFlow(sample, [], 15) }, moneyUnits: { cash: 'eok' as const, nonArb: 'eok' as const } }
const body = { date: sample.date, task: 'review', provider: 'anthropic', snapshotId: 7 }
const post = (data: object) => request(app).post('/flow/expert').set('Authorization', auth).send(data)
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('ANTHROPIC_API_KEY', 'fixture'); vi.stubEnv('OPENAI_API_KEY', '')
  m.existing.mockResolvedValue(null); m.list.mockResolvedValue([]); m.count.mockResolvedValue(0); m.create.mockResolvedValue({ id: 9 })
  m.snapshot.mockResolvedValue({ id: 7, payload: record }); m.snapshots.mockResolvedValue([{ id: 7, payload: record }])
  m.reports.mockResolvedValue([]); m.predictions.mockResolvedValue([])
  m.generate.mockResolvedValue({ direction: 'wait', summary: '대기', reasons: ['누락'], risks: ['불확실'], invalidation: ['추가 자료'], citations: [] })
})
afterEach(() => vi.unstubAllEnvs())
describe('expert analysis boundaries', () => {
  it('requires authentication and validates provider before requesting a model', async () => {
    expect((await request(app).post('/flow/expert').send(body)).status).toBe(401)
    expect((await post({ ...body, provider: 'unknown' })).status).toBe(400)
    expect((await post({ ...body, provider: 'openai' })).status).toBe(503)
    expect(m.generate).not.toHaveBeenCalled()
  })
  it('scopes the saved list to the current owner', async () => {
    expect((await request(app).get('/flow/expert?date=2026-09-22').set('Authorization', auth)).status).toBe(200)
    expect(m.list.mock.calls[0][0].where).toEqual({ userId: 12, date: sample.date, task: { in: ['review', 'close'] } })
  })
  it('isolates owners and forbids future records and PDFs in point-in-time review', async () => {
    expect((await post({ ...body, userId: 999 })).status).toBe(201)
    expect(m.reports.mock.calls[0][0].where).toMatchObject({ userId: 12, createdAt: { lte: new Date(at) } })
    expect(m.snapshots.mock.calls[0][0].where).toMatchObject({ observedAt: { lte: new Date(at) } })
    expect(m.create.mock.calls[0][0].data).toMatchObject({ userId: 12, task: 'review', provider: 'anthropic', payload: { cutoff: at, retrospective: false } })
  })
  it('allows later PDF uploads only for explicitly retrospective closing reviews', async () => {
    expect((await post({ ...body, task: 'close' })).status).toBe(201)
    expect(m.reports.mock.calls[0][0].where.createdAt.lte.getTime()).toBeGreaterThan(Date.parse(at))
    expect(m.create.mock.calls[0][0].data).toMatchObject({ task: 'close', snapshotId: 0, payload: { retrospective: true } })
  })
  it('does not regenerate, overwrite or bill an existing expert review', async () => {
    m.existing.mockResolvedValue({ id: 1 })
    expect((await post(body)).body.data.id).toBe(1)
    expect(m.generate).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled()
  })
  it('rejects missing/mismatched dates, rate limits and failed generation', async () => {
    expect((await post({ ...body, date: '2026-09-21' })).status).toBe(404)
    m.count.mockResolvedValueOnce(20)
    expect((await post(body)).status).toBe(429)
    m.generate.mockRejectedValue(new Error('invalid response'))
    expect((await post(body)).status).toBe(502)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('opens closing review only after 15:40 KST and identifies conflicting signs', () => {
    expect(closeAvailable(sample.date, new Date('2026-09-22T06:39:00Z'))).toBe(false)
    expect(closeAvailable(sample.date, new Date('2026-09-22T06:40:00Z'))).toBe(true)
    const r = { ...record, analyses: { '15': { ...record.analyses['15'], delta: { ...record.analyses['15'].delta, cash: 10, futures: -10 } } } }
    expect(conflictSignals(r)).toHaveLength(1)
  })
})
