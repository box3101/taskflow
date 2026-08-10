import { describe, it, expect } from 'vitest'
import type { ScoreSnapshotFull, ScoreSnapshotItem } from '../api/stockApi'
import {
  tradingDaysBetween, addTradingDays, selectCycles,
  HORIZON_DAYS, FEE_RATE, TAX_RATE,
} from './scoreSimulation'

// ===== 테스트 픽스처 =====
function item(over: Partial<ScoreSnapshotItem> & { code: string; total: number; entryPrice: number }): ScoreSnapshotItem {
  return {
    name: over.code,
    theme: '테스트',
    rank: 0,
    supply: 0,
    momentum: 0,
    surge: 0,
    valuation: 0,
    ...over,
  }
}

function snap(date: string, entryDate: string | null, items: ScoreSnapshotItem[]): ScoreSnapshotFull {
  return { id: 0, date, entryDate, memo: null, createdAt: '', data: items }
}

describe('거래일 유틸', () => {
  it('주말을 건너뛰고 거래일 수를 센다', () => {
    // 08/06(목) → 08/07(금), 08/10(월), 08/11(화) = 3거래일
    expect(tradingDaysBetween('2026-08-06', '2026-08-11')).toBe(3)
  })

  it('같은 날짜면 0을 반환한다', () => {
    expect(tradingDaysBetween('2026-08-10', '2026-08-10')).toBe(0)
  })

  it('N거래일 뒤 날짜를 구한다', () => {
    expect(addTradingDays('2026-08-06', 3)).toBe('2026-08-11')
  })

  it('금요일 +1거래일은 월요일이다', () => {
    expect(addTradingDays('2026-08-07', 1)).toBe('2026-08-10')
  })

  it('상수값이 스펙과 일치한다', () => {
    expect(HORIZON_DAYS).toBe(3)
    expect(FEE_RATE).toBe(0.00015)
    expect(TAX_RATE).toBe(0.0015)
  })
})

describe('논오버랩 사이클 선택', () => {
  const A = snap('2026-08-05', '2026-08-06', [item({ code: 'A', total: 80, entryPrice: 1000 })])
  const B = snap('2026-08-06', '2026-08-07', [item({ code: 'B', total: 80, entryPrice: 1000 })])
  const C = snap('2026-08-10', '2026-08-11', [item({ code: 'C', total: 80, entryPrice: 1000 })])
  const D = snap('2026-08-04', null, [item({ code: 'D', total: 80, entryPrice: 1000 })])

  it('직전 사이클 보유 중인 스냅샷을 건너뛴다', () => {
    const { picked, skipped } = selectCycles([A, B, C])
    expect(picked.map(p => p.snap.date)).toEqual(['2026-08-05', '2026-08-10'])
    expect(skipped).toEqual([
      { date: '2026-08-06', entryDate: '2026-08-07', reason: 'holding' },
    ])
  })

  it('미확정 스냅샷의 청산일은 진입일 +3거래일로 잡는다', () => {
    const { picked } = selectCycles([A])
    expect(picked[0].exitDate).toBe('2026-08-11')
  })

  it('확정된 스냅샷은 실제 exitDate를 청산일로 쓴다', () => {
    const matured = snap('2026-08-05', '2026-08-06', [
      item({ code: 'A', total: 80, entryPrice: 1000, exitPrice: 1100, exitDate: '2026-08-12' }),
    ])
    const { picked } = selectCycles([matured])
    expect(picked[0].exitDate).toBe('2026-08-12')
  })

  it('진입일이 없는 스냅샷은 제외한다', () => {
    const { picked, skipped } = selectCycles([D, A])
    expect(picked.map(p => p.snap.date)).toEqual(['2026-08-05'])
    expect(skipped).toEqual([
      { date: '2026-08-04', entryDate: null, reason: 'no-entry-date' },
    ])
  })

  it('입력 순서와 무관하게 진입일 오름차순으로 처리한다', () => {
    const { picked } = selectCycles([C, B, A])
    expect(picked.map(p => p.snap.date)).toEqual(['2026-08-05', '2026-08-10'])
  })

  it('스냅샷이 없으면 빈 결과를 반환한다', () => {
    expect(selectCycles([])).toEqual({ picked: [], skipped: [] })
  })
})
