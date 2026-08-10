import { describe, it, expect } from 'vitest'
import type { ScoreSnapshotFull, ScoreSnapshotItem, ScoreDailyMark } from '../api/stockApi'
import {
  tradingDaysBetween, addTradingDays, selectCycles, simulate, computeMdd,
  buildDailySeries, computeDailyMdd,
  HORIZON_DAYS, FEE_RATE, TAX_RATE,
} from './scoreSimulation'
import type { SimCycle } from './scoreSimulation'

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

describe('사이클 손익 계산', () => {
  it('단주는 버림 처리하고 잔돈은 현금으로 남긴다', () => {
    // 종자금 100만, N=2 → 종목당 50만 배분
    // X: floor(500000/30000)=16주 → 48만 투입, Y: floor(500000/7000)=71주 → 49.7만 투입
    // 잔돈 = 1,000,000 - 977,000 = 23,000
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'X', total: 80, entryPrice: 30000, exitPrice: 33000, exitDate: '2026-08-11' }),
      item({ code: 'Y', total: 70, entryPrice: 7000, exitPrice: 7000, exitDate: '2026-08-11' }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 2, seedCash: 1000000 })

    const c = r.cycles[0]
    expect(c.holdings.map(h => h.quantity)).toEqual([16, 71])
    expect(c.investAmount).toBe(977000)
    // 비용전: 23,000 + (16×33,000 + 71×7,000) = 23,000 + 1,025,000
    expect(c.endAssetGross).toBe(1048000)
    // 비용후: 매수 round(977,000×0.00015)=147, 매도 round(1,025,000×0.00165)=1,691
    expect(c.tradeCost).toBe(1838)
    expect(c.endAsset).toBe(1046162)
  })

  it('비용전·비용후 누적수익률을 각각 낸다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'X', total: 80, entryPrice: 30000, exitPrice: 33000, exitDate: '2026-08-11' }),
      item({ code: 'Y', total: 70, entryPrice: 7000, exitPrice: 7000, exitDate: '2026-08-11' }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 2, seedCash: 1000000 })
    expect(r.totalReturnPctGross).toBeCloseTo(4.8, 4)
    expect(r.totalReturnPct).toBeCloseTo(4.6162, 4)
    expect(r.totalCost).toBe(1838)
  })

  it('점수 내림차순 상위 N종목만 매수한다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'LOW', total: 50, entryPrice: 1000, exitPrice: 1000, exitDate: '2026-08-11' }),
      item({ code: 'HIGH', total: 90, entryPrice: 1000, exitPrice: 1000, exitDate: '2026-08-11' }),
      item({ code: 'MID', total: 70, entryPrice: 1000, exitPrice: 1000, exitDate: '2026-08-11' }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 2, seedCash: 1000000 })
    expect(r.cycles[0].holdings.map(h => h.code)).toEqual(['HIGH', 'MID'])
  })

  it('entryPrice가 0인 종목은 빼고 남은 종목으로 균등 배분한다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'X', total: 80, entryPrice: 10000, exitPrice: 10000, exitDate: '2026-08-11' }),
      item({ code: 'BAD', total: 70, entryPrice: 0 }),
      item({ code: 'Z', total: 60, entryPrice: 5000, exitPrice: 5000, exitDate: '2026-08-11' }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 3, seedCash: 1000000 })
    const c = r.cycles[0]
    expect(c.holdings.map(h => h.code)).toEqual(['X', 'Z'])
    // 100만을 2종목으로 균등 → 50만씩, 유휴 현금 없음
    expect(c.holdings.map(h => h.quantity)).toEqual([50, 100])
    expect(c.investAmount).toBe(1000000)
  })

  it('미확정 종목은 전달받은 현재가로 평가한다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'P', total: 80, entryPrice: 1000 }),
    ])
    const r = simulate({ snapshots: [s], prices: { P: 1200 }, stockCount: 1, seedCash: 1000000 })
    expect(r.cycles[0].matured).toBe(false)
    expect(r.cycles[0].holdings[0].exitPrice).toBe(1200)
  })

  it('현재가 조회에 실패한 미확정 종목은 진입가로 평가한다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'P', total: 80, entryPrice: 1000 }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 1, seedCash: 1000000 })
    expect(r.cycles[0].holdings[0].exitPrice).toBe(1000)
    expect(r.cycles[0].holdings[0].profit).toBe(0)
  })

  it('매수 가능한 종목이 없으면 전액 현금으로 넘어간다', () => {
    const s = snap('2026-08-05', '2026-08-06', [item({ code: 'BAD', total: 70, entryPrice: 0 })])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 3, seedCash: 1000000 })
    expect(r.cycles[0].noTrade).toBe(true)
    expect(r.cycles[0].endAsset).toBe(1000000)
  })

  it('주가가 배분금보다 비싸 한 주도 못 사면 매매 없음으로 본다', () => {
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'PRICEY', total: 80, entryPrice: 2000000, exitPrice: 2100000, exitDate: '2026-08-11' }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 1, seedCash: 1000000 })
    expect(r.cycles[0].noTrade).toBe(true)
    expect(r.cycles[0].endAsset).toBe(1000000)
  })

  it('한 주도 못 산 종목은 확정 판정에서 제외한다', () => {
    // 종자금 100만, N=2 → 종목당 50만
    // CHEAP: floor(500000/1000)=500주 매수, 확정됨
    // PRICEY: floor(500000/2000000)=0주 미매수, 미확정 → 판정에서 빠져야 함
    const s = snap('2026-08-05', '2026-08-06', [
      item({ code: 'CHEAP', total: 90, entryPrice: 1000, exitPrice: 1100, exitDate: '2026-08-11' }),
      item({ code: 'PRICEY', total: 80, entryPrice: 2000000 }),
    ])
    const r = simulate({ snapshots: [s], prices: {}, stockCount: 2, seedCash: 1000000 })
    expect(r.cycles[0].holdings.map(h => h.quantity)).toEqual([500, 0])
    expect(r.cycles[0].matured).toBe(true)
    expect(r.maturedCount).toBe(1)
  })

  it('사이클이 없으면 종자금 그대로 반환한다', () => {
    const r = simulate({ snapshots: [], prices: {}, stockCount: 3, seedCash: 1000000 })
    expect(r.cycles).toEqual([])
    expect(r.finalAsset).toBe(1000000)
    expect(r.totalReturnPct).toBe(0)
  })
})

