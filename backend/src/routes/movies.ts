import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ===== 캘린더용: 해당 월 개봉작 =====
// GET /movies?year&month → openDt가 그 달에 속하는 영화 (openDt 오름차순)
router.get('/', async (req, res) => {
  try {
    const year = Number(req.query.year)
    const month = Number(req.query.month)

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ message: 'year, month 파라미터가 필요합니다.' })
      return
    }

    // openDt는 UTC 자정 저장(@db.Date) → UTC 기준 월 경계로 조회
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 1)) // 다음 달 1일 (exclusive)

    const movies = await prisma.movie.findMany({
      where: { openDt: { gte: start, lt: end } },
      orderBy: [{ openDt: 'asc' }, { movieNm: 'asc' }],
    })

    res.json({ data: movies })
  } catch (err) {
    console.error('GET /movies error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 현재상영작: 최신 박스오피스 =====
// GET /movies/now-showing → boxRank 있는 영화, 순위 오름차순
// 주의: /:movieCd 보다 먼저 정의해야 파라미터 라우트에 잡히지 않음
router.get('/now-showing', async (_req, res) => {
  try {
    const movies = await prisma.movie.findMany({
      where: { boxRank: { not: null } },
      orderBy: { boxRank: 'asc' },
    })

    res.json({ data: movies })
  } catch (err) {
    console.error('GET /movies/now-showing error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 상세: 단일 영화 =====
// GET /movies/:movieCd → 드로어용 상세, 없으면 404
router.get('/:movieCd', async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { movieCd: req.params.movieCd },
    })

    if (!movie) {
      res.status(404).json({ message: '영화를 찾을 수 없습니다.' })
      return
    }

    res.json({ data: movie })
  } catch (err) {
    console.error('GET /movies/:movieCd error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
