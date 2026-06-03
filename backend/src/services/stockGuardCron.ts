import cron from 'node-cron'
import prisma from '../prisma'
import { sendKakaoMessage } from './kakaoMessage'

const SCHEDULE_WINDOWS = [
  { cron: '5 9 * * 1-5', round: 1, open: '09:05', close: '13:00' },
  { cron: '0 13 * * 1-5', round: 2, open: '13:00', close: '15:35' },
  { cron: '35 15 * * 1-5', round: 3, open: '15:35', close: '16:00' },
  { cron: '37 21 * * 1-5', round: 4, open: '21:37', close: '21:45' },
]

function buildMessage(round: number, total: number, closeTime: string): string {
  return `📈 주식 확인 시간! (${round}/${total}회)\n지금부터 ${closeTime}까지 주식 페이지를 볼 수 있어요.`
}

export function startStockGuardCron() {
  const taskflowUrl = process.env.TASKFLOW_URL || 'http://localhost:5173'

  for (const window of SCHEDULE_WINDOWS) {
    cron.schedule(window.cron, async () => {
      console.log(`[stock-guard-cron] ${window.round}회차 알림 발송 시작`)

      try {
        const usersWithKakao = await prisma.kakaoToken.findMany({
          include: { user: true },
        })

        for (const kakaoToken of usersWithKakao) {
          const message = buildMessage(window.round, SCHEDULE_WINDOWS.length, window.close)
          await sendKakaoMessage(kakaoToken.userId, message, `${taskflowUrl}/stock`)
        }

        console.log(`[stock-guard-cron] ${window.round}회차 알림 발송 완료`)
      } catch (e) {
        console.error(`[stock-guard-cron] ${window.round}회차 알림 실패:`, e)
      }
    })
  }

  console.log('[stock-guard-cron] 스케줄러 등록 완료: 09:05, 13:00, 15:35 (평일)')
}
