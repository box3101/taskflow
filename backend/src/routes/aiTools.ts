import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 목록 조회 (태그 필터 + 검색)
router.get('/', async (req, res) => {
  try {
    const tag = req.query.tag as string | undefined
    const search = req.query.search as string | undefined

    const where: Record<string, unknown> = {}
    if (tag) {
      where.tags = { has: tag }
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const data = await prisma.aiTool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.json({ data })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const tool = await prisma.aiTool.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    if (!tool) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }
    res.json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 생성
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, description, content, tags, icon } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '제목을 입력해주세요.' })
      return
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ message: '설명을 입력해주세요.' })
      return
    }

    const tool = await prisma.aiTool.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        content: content ?? '',
        tags: Array.isArray(tags) ? tags : [],
        icon: icon ?? null,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.status(201).json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 수정
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { title, description, content, tags, icon } = req.body

    const existing = await prisma.aiTool.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (description !== undefined) updateData.description = String(description).trim()
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (icon !== undefined) updateData.icon = icon || null

    const tool = await prisma.aiTool.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    const existing = await prisma.aiTool.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }

    await prisma.aiTool.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
