import prisma from '../prisma'

// 고정기간 백테스트 horizon (진입일 기준 N거래일 뒤 종가로 확정)
export const HORIZON_DAYS = 3
// cron 누락 대비 여유일 (이 범위 넘게 지난 미확정 스냅샷은 폴루션 방지 위해 스킵)
const MATURE_SLACK = 3

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

// 오늘 날짜 (YYYY-MM-DD, 로컬)
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Naver 모바일 API로 종가 조회
export async function fetchClosePrice(code: string): Promise<number> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const j: any = await res.json()
    return Number(String(j.closePrice || '').replace(/,/g, '')) || 0
  } catch (e) {
    console.warn(`[score-maturity] 종가 조회 실패 ${code}:`, e)
    return 0
  }
}

interface SnapItem {
  code: string
  entryPrice: number
  exitPrice?: number
  returnPct?: number
  exitDate?: string
  [k: string]: any
}

/**
 * 만기(진입 후 HORIZON_DAYS 거래일) 도래한 스냅샷을 그날 종가로 확정한다.
 * - 확정 결과는 data(JSON) 각 항목에 exitPrice/returnPct/exitDate로 저장 (스키마 변경 없음)
 * - 이미 확정됐거나(모든 항목 exitPrice 존재), 아직 미도래(age<H), 너무 오래된(age>H+slack) 건 스킵
 */
export async function matureSnapshots(): Promise<{ checked: number; matured: number }> {
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { entryDate: { not: null } },
    orderBy: { date: 'desc' },
    take: 200,
  })

  let maturedCount = 0
  const today = todayStr()

  for (const snap of snapshots) {
    const items = (snap.data as unknown as SnapItem[]) || []
    if (!Array.isArray(items) || items.length === 0) continue

    // 이미 확정된 스냅샷 스킵
    if (items.every(i => i.exitPrice != null)) continue

    const age = tradingDayAge(snap.entryDate!)
    if (age < HORIZON_DAYS) continue // 아직 미도래
    if (age > HORIZON_DAYS + MATURE_SLACK) {
      console.warn(`[score-maturity] 만기 지남·미확정 스킵: ${snap.date} (경과 ${age}거래일)`)
      continue
    }

    // 그날 종가로 확정
    const updated: SnapItem[] = []
    for (const item of items) {
      const exit = await fetchClosePrice(item.code)
      const entry = item.entryPrice || 0
      const returnPct = entry > 0 && exit > 0 ? ((exit - entry) / entry) * 100 : 0
      updated.push({ ...item, exitPrice: exit, returnPct, exitDate: today })
    }

    await prisma.scoreSnapshot.update({
      where: { id: snap.id },
      data: { data: updated as any },
    })
    maturedCount++
    console.log(`[score-maturity] 확정: ${snap.date} (진입 ${snap.entryDate}, 경과 ${age}거래일, ${items.length}종목)`)
  }

  return { checked: snapshots.length, matured: maturedCount }
}
