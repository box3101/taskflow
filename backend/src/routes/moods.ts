import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// POST / — 기분 저장 (upsert)
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date, mood } = req.body

    // 유효성 검사: date
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }

    // 유효성 검사: mood
    if (mood === undefined || !Number.isInteger(mood) || mood < 1 || mood > 5) {
      res.status(400).json({ message: '기분은 1~5 사이의 정수여야 합니다.' })
      return
    }

    const result = await prisma.mood.upsert({
      where: { userId_date: { userId, date } },
      update: { mood },
      create: { userId, date, mood },
    })
    res.json({ data: result })
  } catch (err) {
    console.error('POST /moods error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// GET / — 월별 기분 조회
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const month = req.query.month as string

    // 유효성 검사: month
    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ message: 'month는 YYYY-MM 형식이어야 합니다.' })
      return
    }

    const moods = await prisma.mood.findMany({
      where: { userId, date: { startsWith: month } },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, mood: true },
    })
    res.json({ data: moods })
  } catch (err) {
    console.error('GET /moods error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
