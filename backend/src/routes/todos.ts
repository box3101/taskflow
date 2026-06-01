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

const UPLOADS_DIR = path.resolve(path.join(__dirname, '../../uploads'))

// 디스크에서 파일 안전 삭제 (uploads 디렉토리 밖 접근 방지)
function removeFileFromDisk(filePath: string) {
  const fullPath = path.resolve(path.join(UPLOADS_DIR, filePath))
  if (!fullPath.startsWith(UPLOADS_DIR)) return
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
}

// 할일에 연결된 파일들을 디스크에서 일괄 삭제
async function removeFilesForTodos(todoIds: number[]) {
  if (todoIds.length === 0) return
  const files = await prisma.todoFile.findMany({
    where: { todoId: { in: todoIds } },
    select: { path: true },
  })
  for (const f of files) {
    removeFileFromDisk(f.path)
  }
}

// 반복 할일 다음 날짜 계산
function getNextRepeatDate(repeatType: string, repeatDay: number | null, baseDate: Date): Date {
  const next = new Date(baseDate)
  if (repeatType === 'daily') {
    next.setDate(next.getDate() + 1)
  } else if (repeatType === 'weekly' && repeatDay !== null) {
    next.setDate(next.getDate() + 7)
  } else if (repeatType === 'monthly' && repeatDay !== null) {
    next.setMonth(next.getMonth() + 1)
    next.setDate(repeatDay)
  }
  return next
}

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

    // repeatType, repeatDay 처리
    const safeRepeatType = ['daily', 'weekly', 'monthly'].includes(req.body.repeatType)
      ? req.body.repeatType
      : null
    const safeRepeatDay =
      req.body.repeatDay !== undefined && req.body.repeatDay !== null
        ? Number(req.body.repeatDay)
        : null

    const todo = await prisma.todo.create({
      data: {
        userId,
        title: title.trim(),
        dueDate: safeDueDate,
        memo: memo ?? null,
        repeatType: safeRepeatType,
        repeatDay: safeRepeatDay,
      },
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
    const { done, title, memo, dueDate, repeatType, repeatDay } = req.body

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
    if (repeatType !== undefined) {
      updateData.repeatType = ['daily', 'weekly', 'monthly'].includes(repeatType) ? repeatType : null
    }
    if (repeatDay !== undefined) {
      updateData.repeatDay = repeatDay !== null ? Number(repeatDay) : null
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData,
      include: { files: true },
    })

    // 완료 시 반복 할일 → 다음 반복일로 리셋 (새 할일 안 만들고 같은 할일 재사용)
    if (
      done === true &&
      !existing.done &&
      existing.repeatType &&
      ['daily', 'weekly', 'monthly'].includes(existing.repeatType)
    ) {
      const baseDate = existing.dueDate ? new Date(existing.dueDate) : new Date()
      const nextDate = getNextRepeatDate(existing.repeatType, existing.repeatDay, baseDate)
      const dueDateStr = nextDate.toISOString().slice(0, 10)

      // 같은 할일을 미완료로 리셋 + 다음 반복일로 업데이트
      await prisma.todo.update({
        where: { id },
        data: { done: false, dueDate: new Date(dueDateStr) },
      })

      // 응답은 리셋된 상태로 반환
      const resetTodo = await prisma.todo.findUnique({ where: { id }, include: { files: true } })
      return res.json({ data: resetTodo })
    }

    res.json({ data: todo })
  } catch (err) {
    console.error('PATCH /todos error:', err)
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

// 할일 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const todo = await prisma.todo.findFirst({
      where: { id, userId, deletedAt: null },
      include: { files: true },
    })
    if (!todo) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 휴지통 전체 비우기 (/:id 보다 먼저 등록)
router.delete('/trash/empty', async (req, res) => {
  try {
    const userId = req.user!.id
    // 삭제 대상 할일 ID 조회 → 디스크 파일 정리 → DB 삭제
    const trashed = await prisma.todo.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { id: true },
    })
    const ids = trashed.map(t => t.id)
    await removeFilesForTodos(ids)
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
      include: { files: true },
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
      include: { files: true },
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

    // 디스크 파일 정리 후 DB 삭제
    await removeFilesForTodos([id])
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
      // 소유권 체크 실패 — 이미 저장된 파일 정리
      removeFileFromDisk(file.filename)
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
    // DB 실패 시 디스크 파일 롤백
    if (req.file) removeFileFromDisk(req.file.filename)
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

    // 디스크에서 삭제 (path traversal 방지)
    removeFileFromDisk(file.path)

    await prisma.todoFile.delete({ where: { id: fileId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '파일 삭제에 실패했습니다.' })
  }
})

export default router
