import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET / — 모든 결과 조회
router.get('/', async (_req, res) => {
  try {
    const results = await prisma.marketEventResult.findMany()
    const map: Record<string, { actual: string | null; memo: string | null; impact: string | null }> = {}
    for (const r of results) {
      map[r.eventId] = { actual: r.actual, memo: r.memo, impact: r.impact }
    }
    res.json({ data: map })
  } catch (err) {
    console.error('GET /market-events error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:eventId — 결과 저장 (upsert)
router.put('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const { actual, memo, impact } = req.body

    const result = await prisma.marketEventResult.upsert({
      where: { eventId },
      create: {
        eventId,
        actual: actual?.trim() || null,
        memo: memo?.trim() || null,
        impact: impact || null,
      },
      update: {
        actual: actual?.trim() || null,
        memo: memo?.trim() || null,
        impact: impact || null,
      },
    })
    res.json({ data: result })
  } catch (err) {
    console.error('PUT /market-events error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
