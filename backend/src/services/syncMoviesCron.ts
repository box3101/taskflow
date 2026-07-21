import cron from 'node-cron'
import prisma from '../prisma'
import { fetchMovieList, fetchDailyBoxOffice, parseKobisDate, type KobisMovie } from './kobis'
import { isAdultGenre, isLikelyRerelease } from './movieMetadata'

// ===== 헬퍼 =====
// N일 전 날짜를 "YYYYMMDD"로
function ymdDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// 배열을 size 단위로 끊어 병렬 처리 (Railway 왕복 부담 완화)
async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

// ===== 1. 박스오피스 동기화 =====
// KOBIS는 당일 데이터가 다음날 확정 → "어제"부터 조회, 비면 하루씩 뒤로 폴백(최대 5일)
async function syncBoxOffice(): Promise<number> {
  let list: Awaited<ReturnType<typeof fetchDailyBoxOffice>> = []
  let usedDt = ''
  for (let back = 1; back <= 5; back++) {
    const targetDt = ymdDaysAgo(back)
    const items = await fetchDailyBoxOffice({ targetDt })
    if (items.length > 0) {
      list = items
      usedDt = targetDt
      break
    }
  }
  if (list.length === 0) {
    console.warn('[sync-movies] 박스오피스 데이터 없음 (최근 5일)')
    return 0
  }

  const boxDate = parseKobisDate(usedDt)

  // 이전 박스오피스 순위 초기화 → 이번에 빠진 영화는 현재상영작에서 자동 제외
  await prisma.movie.updateMany({
    data: { boxRank: null, audiCnt: null, audiAcc: null, boxUpdatedAt: null },
  })

  for (const b of list) {
    const box = {
      boxRank: Number(b.rank) || null,
      audiCnt: Number(b.audiCnt) || null,
      audiAcc: Number(b.audiAcc) || null,
      boxUpdatedAt: boxDate,
      syncedAt: new Date(),
    }
    await prisma.movie.upsert({
      where: { movieCd: b.movieCd },
      create: { movieCd: b.movieCd, movieNm: b.movieNm, openDt: parseKobisDate(b.openDt), ...box },
      update: { movieNm: b.movieNm, ...box },
    })
  }
  console.log(`[sync-movies] 박스오피스 ${list.length}건 갱신 (기준일 ${usedDt})`)
  return list.length
}

// ===== 2. 개봉작 목록 동기화 =====
// 캘린더는 openDt 기준으로 배치하므로 openDt가 있는 행만 upsert (미정작은 제외)
async function upsertMovieMeta(m: KobisMovie): Promise<void> {
  const openDt = parseKobisDate(m.openDt)
  const productionYear = /^\d{4}$/.test(m.prdtYear || '') ? Number(m.prdtYear) : null
  if (isAdultGenre(m.genreAlt || m.repGenreNm)) return

  const data = {
    movieNm: m.movieNm,
    movieNmEn: m.movieNmEn || null,
    openDt,
    productionYear,
    isRerelease: isLikelyRerelease(openDt, productionYear),
    prdtStatNm: m.prdtStatNm || null,
    genreNm: m.genreAlt || m.repGenreNm || null,
    nationNm: m.nationAlt || m.repNationNm || null,
    directors: (m.directors || []).map(d => d.peopleNm).filter(Boolean).join(', ') || null,
    syncedAt: new Date(),
  }
  await prisma.movie.upsert({
    where: { movieCd: m.movieCd },
    create: { movieCd: m.movieCd, ...data },
    update: data,
  })
}

async function syncMovieListForYear(year: number): Promise<number> {
  const MAX_PAGES = 50 // 안전장치 (연간 개봉작이 이보다 많을 일은 없음)
  let count = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { totCnt, movieList } = await fetchMovieList({ openYear: year, curPage: page })
    if (movieList.length === 0) break

    const withOpen = movieList.filter(m => parseKobisDate(m.openDt))
    await inChunks(withOpen, 10, async (m) => {
      await upsertMovieMeta(m)
      count++
    })

    if (page * 100 >= totCnt) break
  }
  console.log(`[sync-movies] ${year}년 개봉작 ${count}건 갱신`)
  return count
}

async function removeAdultMovies(): Promise<number> {
  const movies = await prisma.movie.findMany({
    where: { genreNm: { not: null } },
    select: { id: true, genreNm: true },
  })
  const adultMovieIds = movies
    .filter(movie => isAdultGenre(movie.genreNm))
    .map(movie => movie.id)

  if (adultMovieIds.length === 0) return 0

  const { count } = await prisma.movie.deleteMany({
    where: { id: { in: adultMovieIds } },
  })
  console.log(`[sync-movies] 성인물 ${count}건 정리`)
  return count
}

// ===== 전체 동기화 (수동 실행 / 크론 공용) =====
// KOBIS 장애·키 미설정에도 앱을 죽이지 않도록 각 단계를 개별 try로 감싼다.
export async function syncMovies(): Promise<{ boxOffice: number; movies: number }> {
  if (!process.env.KOBIS_API_KEY) {
    console.warn('[sync-movies] KOBIS_API_KEY 미설정 — 동기화 건너뜀')
    return { boxOffice: 0, movies: 0 }
  }

  let boxOffice = 0
  let movies = 0

  try {
    boxOffice = await syncBoxOffice()
  } catch (e) {
    console.error('[sync-movies] 박스오피스 동기화 실패:', e)
  }

  try {
    const year = new Date().getFullYear()
    for (const y of [year, year + 1]) {
      movies += await syncMovieListForYear(y)
    }
    await removeAdultMovies()
  } catch (e) {
    console.error('[sync-movies] 개봉작 목록 동기화 실패:', e)
  }

  console.log(`[sync-movies] 완료: 박스오피스 ${boxOffice}건, 개봉작 ${movies}건`)
  return { boxOffice, movies }
}

// ===== 크론 등록 =====
// 매일 새벽 5시 동기화 (KOBIS 전일 데이터 확정 이후)
export function startSyncMoviesCron() {
  cron.schedule('0 5 * * *', async () => {
    console.log('[sync-movies-cron] 동기화 시작')
    try {
      await syncMovies()
    } catch (e) {
      console.error('[sync-movies-cron] 실패:', e)
    }
  })

  console.log('[sync-movies-cron] 스케줄러 등록 완료: 05:00 (매일)')
}
