import cron from 'node-cron'
import prisma from '../../prisma'
import { clock, Pool } from '../spikeCloudRules'
import { strategyPool as legacyPool } from '../leaderUniverse'
import { tickLeaderBreakout, breakoutSummary } from '../leaderBreakout'
import { isKisTradingDay, kisConfigured } from '../kisFlow'
import { surgeConfig, notificationConfig } from './config'
import { tickSurge, SurgeState, MarketQuote, summarize, themeBoard, candidateFor } from './engine'
import { fetchQuotes, executionStatus } from './market'
import { prepareUniverse, expandIntraday, loadUniverse, backfillHistory } from './universe'
import { drainNotifications } from './notifications'
import { contextConfig, runContextWorker } from './context'

type Payload = { engine?: SurgeState; quotes: Record<string, MarketQuote>; pool: Pool; broadAt: number; legacy?: ReturnType<typeof tickLeaderBreakout>; ranking?: unknown; error?: string; inactive?: string[] }
let busy = false, started = false, lastError: string | null = null, lastPrepareAt = 0
// The 08:30 batch runs once; retry during market hours until the universe is ready.
export function retryPrepare(date: string, now: number) {
  if (now - lastPrepareAt < Number(process.env.SURGE_PREPARE_RETRY_MS || 600000)) return
  lastPrepareAt = now
  void prepareUniverse(date).catch(() => {})
}
export const surgeEnabled = () => process.env.SURGE_ENABLED === 'true' || (process.env.SURGE_ENABLED !== 'false' &&
  (process.env.SPIKE_CLOUD_ENABLED === 'true' || (process.env.SPIKE_CLOUD_ENABLED !== 'false' && !!process.env.RAILWAY_ENVIRONMENT_ID)))
// Names with no usable quote today are left out of the board instead of blocking it.
export const activePool = (p: Payload): Pool => p.inactive?.length
  ? Object.fromEntries(Object.entries(p.pool).filter(([code]) => !p.inactive!.includes(code))) : p.pool
