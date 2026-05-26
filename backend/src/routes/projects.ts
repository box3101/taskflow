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

// 멤버 추가
router.post('/:id/members', async (req, res) => {
  try {
    const { userId, role } = req.body
    const member = await prisma.member.create({
      data: { projectId: Number(req.params.id), userId, role: role || 'dev' },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(member)
  } catch {
    res.status(500).json({ message: '이미 등록된 멤버이거나 서버 오류입니다.' })
  }
})

// 이슈 목록
router.get('/:id/issues', async (req, res) => {
  try {
    const issues = await prisma.issue.findMany({
      where: { projectId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' },
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
    const { title, priority, assigneeId } = req.body
    const issue = await prisma.issue.create({
      data: {
        projectId: Number(req.params.id),
        title,
        priority: priority || 'mid',
        assigneeId: assigneeId || null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    })
    res.status(201).json(issue)
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
