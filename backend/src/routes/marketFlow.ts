import { Router } from 'express'
import multer from 'multer'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'
import { collectorStatus, recordedFlow } from '../services/flowCollector'
import { koreanClock, reviewFlow } from '../services/flowAnalysis'
import retrospectiveReview from '../data/market-review-2026-09-22.json'
import flowAgentRouter from './flowAgent'
import flowExpertRouter from './flowExpert'
import flowCalendarRouter from './flowCalendar'

const router = Router()
router.use(authenticate)
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.use(flowAgentRouter)
router.use(flowExpertRouter)
router.use(flowCalendarRouter)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, fieldSize: 8000 } })
export function validFlowDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
function dateParam(value: unknown) { return value === undefined ? koreanClock().date : value }
const reportSelect = { id: true, date: true, filename: true, note: true, createdAt: true } as const

// Historical price evidence is separate from contemporaneous flow predictions.
router.get('/retrospective', (req, res) => {
  if (!validFlowDate(req.query.date)) { res.status(400).json({ message: '올바른 날짜를 입력하세요.' }); return }
  res.json({ data: req.query.date === retrospectiveReview.date ? retrospectiveReview : null })
})

router.get('/', async (req, res) => {
  const date = dateParam(req.query.date)
  if (!validFlowDate(date)) { res.status(400).json({ message: '올바른 날짜를 입력하세요.' }); return }
  try {
    const stored = await prisma.flowSnapshot.findMany({ where: { date }, orderBy: { observedAt: 'asc' }, take: 600 })
    const records = stored.map(row => ({ id: row.id, record: recordedFlow(row.payload) })).filter(row => row.record !== null)
    const samples = records.map(row => row.record!.sample)
    const reports = await prisma.flowReport.findMany({ where: { userId: req.user!.id, date }, select: reportSelect, orderBy: { createdAt: 'desc' } })
    res.json({ data: {
      date, serverTime: new Date().toISOString(), status: { ...collectorStatus(), storageReady: true }, reports,
      records: records.map(({ id, record }) => ({ id, ...record!, reviews: [15, 30].map(h => reviewFlow(record!.sample, record!.analyses['15'], samples, h)) })),
    } })
  } catch {
    res.status(503).json({ message: '수급 기록 저장소를 사용할 수 없습니다. 데이터베이스 연결 및 마이그레이션을 확인하세요.', status: { ...collectorStatus(), storageReady: false } })
  }
})

router.post('/reports', (req, res) => {
  upload.single('file')(req, res, async error => {
    if (error) { res.status(400).json({ message: 'PDF 한 개를 10MB 이하로 첨부하세요.' }); return }
    const date = req.body.date
    if (!validFlowDate(date) || !req.file || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      res.status(400).json({ message: '거래일과 PDF 파일을 확인하세요.' }); return
    }
    try {
      if (await prisma.flowReport.count({ where: { userId: req.user!.id, date } }) >= 10) {
        res.status(400).json({ message: '거래일별 참고 PDF는 최대 10개입니다.' }); return
      }
      let filename = req.file.originalname
      if (!/[^\u0000-\u00ff]/.test(filename)) filename = Buffer.from(filename, 'latin1').toString('utf8')
      filename = filename.replace(/[\x00-\x1f\\/]/g, '_').slice(0, 255)
      const report = await prisma.flowReport.create({ data: { userId: req.user!.id, date, filename, content: new Uint8Array(req.file.buffer), note: typeof req.body.note === 'string' ? req.body.note.slice(0, 4000) : '' }, select: reportSelect })
      res.status(201).json({ data: report })
    } catch { res.status(503).json({ message: 'PDF 저장에 실패했습니다. 저장소 연결을 확인하세요.' }) }
  })
})
router.get('/reports/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).end(); return }
  try {
    const report = await prisma.flowReport.findFirst({ where: { id, userId: req.user!.id } })
    if (!report) { res.status(404).json({ message: '자료를 찾을 수 없습니다.' }); return }
    res.set('Content-Type', 'application/pdf')
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`)
    res.send(Buffer.from(report.content))
  } catch { res.status(503).json({ message: '자료 조회에 실패했습니다.' }) }
})
router.delete('/reports/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).end(); return }
  try {
    await prisma.flowReport.deleteMany({ where: { id, userId: req.user!.id } })
    res.status(204).end()
  } catch { res.status(503).json({ message: '자료 삭제에 실패했습니다.' }) }
})
export default router
