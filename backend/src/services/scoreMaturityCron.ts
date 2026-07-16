import cron from 'node-cron'
import { matureSnapshots } from './scoreMaturity'

// 평일 장마감 후(15:40) 만기 도래 스냅샷을 D+3 종가로 확정
export function startScoreMaturityCron() {
  cron.schedule('40 15 * * 1-5', async () => {
    console.log('[score-maturity-cron] 만기 스냅샷 확정 시작')
    try {
      const { checked, matured } = await matureSnapshots()
      console.log(`[score-maturity-cron] 완료: ${checked}건 검사, ${matured}건 확정`)
    } catch (e) {
      console.error('[score-maturity-cron] 실패:', e)
    }
  })

  console.log('[score-maturity-cron] 스케줄러 등록 완료: 15:40 (평일)')
}
