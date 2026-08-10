// 스코어 랭킹 가상매매 시뮬레이션 — Vue 의존성 없는 순수 계산 모듈
// 스펙: docs/superpowers/specs/2026-08-10-score-simulation-design.md

import type { ScoreSnapshotFull, ScoreSnapshotItem } from '../api/stockApi'

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

// ===== 타입 =====
export interface PickedCycle {
  snap: ScoreSnapshotFull
  exitDate: string          // 확정된 exitDate 또는 진입일 +HORIZON_DAYS 거래일
}

export interface SkippedSnapshot {
  date: string
  entryDate: string | null
  reason: 'holding' | 'no-entry-date'
}

// ===== 사이클 선택 =====

/**
 * 논오버랩 규칙으로 실제 매매할 스냅샷만 고른다.
 * 직전 사이클 청산일 이후(당일 포함)에 진입하는 스냅샷만 채택한다.
 * 청산일 종가로 팔고 같은 날 종가로 다시 사는 것은 가능하다고 본다.
 */
export function selectCycles(snapshots: ScoreSnapshotFull[]): {
  picked: PickedCycle[]
  skipped: SkippedSnapshot[]
} {
  const sorted = [...snapshots].sort((a, b) =>
    (a.entryDate || a.date).localeCompare(b.entryDate || b.date)
  )
  const picked: PickedCycle[] = []
  const skipped: SkippedSnapshot[] = []
  let cursor: string | null = null

  for (const snap of sorted) {
    if (!snap.entryDate) {
      skipped.push({ date: snap.date, entryDate: null, reason: 'no-entry-date' })
      continue
    }
    if (cursor !== null && snap.entryDate < cursor) {
      skipped.push({ date: snap.date, entryDate: snap.entryDate, reason: 'holding' })
      continue
    }
    const items: ScoreSnapshotItem[] = snap.data || []
    const confirmed = items.find(i => i.exitDate)
    const exitDate = confirmed?.exitDate || addTradingDays(snap.entryDate, HORIZON_DAYS)
    picked.push({ snap, exitDate })
    cursor = exitDate
  }

  return { picked, skipped }
}
