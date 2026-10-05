import prisma from '../../prisma'
import { Event } from './engine'
import { notificationConfig } from './config'
import { clock } from '../spikeCloudRules'

export const escapeHtml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n?: number) => n == null ? '—' : Math.round(n).toLocaleString('ko-KR')
const pct = (n?: number) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const tm = (n: number) => clock(n).slice(11, 19)
const reasons = { STOP_LOSS: '손절', THEME_DROP: '테마 순위 이탈', LEADER_CHANGE: '대장 교체 확정', CLOSE: '장 마감' }
export function wantsNotification(e: Event, config = notificationConfig()) {
  return config.enabled && e.variant === config.variant && (e.kind === 'ENTRY' || e.kind === 'LEADER_CHANGE' || e.kind === 'THEME_DROP' ||
    (e.kind === 'STOP_LOSS' && config.stop) || (e.kind === 'CLOSE' && config.close))
}
export function formatNotification(e: Event) {
  const t = e.trade, lines = e.kind === 'ENTRY' ? [
    '<b>🟢 모의 진입 · 대장 유지 확인</b>', `종목  ${escapeHtml(t.name)} (${escapeHtml(t.code)})`,
    `테마  ${escapeHtml(t.themeName)} (거래대금 ${t.themeRank}위)`,
    `진입  ${money(t.entry)}원 · ${pct(t.dayPct)}`, `시각  ${tm(t.entryAt)}`,
    `거래대금 ${money(t.turnover / 100000000)}억 · 테마 중앙값 ${pct(t.median)}`,
  ] : [
    `<b>🟠 모의 청산 · ${reasons[e.kind]}</b>`, `종목  ${escapeHtml(t.name)} (${escapeHtml(t.code)})`,
    `진입 ${money(t.entry)} → 청산 ${money(t.exit)}원`, `수익 ${pct(t.grossPct)} · 비용후 ${pct(t.netPct)}`,
    `보유 ${tm(t.entryAt)} ~ ${tm(e.at)}`,
  ]
  if (e.kind === 'LEADER_CHANGE' && e.next) lines.push('', `새 대장  ${escapeHtml(e.next.name)} (${escapeHtml(e.next.code)}) ${pct(e.next.dayPct)}`,
    `직전 대장  ${escapeHtml(t.name)} ${pct(e.previousPct)}`)
  if (e.kind === 'THEME_DROP') lines.push(`${escapeHtml(t.themeName)} 테마 순위 이탈 · 현재 ${e.themeRank ?? '미확인'}위`, `현재 1위 테마  ${escapeHtml(e.topTheme)}`)
  if (e.blockedReason) lines.push(`새 대장 진입 차단: ${escapeHtml(e.blockedReason)}`)
  if (t.excluded) lines.push('관측 공백으로 성과 집계 제외')
  lines.push('※ 모의 기록입니다. 주문 아님')
  return lines.join('\n')
}
export type Delivery = { ok: boolean; error?: string; retryAfterMs?: number; ambiguous?: boolean }
export async function sendTelegram(text: string, config = notificationConfig(), transport: typeof fetch = fetch): Promise<Delivery> {
  if (!config.token || !config.chatId) return { ok: false, error: 'TELEGRAM_NOT_CONFIGURED' }
  try {
    const response = await transport(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    })
    const body = await response.json() as any
    if (response.ok && body.ok === true) return { ok: true }
    return { ok: false, error: `TELEGRAM_HTTP_${response.status}`, retryAfterMs: response.status === 429 ? Math.max(config.backoffMs, Number(body.parameters?.retry_after || 1) * 1000) : undefined }
  } catch { return { ok: false, error: 'TELEGRAM_DELIVERY_UNKNOWN', ambiguous: true } }
}
let busy = false
// Durable event subscriber. No network requests are made by the strategy transaction.
export async function drainNotifications() {
  const config = notificationConfig()
  if (busy || !config.enabled || !config.token || !config.chatId) return
  busy = true
  try {
    const events = await prisma.surgeEvent.findMany({ where: { at: { gte: new Date(Date.now() - config.maxAgeMs) } }, orderBy: [{ at: 'asc' }, { id: 'asc' }] })
    for (const row of events) {
      const e = row.payload as unknown as Event
      if (!wantsNotification(e, config)) continue
      await prisma.notificationLog.upsert({ where: { id: row.id }, update: {}, create: {
        id: row.id, tradeId: e.tradeId, kind: e.kind, payload: { text: formatNotification(e) },
      } })
    }
    const pending = await prisma.notificationLog.findMany({ where: { ok: false, attempts: { lt: config.maxAttempts }, nextAt: { lte: new Date() }, claimedAt: null }, orderBy: [{ nextAt: 'asc' }, { id: 'asc' }], take: 10 })
    for (const row of pending) {
      const claimed = await prisma.notificationLog.updateMany({ where: { id: row.id, claimedAt: null, attempts: row.attempts }, data: { claimedAt: new Date(), attempts: { increment: 1 } } })
      if (!claimed.count) continue
      const result = await sendTelegram((row.payload as any).text, config)
      await prisma.notificationLog.update({ where: { id: row.id }, data: {
        ok: result.ok, error: result.error || null, sentAt: result.ok ? new Date() : null,
        // Timeout/crash delivery is ambiguous: don't replay a potentially delivered message.
        claimedAt: result.ambiguous ? new Date() : null,
        nextAt: new Date(Date.now() + Math.max(result.retryAfterMs || 0, config.backoffMs * 2 ** (row.attempts + 1))),
      } })
    }
  } catch { console.warn('[surge-notify] delivery worker unavailable') }
  finally { busy = false }
}
