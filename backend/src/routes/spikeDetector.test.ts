import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signToken } from '../middleware/auth'
const reader = vi.hoisted(() => vi.fn())
vi.mock('../services/averageSpike', async () => ({ ...await vi.importActual('../services/averageSpike'), averageSpike: reader }))
import router from './spikeDetector'
const app = express(); app.use('/spike-detector', router)
const token = (id: number) => `Bearer ${signToken({ id, email: 'fixture@example.test', role: 'member' })}`
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })
describe('Average spike record isolation', () => {
  it('requires authentication and restricts records to the configured owner', async () => {
    vi.stubEnv('AVERAGE_SPIKE_OWNER_ID', '12')
    expect((await request(app).get('/spike-detector')).status).toBe(401)
    expect((await request(app).get('/spike-detector').set('Authorization', token(13))).status).toBe(403)
    expect(reader).not.toHaveBeenCalled()
    reader.mockResolvedValue({ spike: { days: [], rule: {} } })
    expect((await request(app).get('/spike-detector').set('Authorization', token(12))).body.data.spike.days).toEqual([])
  })
  it('fails closed without an owner and hides filesystem errors', async () => {
    vi.stubEnv('AVERAGE_SPIKE_OWNER_ID', '')
    expect((await request(app).get('/spike-detector').set('Authorization', token(12))).status).toBe(503)
    expect(reader).not.toHaveBeenCalled()
    vi.stubEnv('AVERAGE_SPIKE_OWNER_ID', '12')
    reader.mockRejectedValue(new Error('private path or upstream details'))
    const res = await request(app).get('/spike-detector').set('Authorization', token(12))
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('private path')
  })
})
