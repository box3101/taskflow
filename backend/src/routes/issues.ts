import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

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

export default router