describe('MDD 계산', () => {
  it('고점 대비 최대 낙폭을 퍼센트로 낸다', () => {
    expect(computeMdd(1000000, [1100000, 990000, 1050000])).toBeCloseTo(-10, 6)
  })

  it('한 번도 고점을 깨지 않으면 0이다', () => {
    expect(computeMdd(1000000, [1100000, 1200000])).toBe(0)
  })

  it('첫 사이클부터 손실이면 종자금 대비로 잰다', () => {
    expect(computeMdd(1000000, [950000])).toBeCloseTo(-5, 6)
  })

  it('자산이 없으면 0이다', () => {
    expect(computeMdd(1000000, [])).toBe(0)
  })
})

describe('지표 집계', () => {
  // 회차1: 확정 — 1,000원 → 1,100원, 1000주
  //   투입 1,000,000 / 매수비용 150 / 매도금 1,100,000 / 매도비용 1,815
  //   종료자산 = 0 + 1,100,000 - 1,965 = 1,098,035
  // 회차2: 진행중 — 현재가 900원
  //   가용 1,098,035 → 1,098주 투입 1,098,000, 잔돈 35
  //   매도금 988,200 / 비용 165 + 1,631 = 1,796 → 종료자산 986,439
  const c1 = snap('2026-08-05', '2026-08-06', [
    item({ code: 'A', total: 90, entryPrice: 1000, exitPrice: 1100, exitDate: '2026-08-11' }),
  ])
  const c2 = snap('2026-08-11', '2026-08-12', [
    item({ code: 'B', total: 90, entryPrice: 1000 }),
  ])
  const run = () => simulate({
    snapshots: [c1, c2], prices: { B: 900 }, stockCount: 1, seedCash: 1000000,
  })

  it('사이클별 종료자산과 비용이 정확하다', () => {
    const r = run()
    expect(r.cycles[0].endAsset).toBe(1098035)
    expect(r.cycles[0].tradeCost).toBe(1965)
    expect(r.cycles[1].endAsset).toBe(986439)
    expect(r.finalAsset).toBe(986439)
    // 비용전 트랙은 자기 잔액으로 복리 — 회차2에서 수량이 갈린다 (1,100주 vs 비용후 1,098주)
    expect(r.cycles[0].endAssetGross).toBe(1100000)
    expect(r.cycles[1].endAssetGross).toBe(990000)
    expect(r.finalAssetGross).toBe(990000)
    expect(r.totalReturnPctGross).toBeCloseTo(-1.0, 4)
  })

  it('진행중 사이클은 승률 분모에서 제외한다', () => {
    const r = run()
    expect(r.maturedCount).toBe(1)
    expect(r.pendingCount).toBe(1)
    expect(r.winCount).toBe(1)
    expect(r.winRate).toBe(100)
  })

  it('평균·최고·최악은 확정 사이클만 본다', () => {
    const r = run()
    expect(r.avgReturnPct).toBeCloseTo(9.8035, 3)
    expect(r.bestCycle?.index).toBe(1)
    expect(r.worstCycle?.index).toBe(1)
  })

  it('확정 사이클이 없으면 승률·평균이 null이다', () => {
    const r = simulate({ snapshots: [c2], prices: { B: 900 }, stockCount: 1, seedCash: 1000000 })
    expect(r.winRate).toBeNull()
    expect(r.avgReturnPct).toBeNull()
    expect(r.bestCycle).toBeNull()
    expect(r.mdd).toBe(0)
  })

  it('매매 없는 사이클은 승률 분모에서 뺀다', () => {
    const empty = snap('2026-08-05', '2026-08-06', [item({ code: 'BAD', total: 70, entryPrice: 0 })])
    const r = simulate({ snapshots: [empty], prices: {}, stockCount: 3, seedCash: 1000000 })
    expect(r.cycles.length).toBe(1)
    expect(r.maturedCount).toBe(0)
    expect(r.winRate).toBeNull()
  })
})

