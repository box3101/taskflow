import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

type Span = 'single' | 'start' | 'middle' | 'end'

// Date → "YYYY-MM-DD" (UTC 기준, @db.Date / UTC 자정 저장과 일치)
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// "YYYY-MM-DD"에 n일 더한 날짜 문자열
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// 시작~종료 범위를 해당 월(monthStart~monthEnd)과 겹치는 날짜들로 확장
// 각 날짜에 막대 위치(span) 부여 — 실제 시작/종료일 기준
function expandRange(
  startStr: string,
  endStr: string,
  monthStartStr: string,
  monthEndStr: string,
): { date: string; span: Span }[] {
  const visStart = startStr < monthStartStr ? monthStartStr : startStr
  const visEnd = endStr > monthEndStr ? monthEndStr : endStr
  const out: { date: string; span: Span }[] = []
  let cur = visStart
  // 무한 루프 방지 (최대 366일)
  for (let i = 0; i < 366 && cur <= visEnd; i++) {
    let span: Span
    if (startStr === endStr) span = 'single'
    else if (cur === startStr) span = 'start'
    else if (cur === endStr) span = 'end'
    else span = 'middle'
    out.push({ date: cur, span })
    cur = addDaysStr(cur, 1)
  }
  return out
}

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
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEndStr = toDateStr(new Date(Date.UTC(year, month, 0)))

    // 일정: [date, endDate ?? date] 가 이번 달과 겹치는 것
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        userId,
        date: { lte: endDate },
        OR: [{ date: { gte: startDate } }, { endDate: { gte: startDate } }],
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    // 할일: [startDate ?? dueDate, dueDate] 가 이번 달과 겹치는 것
    const todos = await prisma.todo.findMany({
      where: {
        userId, done: false, deletedAt: null,
        dueDate: { gte: startDate },
        OR: [{ dueDate: { lte: endDate } }, { startDate: { lte: endDate } }],
      },
      orderBy: { dueDate: 'asc' },
    })

    const issues = await prisma.issue.findMany({
      where: { assigneeId: userId, status: { not: 'done' }, dueAt: { gte: startDate, lte: endDate } },
      include: { project: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
    })

    const events = [
      ...calendarEvents.flatMap(e => {
        const sStr = toDateStr(e.date)
        const eStr = toDateStr(e.endDate ?? e.date)
        return expandRange(sStr, eStr, monthStartStr, monthEndStr).map(({ date, span }) => ({
          id: e.id, type: 'event' as const, title: e.title, date,
          startTime: e.startTime, endTime: e.endTime, allDay: e.allDay, span,
          srcStart: sStr, srcEnd: e.endDate ? eStr : null,
          color: e.color, memo: e.memo, location: e.location,
        }))
      }),
      ...todos.flatMap(t => {
        const sStr = toDateStr(t.startDate ?? t.dueDate!)
        const eStr = toDateStr(t.dueDate!)
        return expandRange(sStr, eStr, monthStartStr, monthEndStr).map(({ date, span }) => ({
          id: t.id, type: 'todo' as const, title: t.title, date,
          startTime: t.startTime, endTime: t.endTime, allDay: t.allDay, span,
          color: '#ef4444', memo: null, location: null,
        }))
      }),
      ...issues.map(i => ({
        id: i.id, type: 'issue' as const, title: i.title,
        date: i.dueAt!.toISOString().slice(0, 10),
        startTime: null, endTime: null, allDay: true, span: 'single' as const,
        color: '#22c55e', memo: null, location: null,
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
    const { title, date, endDate, allDay, startTime, endTime, memo, location, color } = req.body

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

    // 종료일: 없거나 시작일보다 빠르면 무시(단일 날짜 처리)
    let parsedEndDate: Date | null = null
    if (endDate) {
      const pe = new Date(endDate)
      if (!isNaN(pe.getTime()) && pe >= parsedDate) parsedEndDate = pe
    }

    const isAllDay = allDay !== false // 기본 true 취급, 명시적으로 false일 때만 시간 사용
    const event = await prisma.calendarEvent.create({
      data: {
        userId, title: title.trim(), date: parsedDate, endDate: parsedEndDate,
        allDay: isAllDay,
        startTime: isAllDay ? null : (startTime || null),
        endTime: isAllDay ? null : (endTime || null),
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
    const { title, date, endDate, allDay, startTime, endTime, memo, location, color } = req.body

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
    if (endDate !== undefined) {
      if (endDate === null) {
        updateData.endDate = null
      } else {
        const parsed = new Date(endDate)
        // 시작일 기준(수정값 우선, 없으면 기존값)보다 빠르면 무시
        const baseStart = (updateData.date as Date) ?? existing.date
        if (!isNaN(parsed.getTime()) && parsed >= baseStart) updateData.endDate = parsed
        else updateData.endDate = null
      }
    }
    if (allDay !== undefined) {
      updateData.allDay = Boolean(allDay)
      // 하루종일로 켜면 시간 제거
      if (allDay) {
        updateData.startTime = null
        updateData.endTime = null
      }
    }
    if (startTime !== undefined && updateData.startTime === undefined) updateData.startTime = startTime || null
    if (endTime !== undefined && updateData.endTime === undefined) updateData.endTime = endTime || null
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
