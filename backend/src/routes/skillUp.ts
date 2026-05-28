import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 전체 레벨 목록 + 내 진행률
router.get('/levels', async (req, res) => {
  try {
    const userId = req.user!.id
    const levels = await prisma.skillLevel.findMany({
      orderBy: { order: 'asc' },
      include: {
        progresses: {
          where: { userId },
          select: { status: true, score: true, completedAt: true },
        },
      },
    })

    const data = levels.map((l) => ({
      id: l.id,
      order: l.order,
      title: l.title,
      description: l.description,
      icon: l.icon,
      status: l.progresses[0]?.status ?? 'locked',
      score: l.progresses[0]?.score ?? null,
      completedAt: l.progresses[0]?.completedAt ?? null,
    }))

    res.json({ data })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 레벨 상세 (학습 내용 + 챌린지)
router.get('/levels/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const userId = req.user!.id

    const level = await prisma.skillLevel.findUnique({
      where: { id },
      include: {
        progresses: {
          where: { userId },
          select: { status: true, score: true, note: true, completedAt: true },
        },
      },
    })

    if (!level) {
      res.status(404).json({ message: '레벨을 찾을 수 없습니다.' })
      return
    }

    res.json({
      data: {
        ...level,
        challenge: level.challenge ? JSON.parse(level.challenge) : null,
        myProgress: level.progresses[0] ?? null,
      },
    })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 진행 상태 업데이트
router.patch('/progress/:levelId', async (req, res) => {
  try {
    const levelId = Number(req.params.levelId)
    const userId = req.user!.id
    const { status, score, note } = req.body

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (score !== undefined) updateData.score = score
    if (note !== undefined) updateData.note = note
    if (status === 'completed') updateData.completedAt = new Date()

    const progress = await prisma.skillProgress.upsert({
      where: { userId_levelId: { userId, levelId } },
      update: updateData,
      create: {
        userId,
        levelId,
        status: status ?? 'in_progress',
        score: score ?? null,
        note: note ?? null,
        completedAt: status === 'completed' ? new Date() : null,
      },
    })

    res.json({ data: progress })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 유저별 진행률 요약
router.get('/summary', async (req, res) => {
  try {
    const totalLevels = await prisma.skillLevel.count()
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        skillProgresses: {
          select: { status: true, score: true, completedAt: true },
        },
      },
    })

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      total: totalLevels,
      completed: u.skillProgresses.filter((p) => p.status === 'completed').length,
      inProgress: u.skillProgresses.filter((p) => p.status === 'in_progress').length,
    }))

    res.json({ data })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 레벨 추가 (관리용)
router.post('/levels', async (req, res) => {
  try {
    const { order, title, description, icon, content, challenge } = req.body
    const level = await prisma.skillLevel.create({
      data: {
        order,
        title,
        description,
        icon: icon ?? '📚',
        content: content ?? '',
        challenge: challenge ? JSON.stringify(challenge) : null,
      },
    })
    res.status(201).json({ data: level })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 레벨 수정
router.put('/levels/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { order, title, description, icon, content, challenge } = req.body

    const updateData: Record<string, unknown> = {}
    if (order !== undefined) updateData.order = order
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (icon !== undefined) updateData.icon = icon
    if (content !== undefined) updateData.content = content
    if (challenge !== undefined) updateData.challenge = challenge ? JSON.stringify(challenge) : null

    const level = await prisma.skillLevel.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: level })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
