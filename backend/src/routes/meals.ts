import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const VALID_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const TYPE_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }

// GET / — 날짜별 식단 조회 (?date=YYYY-MM-DD)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const date = req.query.date as string | undefined
    const month = req.query.month as string | undefined

    // 월별 조회 (?month=YYYY-MM) — 힌트용: 날짜별 첫 식단 + 건수
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const meals = await prisma.meal.findMany({
        where: { userId, date: { startsWith: month } },
        select: { date: true, type: true, content: true },
        orderBy: { createdAt: 'asc' },
      })
      const LABELS: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }
      const map = new Map<string, { firstLabel: string; count: number }>()
      for (const m of meals) {
        const entry = map.get(m.date)
        if (entry) { entry.count++ }
        else { map.set(m.date, { firstLabel: `${LABELS[m.type] || m.type}: ${m.content}`, count: 1 }) }
      }
      const hints = Array.from(map.entries()).map(([d, v]) => ({
        date: d,
        title: v.count > 1 ? `${v.firstLabel} 외 ${v.count - 1}건` : v.firstLabel,
        count: v.count,
      }))
      res.json({ data: hints })
      return
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }

    const meals = await prisma.meal.findMany({
      where: { userId, date },
      select: { id: true, date: true, type: true, content: true },
    })

    // 끼니 순서 정렬 (breakfast → lunch → dinner → snack)
    meals.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9))

    res.json({ data: meals })
  } catch (err) {
    console.error('GET /meals error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST / — 식단 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date, type, content } = req.body

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }

    if (!type || !VALID_TYPES.includes(type)) {
      res.status(400).json({ message: 'type은 lunch, dinner, snack 중 하나여야 합니다.' })
      return
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ message: 'content는 필수입니다.' })
      return
    }

    const meal = await prisma.meal.create({
      data: { userId, date, type, content: content.trim() },
    })
    res.status(201).json({ data: meal })
  } catch (err) {
    console.error('POST /meals error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:id — 식단 수정
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    if (isNaN(id)) {
      res.status(400).json({ message: '유효하지 않은 ID입니다.' })
      return
    }

    const existing = await prisma.meal.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ message: '식단을 찾을 수 없습니다.' })
      return
    }

    const { type, content } = req.body

    if (type !== undefined && !VALID_TYPES.includes(type)) {
      res.status(400).json({ message: 'type은 lunch, dinner, snack 중 하나여야 합니다.' })
      return
    }

    if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
      res.status(400).json({ message: 'content는 비어있을 수 없습니다.' })
      return
    }

    const updateData: Record<string, string> = {}
    if (type !== undefined) updateData.type = type
    if (content !== undefined) updateData.content = content.trim()

    const meal = await prisma.meal.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: meal })
  } catch (err) {
    console.error('PUT /meals error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:id — 식단 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    if (isNaN(id)) {
      res.status(400).json({ message: '유효하지 않은 ID입니다.' })
      return
    }

    const existing = await prisma.meal.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ message: '식단을 찾을 수 없습니다.' })
      return
    }

    await prisma.meal.delete({ where: { id } })
    res.json({ message: '삭제되었습니다.' })
  } catch (err) {
    console.error('DELETE /meals error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
