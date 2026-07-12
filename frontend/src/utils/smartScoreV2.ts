import type { InvestorData, InvestorTrend } from '../api/stockApi'

// ── 튜닝 대상 파라미터 (데이터 분포 확인 후 조정) ──
export const TUNING = {
  volumeFilterCutoff: 0.2,        // 거래대금 하위 20% 필터
  sellPenaltyThreshold: 0.005,    // 시총 대비 매도 임계 0.5%
  sellPenaltyMax: 12,             // 매도 감점 최대
  pbrCoefficient: 1.5,            // PBR 선형 보간 계수
  // 등락률 종모양 파라미터
  momentum20Peak: [10, 25] as readonly [number, number],  // 20일 피크 구간 (%)
  momentum20Max: 50,              // 20일 0점 수렴 지점 (%)
  momentum5Peak: [3, 10] as readonly [number, number],    // 5일 피크 구간 (%)
  momentum5Max: 25,               // 5일 0점 수렴 지점 (%)
} as const

// ── 타입 ──

export interface StockInput {
  code: string
  name: string
  theme: string
  chg20: number
  chg5: number
  data: InvestorData
}

export type PerStatus = 'normal' | 'deficit' | 'missing'
export type PbrStatus = 'normal' | 'missing'

export interface ValuationResult {
  perScore: number
  pbrScore: number
  perStatus: PerStatus
  pbrStatus: PbrStatus
  maxPossible: number
}

export interface SupplyResult {
  total: number
  foreignRatio: number
  instRatio: number
  foreignAmtScore: number
  instAmtScore: number
  sellPenalty: number
  foreignSellDays: number
}

export interface ScoreBreakdown {
  code: string
  name: string
  theme: string
  total: number
  supply: number
  momentum: number
  surge: number
  valuation: number
  foreignRatio: number
  instRatio: number
  foreignSellDays: number
  overextended: boolean
  valuationMissing: boolean
}

// ── 0. 거래대금 필터 ──

/** 5일 외인+기관 절대거래금액 합산 */
function absAmtSum(trends: InvestorTrend[]): number {
  return trends.slice(0, 5).reduce(
    (sum, d) => sum + Math.abs(d.foreignAmt || 0) + Math.abs(d.institutionAmt || 0),
    0,
  )
}

/** 유니버스 하위 N% 거래대금 종목 제외 */
function filterByVolume(stocks: StockInput[]): StockInput[] {
  if (stocks.length === 0) return []
  const amts = stocks.map(s => absAmtSum(s.data.trends))
  const sorted = [...amts].sort((a, b) => a - b)
  const cutoffIndex = Math.floor(sorted.length * TUNING.volumeFilterCutoff)
  const cutoffValue = sorted[cutoffIndex] ?? 0
  return stocks.filter((_, i) => amts[i] >= cutoffValue)
}

// ── 1. 수급 45점 ──

/** 최근 N일 중 순매수일 비율 (0~1) */
function buyDayRatio(trends: InvestorTrend[], type: 'foreign' | 'institution', days = 10): number {
  const slice = trends.slice(0, days)
  if (slice.length === 0) return 0
  const buyDays = slice.filter(d => d[type] > 0).length
  return buyDays / slice.length
}

/** 연속 매도일 */
function consecutiveSellDays(trends: InvestorTrend[]): number {
  let count = 0
  for (const day of trends) {
    if (day.foreign < 0) count++
    else break
  }
  return count
}

/** 5일 순매수합 / 시총 비율 (음수는 0 처리) */
function netBuyRatio(trends: InvestorTrend[], type: 'foreignAmt' | 'institutionAmt', mcap: number): number {
  if (mcap <= 0) return 0
  const sum = trends.slice(0, 5).reduce((s, d) => s + Math.max(0, d[type] || 0), 0)
  return sum / mcap
}

/** 값의 유니버스 내 백분위 (0~1) — 동일값은 중간 순위 */
function percentile(value: number, allValues: number[]): number {
  if (allValues.length <= 1) return 0.5
  const sorted = [...allValues].sort((a, b) => a - b)
  // 동일값이 여러 개일 때 중간 순위 사용 (평균 순위)
  let first = sorted.length
  let last = -1
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= value && first === sorted.length) first = i
    if (sorted[i] <= value) last = i
  }
  const midRank = (first + last) / 2
  return midRank / (sorted.length - 1)
}