// 픽스처 헬퍼 — SimCycle을 직접 리터럴로 만든다 (숫자를 손계산해 넣기 쉬움)
function holding(over: Partial<SimCycle['holdings'][number]> & { code: string; entryPrice: number; quantity: number }) {
  return {
    name: over.code,
    score: 80,
    cost: over.entryPrice * over.quantity,
    exitPrice: over.entryPrice,
    proceeds: over.entryPrice * over.quantity,
    profit: 0,
    returnPct: 0,
    isMatured: true,
    ...over,
  }
}

function mark(snapshotDate: string, code: string, date: string, close: number): ScoreDailyMark {
  return { snapshotDate, code, date, close }
}

describe('일별 자산 시계열', () => {
  it('마크 2일 + 청산일 → 3포인트, 날짜 오름차순 (매수비용 차감·매도비용 미차감·잔돈 매일 반영)', () => {
    // 종목 A 10주 @1000원, 투입 10,000 / 매수비용 round(10,000×0.00015)=round(1.4999...)=1
    // 잔돈 = 100,000 - 10,000 = 90,000
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: true, noTrade: false,
      holdings: [holding({ code: 'A', entryPrice: 1000, quantity: 10 })],
      investAmount: 10000, startAsset: 100000,
      endAsset: 105000, endAssetGross: 106000,
      profit: 5000, returnPct: 5, tradeCost: 20,
    }
    const marks = [
      mark('2026-08-05', 'A', '2026-08-07', 1100),
      mark('2026-08-05', 'A', '2026-08-10', 1200),
    ]
    const series = buildDailySeries([cycle], marks)

    expect(series.map(p => p.date)).toEqual(['2026-08-07', '2026-08-10', '2026-08-11'])
    // 90,000 + 10×1,100 - 1 = 100,999
    expect(series[0]).toEqual({ date: '2026-08-07', asset: 100999, cycleIndex: 1, isCycleEnd: false })
    // 90,000 + 10×1,200 - 1 = 101,999 (매도비용 없이 잔돈만 매일 더해짐)
    expect(series[1]).toEqual({ date: '2026-08-10', asset: 101999, cycleIndex: 1, isCycleEnd: false })
    // 청산일 포인트는 endAsset 그대로
    expect(series[2]).toEqual({ date: '2026-08-11', asset: 105000, cycleIndex: 1, isCycleEnd: true })
  })

  it('특정 종목의 마크가 빠진 날은 그 종목만 진입가로 평가한다', () => {
    // A 10주@1000(투입10,000) + B 5주@2000(투입10,000) = 투입 20,000, 매수비용 round(20,000×0.00015)=3
    // 잔돈 = 100,000 - 20,000 = 80,000
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: false, noTrade: false,
      holdings: [
        holding({ code: 'A', entryPrice: 1000, quantity: 10 }),
        holding({ code: 'B', entryPrice: 2000, quantity: 5 }),
      ],
      investAmount: 20000, startAsset: 100000,
      endAsset: 0, endAssetGross: 0, profit: 0, returnPct: 0, tradeCost: 0,
    }
    // B는 그날 마크가 없다 → 진입가(2000)로 평가
    const marks = [mark('2026-08-05', 'A', '2026-08-07', 1100)]
    const series = buildDailySeries([cycle], marks)

    // 80,000 + (10×1,100 + 5×2,000) - 3 = 80,000 + 21,000 - 3 = 100,997
    expect(series).toEqual([{ date: '2026-08-07', asset: 100997, cycleIndex: 1, isCycleEnd: false }])
  })

  it('마크 날짜가 청산일과 같으면 중복 없이 endAsset으로 덮어쓴다', () => {
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: true, noTrade: false,
      holdings: [holding({ code: 'A', entryPrice: 1000, quantity: 10 })],
      investAmount: 10000, startAsset: 100000,
      endAsset: 105000, endAssetGross: 106000,
      profit: 5000, returnPct: 5, tradeCost: 20,
    }
    const marks = [mark('2026-08-05', 'A', '2026-08-11', 1300)]
    const series = buildDailySeries([cycle], marks)

    expect(series).toEqual([{ date: '2026-08-11', asset: 105000, cycleIndex: 1, isCycleEnd: true }])
  })

  it('진행중 사이클은 청산일 포인트를 붙이지 않는다', () => {
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: false, noTrade: false,
      holdings: [holding({ code: 'A', entryPrice: 1000, quantity: 10 })],
      investAmount: 10000, startAsset: 100000,
      endAsset: 0, endAssetGross: 0, profit: 0, returnPct: 0, tradeCost: 0,
    }
    const marks = [mark('2026-08-05', 'A', '2026-08-07', 1100)]
    const series = buildDailySeries([cycle], marks)

    expect(series.length).toBe(1)
    expect(series.every(p => !p.isCycleEnd)).toBe(true)
  })

  it('마크가 0건이고 확정 사이클이면 청산일 포인트 1개만 남는다', () => {
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: true, noTrade: false,
      holdings: [holding({ code: 'A', entryPrice: 1000, quantity: 10 })],
      investAmount: 10000, startAsset: 100000,
      endAsset: 105000, endAssetGross: 106000,
      profit: 5000, returnPct: 5, tradeCost: 20,
    }
    const series = buildDailySeries([cycle], [])

    expect(series).toEqual([{ date: '2026-08-11', asset: 105000, cycleIndex: 1, isCycleEnd: true }])
  })

  it('사이클이 없으면 빈 배열을 반환한다', () => {
    expect(buildDailySeries([], [])).toEqual([])
  })
})

