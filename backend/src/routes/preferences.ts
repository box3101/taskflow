import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET / — 내 설정 조회
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const pref = await prisma.userPreference.findUnique({ where: { userId } })
    res.json({ data: pref?.preferences || {} })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.json({ data: {} })
      return
    }
    console.error('GET /preferences error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT / — 설정 저장 (upsert)
router.put('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { preferences } = req.body

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, preferences: preferences || {} },
      update: { preferences: preferences || {} },
    })
    res.json({ data: pref.preferences })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      res.status(503).json({ message: '테이블 마이그레이션 필요' })
      return
    }
    console.error('PUT /preferences error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
