import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 오늘의 각오 조회
router.get('/today', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const motto = await prisma.dailyMotto.findUnique({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: today,
        },
      },
    })
    res.json({ data: motto })
  } catch {
    res.status(500).json({ error: '각오 조회에 실패했습니다.' })
  }
})

// 각오 저장 (upsert)
router.post('/', async (req, res) => {
  try {
    const content = (req.body.content || '').trim()
    if (!content) return res.status(400).json({ error: '내용을 입력해주세요.' })
    if (content.length > 200) return res.status(400).json({ error: '200자 이내로 입력해주세요.' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const motto = await prisma.dailyMotto.upsert({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: today,
        },
      },
      update: { content },
      create: {
        userId: req.user!.id,
        content,
        date: today,
      },
    })
    res.json({ data: motto })
  } catch {
    res.status(500).json({ error: '각오 저장에 실패했습니다.' })
  }
})

// 각오 삭제
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.dailyMotto.deleteMany({
      where: { id, userId: req.user!.id },
    })
    res.json({ data: null })
  } catch {
    res.status(500).json({ error: '각오 삭제에 실패했습니다.' })
  }
})

export default router
