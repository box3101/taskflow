import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const VALID_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple']

// GET / — 메모 목록 (핀 우선, 최신순)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const q = (req.query.q as string || '').trim()

    const where: Record<string, unknown> = { userId, deletedAt: null }

    // 검색
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ]
    }

    const memos = await prisma.memo.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true, title: true, content: true,
        color: true, pinned: true, order: true,
        createdAt: true, updatedAt: true,
      },
    })

    res.json({ data: memos })
  } catch (err) {
    console.error('GET /memos error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST / — 메모 생성
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, content, color } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '제목은 필수입니다.' })
      return
    }
    if (title.trim().length > 100) {
      res.status(400).json({ message: '제목은 100자 이하여야 합니다.' })
      return
    }
    if (content && typeof content === 'string' && content.length > 5000) {
      res.status(400).json({ message: '내용은 5000자 이하여야 합니다.' })
      return
    }
    if (color && !VALID_COLORS.includes(color)) {
      res.status(400).json({ message: '유효하지 않은 색상입니다.' })
      return
    }

    const memo = await prisma.memo.create({
      data: {
        userId,
        title: title.trim(),
        content: content?.trim() || '',
        color: color || 'yellow',
      },
    })
    res.status(201).json({ data: memo })
  } catch (err) {
    console.error('POST /memos error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:id — 메모 수정
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.memo.findFirst({ where: { id, userId, deletedAt: null } })
    if (!existing) {
      res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
      return
    }

    const { title, content, color } = req.body
    const updateData: Record<string, unknown> = {}

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ message: '제목은 필수입니다.' })
        return
      }
      if (title.trim().length > 100) {
        res.status(400).json({ message: '제목은 100자 이하여야 합니다.' })
        return
      }
      updateData.title = title.trim()
    }
    if (content !== undefined) {
      if (typeof content === 'string' && content.length > 5000) {
        res.status(400).json({ message: '내용은 5000자 이하여야 합니다.' })
        return
      }
      updateData.content = typeof content === 'string' ? content.trim() : ''
    }
    if (color !== undefined) {
      if (!VALID_COLORS.includes(color)) {
        res.status(400).json({ message: '유효하지 않은 색상입니다.' })
        return
      }
      updateData.color = color
    }

    const memo = await prisma.memo.update({ where: { id }, data: updateData })
    res.json({ data: memo })
  } catch (err) {
    console.error('PUT /memos error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PATCH /:id/pin — 핀 토글
router.patch('/:id/pin', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.memo.findFirst({ where: { id, userId, deletedAt: null } })
    if (!existing) {
      res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
      return
    }

    const memo = await prisma.memo.update({
      where: { id },
      data: { pinned: !existing.pinned },
    })
    res.json({ data: memo })
  } catch (err) {
    console.error('PATCH /memos/:id/pin error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:id — 소프트삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.memo.findFirst({ where: { id, userId, deletedAt: null } })
    if (!existing) {
      res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
      return
    }

    await prisma.memo.update({ where: { id }, data: { deletedAt: new Date() } })
    res.json({ message: '삭제되었습니다.' })
  } catch (err) {
    console.error('DELETE /memos error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
