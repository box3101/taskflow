// 스코어 랭킹 가상매매 시뮬레이션 — Vue 의존성 없는 순수 계산 모듈
// 스펙: docs/superpowers/specs/2026-08-10-score-simulation-design.md

// ===== 상수 =====
export const HORIZON_DAYS = 3       // D+3 고정 청산
export const FEE_RATE = 0.00015     // 수수료 (매수·매도 각각)
export const TAX_RATE = 0.0015      // 증권거래세 (매도시)

// ===== 거래일 유틸 (주말 제외, 공휴일 무시) =====

/** from(제외) ~ to(포함) 사이 거래일 수 */
export function tradingDaysBetween(from: string, to: string): number {
  const end = new Date(to + 'T00:00:00')
  const cur = new Date(from + 'T00:00:00')
  let count = 0
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

/** from 기준 N거래일 뒤 날짜 (YYYY-MM-DD) */
export function addTradingDays(from: string, days: number): string {
  const cur = new Date(from + 'T00:00:00')
  let added = 0
  while (added < days) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  const y = cur.getFullYear()
  const m = String(cur.getMonth() + 1).padStart(2, '0')
  const d = String(cur.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
