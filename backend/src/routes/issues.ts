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

// 이슈 수정 (상태, 담당자, 우선순위 변경)
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, priority, assigneeId } = req.body
    const issue = await prisma.issue.update({
      where: { id: Number(req.params.id) },
      data: { title, description, status, priority, assigneeId },
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