/** 수급 점수 (45점) */
function calcSupply(
  data: InvestorData,
  allForeignRatios: number[],
  allInstRatios: number[],
): SupplyResult {
  const mcap = parseFloat(data.marketCap) || 0

  // 지속성 20점: 순매수일 비율
  const foreignRatio = buyDayRatio(data.trends, 'foreign')
  const instRatio = buyDayRatio(data.trends, 'institution')
  const foreignDayScore = Math.round(foreignRatio * 10)
  const instDayScore = Math.round(instRatio * 10)

  // 금액 25점: 백분위 기반
  const fRatio = netBuyRatio(data.trends, 'foreignAmt', mcap)
  const iRatio = netBuyRatio(data.trends, 'institutionAmt', mcap)
  const foreignAmtScore = Math.min(12.5, percentile(fRatio, allForeignRatios) * 12.5)
  const instAmtScore = Math.min(12.5, percentile(iRatio, allInstRatios) * 12.5)

  // 외인 연속매도 감점: 시총 대비 % 기준
  const foreignSellDaysCount = consecutiveSellDays(data.trends)
  let sellPenalty = 0
  if (foreignSellDaysCount >= 3 && mcap > 0) {
    const sellAmt = Math.abs(
      data.trends.slice(0, 5).reduce((s, d) => s + Math.min(0, d.foreignAmt || 0), 0),
    )
    const sellRatio = sellAmt / mcap
    const intensity = Math.min(1, sellRatio / (TUNING.sellPenaltyThreshold * 4))
    sellPenalty = Math.round(intensity * TUNING.sellPenaltyMax)
  }

  const raw = foreignDayScore + instDayScore + foreignAmtScore + instAmtScore
  const total = Math.max(0, Math.round(raw) - sellPenalty)

  return {
    total,
    foreignRatio,
    instRatio,
    foreignAmtScore: Math.round(foreignAmtScore),
    instAmtScore: Math.round(instAmtScore),
    sellPenalty,
    foreignSellDays: foreignSellDaysCount,
  }
}

// ── 2. 등락률 30점 — 종 모양 ──

/**
 * 종 모양 점수: 피크 구간은 고원(만점), 양쪽으로 선형 감쇠
 */
function bellScore(value: number, peakStart: number, peakEnd: number, maxDecay: number, maxScore: number): number {
  if (value <= 0) return 0
  if (value < peakStart) {
    return (value / peakStart) * maxScore
  }
  if (value <= peakEnd) {
    return maxScore
  }
  if (value < maxDecay) {
    return ((maxDecay - value) / (maxDecay - peakEnd)) * maxScore
  }
  return 0
}

/** 등락률 점수 (30점) */
function calcMomentum(chg20: number, chg5: number): number {
  const score20 = bellScore(
    chg20,
    TUNING.momentum20Peak[0], TUNING.momentum20Peak[1],
    TUNING.momentum20Max,
    22,
  )
  const score5 = bellScore(
    chg5,
    TUNING.momentum5Peak[0], TUNING.momentum5Peak[1],
    TUNING.momentum5Max,
    8,
  )
  return Math.round(score20 + score5)
}

// ── 3. 회전율 10점 — surge ──

/** 구간별 평균 회전율 (절대거래금액 / 시총) */
function avgTurnover(trends: InvestorTrend[], days: number, mcap: number): number {
  if (mcap <= 0) return 0
  const slice = trends.slice(0, days)
  if (slice.length === 0) return 0
  const totalAmt = slice.reduce(
    (s, d) => s + Math.abs(d.foreignAmt || 0) + Math.abs(d.institutionAmt || 0),
    0,
  )
  return totalAmt / slice.length / mcap
}

/** surge 비율: 5일 회전율 / 장기 회전율 */
function surgeRatio(data: InvestorData): number {
  const mcap = parseFloat(data.marketCap) || 0
  if (mcap <= 0) return 0
  const short = avgTurnover(data.trends, 5, mcap)
  // 장기: 최소 10일 이상 있어야 의미 있는 비교 가능
  const longDays = data.trends.length
  if (longDays <= 5) {
    // 데이터 부족 시 절대 회전율 자체를 반환 (백분위에서 상대 비교)
    return short
  }
  const long = avgTurnover(data.trends, longDays, mcap)
  if (long <= 0) return 0
  return short / long
}

/** 회전율 점수 (10점): surge 비율의 유니버스 백분위 */
function calcSurge(data: InvestorData, allSurgeRatios: number[]): number {
  const ratio = surgeRatio(data)
  return Math.round(percentile(ratio, allSurgeRatios) * 10)
}

// ── 4. PER/PBR 15점 — 선형 보간 ──

/** PER 점수 */
function perScore(raw: string): { score: number; status: PerStatus } {
  const per = parseFloat(raw)
  if (isNaN(per) || raw === '-') return { score: 0, status: 'missing' }
  if (per < 0) return { score: 2, status: 'deficit' }
  return { score: Math.max(1, Math.min(8, 8 - (per - 5) * 0.28)), status: 'normal' }
}

