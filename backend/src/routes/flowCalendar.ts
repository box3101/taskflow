import { Router } from 'express'
import prisma from '../prisma'
import retrospective from '../data/market-review-2026-09-22.json'

const router = Router()
router.get('/calendar', async (req, res) => {
  const month = req.query.month
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) { res.status(400).json({ message: '조회할 월을 확인하세요.' }); return }
  const [year, m] = month.split('-').map(Number)
  const start = `${month}-01`, end = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10)
  const date = { gte: start, lt: end }, userId = req.user!.id
  try {
    // Aggregate metadata only: no PDF bytes, prompts or month-long tick payloads.
    const [snapshots, reports, predictions, reviews] = await Promise.all([
      prisma.flowSnapshot.groupBy({ by: ['date'], where: { date }, _count: { _all: true } }),
      prisma.flowReport.groupBy({ by: ['date', 'ragStatus'], where: { userId, date }, _count: { _all: true } }),
      prisma.flowPrediction.groupBy({ by: ['date', 'variant'], where: { userId, date }, _count: { _all: true } }),
      prisma.flowExpertReview.groupBy({ by: ['date', 'task'], where: { userId, date }, _count: { _all: true } }),
    ])
    const days = Array.from({ length: new Date(Date.UTC(year, m, 0)).getUTCDate() }, (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, '0')}`
      const pdf = reports.filter(r => r.date === d), ai = predictions.filter(p => p.date === d), expert = reviews.filter(r => r.date === d)
      return { date: d, records: snapshots.find(s => s.date === d)?._count._all || 0,
        pdf: pdf.reduce((n, r) => n + r._count._all, 0), pdfReady: pdf.filter(r => r.ragStatus === 'ready').reduce((n, r) => n + r._count._all, 0),
        ai: ai.reduce((n, p) => n + p._count._all, 0), flowAi: ai.filter(p => p.variant === 'flow').reduce((n, p) => n + p._count._all, 0),
        ragAi: ai.filter(p => p.variant === 'rag').reduce((n, p) => n + p._count._all, 0),
        deepReviews: expert.filter(r => r.task === 'review').reduce((n, r) => n + r._count._all, 0),
        closingReviews: expert.filter(r => r.task === 'close').reduce((n, r) => n + r._count._all, 0),
        retrospective: d === retrospective.date,
      }
    })
    res.json({ data: { month, days, updatedAt: new Date().toISOString() } })
  } catch { res.status(503).json({ message: '달력 기록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 조회하세요.' }) }
})
export default router
