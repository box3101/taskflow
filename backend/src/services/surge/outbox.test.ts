import { afterEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ logs: new Map<string, any>(), events: [] as any[], now: 0 }))
vi.mock('../../prisma', () => ({ default: {
  surgeEvent: { findMany: async () => m.events },
  notificationLog: {
    upsert: async ({ create }: any) => { if (!m.logs.has(create.id)) m.logs.set(create.id, { ...create, ok: false, attempts: 0, claimedAt: null, nextAt: new Date(m.now) }) },
    findMany: async () => [...m.logs.values()].filter(r => !r.ok && r.attempts < 2 && !r.claimedAt && r.nextAt.getTime() <= m.now).map(r => ({ ...r })),
    updateMany: async ({ where, data }: any) => { const r = m.logs.get(where.id); if (r.claimedAt || r.attempts !== where.attempts) return { count: 0 }; r.claimedAt = data.claimedAt; r.attempts++; return { count: 1 } },
    update: async ({ where, data }: any) => { Object.assign(m.logs.get(where.id), data) },
  },
} }))
import { drainNotifications } from './notifications'
import { variantId } from './config'
function setup() {
  m.now = Date.parse('2026-10-06T09:10:00+09:00'); vi.spyOn(Date, 'now').mockImplementation(() => m.now)
  vi.stubEnv('NOTIFY_ENABLED', 'true'); vi.stubEnv('TELEGRAM_BOT_TOKEN', 'fake'); vi.stubEnv('TELEGRAM_CHAT_ID', 'fake')
  const event = { id: 'entry1', tradeId: 't1', at: m.now, kind: 'ENTRY', variant: variantId(10e9, 180),
    trade: { name: 'A', code: '000001', themeName: '조선', entryAt: m.now, entry: 100, dayPct: 10, turnover: 20e9, median: 5, themeRank: 1 } }
  m.events = [{ id: event.id, payload: event }]
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); m.logs.clear(); m.events = [] })
describe('durable notification outbox', () => {
  it('does not resend a successfully delivered event on subsequent drains', async () => {
    setup(); const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); vi.stubGlobal('fetch', send)
    await drainNotifications(); await drainNotifications()
    expect(send).toHaveBeenCalledOnce(); expect(m.logs.get('entry1').ok).toBe(true)
  })
  it('honors 429 wait and retries only once without blocking recording', async () => {
    setup(); const send = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ parameters: { retry_after: 5 } }) }); vi.stubGlobal('fetch', send)
    await drainNotifications(); await drainNotifications(); expect(send).toHaveBeenCalledOnce()
    m.now += 5000; await drainNotifications(); expect(send).toHaveBeenCalledTimes(2)
    m.now += 10000; await drainNotifications(); expect(send).toHaveBeenCalledTimes(2)
    expect(m.logs.get('entry1').error).toBe('TELEGRAM_HTTP_429')
  })
})
