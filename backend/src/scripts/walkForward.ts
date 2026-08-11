// 워크포워드 분할 검증 — [1c]에서 유의하게 나온 팩터가 구간을 쪼개도 살아남는지 본다.
//   실행: npx tsx src/scripts/walkForward.ts [분할수]
//
// 판정 기준
//   부호일치: 모든 구간에서 IC 부호가 전체 표본과 같은가 (신호의 최소 조건)
//   구간유의: |t| >= 2 인 구간이 몇 개인가
// 한 구간에만 몰려 있으면 곡선적합으로 본다.
import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import prisma from '../prisma'
import { runReplay } from '../services/scoreReplay'
import { FACTORS, evaluateFactor, groupByDate, type FactorStat } from '../services/factorStats'

const OUT_PATH = resolve(__dirname, '../../../frontend/public/data/walkforward-result.json')

async function main() {
  const splits = Math.max(2, Number(process.argv[2]) || 2)
  console.log('[wf] 리플레이 실행 중...')
  const { observations } = await runReplay()
  const days = groupByDate(observations)
  console.log(`[wf] ${days.length}일 / 관측치 ${observations.length.toLocaleString()}개`)

  // 시간 순서대로 균등 분할
  const size = Math.floor(days.length / splits)
  const periods: { label: string; days: typeof days }[] = []
  for (let i = 0; i < splits; i++) {
    const from = i * size
    const to = i === splits - 1 ? days.length : (i + 1) * size
    const slice = days.slice(from, to)
    periods.push({
      label: `${i + 1}기(${slice[0][0].date.slice(2, 8)}~${slice[slice.length - 1][0].date.slice(2, 8)})`,
      days: slice,
    })
  }
  console.log(`[wf] ${splits}분할: ` + periods.map(p => `${p.label} ${p.days.length}일`).join(' / ') + '\n')

  const head = '팩터'.padEnd(24) + '전체 IC t'.padStart(10)
    + periods.map((_, i) => `${i + 1}기 IC t`.padStart(11)).join('')
    + '   부호일치  유의구간'
  console.log(head)
  console.log('─'.repeat(head.length + 6))

  const results: any[] = []

  for (const f of FACTORS) {
    if (f.isHeader) { console.log(f.label); continue }

    const overall = evaluateFactor(days, f.get)
    if (!overall) continue
    const parts: (FactorStat | null)[] = periods.map(p => evaluateFactor(p.days, f.get))

    const signOK = parts.every(p => p && Math.sign(p.icT) === Math.sign(overall.icT))
    const sigCount = parts.filter(p => p && Math.abs(p.icT) >= 2).length

    let verdict = ''
    if (Math.abs(overall.icT) >= 2) {
      verdict = signOK && sigCount >= 1 ? '  ← 생존' : '  ← 탈락'
    }

    console.log(
      f.label.padEnd(24)
      + overall.icT.toFixed(2).padStart(10)
      + parts.map(p => (p ? p.icT.toFixed(2) : '-').padStart(11)).join('')
      + `${signOK ? '  일치  ' : '  불일치'}`
      + `${sigCount}/${splits}`.padStart(8)
      + verdict,
    )

    results.push({
      factor: f.label.trim(),
      overall,
      periods: periods.map((p, i) => ({ label: p.label, ...(parts[i] || {}) })),
      signConsistent: signOK,
      significantPeriods: sigCount,
    })
  }

  console.log('─'.repeat(head.length + 6))
  console.log('생존 = 전체 |t|>=2 이고 모든 구간 부호 일치 + 최소 1구간 유의')

  // 구간별 시장 국면 (유니버스 평균 수익률) — 국면 편중 확인용
  console.log('\n=== 구간별 시장 국면 ===')
  periods.forEach(p => {
    const dayMeans = p.days.map(d => d.reduce((s, o) => s + o.retMain, 0) / d.length)
    const m = dayMeans.reduce((a, b) => a + b, 0) / dayMeans.length
    const win = dayMeans.filter(v => v > 0).length / dayMeans.length * 100
    console.log(`  ${p.label}  유니버스 평균 ${m.toFixed(3)}%  상승일 ${win.toFixed(1)}%`)
  })

  writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalDates: days.length,
    splits,
    results,
  }, null, 2))
  console.log(`\n[wf] 저장: ${OUT_PATH}`)

  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
