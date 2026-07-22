// 과거 재현 백테스트 리포트 — 엔진은 services/scoreReplay.ts
//   실행: npx tsx src/scripts/replayScore.ts
import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import prisma from '../prisma'
import { runReplay, HOLD_DAYS, type ReplayObs } from '../services/scoreReplay'

const OUT_PATH = resolve(__dirname, '../../../frontend/public/data/replay-result.json')
const COST_PCT = 0.63   // 왕복 거래비용 가정 (세금 0.20 + 수수료 0.03 + 슬리피지 0.40)

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const std = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

function report(label: string, a: number[]) {
  const se = std(a) / Math.sqrt(a.length)
  const t = se > 0 ? mean(a) / se : 0
  console.log(
    `  ${label.padEnd(26)} 평균 ${mean(a).toFixed(3).padStart(7)}%  SE ${se.toFixed(3)}%`
    + `  t ${t.toFixed(2).padStart(6)}  승률 ${(a.filter(v => v > 0).length / a.length * 100).toFixed(1)}%`,
  )
}

async function main() {
  const { observations, dates, skippedDates } = await runReplay()
  console.log(`[replay] ${dates.length}일 / 관측치 ${observations.length.toLocaleString()}개 / 스킵 ${skippedDates}일`)
  if (dates.length === 0) { await prisma.$disconnect(); return }

  const byDate = new Map<string, ReplayObs[]>()
  for (const o of observations) {
    if (!byDate.has(o.date)) byDate.set(o.date, [])
    byDate.get(o.date)!.push(o)
  }

  const perDate = [...byDate.entries()].map(([date, day]) => {
    const top = day.slice(0, 20)   // runReplay가 점수 내림차순으로 담는다
    return {
      date,
      topMain: mean(top.map(o => o.retMain)),
      topLive: mean(top.map(o => o.retLive)),
      uniMain: mean(day.map(o => o.retMain)),
      n: day.length,
    }
  })

  const topMain = perDate.map(d => d.topMain)
  const topLive = perDate.map(d => d.topLive)
  const uniMain = perDate.map(d => d.uniMain)

  console.log(`\n=== 날짜 단위 (n=${perDate.length}일, 보유 ${HOLD_DAYS}거래일) ===`)
  report('상위20 (주 규약)', topMain)
  report('상위20 (부 규약)', topLive)
  report('유니버스 평균', uniMain)
  report('초과수익 (상위20-유니버스)', perDate.map(d => d.topMain - d.uniMain))
  report('상위20 주-비용', topMain.map(v => v - COST_PCT))

  console.log(`\n=== 규약 차이 ===`)
  console.log(`  부 규약 - 주 규약 = ${(mean(topLive) - mean(topMain)).toFixed(3)}%p (하루 지연 진입 비용)`)

  console.log(`\n=== 점수 십분위별 D+3 수익률 (주 규약) ===`)
  const deciles: number[][] = Array.from({ length: 10 }, () => [])
  for (const day of byDate.values()) {
    const size = Math.floor(day.length / 10)
    if (size === 0) continue
    for (let k = 0; k < 10; k++) {
      deciles[k].push(mean(day.slice(k * size, (k + 1) * size).map(o => o.retMain)))
    }
  }
  deciles.forEach((d, k) => {
    if (d.length === 0) return
    const tag = k === 0 ? '(최고점)' : k === 9 ? '(최저점)' : '      '
    console.log(`  D${String(k + 1).padEnd(2)}${tag} 평균 ${mean(d).toFixed(3).padStart(7)}%  (n=${d.length}일)`)
  })
  if (deciles[0].length > 0) {
    report('롱숏 (D1-D10)', deciles[0].map((v, i) => v - deciles[9][i]))
  }

  writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    convention: { holdDays: HOLD_DAYS, main: 'T+1종가 진입 → T+4종가 청산', live: 'T종가 진입 → T+4종가 청산' },
    valuationExcluded: true,
    dates: perDate.length,
    observations: observations.length,
    perDate,
  }, null, 2))
  console.log(`\n[replay] 저장: ${OUT_PATH}`)

  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
