// 테마 유니버스 전 종목의 외인/기관 일별 동향을 일회성 수집한다.
// 과거 재현 백테스트용 — 수집된 과거 행은 불변이므로 재실행 시 자동 스킵된다.
//   실행: npx ts-node --transpile-only src/scripts/backfillInvestor.ts [days]
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import prisma from '../prisma'
import { crawlInvestor, detectShareDiscontinuity } from '../services/investorData'

const THEMES_PATH = resolve(__dirname, '../../../frontend/public/data/themes.json')
const DEFAULT_DAYS = 260
const STOCK_DELAY_MS = 500   // 종목 간 추가 딜레이 (네이버 부하 방어)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface ThemeFile {
  themes: { label: string; stocks: { code: string; name: string }[] }[]
}

function loadUniverse(): { code: string; name: string }[] {
  const raw = JSON.parse(readFileSync(THEMES_PATH, 'utf8')) as ThemeFile
  const map = new Map<string, string>()
  for (const t of raw.themes) {
    for (const s of t.stocks) map.set(s.code, s.name)
  }
  return [...map.entries()].map(([code, name]) => ({ code, name }))
}

async function main() {
  const days = Number(process.argv[2]) || DEFAULT_DAYS
  const universe = loadUniverse()
  console.log(`[backfill] 대상 ${universe.length}종목 × ${days}일 시작`)

  let ok = 0, skipped = 0, failed = 0
  const splitWarnings: string[] = []

  for (let i = 0; i < universe.length; i++) {
    const { code, name } = universe[i]
    const tag = `[${i + 1}/${universe.length}] ${name}(${code})`

    try {
      // 이미 충분히 쌓여 있으면 건너뛴다 (과거 행은 불변)
      const have = await prisma.investorDaily.count({ where: { code } })
      if (have >= days) {
        console.log(`${tag} 스킵 (보유 ${have}일)`)
        skipped++
        continue
      }

      const rows = await crawlInvestor(code, days)
      if (rows.length === 0) {
        console.warn(`${tag} 수집 0건`)
        failed++
        continue
      }

      // 최근 3거래일은 장중 변동 반영 위해 교체, 나머지는 중복 무시
      const recent = rows.slice(0, 3).map(r => r.date)
      await prisma.investorDaily.deleteMany({ where: { code, date: { in: recent } } })
      await prisma.investorDaily.createMany({
        data: rows.map(r => ({ code, ...r })),
        skipDuplicates: true,
      })

      const splits = detectShareDiscontinuity(rows)
      if (splits.length > 0) splitWarnings.push(`${name}(${code}): ${splits.join(', ')}`)

      const noShares = rows.filter(r => r.listedShares <= 0).length
      console.log(
        `${tag} ${rows.length}일 (${rows[rows.length - 1].date}~${rows[0].date})`
        + (noShares ? ` / 시총역산실패 ${noShares}일` : '')
        + (splits.length ? ` / 분할의심 ${splits.length}건` : ''),
      )
      ok++
      await sleep(STOCK_DELAY_MS)
    } catch (e) {
      console.error(`${tag} 실패:`, e instanceof Error ? e.message : e)
      failed++
    }
  }

  const total = await prisma.investorDaily.count()
  console.log(`\n[backfill] 완료 — 수집 ${ok} / 스킵 ${skipped} / 실패 ${failed}`)
  console.log(`[backfill] investor_daily 총 ${total.toLocaleString()}행`)

  if (splitWarnings.length > 0) {
    console.log(`\n[backfill] 액면분할·감자 의심 (백테스트 시 해당일 이전 구간 제외 필요):`)
    splitWarnings.forEach(w => console.log('  - ' + w))
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('[backfill] 치명적 오류:', e)
  await prisma.$disconnect()
  process.exit(1)
})
