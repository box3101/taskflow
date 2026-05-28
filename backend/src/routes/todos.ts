import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 내 할일 목록 조회 (미완료 createdAt asc 먼저, 완료 createdAt desc)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const todos = await prisma.todo.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ done: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    })
    res.json({ data: todos })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, priority, memo } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '할일 제목을 입력해주세요.' })
      return
    }
    if (title.length > 500) {
      res.status(400).json({ message: '할일 제목은 500자 이내로 입력해주세요.' })
      return
    }

    const validPriorities = ['high', 'mid', 'low', 'none']
    const safePriority = validPriorities.includes(priority) ? priority : 'none'

    const todo = await prisma.todo.create({
      data: { userId, title: title.trim(), priority: safePriority, memo: memo ?? null },
    })
    res.status(201).json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 완료 토글
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const { done, priority, title, memo } = req.body

    // 본인 할일인지 확인
    const existing = await prisma.todo.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (done !== undefined) updateData.done = Boolean(done)
    if (title !== undefined && typeof title === 'string' && title.trim().length > 0) {
      updateData.title = title.trim()
    }
    if (priority !== undefined) {
      const validPriorities = ['high', 'mid', 'low', 'none']
      if (validPriorities.includes(priority)) updateData.priority = priority
    }
    if (memo !== undefined) {
      updateData.memo = typeof memo === 'string' ? memo : null
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 휴지통 목록 조회
router.get('/trash', async (req, res) => {
  try {
    const userId = req.user!.id
    const todos = await prisma.todo.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 200,
    })
    res.json({ data: todos })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 휴지통 전체 비우기 (/:id 보다 먼저 등록)
router.delete('/trash/empty', async (req, res) => {
  try {
    const userId = req.user!.id
    await prisma.todo.deleteMany({
      where: { userId, deletedAt: { not: null } },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 삭제 (휴지통으로 이동)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    const existing = await prisma.todo.findFirst({ where: { id, userId, deletedAt: null } })
    if (!existing) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 복원
router.patch('/:id/restore', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    const existing = await prisma.todo.findFirst({ where: { id, userId, deletedAt: { not: null } } })
    if (!existing) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: { deletedAt: null },
    })
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 영구 삭제
router.delete('/:id/permanent', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    const existing = await prisma.todo.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    await prisma.todo.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