export function hotCodes(p: Payload, at: number) {
  const config = p.engine?.config || surgeConfig(), pool = activePool(p), board = themeBoard(pool, p.quotes, at, config)
  const held = p.engine?.arms.flatMap(a => a.trades.filter(t => t.status === 'holding').map(t => t.code)) || []
  const leaders = board.themes.filter(t => t.rank <= config.topThemes).flatMap(theme =>
    [...new Set([config.gateWon, ...config.comparisonGates])].flatMap(gate => {
      const c = candidateFor(theme, pool, p.quotes, gate); return c ? [c.code] : []
    }))
  const peers = board.themes.filter(t => t.rank <= config.topThemes).flatMap(t => t.codes)
    .sort((a, b) => p.quotes[b].dayPct - p.quotes[a].dayPct)
  return [...new Set([...held, ...leaders, ...peers])].slice(0, Math.max(config.hotLimit, held.length))
}
export async function collectSurge(now = Date.now()) {
  if (!surgeEnabled() || busy) return
  const local = clock(now), date = local.slice(0, 10), tm = local.slice(11, 19), weekday = new Date(local).getUTCDay()
  if (weekday === 0 || weekday === 6 || tm < '09:00:00' || tm > '15:32:00') return
  busy = true
  try {
    if (!kisConfigured() || !await isKisTradingDay(date)) return
    const saved = await prisma.surgeDay.findUnique({ where: { date } })
    const expectedAt = (saved?.payload as unknown as Payload)?.engine?.lastAt || 0
    const p: Payload = saved ? saved.payload as unknown as Payload : { quotes: {}, pool: {}, broadAt: 0 }
    if (!saved) {
      const previous = await prisma.spikeCloudDay.findUnique({ where: { date } })
      p.legacy = (previous?.payload as any)?.leaderBreakout
    }
    const config = p.engine?.config || surgeConfig()
    const broad = now - p.broadAt >= config.broadMs
    if (broad) {
      try { p.ranking = await expandIntraday(date, now) } catch { p.ranking = { error: 'RANKING_UNAVAILABLE' } }
      p.pool = await loadUniverse(date)
      p.error = Object.keys(p.pool).length ? undefined : '당일 모집단 배치가 준비되지 않았습니다. 기존 대조군만 관측합니다.'
      if (!Object.keys(p.pool).length) retryPrepare(date, now)
      const absent: string[] = []
      Object.assign(p.quotes, await fetchQuotes(Object.keys(p.pool), absent))
      // Holdings stay in the pool so their exit rules keep the last observed state.
      const held = new Set(p.engine?.arms.flatMap(a => a.trades.filter(t => t.status === 'holding').map(t => t.code)) || [])
      p.inactive = absent.filter(code => !held.has(code))
      for (const code of p.inactive) delete p.quotes[code]
      p.broadAt = Date.now()
    } else Object.assign(p.quotes, await fetchQuotes(hotCodes(p, now)))
    const at = Date.now()
    if (clock(at).slice(0, 10) !== date) return
    // Security/VI checks are read-only and limited to imminent entries and holdings.
    const checks = new Set(p.engine?.arms.flatMap(a => [
      ...a.trades.filter(t => t.status === 'holding').map(t => t.code),
      ...Object.values(a.timers).filter(t => at - t.since >= config.stableMs - config.intervalSeconds * 1000).map(t => t.code),
    ]) || [])
    for (const code of checks) if (p.quotes[code]) {
      try { Object.assign(p.quotes[code], await executionStatus(code, date)) }
      catch { p.quotes[code].executionUnknown = true }
    }
    for (const code of Object.keys(p.quotes)) if (!checks.has(code)) p.quotes[code].executionUnknown = true
    // The control keeps its original fixed universe and rules. Its collection is separate
    // from the expanded universe, which is never polled wholesale every ten seconds.
    const legacyQuotes = process.env.SURGE_LEGACY_ENABLED === 'false' ? null : await fetchQuotes(Object.keys(legacyPool))
    const capturedAt = Date.now()
    const result = tickSurge(p.engine, activePool(p), p.quotes, capturedAt, config)
    p.engine = result.state
    if (legacyQuotes) p.legacy = tickLeaderBreakout(p.legacy, legacyPool, legacyQuotes, capturedAt)
    await prisma.$transaction(async tx => {
      const locks = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(9283019) AS locked`
      if (!locks[0]?.locked) return
      const current = await tx.surgeDay.findUnique({ where: { date } })
      const oldAt = (current?.payload as unknown as Payload)?.engine?.lastAt || 0
      if (oldAt !== expectedAt) return
      await tx.surgeDay.upsert({ where: { date }, create: { date, payload: JSON.parse(JSON.stringify(p)) }, update: { payload: JSON.parse(JSON.stringify(p)) } })
      for (const arm of result.state.arms) for (const t of arm.trades) {
        const data = { date, variant: t.variant, ticker: t.code, entryAt: new Date(t.entryAt), exitAt: t.exitAt ? new Date(t.exitAt) : null,
          reason: t.reason || null, netPct: t.netPct ?? null, excluded: t.excluded, payload: JSON.parse(JSON.stringify(t)) }
        await tx.surgeTrade.upsert({ where: { id: t.id }, create: { id: t.id, ...data }, update: data })
      }
      for (const e of result.events) await tx.surgeEvent.upsert({ where: { id: e.id }, update: {}, create: {
        id: e.id, tradeId: e.tradeId, date, variant: e.variant, kind: e.kind, at: new Date(e.at), payload: JSON.parse(JSON.stringify(e)),
      } })
    }, { timeout: 30000 })
    lastError = p.error || null
  } catch (e) { lastError = e instanceof Error && e.message === 'UNIVERSE_NOT_READY' ? '당일 모집단 배치가 준비되지 않았습니다.' : '수집 지연 · 시세/거래일/DB 연결 확인 필요'; console.warn('[surge]', lastError) }
  finally { busy = false }
}
export function startSurge() {
  if (started) return
  started = true
  // Notification/context subscribers are independent of quote collection.
  cron.schedule('*/5 * * * * *', () => { void drainNotifications() }, { timezone: 'Asia/Seoul' })
  cron.schedule('*/1 * * * *', () => { void runContextWorker() }, { timezone: 'Asia/Seoul' })
  if (!surgeEnabled()) return
  cron.schedule(`*/${surgeConfig().intervalSeconds} * * * * *`, () => { void collectSurge() }, { timezone: 'Asia/Seoul' })
  cron.schedule('30 8 * * 1-5', () => {
    const date = clock(Date.now()).slice(0, 10)
    lastPrepareAt = Date.now()
    void isKisTradingDay(date).then(open => open ? prepareUniverse(date) : undefined).catch(() => {})
  }, { timezone: 'Asia/Seoul' })
  // After the close (every day, weekends included) fill missing 3-year surge history in chunks.
  cron.schedule('5 16 * * *', () => { void backfillHistory().catch(() => {}) }, { timezone: 'Asia/Seoul' })
  // Restart after the scheduled batch: prepare once, without backdating membership.
  const local = clock(Date.now()), date = local.slice(0, 10)
  if (local.slice(11, 19) >= '08:30:00') {
    lastPrepareAt = Date.now()
    void isKisTradingDay(date).then(open => open ? prepareUniverse(date) : undefined).catch(() => {})
  }
  void collectSurge()
}
export async function surgeDashboard() {
  const config = surgeConfig(), notify = notificationConfig()
  const [days, runs, batches, notifications] = await Promise.all([
    prisma.surgeDay.findMany({ orderBy: { date: 'desc' }, take: 60 }),
    prisma.surgeLlmRun.findMany({ orderBy: { runAt: 'desc' }, take: 30, select: { id: true, date: true, kind: true, model: true, parsedOk: true, error: true, payload: true } }),
    prisma.surgeBatch.findMany({ where: { date: { not: { startsWith: 'history:' } } }, orderBy: { date: 'desc' }, take: 5 }),
    prisma.notificationLog.findMany({ orderBy: { nextAt: 'desc' }, take: 20, select: { id: true, kind: true, ok: true, error: true, sentAt: true, attempts: true } }),
  ])
  return { config, enabled: surgeEnabled(), lastError, notifications: { enabled: notify.enabled, configured: !!(notify.token && notify.chatId), variant: notify.variant, recent: notifications },
    llm: contextConfig(), batchConfigured: !!(process.env.KRX_ID && process.env.KRX_PW), runs, batches, days: days.map(d => {
      const p = d.payload as unknown as Payload
      return { date: d.date, engine: p.engine, count: Object.keys(p.pool).length, inactive: p.inactive || [], ranking: p.ranking,
        summary: p.engine ? summarize(p.engine.arms) : [], legacy: p.legacy ? breakoutSummary(p.legacy) : null }
    }) }
}
