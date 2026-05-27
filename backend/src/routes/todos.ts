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
      where: { userId },
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
    const { title, priority } = req.body

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
      data: { userId, title: title.trim(), priority: safePriority },
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
    const { done, priority, title } = req.body

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

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    // 본인 할일인지 확인
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
