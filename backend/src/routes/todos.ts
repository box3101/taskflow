import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      cb(null, `${unique}${path.extname(file.originalname)}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

const router = Router()
router.use(authenticate)

// 내 할일 목록 조회 (마감일 가까운 순, 마감일 없으면 뒤로)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const todos = await prisma.todo.findMany({
      where: { userId, deletedAt: null },
      include: { files: true },
      orderBy: [{ done: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    })
    res.json({ data: todos })
  } catch (err) {
    console.error('GET /todos error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, dueDate, memo } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '할일 제목을 입력해주세요.' })
      return
    }
    if (title.length > 500) {
      res.status(400).json({ message: '할일 제목은 500자 이내로 입력해주세요.' })
      return
    }

    let safeDueDate: Date | null = null
    if (dueDate && typeof dueDate === 'string') {
      const parsed = new Date(dueDate)
      if (!isNaN(parsed.getTime())) safeDueDate = parsed
    }

    const todo = await prisma.todo.create({
      data: { userId, title: title.trim(), dueDate: safeDueDate, memo: memo ?? null },
    })
    res.status(201).json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 할일 수정
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const { done, title, memo, dueDate } = req.body

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
    if (memo !== undefined) {
      updateData.memo = typeof memo === 'string' ? memo : null
    }
    if (dueDate !== undefined) {
      if (dueDate === null) {
        updateData.dueDate = null
      } else if (typeof dueDate === 'string') {
        const parsed = new Date(dueDate)
        if (!isNaN(parsed.getTime())) updateData.dueDate = parsed
      }
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData,
    })
    res.json({ data: todo })
  } catch (err) {
    console.error('POST /todos error:', err)
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

// 파일 업로드
router.post('/:id/files', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const file = req.file
    if (!file) {
      res.status(400).json({ message: '파일을 선택해주세요.' })
      return
    }

    const existing = await prisma.todo.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    // 한글 파일명 디코딩
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8')

    const todoFile = await prisma.todoFile.create({
      data: {
        todoId: id,
        filename: decodedName,
        path: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
    })
    res.status(201).json({ data: todoFile })
  } catch {
    res.status(500).json({ message: '파일 업로드에 실패했습니다.' })
  }
})

// 파일 삭제
router.delete('/:id/files/:fileId', async (req, res) => {
  try {
    const userId = req.user!.id
    const todoId = Number(req.params.id)
    const fileId = Number(req.params.fileId)

    const todo = await prisma.todo.findFirst({ where: { id: todoId, userId } })
    if (!todo) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }

    const file = await prisma.todoFile.findFirst({ where: { id: fileId, todoId } })
    if (!file) {
      res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
      return
    }

    // 디스크에서 삭제
    const filePath = path.join(__dirname, '../../uploads', file.path)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    await prisma.todoFile.delete({ where: { id: fileId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '파일 삭제에 실패했습니다.' })
  }
})

export default router
