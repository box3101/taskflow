import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'
import { matureSnapshots } from '../services/scoreMaturity'
import { markDailyCloses } from '../services/scoreDailyMark'

const router = Router()
router.use(authenticate)

// GET /marks — 일별 종가 마크 (자산곡선 일 단위 렌더용)
// :date 라우트보다 먼저 선언해야 'marks'가 날짜로 잡히지 않는다
router.get('/marks', async (_req, res) => {
  try {
    const marks = await prisma.scoreDailyMark.findMany({
      orderBy: [{ snapshotDate: 'asc' }, { date: 'asc' }],
      select: { snapshotDate: true, code: true, date: true, close: true },
    })
    res.json({ data: marks })
  } catch (err) {
    console.error('GET /score-snapshots/marks error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST /marks — 오늘 종가 마크 즉시 기록 (cron 수동 트리거)
router.post('/marks', async (_req, res) => {
  try {
    const result = await markDailyCloses()
    res.json({ message: '기록 완료', ...result })
  } catch (err) {
    console.error('POST /score-snapshots/marks error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST /mature — 만기 도래 스냅샷 즉시 확정 (cron 수동 트리거)
router.post('/mature', async (_req, res) => {
  try {
    const result = await matureSnapshots()
    res.json({ message: '확정 완료', ...result })
  } catch (err) {
    console.error('POST /score-snapshots/mature error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST / — 오늘 스코어 스냅샷 저장 (upsert)
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date, entryDate, data, memo } = req.body

    if (!date || !data || !Array.isArray(data)) {
      return res.status(400).json({ message: 'date, data(배열) 필수' })
    }

    const snapshot = await prisma.scoreSnapshot.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, entryDate, data, memo },
      update: { entryDate, data, memo },
    })

    res.json({ data: snapshot })
  } catch (err) {
    console.error('POST /score-snapshots error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// GET / — 스냅샷 목록 (최근 30개)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 30,
      select: { id: true, date: true, entryDate: true, memo: true, createdAt: true },
    })
    res.json({ data: snapshots })
  } catch (err) {
    console.error('GET /score-snapshots error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// GET /:date — 특정 날짜 스냅샷 상세
router.get('/:date', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    const snapshot = await prisma.scoreSnapshot.findUnique({
      where: { userId_date: { userId, date } },
    })

    if (!snapshot) {
      return res.status(404).json({ message: '해당 날짜 스냅샷 없음' })
    }

    res.json({ data: snapshot })
  } catch (err) {
    console.error('GET /score-snapshots/:date error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:date — 스냅샷 삭제
router.delete('/:date', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    await prisma.scoreSnapshot.deleteMany({
      where: { userId, date },
    })

    res.json({ message: '삭제 완료' })
  } catch (err) {
    console.error('DELETE /score-snapshots/:date error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
