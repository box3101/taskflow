import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 목록 조회 (카테고리 필터 + 검색)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const category = req.query.category as string | undefined
    const search = req.query.search as string | undefined

    const where: Record<string, unknown> = {}

    if (search) {
      // userId 필터 + OR 검색을 AND로 결합
      where.AND = [
        { userId },
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { tags: { has: search } },
          ],
        },
      ]
      if (category) {
        ;(where.AND as Record<string, unknown>[]).push({ category })
      }
    } else {
      where.userId = userId
      if (category) {
        where.category = category
      }
    }

    const data = await prisma.techNote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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
    const note = await prisma.techNote.findUnique({ where: { id } })
    if (!note) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }
    res.json({ data: note })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 생성
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, category, tags, summary, content } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '제목을 입력해주세요.' })
      return
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      res.status(400).json({ message: '카테고리를 입력해주세요.' })
      return
    }

    const note = await prisma.techNote.create({
      data: {
        title: title.trim(),
        category: category.trim(),
        tags: Array.isArray(tags) ? tags : [],
        summary: summary ?? null,
        content: content ?? '',
        userId,
      },
    })
    res.status(201).json({ data: note })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 수정 (부분 업데이트)
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { title, category, tags, summary, content } = req.body

    const existing = await prisma.techNote.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (category !== undefined) updateData.category = String(category).trim()
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (summary !== undefined) updateData.summary = summary || null
    if (content !== undefined) updateData.content = content

    const note = await prisma.techNote.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: note })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    const existing = await prisma.techNote.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }

    await prisma.techNote.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
