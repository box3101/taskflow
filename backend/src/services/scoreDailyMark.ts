import prisma from '../prisma'
import { HORIZON_DAYS, fetchClosePrice } from './scoreMaturity'

// 만기 지난 뒤 이 범위까지는 마크를 계속 찍는다 (확정 cron 누락 대비)
const MARK_SLACK = 3

interface SnapItem {
  code: string
  entryPrice: number
  exitPrice?: number
  [k: string]: any
}

// 오늘 날짜 (YYYY-MM-DD, 로컬)
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 진입일 이후 경과 거래일 수 (주말 제외, 공휴일 무시)
function tradingDayAge(entryDate: string): number {
  const start = new Date(entryDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let count = 0
  const cur = new Date(start)
  while (cur < now) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

/**
 * 아직 만기가 안 온 스냅샷 종목들의 오늘 종가를 기록한다.
 * 자산곡선을 회차 단위가 아니라 일 단위로 그리기 위한 원재료다.
 * 만기 확정보다 먼저 실행해야 청산일 당일 종가도 남는다.
 */
export async function markDailyCloses(): Promise<{ snapshots: number; marks: number }> {
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { entryDate: { not: null } },
    orderBy: { date: 'desc' },
    take: 50,
  })

  const today = todayStr()
  let snapshotCount = 0
  let markCount = 0

  for (const snap of snapshots) {
    const items = (snap.data as unknown as SnapItem[]) || []
    if (!Array.isArray(items) || items.length === 0) continue

    // 이미 확정된 스냅샷은 더 찍을 필요 없다
    if (items.every(i => i.exitPrice != null)) continue

    const age = tradingDayAge(snap.entryDate!)
    if (age > HORIZON_DAYS + MARK_SLACK) continue // 너무 오래된 미확정 건은 스킵

    // 오늘 이미 찍었으면 건너뛴다 (cron 재실행 대비)
    const existing = await prisma.scoreDailyMark.count({
      where: { snapshotDate: snap.date, date: today },
    })
    if (existing > 0) continue

    const rows: { snapshotDate: string; code: string; date: string; close: number }[] = []
    for (const item of items) {
      const close = await fetchClosePrice(item.code)
      if (close > 0) {
        rows.push({ snapshotDate: snap.date, code: item.code, date: today, close })
      }
    }

    if (rows.length > 0) {
      const res = await prisma.scoreDailyMark.createMany({ data: rows, skipDuplicates: true })
      markCount += res.count
      snapshotCount++
      console.log(`[score-daily-mark] ${snap.date} → ${today} ${res.count}종목 기록 (경과 ${age}거래일)`)
    }
  }

  return { snapshots: snapshotCount, marks: markCount }
}
