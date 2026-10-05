import { describe, expect, it, vi } from 'vitest'
vi.mock('../../prisma', () => ({ default: {} }))
import { formatNotification, wantsNotification, sendTelegram } from './notifications'
import { notificationConfig } from './config'
import { Event } from './engine'
const event: Event = { id: 'e', tradeId: 't', date: '2026-10-06', variant: 'v', at: Date.parse('2026-10-06T09:10:00+09:00'), kind: 'LEADER_CHANGE',
  trade: { id: 't', variant: 'v', code: '000001', name: 'A<&>', theme: 't', themeName: '조선', entryAt: Date.parse('2026-10-06T09:05:00+09:00'), entry: 100, lastAt: 1, lastPrice: 103, status: 'closed', dayPct: 8, turnover: 10e9, median: 3, themeRank: 2, excluded: false, exit: 103, grossPct: 3, netPct: 2.79 },
  next: { code: '000002', name: 'B&기업', dayPct: 12.4, theme: 't', themeName: '조선', turnover: 11e9, median: 3, themeRank: 2 }, previousPct: 8.1 }
describe('notification subscriber', () => {
  it('includes replacement identity and rate, escapes HTML, labels paper only', () => {
    const text = formatNotification(event)
    for (const part of ['A&lt;&amp;&gt;', 'B&amp;기업', '000002', '+12.40%', '+8.10%', '비용후 +2.79%', '주문 아님']) expect(text).toContain(part)
  })
  it('selects one complete variant and defaults stops/close off', () => {
    const cfg = { ...notificationConfig(), enabled: true, variant: 'v' }
    expect(wantsNotification(event, cfg)).toBe(true)
    expect(wantsNotification({ ...event, variant: 'other' }, cfg)).toBe(false)
    expect(wantsNotification({ ...event, kind: 'STOP_LOSS' }, cfg)).toBe(false)
    expect(wantsNotification({ ...event, kind: 'CLOSE' }, cfg)).toBe(false)
  })
  it('uses HTML and separates failures/429 retry delay from trading', async () => {
    const transport = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ parameters: { retry_after: 3 } }) })
    const cfg = { ...notificationConfig(), token: 'fake', chatId: 'fake' }
    expect(await sendTelegram('test', cfg, transport)).toMatchObject({ ok: false, retryAfterMs: 3000 })
    expect(JSON.parse(transport.mock.calls[0][1].body).parse_mode).toBe('HTML')
    transport.mockRejectedValue(new Error('timeout'))
    expect(await sendTelegram('test', cfg, transport)).toMatchObject({ ok: false, ambiguous: true })
  })
})
