import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 프로젝트 목록 (페이지네이션)
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const size = Number(req.query.size) || 10
    const skip = (page - 1) * size

    const [data, total] = await Promise.all([
      prisma.project.findMany({
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true, issues: true } } },
      }),
      prisma.project.count(),
    ])

    res.json({ data, total, page, size })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 프로젝트 생성
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body
    const userId = req.user!.id

    const project = await prisma.project.create({
      data: {
        name,
        description,
        // 생성자를 owner로 자동 등록
        members: { create: { userId, role: 'owner' } },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    })

    res.status(201).json(project)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 프로젝트 상세
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { issues: true } },
      },
    })
    if (!project) {
      res.status(404).json({ message: '프로젝트를 찾을 수 없습니다.' })
      return
    }
    res.json(project)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 프로젝트 수정
router.put('/:id', async (req, res) => {
  try {
    const { name, description, status } = req.body
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: { name, description, status },
    })
    res.json(project)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 프로젝트 삭제
router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 멤버 목록
router.get('/:id/members', async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { projectId: Number(req.params.id) },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    res.json(members)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 멤버 추가 (이메일로 검색하여 추가)
router.post('/:id/members', async (req, res) => {
  try {
    const { email, role } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(404).json({ message: '해당 이메일의 사용자를 찾을 수 없습니다.' })
      return
    }
    const member = await prisma.member.create({
      data: { projectId: Number(req.params.id), userId: user.id, role: role || 'dev' },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(member)
  } catch {
    res.status(500).json({ message: '이미 등록된 멤버이거나 서버 오류입니다.' })
  }
})

// 멤버 역할 변경
router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { role } = req.body
    const member = await prisma.member.update({
      where: { id: Number(req.params.memberId) },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    res.json(member)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 멤버 삭제
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    await prisma.member.delete({ where: { id: Number(req.params.memberId) } })
    res.status(204).send()
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 목록
router.get('/:id/issues', async (req, res) => {
  try {
    const issues = await prisma.issue.findMany({
      where: { projectId: Number(req.params.id) },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: { assignee: { select: { id: true, name: true } } },
    })
    res.json(issues)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 이슈 생성
router.post('/:id/issues', async (req, res) => {
  try {
    const { title, priority, urgency, requestedAt, dueAt, assigneeId, status } = req.body
    // 해당 상태 컬럼의 마지막 order 값 + 1
    const maxOrder = await prisma.issue.aggregate({
      where: { projectId: Number(req.params.id), status: status || 'todo' },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const issue = await prisma.issue.create({
      data: {
        projectId: Number(req.params.id),
        title,
        priority: priority || 'mid',
        urgency: urgency || 'normal',
        requestedAt: requestedAt ? new Date(requestedAt) : null,
        dueAt: dueAt ? new Date(dueAt) : null,
        assigneeId: assigneeId || null,
        status: status || 'todo',
        order: nextOrder,
      },
      include: { assignee: { select: { id: true, name: true } } },
    })
    res.status(201).json(issue)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
