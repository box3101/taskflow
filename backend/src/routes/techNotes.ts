import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 목록 조회 (내 노트 + 공개 노트, 카테고리 필터 + 검색)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const category = req.query.category as string | undefined
    const search = req.query.search as string | undefined

    // 조회 범위: 내 노트 OR 공개 노트 → 검색/카테고리 조건을 AND로 누적
    const conditions: Record<string, unknown>[] = [
      { OR: [{ userId }, { isPublic: true }] },
    ]

    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ],
      })
    }
    if (category) {
      conditions.push({ category })
    }

    const data = await prisma.techNote.findMany({
      where: { AND: conditions },
      include: { user: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ data })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 상세 조회 (내 노트이거나 공개 노트만)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const note = await prisma.techNote.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    })
    if (!note) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }
    if (note.userId !== userId && !note.isPublic) {
      res.status(403).json({ message: '접근 권한이 없습니다.' })
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
    const { title, category, tags, summary, content, isPublic } = req.body

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
        isPublic: isPublic === true,
        userId,
      },
    })
    res.status(201).json({ data: note })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 수정 (부분 업데이트) — 작성자 본인만
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const { title, category, tags, summary, content, isPublic } = req.body

    const existing = await prisma.techNote.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }
    // 공개 노트라도 수정은 작성자만 가능
    if (existing.userId !== userId) {
      res.status(403).json({ message: '본인 노트만 수정할 수 있습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (category !== undefined) updateData.category = String(category).trim()
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (summary !== undefined) updateData.summary = summary || null
    if (content !== undefined) updateData.content = content
    if (isPublic !== undefined) updateData.isPublic = isPublic === true

    const note = await prisma.techNote.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: note })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 삭제 — 작성자 본인만
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)

    const existing = await prisma.techNote.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: '테크 노트를 찾을 수 없습니다.' })
      return
    }
    // 공개 노트라도 삭제는 작성자만 가능
    if (existing.userId !== userId) {
      res.status(403).json({ message: '본인 노트만 삭제할 수 있습니다.' })
      return
    }

    await prisma.techNote.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
