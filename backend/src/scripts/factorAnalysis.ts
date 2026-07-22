// 팩터별 기여도 분해 — 각 팩터가 단독으로 D+3 수익률 예측력을 갖는지 검정한다.
//   실행: npx tsx src/scripts/factorAnalysis.ts
//
// 지표
//   IC   : 일자별 단면 순위상관(Spearman). 날짜를 독립 단위로 보고 평균·t 산출.
//   롱숏 : 팩터 상위 10% - 하위 10% 평균 수익률 (일자별 → 평균·t)
// 부호 규약: 값이 클수록 좋다고 가정. 감점 팩터는 라벨에 (역)을 붙였다.
import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import prisma from '../prisma'
import { runReplay, type ReplayObs } from '../services/scoreReplay'

const OUT_PATH = resolve(__dirname, '../../../frontend/public/data/factor-analysis.json')

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const std = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

/** 동점은 평균 순위로 처리 */
function rankify(values: number[]): number[] {
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
function spearman(xs: number[], ys: number[]): number {
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

const FACTORS: { label: string; get: (o: ReplayObs) => number }[] = [
  { label: '종합점수 total', get: o => o.total },
  { label: '  수급 supply(45)', get: o => o.supply },
  { label: '  모멘텀 momentum(30)', get: o => o.momentum },
  { label: '  회전율 surge(10)', get: o => o.surge },
  { label: '── 수급 분해 ──', get: () => NaN },
  { label: '  외인 순매수일비율', get: o => o.foreignRatio },
  { label: '  기관 순매수일비율', get: o => o.instRatio },
  { label: '  외인 금액백분위', get: o => o.foreignAmtScore },
  { label: '  기관 금액백분위', get: o => o.instAmtScore },
  { label: '── 원시 팩터 ──', get: () => NaN },
  { label: '  20일 등락률(원시)', get: o => o.chg20 },
  { label: '  5일 등락률(원시)', get: o => o.chg5 },
  { label: '  회전율(원시)', get: o => o.turnover },
  { label: '  시총(원시)', get: o => o.marketCap },
  { label: '  변동성감점(역)', get: o => o.volatilityPenalty },
]

async function main() {
  console.log('[factor] 리플레이 실행 중...')
  const { observations, dates, skippedDates } = await runReplay()
  console.log(`[factor] ${dates.length}일 / 관측치 ${observations.length.toLocaleString()}개 / 스킵 ${skippedDates}일\n`)

  // 날짜별로 묶기
  const byDate = new Map<string, ReplayObs[]>()
  for (const o of observations) {
    if (!byDate.has(o.date)) byDate.set(o.date, [])
    byDate.get(o.date)!.push(o)
  }

  console.log('팩터'.padEnd(24) + '  평균IC     t      IC>0    롱숏(D1-D10)     t')
  console.log('─'.repeat(78))

  const results: any[] = []

  for (const f of FACTORS) {
    if (f.label.startsWith('──')) { console.log(f.label); continue }

    const ics: number[] = []
    const spreads: number[] = []

    for (const day of byDate.values()) {
      const xs = day.map(f.get)
      const ys = day.map(o => o.retMain)
      if (xs.some(v => !isFinite(v))) continue

      ics.push(spearman(xs, ys))

      // 팩터 기준 정렬 → 상위/하위 10%
      const sorted = [...day].sort((a, b) => f.get(b) - f.get(a))
      const k = Math.max(1, Math.floor(sorted.length / 10))
      const hi = mean(sorted.slice(0, k).map(o => o.retMain))
      const lo = mean(sorted.slice(-k).map(o => o.retMain))
      spreads.push(hi - lo)
    }

    if (ics.length === 0) continue
    const icMean = mean(ics)
    const icSE = std(ics) / Math.sqrt(ics.length)
    const icT = icSE > 0 ? icMean / icSE : 0
    const spMean = mean(spreads)
    const spSE = std(spreads) / Math.sqrt(spreads.length)
    const spT = spSE > 0 ? spMean / spSE : 0
    const hitRate = ics.filter(v => v > 0).length / ics.length * 100

    const flag = Math.abs(icT) >= 2 ? (icT > 0 ? ' ***' : ' *** (역방향)') : ''
    console.log(
      f.label.padEnd(24)
      + `${icMean.toFixed(4).padStart(8)}${icT.toFixed(2).padStart(7)}`
      + `${hitRate.toFixed(1).padStart(8)}%`
      + `${spMean.toFixed(3).padStart(12)}%${spT.toFixed(2).padStart(7)}`
      + flag,
    )
    results.push({ factor: f.label.trim(), icMean, icT, hitRate, spreadMean: spMean, spreadT: spT, n: ics.length })
  }

  console.log('─'.repeat(78))
  console.log('*** = |t| >= 2 (유의)')

  writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    dates: dates.length,
    observations: observations.length,
    note: '밸류(PER/PBR) 제외 85점 정규화 / 주 규약(T+1 종가 진입, 보유 3거래일)',
    results,
  }, null, 2))
  console.log(`\n[factor] 저장: ${OUT_PATH}`)

  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
