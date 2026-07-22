import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'
import { findTmdbMovie } from '../services/tmdb'
import { isAdultGenre } from '../services/movieMetadata'

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

    // 동기화 단계에서 걸러지지만, 상영 캘린더에는 성인물이 절대 노출되지 않도록 방어적으로 재확인
    res.json({ data: movies.filter(movie => !isAdultGenre(movie.genreNm)) })
  } catch (err) {
    console.error('GET /movies error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 내 북마크: 영화 전체 정보 =====
// GET /movies/bookmarks → 로그인 사용자가 북마크한 영화 목록(Movie[]), 개봉일 오름차순(미정작은 뒤로)
// 주의: /:movieCd 보다 먼저 정의해야 파라미터 라우트에 잡히지 않음
router.get('/bookmarks', async (req, res) => {
  try {
    const bookmarks = await prisma.movieBookmark.findMany({
      where: { userId: req.user!.id },
      include: { movie: true },
      orderBy: { movie: { openDt: 'asc' } },
    })

    const movies = bookmarks.map(bookmark => bookmark.movie).filter(movie => !isAdultGenre(movie.genreNm))
    res.json({ data: movies })
  } catch (err) {
    console.error('GET /movies/bookmarks error:', err)
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

    res.json({ data: movies.filter(movie => !isAdultGenre(movie.genreNm)) })
  } catch (err) {
    console.error('GET /movies/now-showing error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 북마크 추가 =====
// POST /movies/:movieCd/bookmark → 영화 존재 확인 후 멱등 upsert
router.post('/:movieCd/bookmark', async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { movieCd: req.params.movieCd },
    })

    if (!movie) {
      res.status(404).json({ message: '영화를 찾을 수 없습니다.' })
      return
    }

    const userId = req.user!.id
    await prisma.movieBookmark.upsert({
      where: { userId_movieCd: { userId, movieCd: req.params.movieCd } },
      create: { userId, movieCd: req.params.movieCd },
      update: {},
    })

    res.json({ data: { movieCd: req.params.movieCd } })
  } catch (err) {
    console.error('POST /movies/:movieCd/bookmark error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 북마크 삭제 =====
// DELETE /movies/:movieCd/bookmark → 없어도 성공하는 멱등 삭제
router.delete('/:movieCd/bookmark', async (req, res) => {
  try {
    await prisma.movieBookmark.deleteMany({
      where: { userId: req.user!.id, movieCd: req.params.movieCd },
    })

    res.json({ data: { movieCd: req.params.movieCd } })
  } catch (err) {
    console.error('DELETE /movies/:movieCd/bookmark error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// ===== 상세: 단일 영화 =====
// GET /movies/:movieCd → 드로어용 상세, 없으면 404. 미조회 상태면 TMDB로 지연 보강
router.get('/:movieCd', async (req, res) => {
  try {
    let movie = await prisma.movie.findUnique({
      where: { movieCd: req.params.movieCd },
    })

    if (!movie) {
      res.status(404).json({ message: '영화를 찾을 수 없습니다.' })
      return
    }

    if (movie.tmdbCheckedAt === null && process.env.TMDB_API_KEY) {
      try {
        const metadata = await findTmdbMovie(movie)
        const data = metadata
          ? { ...metadata, tmdbCheckedAt: new Date() }
          : { tmdbCheckedAt: new Date() }
        movie = await prisma.movie.update({ where: { movieCd: req.params.movieCd }, data })
      } catch (error) {
        // 네트워크 등 일시 오류는 tmdbCheckedAt을 기록하지 않아 다음 요청에서 재시도한다.
        console.error('TMDB enrichment failed:', error)
      }
    }

    res.json({ data: movie })
  } catch (err) {
    console.error('GET /movies/:movieCd error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
