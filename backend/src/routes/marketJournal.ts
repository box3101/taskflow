import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /:date — 특정 날짜 일지 조회
router.get('/:date', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    const journal = await prisma.marketJournal.findUnique({
      where: { userId_date: { userId, date } },
    })
    res.json({ data: journal })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.json({ data: null })
      return
    }
    console.error('GET /market-journal error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// GET / — 월별 일지 목록 (요약만)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { year, month } = req.query
    const prefix = year && month
      ? `${year}-${String(month).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 7)

    const journals = await prisma.marketJournal.findMany({
      where: {
        userId,
        date: { startsWith: prefix },
      },
      select: { date: true, summary: true, updatedAt: true },
      orderBy: { date: 'desc' },
    })
    res.json({ data: journals })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.json({ data: [] })
      return
    }
    console.error('GET /market-journal error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:date — 일지 저장 (upsert)
router.put('/:date', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date } = req.params
    const { content, summary } = req.body

    if (!content?.trim()) {
      res.status(400).json({ message: '내용을 입력해주세요.' })
      return
    }

    const journal = await prisma.marketJournal.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        content: content.trim(),
        summary: summary?.trim() || null,
      },
      update: {
        content: content.trim(),
        summary: summary?.trim() || null,
      },
    })
    res.json({ data: journal })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.status(503).json({ message: '테이블 마이그레이션 필요' })
      return
    }
    console.error('PUT /market-journal error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:date — 일지 삭제
router.delete('/:date', async (req, res) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    await prisma.marketJournal.delete({
      where: { userId_date: { userId, date } },
    })
    res.json({ message: '삭제되었습니다.' })
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ message: '일지를 찾을 수 없습니다.' })
      return
    }
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.status(503).json({ message: '테이블 마이그레이션 필요' })
      return
    }
    console.error('DELETE /market-journal error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
