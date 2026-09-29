import prisma from '../prisma'
import { recordedFlow, RecordedFlow } from './flowCollector'
import { agentConfig, agentErrorMessage, AGENT_VERSION, AgentPayload, generateJudgment, predictionMode } from './flowAgent'
import { koreanClock } from './flowAnalysis'
import { isKisTradingDay, kisConfigured } from './kisFlow'

// One owner, 24 slots/day, one flow-only call per slot. Reservations survive restart.
export function automationConfig() {
  const userId = Number(process.env.FLOW_AUTO_USER_ID)
  return { enabled: process.env.FLOW_AUTO_ENABLED === 'true' && Number.isSafeInteger(userId) && userId > 0,
    userId, intervalMinutes: 15, horizon: 15, maxCallsPerDay: 24, hours: '09:15–15:00 (한국시간)',
    configured: agentConfig().configured && kisConfigured() }
}
export function automationSlot(now: Date): number | null {
  const k = koreanClock(now)
  const slot = Math.floor(k.minute / 15) * 15
  // No late catch-up: only fresh data in the first three minutes of a slot.
  return k.day > 0 && k.day < 6 && slot >= 555 && slot <= 900 && k.minute - slot < 3 ? slot : null
}
export function usableAutomaticRecord(record: RecordedFlow, now: Date, slot: number) {
  const sample = record.sample, at = new Date(sample.observedAt), age = now.getTime() - at.getTime()
  return Number.isFinite(at.getTime()) && sample.date === koreanClock(now).date && koreanClock(at).minute >= slot && age >= 0 && age <= 90_000
    && Boolean(record.analyses['15']?.baselineAt)
    && (['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'] as const).every(key =>
      sample.sources[key]?.status === 'ok' && Number.isFinite(sample.values[key]) && Number.isFinite(record.analyses['15'].delta[key]))
}
let running = false
export async function runFlowAutomation(now = new Date()): Promise<void> {
  const config = automationConfig(), slot = automationSlot(now)
  if (running || !config.enabled || !config.configured || slot === null) return
  running = true
  let jobId: number | undefined
  try {
    const date = koreanClock(now).date, userId = config.userId
    if (!await isKisTradingDay(date)) return
    const snapshot = await prisma.flowSnapshot.findFirst({ where: { date }, orderBy: { observedAt: 'desc' } })
    const record = snapshot && recordedFlow(snapshot.payload)
    if (!snapshot || !record || !usableAutomaticRecord(record, now, slot)) return
    const cutoff = new Date(record.sample.observedAt)
    const existing = await prisma.flowPrediction.count({ where: { userId, snapshotId: snapshot.id, horizon: 15 } })
    if (existing) return
    // Atomic reservation comes BEFORE paid requests. Never retry an uncertain/failed slot.
    const job = await prisma.flowAutoRun.create({ data: { userId, date, slot, snapshotId: snapshot.id, reservedCalls: 1 } })
    jobId = job.id
    const requested = new Date()
    if (automationSlot(requested) !== slot || !usableAutomaticRecord(record, requested, slot)) {
      await prisma.flowAutoRun.update({ where: { id: job.id }, data: { status: 'skipped', reservedCalls: 0, message: '관측 지연으로 실행 생략', completedAt: new Date() } }); return
    }
    const judgment = await generateJudgment(record, [], 15)
    const generated = new Date()
    const payload: AgentPayload = { record, judgment, evidence: [], requestedAt: requested.toISOString(), generatedAt: generated.toISOString(), cutoff: cutoff.toISOString() }
    await prisma.$transaction([
      prisma.flowPrediction.create({ data: { userId, snapshotId: snapshot.id, date, horizon: 15, variant: 'flow', mode: predictionMode(record.sample, requested, generated),
        model: agentConfig().model, version: AGENT_VERSION, payload: JSON.parse(JSON.stringify(payload)) } }),
      prisma.flowAutoRun.update({ where: { id: job.id }, data: { status: 'completed', completedAt: generated } }),
    ])
    console.log(`[flow-auto] ${date} slot=${slot} saved=1 status=completed`)
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') {
      const detail = error as { code?: string; status?: number; stopReason?: string; outputTokens?: number }
      console.warn('[flow-auto] 자동 분석 실패', { jobId, slot, code: detail.code, status: detail.status, stopReason: detail.stopReason, outputTokens: detail.outputTokens })
      if (jobId) await prisma.flowAutoRun.update({ where: { id: jobId }, data: { status: 'failed', message: `${agentErrorMessage(error)} 중복 과금 방지를 위해 자동 재시도하지 않습니다.`, completedAt: new Date() } }).catch(() => {})
    }
  } finally { running = false }
}

export async function automationStatus(userId: number, date: string) {
  const config = automationConfig()
  if (!config.enabled || config.userId !== userId) return { enabled: false }
  const jobs = await prisma.flowAutoRun.findMany({ where: { userId, date }, orderBy: { slot: 'desc' } })
  return { enabled: true, configured: config.configured, intervalMinutes: config.intervalMinutes, horizon: config.horizon, hours: config.hours,
    maxCallsPerDay: config.maxCallsPerDay, reservedCalls: jobs.reduce((n, j) => n + j.reservedCalls, 0),
    jobs: jobs.map(j => ({ slot: j.slot, status: j.status === 'running' && Date.now() - j.createdAt.getTime() > 300_000 ? 'interrupted' : j.status, message: j.message, createdAt: j.createdAt, completedAt: j.completedAt })) }
}
