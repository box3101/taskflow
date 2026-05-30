import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 월별 통합 일정 조회 (개인 일정 + Todo + Issue)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const year = Number(req.query.year)
    const month = Number(req.query.month)

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ message: 'year, month 파라미터가 필요합니다.' })
      return
    }

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const calendarEvents = await prisma.calendarEvent.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    const todos = await prisma.todo.findMany({
      where: { userId, done: false, deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
      orderBy: { dueDate: 'asc' },
    })

    const issues = await prisma.issue.findMany({
      where: { assigneeId: userId, status: { not: 'done' }, dueAt: { gte: startDate, lte: endDate } },
      include: { project: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
    })

    const events = [
      ...calendarEvents.map(e => ({
        id: e.id, type: 'event' as const, title: e.title,
        date: e.date.toISOString().slice(0, 10),
        startTime: e.startTime, endTime: e.endTime,
        color: e.color, memo: e.memo, location: e.location,
      })),
      ...todos.map(t => ({
        id: t.id, type: 'todo' as const, title: t.title,
        date: t.dueDate!.toISOString().slice(0, 10),
        startTime: null, endTime: null, color: '#ef4444', memo: null, location: null,
      })),
      ...issues.map(i => ({
        id: i.id, type: 'issue' as const, title: i.title,
        date: i.dueAt!.toISOString().slice(0, 10),
        startTime: null, endTime: null, color: '#22c55e', memo: null, location: null,
        projectId: i.projectId, projectName: i.project.name,
      })),
    ]

    res.json({ data: events })
  } catch (err) {
    console.error('GET /calendar error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 일정 생성
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, date, startTime, endTime, memo, location, color } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '일정 제목을 입력해주세요.' })
      return
    }
    if (title.length > 200) {
      res.status(400).json({ message: '일정 제목은 200자 이내로 입력해주세요.' })
      return
    }
    if (!date) {
      res.status(400).json({ message: '날짜를 입력해주세요.' })
      return
    }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ message: '올바른 날짜 형식이 아닙니다.' })
      return
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId, title: title.trim(), date: parsedDate,
        startTime: startTime || null, endTime: endTime || null,
        memo: memo || null, location: location || null, color: color || '#3b82f6',
      },
    })
    res.status(201).json({ data: event })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 일정 수정
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const { title, date, startTime, endTime, memo, location, color } = req.body

    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '일정을 찾을 수 없습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (date !== undefined) {
      const parsed = new Date(date)
      if (!isNaN(parsed.getTime())) updateData.date = parsed
    }
    if (startTime !== undefined) updateData.startTime = startTime || null
    if (endTime !== undefined) updateData.endTime = endTime || null
    if (memo !== undefined) updateData.memo = memo || null
    if (location !== undefined) updateData.location = location || null
    if (color !== undefined) updateData.color = color

    const event = await prisma.calendarEvent.update({ where: { id }, data: updateData })
    res.json({ data: event })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 일정 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '일정을 찾을 수 없습니다.' })
      return
    }

    await prisma.calendarEvent.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
