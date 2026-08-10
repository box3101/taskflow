import cron from 'node-cron'
import { matureSnapshots } from './scoreMaturity'
import { markDailyCloses } from './scoreDailyMark'

// 평일 장마감 후(15:40) 일별 종가 마크 → 만기 도래 스냅샷을 D+3 종가로 확정
// 마크를 먼저 찍어야 청산일 당일 종가가 곡선에 남는다 (확정되면 마크 대상에서 빠짐)
export function startScoreMaturityCron() {
  cron.schedule('40 15 * * 1-5', async () => {
    console.log('[score-maturity-cron] 일별 마크 + 만기 확정 시작')
    try {
      const { snapshots, marks } = await markDailyCloses()
      console.log(`[score-daily-mark] 완료: ${snapshots}개 스냅샷, ${marks}종목 기록`)
    } catch (e) {
      console.error('[score-daily-mark] 실패:', e)
    }
    try {
      const { checked, matured } = await matureSnapshots()
      console.log(`[score-maturity-cron] 완료: ${checked}건 검사, ${matured}건 확정`)
    } catch (e) {
      console.error('[score-maturity-cron] 실패:', e)
    }
  })

  console.log('[score-maturity-cron] 스케줄러 등록 완료: 15:40 (평일, 마크→확정)')
}
