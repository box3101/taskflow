// 과거 재현 백테스트 엔진 — investor_daily 캐시로 일자별 SmartScore를 재계산한다.
// 스코어링 로직은 프론트와 동일한 모듈을 직접 import 한다 (복사 금지 — 드리프트 방지).
//
// 규약 (종가만 보유하므로 시가 진입은 재현 불가)
//   주 규약(실행가능): T 종가 판단 → T+1 종가 진입 → T+4 종가 청산 (보유 3거래일)
//   부 규약(라이브 현행): T 종가 진입 → T+4 종가 청산 (약한 룩어헤드)
//
// 밸류(PER/PBR)는 과거값 복원 불가 → 결측 처리로 85점 만점 재정규화 경로를 탄다.
import { readFileSync } from 'fs'
import { resolve } from 'path'
import prisma from '../prisma'
import { calculateRanking, type StockInput } from '../../../frontend/src/utils/smartScoreV2'

const THEMES_PATH = resolve(__dirname, '../../../frontend/public/data/themes.json')

export const HOLD_DAYS = 3        // 진입 후 보유 거래일
export const LOOKBACK = 20        // 스코어에 필요한 과거 거래일
const SPLIT_THRESHOLD = 0.2       // 상장주식수 급변 = 액면분할·감자 의심
const MIN_UNIVERSE = 30           // 이보다 적으면 백분위가 무의미해 해당일 스킵

interface Row {
  date: string
  close: number
  changePct: number
  foreignVol: number
  instVol: number
  listedShares: number
}

/** 일자별·종목별 관측치 — 점수 구성요소와 원시 팩터값, 미래 수익률을 모두 담는다 */
export interface ReplayObs {
  date: string          // 스코어 산출일 T
  code: string
  name: string
  rank: number          // 해당일 점수 순위 (1 = 최고점)
  // 점수 구성요소
  total: number
  supply: number
  momentum: number
  surge: number
  foreignRatio: number
  instRatio: number
  foreignAmtScore: number
  instAmtScore: number
  volatilityPenalty: number
  // 원시 팩터값 (점수화 이전)
  chg20: number
  chg5: number
  turnover: number      // 5일 평균 (외인+기관 절대거래금액 / 시총)
  marketCap: number     // 해당일 시총 (백만원)
  // 미래 수익률 (%)
  retMain: number       // T+1 종가 진입 → T+4 종가 청산
  retLive: number       // T 종가 진입 → T+4 종가 청산
}

export interface ReplayOutput {
  observations: ReplayObs[]
  dates: string[]
  skippedDates: number
}

function loadMeta(): Map<string, { name: string; theme: string }> {
  const raw = JSON.parse(readFileSync(THEMES_PATH, 'utf8')) as {
    themes: { label: string; stocks: { code: string; name: string }[] }[]
  }
  const map = new Map<string, { name: string; theme: string }>()
  for (const t of raw.themes) {
    for (const s of t.stocks) {
      const cur = map.get(s.code)
      if (cur) {
        if (!cur.theme.includes(t.label)) cur.theme += '/' + t.label
      } else {
        map.set(s.code, { name: s.name, theme: t.label })
      }
    }
  }
  return map
}

/** 구간 내 상장주식수 급변 여부 */
function hasSplit(rows: Row[], from: number, to: number): boolean {
  for (let i = Math.max(1, from); i <= Math.min(rows.length - 1, to); i++) {
    const prev = rows[i - 1].listedShares
    const cur = rows[i].listedShares
    if (prev > 0 && cur > 0 && Math.abs(cur - prev) / prev > SPLIT_THRESHOLD) return true
  }
  return false
}