/** PBR 점수 */
function pbrScore(raw: string): { score: number; status: PbrStatus } {
  const pbr = parseFloat(raw)
  if (isNaN(pbr) || pbr < 0 || raw === '-') return { score: 0, status: 'missing' }
  return {
    score: Math.max(1, Math.min(7, 7 - (pbr - 0.5) * TUNING.pbrCoefficient)),
    status: 'normal',
  }
}

/** 밸류에이션 점수 — PER/PBR 독립 판정 */
function calcValuation(data: InvestorData): ValuationResult {
  const per = perScore(data.per)
  const pbr = pbrScore(data.pbr)

  if (per.status === 'missing') {
    console.warn(`[SmartScore] PER 결측: marketCap=${data.marketCap}, per="${data.per}"`)
  }
  if (pbr.status === 'missing') {
    console.warn(`[SmartScore] PBR 결측: marketCap=${data.marketCap}, pbr="${data.pbr}"`)
  }

  const perMax = per.status !== 'missing' ? 8 : 0
  const pbrMax = pbr.status !== 'missing' ? 7 : 0

  return {
    perScore: Math.round(per.score * 10) / 10,
    pbrScore: Math.round(pbr.score * 10) / 10,
    perStatus: per.status,
    pbrStatus: pbr.status,
    maxPossible: perMax + pbrMax,
  }
}

// ── 5. 과열 감점 ──

function overheatPenalty(chg20: number, chg5: number, foreignRatio: number, instRatio: number): number {
  const overextended = chg20 > 90 || chg5 > 40
  if (!overextended) return 0
  const hasSupply = foreignRatio >= 0.3 || instRatio >= 0.3
  if (chg20 > 100) return hasSupply ? 12 : 22
  return hasSupply ? 8 : 18
}

// ── 종합 랭킹 ──

/** 종목 코드 기준 dedup — 테마는 "/"로 합침 */
function dedup(stocks: StockInput[]): StockInput[] {
  const map = new Map<string, StockInput>()
  for (const s of stocks) {
    const existing = map.get(s.code)
    if (existing) {
      // 테마 합치기 (중복 방지)
      if (!existing.theme.includes(s.theme)) {
        existing.theme += '/' + s.theme
      }
    } else {
      map.set(s.code, { ...s })
    }
  }
  return Array.from(map.values())
}

/** 메인 엔트리: 종목 배열 → 상위 20 랭킹 */
export function calculateRanking(stocks: StockInput[]): ScoreBreakdown[] {
  // 0. dedup + 거래대금 필터
  const unique = dedup(stocks)
  const filtered = filterByVolume(unique)

  // 백분위 계산용 유니버스 데이터 수집
  const allForeignRatios: number[] = []
  const allInstRatios: number[] = []
  const allSurgeRatios: number[] = []

  for (const s of filtered) {
    const mcap = parseFloat(s.data.marketCap) || 0
    allForeignRatios.push(netBuyRatio(s.data.trends, 'foreignAmt', mcap))
    allInstRatios.push(netBuyRatio(s.data.trends, 'institutionAmt', mcap))
    allSurgeRatios.push(surgeRatio(s.data))
  }

  const list: ScoreBreakdown[] = []

  for (const s of filtered) {
    // 1. 수급 45점
    const sup = calcSupply(s.data, allForeignRatios, allInstRatios)

    // 2. 등락률 30점
    const mom = calcMomentum(s.chg20, s.chg5)

    // 3. 회전율 10점
    const srg = calcSurge(s.data, allSurgeRatios)

    // 4. 밸류 15점
    const val = calcValuation(s.data)
    const valScore = Math.round(val.perScore + val.pbrScore)

    // 재정규화: 밸류 부분/전체 결측 시
    const baseMax = 85 + val.maxPossible
    const base = sup.total + mom + srg + valScore
    const normalized = baseMax < 100
      ? Math.round(base / baseMax * 100)
      : base

    // 5. 과열감점은 재정규화 후 차감
    const penalty = overheatPenalty(s.chg20, s.chg5, sup.foreignRatio, sup.instRatio)
    const total = normalized - penalty

    list.push({
      code: s.code,
      name: s.name,
      theme: s.theme,
      total,
      supply: sup.total,
      momentum: mom,
      surge: srg,
      valuation: valScore,
      foreignRatio: sup.foreignRatio,
      instRatio: sup.instRatio,
      foreignSellDays: sup.foreignSellDays,
      overextended: s.chg20 > 90 || s.chg5 > 40,
      valuationMissing: val.maxPossible < 15,
    })
  }

  return list.sort((a, b) => b.total - a.total).slice(0, 20)
}
