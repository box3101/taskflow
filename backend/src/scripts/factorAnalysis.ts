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
import { runReplay } from '../services/scoreReplay'
import { FACTORS, evaluateFactor, groupByDate } from '../services/factorStats'

const OUT_PATH = resolve(__dirname, '../../../frontend/public/data/factor-analysis.json')

async function main() {
  console.log('[factor] 리플레이 실행 중...')
  const { observations, dates, skippedDates } = await runReplay()
  const days = groupByDate(observations)
  console.log(`[factor] ${dates.length}일 / 관측치 ${observations.length.toLocaleString()}개 / 스킵 ${skippedDates}일\n`)

  console.log('팩터'.padEnd(24) + '  평균IC     t      IC>0    롱숏(D1-D10)     t')
  console.log('─'.repeat(78))

  const results: any[] = []

  for (const f of FACTORS) {
    if (f.isHeader) { console.log(f.label); continue }

    const s = evaluateFactor(days, f.get)
    if (!s) continue

    const flag = Math.abs(s.icT) >= 2 ? (s.icT > 0 ? ' ***' : ' *** (역방향)') : ''
    console.log(
      f.label.padEnd(24)
      + `${s.icMean.toFixed(4).padStart(8)}${s.icT.toFixed(2).padStart(7)}`
      + `${s.hitRate.toFixed(1).padStart(8)}%`
      + `${s.spreadMean.toFixed(3).padStart(12)}%${s.spreadT.toFixed(2).padStart(7)}`
      + flag,
    )
    results.push({ factor: f.label.trim(), ...s })
  }

  console.log('─'.repeat(78))
  console.log('*** = |t| >= 2 (유의). 다중검정 보정 시 유의수준 0.05/팩터수 → t≈2.9 필요')

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
