import cron from 'node-cron'
import prisma from '../prisma'
import { analyzeFlow, FLOW_WINDOWS, FlowAnalysis, FlowSample, isCollectionTime, koreanClock } from './flowAnalysis'
import { fetchKisFlow, isKisTradingDay, kisConfigured } from './kisFlow'

export type MoneyUnit = 'raw' | 'won' | 'million' | 'eok'
export interface RecordedFlow {
  signals?: import('./flowSignals').FlowSignals
  signalsError?: string
  dayContext?: import('./flowDayContext').DayContext
  previousDayContext?: import('./flowPreviousDay').PreviousDayContext
  version: 1
  sample: FlowSample
  analyses: Record<string, FlowAnalysis>
  moneyUnits: { cash: MoneyUnit; nonArb: MoneyUnit }
}
let collecting: Promise<void> | null = null
let lastAttempt = 0
let lastError: string | null = null
let session = 'waiting'
function moneyUnit(value: string | undefined): MoneyUnit {
  return ['won', 'million', 'eok'].includes(value || '') ? value as MoneyUnit : 'raw'
}
export function collectorStatus() {
  return {
    configured: kisConfigured(), intervalSeconds: 60,
    session: !kisConfigured() ? 'unconfigured' : isCollectionTime() ? session : 'outside',
    lastError,
    moneyUnits: { cash: moneyUnit(process.env.KIS_CASH_AMOUNT_UNIT), nonArb: moneyUnit(process.env.KIS_PROGRAM_AMOUNT_UNIT) },
  }
}
export function recordedFlow(payload: unknown): RecordedFlow | null {
  const value = payload as RecordedFlow | null
  return value?.version === 1 && value.sample && value.analyses && value.moneyUnits ? value : null
}
export async function collectFlow(now = new Date()): Promise<void> {
  if (collecting) return collecting
  if (!kisConfigured() || !isCollectionTime(now) || Date.now() - lastAttempt < 55_000) return
  lastAttempt = Date.now()
  collecting = (async () => {
    const date = koreanClock(now).date
    try {
      if (!await isKisTradingDay(date)) { session = 'holiday'; lastError = null; return }
      session = 'collecting'
      // This check precedes data retrieval, so an unavailable DB cannot create unrecorded forecasts.
      const previous = await prisma.flowSnapshot.findMany({ where: { date }, orderBy: { observedAt: 'asc' } })
      const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
      if (previous.some(row => Math.floor(row.observedAt.getTime() / 60_000) === Math.floor(now.getTime() / 60_000))) return
      const sample = await fetchKisFlow(now)
      // Record completed observations (not the start of the HTTP batch).
      sample.observedAt = new Date().toISOString()
      if (koreanClock(new Date(sample.observedAt)).date !== date) return
      const history = previous.map(row => recordedFlow(row.payload)?.sample).filter((s): s is FlowSample => Boolean(s))
      const analyses = Object.fromEntries(FLOW_WINDOWS.map(window => [String(window), analyzeFlow(sample, history, window)]))
      const payload: RecordedFlow = { version: 1, sample, analyses, moneyUnits: collectorStatus().moneyUnits }
      await prisma.flowSnapshot.upsert({ where: { observedAt: minute }, create: { date, observedAt: minute, payload: JSON.parse(JSON.stringify(payload)) }, update: {} })
      lastError = ['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].some(k => sample.sources[k as keyof typeof sample.sources].status !== 'ok') ? '일부 데이터 조회 실패 · 항목별 상태를 확인하세요.' : null
      session = lastError ? 'partial' : 'collecting'
    } catch (err) {
      session = 'error'
      const code = (err as { code?: string }).code
      lastError = code === 'P2021' ? '수급 기록 테이블이 없습니다. 서버 마이그레이션이 필요합니다.' : '수집 실패 · API 인증, 거래일 조회 및 데이터베이스 연결을 확인하세요.'
      console.warn('[market-flow]', lastError)
    }
  })()
  try { await collecting } finally { collecting = null }
}
export function startFlowCollector(afterCollect?: () => Promise<void>) {
  // Always registered: only configured servers call KIS, and only on verified trading days.
  const tick = async () => {
    await collectFlow()
    await afterCollect?.()
  }
  cron.schedule('* * * * *', () => { void tick().catch(() => console.warn('[market-flow] scheduled task failed')) }, { timezone: 'Asia/Seoul' })
  void tick().catch(() => console.warn('[market-flow] startup task failed'))
}