export async function runReplay(): Promise<ReplayOutput> {
  const meta = loadMeta()

  const all = await prisma.investorDaily.findMany({
    orderBy: [{ code: 'asc' }, { date: 'asc' }],
    select: {
      code: true, date: true, close: true, changePct: true,
      foreignVol: true, instVol: true, listedShares: true,
    },
  })

  const byCode = new Map<string, Row[]>()
  for (const r of all) {
    if (!byCode.has(r.code)) byCode.set(r.code, [])
    byCode.get(r.code)!.push({
      date: r.date, close: r.close, changePct: r.changePct,
      foreignVol: r.foreignVol, instVol: r.instVol, listedShares: r.listedShares ?? 0,
    })
  }
  const idxOf = new Map<string, Map<string, number>>()
  for (const [code, rows] of byCode) {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.date, i))
    idxOf.set(code, m)
  }

  // 거래일 축: 가장 긴 시계열 기준
  let axis: string[] = []
  for (const rows of byCode.values()) if (rows.length > axis.length) axis = rows.map(r => r.date)

  const observations: ReplayObs[] = []
  const dates: string[] = []
  let skippedDates = 0

  for (let i = LOOKBACK; i + HOLD_DAYS + 1 < axis.length; i++) {
    const T = axis[i]
    const inputs: StockInput[] = []
    const extra = new Map<string, {
      entry: number; sameDay: number; exit: number; turnover: number; marketCap: number
    }>()

    for (const [code, rows] of byCode) {
      const idx = idxOf.get(code)!.get(T)
      if (idx === undefined || idx < LOOKBACK) continue
      const entryIdx = idx + 1
      const exitIdx = idx + 1 + HOLD_DAYS
      if (exitIdx >= rows.length) continue

      const cur = rows[idx]
      if (cur.listedShares <= 0) continue
      if (hasSplit(rows, idx - LOOKBACK + 1, exitIdx)) continue

      const base20 = rows[idx - LOOKBACK].close
      const base5 = rows[idx - 5].close
      if (!(base20 > 0) || !(base5 > 0) || !(cur.close > 0)) continue
      if (!(rows[entryIdx].close > 0) || !(rows[exitIdx].close > 0)) continue

      // 최신순(desc) 20행 — 라이브 크롤러와 동일한 정렬
      const window = rows.slice(idx - LOOKBACK + 1, idx + 1).reverse()
      const trends = window.map(r => ({
        date: r.date,
        foreign: r.foreignVol,
        institution: r.instVol,
        individual: 0,
        foreignAmt: Math.round(r.foreignVol * r.close / 1_000_000),
        institutionAmt: Math.round(r.instVol * r.close / 1_000_000),
        changePct: r.changePct,
      }))

      const marketCap = Math.round(cur.listedShares * cur.close / 1_000_000)
      const turnover = marketCap > 0
        ? trends.slice(0, 5).reduce((s, d) => s + Math.abs(d.foreignAmt) + Math.abs(d.institutionAmt), 0) / 5 / marketCap
        : 0

      const m = meta.get(code)
      inputs.push({
        code,
        name: m?.name || code,
        theme: m?.theme || '-',
        chg20: (cur.close / base20 - 1) * 100,
        chg5: (cur.close / base5 - 1) * 100,
        data: { trends, per: '-', pbr: '-', marketCap: String(marketCap) },
      })
      extra.set(code, {
        entry: rows[entryIdx].close,
        sameDay: cur.close,
        exit: rows[exitIdx].close,
        turnover,
        marketCap,
      })
    }

    if (inputs.length < MIN_UNIVERSE) { skippedDates++; continue }

    const inputByCode = new Map(inputs.map(s => [s.code, s]))
    const ranked = calculateRanking(inputs, Infinity)

    ranked.forEach((r, n) => {
      const f = extra.get(r.code)!
      const src = inputByCode.get(r.code)!
      observations.push({
        date: T,
        code: r.code,
        name: r.name,
        rank: n + 1,
        total: r.total,
        supply: r.supply,
        momentum: r.momentum,
        surge: r.surge,
        foreignRatio: r.foreignRatio,
        instRatio: r.instRatio,
        foreignAmtScore: r.foreignAmtScore,
        instAmtScore: r.instAmtScore,
        volatilityPenalty: r.volatilityPenalty,
        chg20: src.chg20,
        chg5: src.chg5,
        turnover: f.turnover,
        marketCap: f.marketCap,
        retMain: (f.exit / f.entry - 1) * 100,
        retLive: (f.exit / f.sameDay - 1) * 100,
      })
    })
    dates.push(T)
  }

  return { observations, dates, skippedDates }
}
