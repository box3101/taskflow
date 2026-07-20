// 상영 캘린더 동기화 수동 실행 (M1 동작 확인용)
// 사용: KOBIS_API_KEY 설정 후 → npm run sync:movies
import 'dotenv/config'
import prisma from '../prisma'
import { syncMovies } from '../services/syncMoviesCron'

async function main() {
  console.log('[sync-movies-once] 수동 동기화 시작')
  const result = await syncMovies()
  console.log('[sync-movies-once] 결과:', result)

  // 결과 확인용 요약 출력
  const total = await prisma.movie.count()
  const nowShowing = await prisma.movie.count({ where: { boxRank: { not: null } } })
  const withOpenDt = await prisma.movie.count({ where: { openDt: { not: null } } })
  console.log(`[sync-movies-once] Movie 테이블: 총 ${total}행, 개봉일 있음 ${withOpenDt}행, 현재상영작(박스오피스) ${nowShowing}행`)

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (e) => {
  console.error('[sync-movies-once] 실패:', e)
  await prisma.$disconnect()
  process.exit(1)
})
