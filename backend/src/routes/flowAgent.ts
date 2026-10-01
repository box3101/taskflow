import { attachPriorReview } from '../services/flowCloseReview'
import { loadHistoricalEvidence } from '../services/flowHistorical'
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import prisma from '../prisma'
import { recordedFlow } from '../services/flowCollector'
import { agentConfig, agentErrorMessage, AGENT_VERSION, AgentPayload, evaluatePrediction, generateJudgment, predictionMode, summarizePredictions, summarizeRetrospectives } from '../services/flowAgent'
import { extractPdf, retrieveEvidence, historicalPolicy } from '../services/flowRag'
import { summarizeComparison } from '../services/flowAgent'
import { automationStatus } from '../services/flowAutomation'
import { captureFlowDistribution } from '../services/flowDistributionStore'

const router = Router()
const running = new Set<number>()
const indexing = new Set<number>()
router.get('/agent/automation', async (req, res) => {
  if (!validDate(req.query.date)) { res.status(400).json({ message: '조회 날짜를 확인하세요.' }); return }
  try { res.json({ data: await automationStatus(req.user!.id, req.query.date) }) }
  catch { res.status(503).json({ message: '자동 분석 실행 기록을 조회하지 못했습니다.' }) }
})
router.get('/agent/close-review', async (req,res)=>{
 if(!validDate(req.query.date)){res.status(400).json({message:'조회 날짜를 확인하세요.'});return}
 try{const row=await prisma.flowExpertReview.findFirst({where:{userId:req.user!.id,date:req.query.date,task:'auto-recap'},orderBy:{createdAt:'desc'},select:{payload:true,createdAt:true,version:true}});res.json({data:row})}
 catch{res.status(503).json({message:'장 마감 복기를 조회하지 못했습니다.'})}
})
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
function message(error: unknown) { return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' }

router.get('/agent', async (req, res) => {
  const date = req.query.date
  if (!validDate(date)) { res.status(400).json({ message: '조회 날짜를 확인하세요.' }); return }
  try {
    const [predictions, snapshots, reports] = await Promise.all([
      prisma.flowPrediction.findMany({ where: { userId: req.user!.id, date }, orderBy: { createdAt: 'desc' } }),
      prisma.flowSnapshot.findMany({ where: { date }, orderBy: { observedAt: 'asc' } }),
      prisma.flowReport.findMany({ where: { userId: req.user!.id, date }, select: { id: true, date: true, filename: true, createdAt: true, ragStatus: true, ragError: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ])
    const samples = snapshots.flatMap(s => { const record = recordedFlow(s.payload); return record ? [record.sample] : [] })
    const rows = predictions.map(p => evaluatePrediction(p, samples))
    res.json({ data: { ...agentConfig(), rows, stats: summarizePredictions(rows.filter(r => r.variant === 'rag')), flowStats: summarizePredictions(rows.filter(r => r.variant === 'flow')), comparison: summarizeComparison(rows), autoReview: summarizeRetrospectives(rows), reports } })
  } catch { res.status(503).json({ message: 'AI 기록 저장소를 사용할 수 없습니다. 연결과 마이그레이션을 확인하세요.' }) }
})

router.post('/reports/:id/index', async (req, res) => {
  const id = Number(req.params.id), userId = req.user!.id
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ message: 'PDF 번호를 확인하세요.' }); return }
  if (indexing.has(userId)) { res.status(409).json({ message: '다른 PDF를 처리 중입니다.' }); return }
  indexing.add(userId)
  try {
    const report = await prisma.flowReport.findFirst({ where: { id, userId } })
    if (!report) { res.status(404).json({ message: '자료를 찾을 수 없습니다.' }); return }
    if (report.ragStatus === 'ready') { res.json({ data: { status: 'ready' } }); return }
    let chunks
    try { chunks = await extractPdf(report.content) }
    catch (error) {
      await prisma.flowReport.updateMany({ where: { id, userId }, data: { ragStatus: 'error', ragError: message(error), ragChunks: [] } })
      res.status(422).json({ message: message(error) }); return
    }
    await prisma.flowReport.updateMany({ where: { id, userId }, data: { ragStatus: 'ready', ragError: null, ragChunks: JSON.parse(JSON.stringify(chunks)) } })
    res.json({ data: { status: 'ready', chunks: chunks.length } })
  } catch { res.status(503).json({ message: 'PDF 검색 준비에 실패했습니다.' }) }
  finally { indexing.delete(userId) }
})

router.post('/agent', async (req, res) => {
  const userId = req.user!.id
  const { snapshotId, horizon } = req.body || {}
  if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0 || ![15, 30].includes(horizon)) { res.status(400).json({ message: '관측 기록과 예측 구간(15·30분)을 확인하세요.' }); return }
  if (running.has(userId)) { res.status(409).json({ message: 'AI 판단을 생성 중입니다.' }); return }
  running.add(userId)
  try {
    const existing = await prisma.flowPrediction.findUnique({ where: { userId_snapshotId_horizon_variant: { userId, snapshotId, horizon, variant: 'rag' } } })
    if (existing) { res.json({ data: { id: existing.id } }); return }
    if (!agentConfig().configured) { res.status(503).json({ message: 'Claude 연결 설정이 필요합니다. 서버의 ANTHROPIC_API_KEY를 확인하세요.' }); return }
    const requested = new Date()
    if (await prisma.flowPrediction.count({ where: { userId, createdAt: { gte: new Date(requested.getTime() - 86400_000) } } }) >= 80) { res.status(429).json({ message: '최근 24시간의 AI 판단 한도(80건)에 도달했습니다.' }); return }
    const snapshot = await prisma.flowSnapshot.findUnique({ where: { id: snapshotId } })
    const record = snapshot && recordedFlow(snapshot.payload)
    if (!record || !record.analyses['15']) { res.status(404).json({ message: '분석할 수급 기록이 없습니다.' }); return }
    const cutoff = new Date(record.sample.observedAt)
    if (!Number.isFinite(cutoff.getTime()) || cutoff > requested) { res.status(422).json({ message: '관측 시각을 확인하세요.' }); return }
    const documents = await prisma.flowReport.findMany({ where: { userId, ragStatus: 'ready', date: record.sample.date, createdAt: { lte: cutoff } }, select: { id: true, filename: true, date: true, createdAt: true, ragChunks: true }, orderBy: { createdAt: 'desc' }, take: 100 })
    const query = `코스피 외국인 현물 선물 비차익 전체 수급 ${record.analyses['15'].title} ${record.analyses['15'].hypotheses.join(' ')}`
    await attachPriorReview(record, userId)
    const evidence = retrieveEvidence(documents, query, record.sample.date, cutoff)
    evidence.push(...await loadHistoricalEvidence(userId, `코스피 외국인 현물 선물 비차익 사례 판별 ${record.analyses['15']?.title || ''}`, record.sample.date, cutoff))
    let judgment
    try { judgment = await generateJudgment(record, evidence, horizon) }
    catch (error) { res.status(502).json({ message: agentErrorMessage(error) }); return }
    const generated = new Date()
    const validationContext = await captureFlowDistribution(record)
    const payload: AgentPayload = { referencePolicy: historicalPolicy(evidence), record, judgment, evidence, validationContext, requestedAt: requested.toISOString(), generatedAt: generated.toISOString(), cutoff: cutoff.toISOString() }
    const prediction = await prisma.flowPrediction.create({ data: { userId, snapshotId, date: record.sample.date, horizon, mode: predictionMode(record.sample, requested, generated), model: agentConfig().model, version: AGENT_VERSION, payload: JSON.parse(JSON.stringify(payload)) } })
    res.status(201).json({ data: { id: prediction.id } })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { res.status(409).json({ message: '이미 저장된 판단입니다. 기록을 새로고침하세요.' }); return }
    res.status(503).json({ message: 'AI 판단 저장에 실패했습니다. 저장소 연결을 확인하세요.' })
  } finally { running.delete(userId) }
})
router.post('/agent/compare', async (req, res) => {
  const userId = req.user!.id
  const { snapshotId, horizon } = req.body || {}
  if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0 || ![15, 30].includes(horizon)) { res.status(400).json({ message: '관측 기록과 예측 구간을 확인하세요.' }); return }
  if (running.has(userId)) { res.status(409).json({ message: 'AI 판단을 생성 중입니다.' }); return }
  running.add(userId)
  try {
    const existing = await prisma.flowPrediction.findMany({ where: { userId, snapshotId, horizon } })
    if (existing.length) {
      if (existing.length === 2 && existing.every(p => Boolean((p.payload as unknown as AgentPayload).comparisonId))) { res.json({ data: { ids: existing.map(p => p.id) } }); return }
      res.status(409).json({ message: '이 관측에는 기존 단일 판단이 있습니다. 원본 보존을 위해 다른 관측을 선택해 비교하세요.' }); return
    }
    const config = agentConfig()
    if (!config.configured) { res.status(503).json({ message: 'Claude API 키 설정이 필요합니다.' }); return }
    const requested = new Date()
    if (await prisma.flowPrediction.count({ where: { userId, createdAt: { gte: new Date(requested.getTime() - 86400_000) } } }) > 78) { res.status(429).json({ message: '최근 24시간의 AI 판단 한도(80건)에 도달했습니다. 비교 실행은 2건입니다.' }); return }
    const snapshot = await prisma.flowSnapshot.findUnique({ where: { id: snapshotId } })
    const record = snapshot && recordedFlow(snapshot.payload)
    if (!record || !record.analyses['15']) { res.status(404).json({ message: '분석할 수급 기록이 없습니다.' }); return }
    const cutoff = new Date(record.sample.observedAt)
    if (!Number.isFinite(cutoff.getTime()) || cutoff > requested) { res.status(422).json({ message: '관측 시각을 확인하세요.' }); return }
    const documents = await prisma.flowReport.findMany({ where: { userId, ragStatus: 'ready', date: record.sample.date, createdAt: { lte: cutoff } }, select: { id: true, filename: true, date: true, createdAt: true, ragChunks: true }, orderBy: { createdAt: 'desc' }, take: 100 })
    await attachPriorReview(record, userId)
    const evidence = retrieveEvidence(documents, `코스피 외국인 현물 선물 비차익 ${record.analyses['15'].title} ${record.analyses['15'].hypotheses.join(' ')}`, record.sample.date, cutoff)
    evidence.push(...await loadHistoricalEvidence(userId, `코스피 외국인 현물 선물 비차익 사례 판별 ${record.analyses['15']?.title || ''}`, record.sample.date, cutoff))
    const results = await Promise.allSettled([[], evidence].map(async context => ({ judgment: await generateJudgment(record, context, horizon), completedAt: new Date().toISOString() })))
    const failure = results.find(r => r.status === 'rejected')
    if (failure?.status === 'rejected') { res.status(502).json({ message: agentErrorMessage(failure.reason) }); return }
    // Both arms share the first available price AFTER both generations complete.
    const generated = new Date(), comparisonId = randomUUID()
    const validationContext = await captureFlowDistribution(record)
    const rows = await prisma.$transaction(results.map((result, i) => {
      if (result.status !== 'fulfilled') throw new Error('비교 결과 누락')
      const payload: AgentPayload = { referencePolicy: historicalPolicy(i === 0 ? [] : evidence, i !== 0), record, ...result.value, validationContext, evidence: i === 0 ? [] : evidence, requestedAt: requested.toISOString(), generatedAt: generated.toISOString(), cutoff: cutoff.toISOString(), comparisonId }
      return prisma.flowPrediction.create({ data: { userId, snapshotId, horizon, variant: i === 0 ? 'flow' : 'rag', date: record.sample.date, mode: predictionMode(record.sample, requested, generated), model: config.model, version: AGENT_VERSION, payload: JSON.parse(JSON.stringify(payload)) } })
    }))
    res.status(201).json({ data: { ids: rows.map(r => r.id), hasPdf: evidence.length > 0 } })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { res.status(409).json({ message: '이미 저장된 비교입니다. 새로고침하세요.' }); return }
    res.status(503).json({ message: '비교 판단 저장에 실패했습니다. 저장소 연결을 확인하세요.' })
  } finally { running.delete(userId) }
})
export default router
