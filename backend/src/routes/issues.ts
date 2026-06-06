import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      cb(null, `${unique}${path.extname(file.originalname)}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// 이슈 순서 일괄 업데이트 (드래그 앤 드롭)
router.put('/reorder', async (req, res) => {
  try {
    const { items } = req.body as { items: { id: number; status: string; order: number }[] }
    await Promise.all(
      items.map(item =>
        prisma.issue.update({
          where: { id: item.id },
          data: { status: item.status, order: item.order },
        })
      )
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: Number(req.params.id) },
      include: { assignee: { select: { id: true, name: true } } },
    })
    if (!issue) {
      res.status(404).json({ message: '이슈를 찾을 수 없습니다.' })
      return
    }
    res.json({ data: issue })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 수정 (상태, 담당자, 우선순위 변경)
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, priority, urgency, requestedAt, dueAt, assigneeId } = req.body
    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (status !== undefined) data.status = status
    if (priority !== undefined) data.priority = priority
    if (urgency !== undefined) data.urgency = urgency
    if (req.body.category !== undefined) data.category = req.body.category
    if (req.body.module !== undefined) data.module = req.body.module
    if (req.body.externalId !== undefined) data.externalId = req.body.externalId || null
    if (requestedAt !== undefined) data.requestedAt = requestedAt ? new Date(requestedAt) : null
    if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null
    if (assigneeId !== undefined) data.assigneeId = assigneeId
    const issue = await prisma.issue.update({
      where: { id: Number(req.params.id) },
      data,
      include: { assignee: { select: { id: true, name: true } } },
    })
    res.json(issue)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 삭제
router.delete('/:id', async (req, res) => {
  try {
    await prisma.issue.delete({ where: { id: Number(req.params.id) } })
    res.status(204).send()
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 댓글 목록 조회
router.get('/:id/comments', async (req, res) => {
  try {
    const issueId = Number(req.params.id)
    const comments = await prisma.issueComment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    })
    res.json({ data: comments })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 댓글 생성
router.post('/:id/comments', async (req, res) => {
  try {
    const issueId = Number(req.params.id)
    const { content } = req.body as { content: string }
    if (!content || content.trim() === '') {
      res.status(400).json({ message: '댓글 내용을 입력해주세요.' })
      return
    }
    const comment = await prisma.issueComment.create({
      data: {
        issueId,
        userId: req.user!.id,
        content: content.trim(),
      },
      include: { user: { select: { id: true, name: true } } },
    })
    res.status(201).json({ data: comment })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 댓글 수정 (본인만)
router.patch('/:id/comments/:commentId', async (req, res) => {
  try {
    const commentId = Number(req.params.commentId)
    const { content } = req.body as { content: string }
    const comment = await prisma.issueComment.findUnique({ where: { id: commentId } })
    if (!comment) {
      res.status(404).json({ message: '댓글을 찾을 수 없습니다.' })
      return
    }
    if (comment.userId !== req.user!.id) {
      res.status(403).json({ message: '본인의 댓글만 수정할 수 있습니다.' })
      return
    }
    const updated = await prisma.issueComment.update({
      where: { id: commentId },
      data: { content },
      include: { user: { select: { id: true, name: true } } },
    })
    res.json({ data: updated })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 댓글 삭제 (본인 또는 관리자)
router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const commentId = Number(req.params.commentId)
    const userId = req.user!.id
    const comment = await prisma.issueComment.findUnique({ where: { id: commentId } })
    if (!comment) {
      res.status(404).json({ message: '댓글을 찾을 수 없습니다.' })
      return
    }
    // 본인 또는 admin
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (comment.userId !== userId && user?.role !== 'admin') {
      res.status(403).json({ message: '본인의 댓글만 삭제할 수 있습니다.' })
      return
    }
    await prisma.issueComment.delete({ where: { id: commentId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 파일 목록
router.get('/:id/files', async (req, res) => {
  try {
    const files = await prisma.issueFile.findMany({
      where: { issueId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: files })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 파일 업로드
router.post('/:id/files', upload.single('file'), async (req, res) => {
  try {
    const issueId = Number(req.params.id)
    const file = req.file
    if (!file) {
      res.status(400).json({ message: '파일을 선택해주세요.' })
      return
    }
    const issueFile = await prisma.issueFile.create({
      data: {
        issueId,
        filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        path: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
    })
    res.status(201).json({ data: issueFile })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 파일 삭제
router.delete('/:id/files/:fileId', async (req, res) => {
  try {
    const fileId = Number(req.params.fileId)
    const file = await prisma.issueFile.findUnique({ where: { id: fileId } })
    if (!file) {
      res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
      return
    }
    // 디스크 삭제
    const filePath = path.resolve(path.join(__dirname, '../../uploads', file.path))
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    await prisma.issueFile.delete({ where: { id: fileId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
