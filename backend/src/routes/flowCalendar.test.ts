import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate, signToken } from '../middleware/auth'

const m = vi.hoisted(() => ({ snapshots: vi.fn(), reports: vi.fn(), predictions: vi.fn(), reviews: vi.fn() }))
vi.mock('../prisma', () => ({ default: { flowSnapshot: { groupBy: m.snapshots }, flowReport: { groupBy: m.reports }, flowPrediction: { groupBy: m.predictions }, flowExpertReview: { groupBy: m.reviews } } }))
import router from './flowCalendar'
const app = express(); app.use('/flow', authenticate, router)
const auth = `Bearer ${signToken({ id: 12, email: 'fixture@example.test', role: 'member' })}`
beforeEach(() => { vi.resetAllMocks(); Object.values(m).forEach(fn => fn.mockResolvedValue([])) })
describe('monthly market dashboard', () => {
  it('requires authentication and a valid month', async () => {
    expect((await request(app).get('/flow/calendar?month=2026-09')).status).toBe(401)
    for (const month of ['2026-13', '2026-00', '../x', '2026-9']) expect((await request(app).get('/flow/calendar').query({ month }).set('Authorization', auth)).status).toBe(400)
    expect(m.snapshots).not.toHaveBeenCalled()
  })
  it('aggregates counts without exposing document contents or other owners', async () => {
    m.snapshots.mockResolvedValue([{ date: '2026-09-22', _count: { _all: 390 } }])
    m.reports.mockResolvedValue([{ date: '2026-09-22', ragStatus: 'ready', _count: { _all: 1 } }, { date: '2026-09-22', ragStatus: 'pending', _count: { _all: 1 } }])
    m.predictions.mockResolvedValue([{ date: '2026-09-22', variant: 'flow', _count: { _all: 3 } }, { date: '2026-09-22', variant: 'rag', _count: { _all: 4 } }])
    m.reviews.mockResolvedValue([{ date: '2026-09-22', task: 'close', _count: { _all: 1 } }])
    const res = await request(app).get('/flow/calendar?month=2026-09').set('Authorization', auth)
    expect(res.status).toBe(200); expect(res.body.data.days).toHaveLength(30)
    expect(res.body.data.days[21]).toMatchObject({ records: 390, pdf: 2, pdfReady: 1, ai: 7, flowAi: 3, ragAi: 4, closingReviews: 1, retrospective: true })
    expect(res.body.data.days[20]).toMatchObject({ records: 0, pdf: 0, ai: 0, retrospective: false })
    for (const fn of [m.reports, m.predictions, m.reviews]) expect(fn.mock.calls[0][0].where).toEqual({ userId: 12, date: { gte: '2026-09-01', lt: '2026-10-01' } })
    expect(JSON.stringify(res.body)).not.toContain('payload')
  })
  it('handles leap days, year boundaries and storage failures', async () => {
    expect((await request(app).get('/flow/calendar?month=2028-02').set('Authorization', auth)).body.data.days).toHaveLength(29)
    await request(app).get('/flow/calendar?month=2026-12').set('Authorization', auth)
    expect(m.snapshots.mock.calls[1][0].where.date.lt).toBe('2027-01-01')
    m.snapshots.mockRejectedValueOnce(new Error('offline'))
    expect((await request(app).get('/flow/calendar?month=2026-09').set('Authorization', auth)).status).toBe(503)
  })
})
