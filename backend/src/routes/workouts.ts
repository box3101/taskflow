import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET / — 날짜별 운동 조회
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const date = req.query.date as string | undefined
    const month = req.query.month as string | undefined

    // 월별 조회 (?month=YYYY-MM) — 힌트용: 날짜별 첫 운동명 + 건수
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const workouts = await prisma.workout.findMany({
        where: { userId, date: { startsWith: month } },
        select: { date: true, name: true },
        orderBy: { createdAt: 'asc' },
      })
      // 날짜별 그룹핑: { date, firstName, count }
      const map = new Map<string, { firstName: string; count: number }>()
      for (const w of workouts) {
        const entry = map.get(w.date)
        if (entry) { entry.count++ }
        else { map.set(w.date, { firstName: w.name, count: 1 }) }
      }
      const hints = Array.from(map.entries()).map(([d, v]) => ({
        date: d,
        title: v.count > 1 ? `${v.firstName} 외 ${v.count - 1}건` : v.firstName,
        count: v.count,
      }))
      res.json({ data: hints })
      return
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }

    const workouts = await prisma.workout.findMany({
      where: { userId, date },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ data: workouts })
  } catch (err) {
    console.error('GET /workouts error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// GET /recent — 최근 7일 내 고유 운동명 목록
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user!.id
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sinceDate = sevenDaysAgo.toISOString().slice(0, 10)

    const workouts = await prisma.workout.findMany({
      where: { userId, date: { gte: sinceDate } },
      select: { name: true },
      distinct: ['name'],
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    const names = workouts.map((w) => w.name)
    res.json({ data: names })
  } catch (err) {
    console.error('GET /workouts/recent error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST / — 운동 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date, name, weight, sets, reps, duration, memo } = req.body

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: '운동명은 필수입니다.' })
      return
    }

    const result = await prisma.workout.create({
      data: {
        userId,
        date,
        name: name.trim(),
        weight: weight ?? null,
        sets: sets ?? null,
        reps: reps ?? null,
        duration: duration ?? null,
        memo: memo ?? null,
      },
    })
    res.json({ data: result })
  } catch (err) {
    console.error('POST /workouts error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:id — 운동 수정
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params
    const { name, weight, sets, reps, duration, memo } = req.body

    const existing = await prisma.workout.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ message: '운동 기록을 찾을 수 없습니다.' })
      return
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      res.status(400).json({ message: '운동명은 비어 있을 수 없습니다.' })
      return
    }

    const result = await prisma.workout.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(weight !== undefined && { weight }),
        ...(sets !== undefined && { sets }),
        ...(reps !== undefined && { reps }),
        ...(duration !== undefined && { duration }),
        ...(memo !== undefined && { memo }),
      },
    })
    res.json({ data: result })
  } catch (err) {
    console.error('PUT /workouts/:id error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:id — 운동 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.workout.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ message: '운동 기록을 찾을 수 없습니다.' })
      return
    }

    await prisma.workout.delete({ where: { id } })
    res.json({ data: { id } })
  } catch (err) {
    console.error('DELETE /workouts/:id error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
