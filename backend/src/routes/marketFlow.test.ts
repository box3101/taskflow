import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ snapshots: vi.fn(), reports: vi.fn(), report: vi.fn(), create: vi.fn(), count: vi.fn(), remove: vi.fn() }))
vi.mock('../prisma', () => ({ default: { flowSnapshot: { findMany: mocks.snapshots }, flowReport: { findMany: mocks.reports, findFirst: mocks.report, create: mocks.create, count: mocks.count, deleteMany: mocks.remove } } }))
vi.mock('../services/flowCollector', async () => {
  const original = await vi.importActual<typeof import('../services/flowCollector')>('../services/flowCollector')
  return { ...original, collectorStatus: () => ({ configured: false, session: 'unconfigured', intervalSeconds: 60 }) }
})
import router from './marketFlow'
import { signToken } from '../middleware/auth'
const app = express(); app.use('/market-flow', router)
const authorization = `Bearer ${signToken({ id: 12, email: 'fixture@example.test', role: 'member' })}`

beforeEach(() => { vi.clearAllMocks(); mocks.snapshots.mockResolvedValue([]); mocks.reports.mockResolvedValue([]); mocks.count.mockResolvedValue(0) })
describe('market flow API', () => {
  it('serves retrospective price evidence separately from flow predictions', async () => {
    expect((await request(app).get('/market-flow/retrospective?date=2026-09-22')).status).toBe(401)
    const response = await request(app).get('/market-flow/retrospective?date=2026-09-22').set('Authorization', authorization)
    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ date: '2026-09-22', mode: 'retrospective', barCount: 393, previous: 7007.72 })
    expect(response.body.data.points).toHaveLength(393)
    expect(response.body.data.records).toBeUndefined()
    expect(mocks.snapshots).not.toHaveBeenCalled()
    const other = await request(app).get('/market-flow/retrospective?date=2026-09-23').set('Authorization', authorization)
    expect(other.body.data).toBeNull()
    expect((await request(app).get('/market-flow/retrospective?date=invalid').set('Authorization', authorization)).status).toBe(400)
  })
  it('requires authentication', async () => {
    expect((await request(app).get('/market-flow')).status).toBe(401)
    expect(mocks.snapshots).not.toHaveBeenCalled()
  })
  it('rejects malformed and impossible dates', async () => {
    for (const date of ['2026-02-30', '2026-13-01', '../secret']) expect((await request(app).get('/market-flow').query({ date }).set('Authorization', authorization)).status).toBe(400)
    expect(mocks.snapshots).not.toHaveBeenCalled()
  })
  it('returns a truthful empty state and scopes PDF metadata to its owner', async () => {
    const response = await request(app).get('/market-flow?date=2026-09-22').set('Authorization', authorization)
    expect(response.status).toBe(200)
    expect(response.body.data.records).toEqual([])
    expect(response.body.data.status.configured).toBe(false)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(mocks.reports.mock.calls[0][0].where).toEqual({ userId: 12, date: '2026-09-22' })
  })
  it('reports unavailable storage instead of pretending collection succeeded', async () => {
    mocks.snapshots.mockRejectedValue(new Error('database unavailable'))
    const response = await request(app).get('/market-flow').set('Authorization', authorization)
    expect(response.status).toBe(503)
    expect(response.body.status.storageReady).toBe(false)
  })
  it('does not expose another user PDF', async () => {
    mocks.report.mockResolvedValue(null)
    expect((await request(app).get('/market-flow/reports/7').set('Authorization', authorization)).status).toBe(404)
    expect(mocks.report.mock.calls[0][0].where).toEqual({ id: 7, userId: 12 })
  })
  it('rejects non-PDF bytes even with a pdf extension', async () => {
    const response = await request(app).post('/market-flow/reports').set('Authorization', authorization).field('date', '2026-09-22').attach('file', Buffer.from('<html>not a pdf</html>'), { filename: 'fake.pdf', contentType: 'application/pdf' })
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('saves PDF bytes with server-derived ownership and limits note size', async () => {
    mocks.create.mockResolvedValue({ id: 1, filename: 'report.pdf', date: '2026-09-22' })
    const response = await request(app).post('/market-flow/reports').set('Authorization', authorization).field('date', '2026-09-22').field('note', 'a'.repeat(4500)).attach('file', Buffer.from('%PDF-1.4\nfixture'), { filename: 'report.pdf', contentType: 'application/pdf' })
    expect(response.status).toBe(201)
    expect(mocks.create.mock.calls[0][0].data.userId).toBe(12)
    expect(mocks.create.mock.calls[0][0].data.note).toHaveLength(4000)
  })
})
