// 팩터 검정 공용 통계 — IC(Spearman) / 십분위 롱숏
// 날짜를 독립 단위로 본다. 같은 날 종목들은 시장 팩터를 공유하므로
// 관측치 단위로 t를 계산하면 표준오차가 심하게 과소추정된다.
import type { ReplayObs } from './scoreReplay'

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

export const std = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

/** 동점은 평균 순위로 처리 */
export function rankify(values: number[]): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(values.length).fill(0)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k].i] = avg
    i = j + 1
  }
  return ranks
}

/** Spearman 순위상관 */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 3) return 0
  const rx = rankify(xs)
  const ry = rankify(ys)
  const mx = mean(rx), my = mean(ry)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0
}

export interface FactorDef {
  label: string
  get: (o: ReplayObs) => number
  isHeader?: boolean
}

export const FACTORS: FactorDef[] = [
  { label: '종합점수 total', get: o => o.total },
  { label: '  수급 supply(45)', get: o => o.supply },
  { label: '  모멘텀 momentum(30)', get: o => o.momentum },
  { label: '  회전율 surge(10)', get: o => o.surge },
  { label: '── 수급 분해 ──', get: () => NaN, isHeader: true },
  { label: '  외인 순매수일비율', get: o => o.foreignRatio },
  { label: '  기관 순매수일비율', get: o => o.instRatio },
  { label: '  외인 금액백분위', get: o => o.foreignAmtScore },
  { label: '  기관 금액백분위', get: o => o.instAmtScore },
  { label: '── 원시 팩터 ──', get: () => NaN, isHeader: true },
  { label: '  20일 등락률(원시)', get: o => o.chg20 },
  { label: '  5일 등락률(원시)', get: o => o.chg5 },
  { label: '  회전율(원시)', get: o => o.turnover },
  { label: '  시총(원시)', get: o => o.marketCap },
  { label: '  변동성감점(역)', get: o => o.volatilityPenalty },
]

export interface FactorStat {
  icMean: number
  icT: number
  hitRate: number      // IC > 0 인 날 비율 (%)
  spreadMean: number   // 상위 10% - 하위 10% 평균 수익률 (%)
  spreadT: number
  n: number            // 유효 날짜 수
}

/** 날짜별 관측치 묶음에 대해 한 팩터의 IC/롱숏 통계를 낸다 */
export function evaluateFactor(days: ReplayObs[][], get: (o: ReplayObs) => number): FactorStat | null {
  const ics: number[] = []
  const spreads: number[] = []

  for (const day of days) {
    const xs = day.map(get)
    if (xs.some(v => !isFinite(v))) continue
    ics.push(spearman(xs, day.map(o => o.retMain)))

    const sorted = [...day].sort((a, b) => get(b) - get(a))
    const k = Math.max(1, Math.floor(sorted.length / 10))
    spreads.push(mean(sorted.slice(0, k).map(o => o.retMain)) - mean(sorted.slice(-k).map(o => o.retMain)))
  }

  if (ics.length === 0) return null
  const icSE = std(ics) / Math.sqrt(ics.length)
  const spSE = std(spreads) / Math.sqrt(spreads.length)
  return {
    icMean: mean(ics),
    icT: icSE > 0 ? mean(ics) / icSE : 0,
    hitRate: ics.filter(v => v > 0).length / ics.length * 100,
    spreadMean: mean(spreads),
    spreadT: spSE > 0 ? mean(spreads) / spSE : 0,
    n: ics.length,
  }
}

/** 관측치를 날짜별로 묶어 날짜 오름차순 배열로 반환 */
export function groupByDate(observations: ReplayObs[]): ReplayObs[][] {
  const map = new Map<string, ReplayObs[]>()
  for (const o of observations) {
    if (!map.has(o.date)) map.set(o.date, [])
    map.get(o.date)!.push(o)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1])
}
