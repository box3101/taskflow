import { describe, it, expect } from 'vitest'
import { tradingDaysBetween, addTradingDays, HORIZON_DAYS, FEE_RATE, TAX_RATE } from './scoreSimulation'

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