describe('일별 기준 MDD', () => {
  it('회차 중간의 저점을 반영해 회차 기준 MDD보다 깊게 나온다', () => {
    // 100주@1,000원 전액 투입, 매수비용 round(100,000×0.00015)=15, 잔돈 0
    // 회차 중간 마크: 800원으로 급락 → 79,985
    // 청산일: 110,000으로 회복 (회차 기준으로는 고점 경신, 낙폭 없음)
    const cycle: SimCycle = {
      index: 1, date: '2026-08-05', entryDate: '2026-08-06', exitDate: '2026-08-11',
      matured: true, noTrade: false,
      holdings: [holding({ code: 'A', entryPrice: 1000, quantity: 100 })],
      investAmount: 100000, startAsset: 100000,
      endAsset: 110000, endAssetGross: 111000,
      profit: 10000, returnPct: 10, tradeCost: 30,
    }
    const marks = [mark('2026-08-05', 'A', '2026-08-07', 800)]
    const series = buildDailySeries([cycle], marks)

    const cycleMdd = computeMdd(100000, [cycle.endAsset])
    const dailyMdd = computeDailyMdd(100000, series)

    expect(cycleMdd).toBe(0)
    expect(dailyMdd).toBeCloseTo(-20.015, 3)
    expect(dailyMdd).toBeLessThan(cycleMdd)
  })
})
