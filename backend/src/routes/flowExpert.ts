import { Router } from 'express'
import prisma from '../prisma'
import { recordedFlow } from '../services/flowCollector'
import { AgentPayload, agentErrorMessage } from '../services/flowAgent'
import { closeAvailable, compactTimeline, conflictSignals, EXPERT_VERSION, generateExpert } from '../services/flowExpert'
import { expertModels } from '../services/flowModels'
import { retrieveEvidence } from '../services/flowRag'

const router = Router()
const running = new Set<number>()
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
router.get('/expert', async (req, res) => {
  const date = req.query.date
  if (!validDate(date)) { res.status(400).json({ message: '조회 날짜를 확인하세요.' }); return }
  try {
    const rows = await prisma.flowExpertReview.findMany({ where: { userId: req.user!.id, date }, orderBy: { createdAt: 'desc' } })
    res.json({ data: { models: expertModels(), closeAvailable: closeAvailable(date), rows } })
  } catch { res.status(503).json({ message: '심층 검토 저장소를 사용할 수 없습니다. 마이그레이션과 연결을 확인하세요.' }) }
})
router.post('/expert', async (req, res) => {
  const userId = req.user!.id
  const { date, task, provider, snapshotId: suppliedId } = req.body || {}
  if (!validDate(date) || !['review', 'close'].includes(task) || !['anthropic', 'openai'].includes(provider) || (task === 'review' && (!Number.isSafeInteger(suppliedId) || suppliedId <= 0))) {
    res.status(400).json({ message: '날짜, 분석 종류, 모델, 관측 기록을 확인하세요.' }); return
  }
  const requested = new Date()
  if (task === 'close' && !closeAvailable(date, requested)) { res.status(422).json({ message: '장 마감 복기는 해당일 15:40 이후 실행할 수 있습니다.' }); return }
  if (running.has(userId)) { res.status(409).json({ message: '심층 분석을 생성 중입니다.' }); return }
  running.add(userId)
  try {
    const snapshotId = task === 'close' ? 0 : suppliedId
    const existing = await prisma.flowExpertReview.findUnique({ where: { userId_date_task_snapshotId_provider: { userId, date, task, snapshotId, provider } } })
    if (existing) { res.json({ data: { id: existing.id } }); return }
    const model = expertModels().find(m => m.provider === provider)!
    if (!model.configured) { res.status(503).json({ message: `${model.label} API 키 설정이 필요합니다.` }); return }
    if (await prisma.flowExpertReview.count({ where: { userId, createdAt: { gte: new Date(requested.getTime() - 86400_000) } } }) >= 20) { res.status(429).json({ message: '최근 24시간의 심층 분석 한도(20건)에 도달했습니다.' }); return }
    const snapshot = task === 'review' ? await prisma.flowSnapshot.findUnique({ where: { id: snapshotId } }) : null
    const chosen = snapshot && recordedFlow(snapshot.payload)
    if (task === 'review' && (!chosen || chosen.sample.date !== date)) { res.status(404).json({ message: '선택한 날짜의 관측 기록이 없습니다.' }); return }
    const cutoff = task === 'close' ? requested : new Date(chosen!.sample.observedAt)
    if (!Number.isFinite(cutoff.getTime()) || cutoff > requested) { res.status(422).json({ message: '관측 시각을 확인하세요.' }); return }
    const snapshots = await prisma.flowSnapshot.findMany({ where: { date, observedAt: { lte: cutoff } }, orderBy: { observedAt: 'asc' } })
    const records = snapshots.flatMap(s => { const r = recordedFlow(s.payload); return r && r.sample.date === date && new Date(r.sample.observedAt) <= cutoff ? [r] : [] })
    const record = chosen || records[records.length - 1]
    if (!record || !records.length) { res.status(404).json({ message: '분석할 수급 기록이 없습니다.' }); return }
    const documents = await prisma.flowReport.findMany({ where: { userId, ragStatus: 'ready', date, createdAt: { lte: cutoff } }, select: { id: true, filename: true, date: true, createdAt: true, ragChunks: true }, orderBy: { createdAt: 'desc' }, take: 100 })
    const evidence = retrieveEvidence(documents, `코스피 외국인 현물 선물 비차익 장전 시나리오 반도체 금리 상승 하락 무효화 ${record.analyses['15']?.title || ''}`, date, cutoff, 12)
    const predictions = await prisma.flowPrediction.findMany({ where: { userId, date, createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' }, take: 80 })
    const basicJudgments = predictions.flatMap(p => {
      const payload = p.payload as unknown as AgentPayload
      return payload.record?.sample.date === date && new Date(payload.record.sample.observedAt) <= cutoff ? [{ id: p.id, horizon: p.horizon, model: p.model, payload }] : []
    })
    const input = { date, cutoff: cutoff.toISOString(), record, timeline: compactTimeline(records), coverage: { count: records.length, first: records[0].sample.observedAt, last: records[records.length - 1].sample.observedAt }, evidence, basicJudgments }
    let judgment
    try { judgment = await generateExpert(provider, task, input) }
    catch (error) { res.status(502).json({ message: agentErrorMessage(error) }); return }
    const saved = await prisma.flowExpertReview.create({ data: { userId, date, task, snapshotId, provider, model: model.model, version: EXPERT_VERSION, payload: JSON.parse(JSON.stringify({ ...input, judgment, conflicts: conflictSignals(record), generatedAt: new Date().toISOString(), requestedAt: requested.toISOString(), retrospective: task === 'close' })) } })
    res.status(201).json({ data: { id: saved.id } })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { res.status(409).json({ message: '이미 저장된 분석입니다. 새로고침하세요.' }); return }
    res.status(503).json({ message: '심층 분석 저장에 실패했습니다. 저장소 연결을 확인하세요.' })
  } finally { running.delete(userId) }
})
export default router
