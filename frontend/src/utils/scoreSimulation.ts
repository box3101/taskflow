// 스코어 랭킹 가상매매 시뮬레이션 — Vue 의존성 없는 순수 계산 모듈
// 스펙: docs/superpowers/specs/2026-08-10-score-simulation-design.md

import type { ScoreSnapshotFull, ScoreSnapshotItem } from '../api/stockApi'

// ===== 상수 =====
export const HORIZON_DAYS = 3       // D+3 고정 청산
export const FEE_RATE = 0.00015     // 수수료 (매수·매도 각각)
export const TAX_RATE = 0.0015      // 증권거래세 (매도시)

// ===== 거래일 유틸 (주말 제외, 공휴일 무시) =====

/** from(제외) ~ to(포함) 사이 거래일 수 */
export function tradingDaysBetween(from: string, to: string): number {
  const end = new Date(to + 'T00:00:00')
  const cur = new Date(from + 'T00:00:00')
  let count = 0
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

/** from 기준 N거래일 뒤 날짜 (YYYY-MM-DD) */
export function addTradingDays(from: string, days: number): string {
  const cur = new Date(from + 'T00:00:00')
  let added = 0
  while (added < days) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  const y = cur.getFullYear()
  const m = String(cur.getMonth() + 1).padStart(2, '0')
  const d = String(cur.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ===== 타입 =====
export interface PickedCycle {
  snap: ScoreSnapshotFull
  exitDate: string          // 확정된 exitDate 또는 진입일 +HORIZON_DAYS 거래일
}

export interface SkippedSnapshot {
  date: string
  entryDate: string | null
  reason: 'holding' | 'no-entry-date'
}

// ===== 사이클 선택 =====

/**
 * 논오버랩 규칙으로 실제 매매할 스냅샷만 고른다.
 * 직전 사이클 청산일 이후(당일 포함)에 진입하는 스냅샷만 채택한다.
 * 청산일 종가로 팔고 같은 날 종가로 다시 사는 것은 가능하다고 본다.
 */
export function selectCycles(snapshots: ScoreSnapshotFull[]): {
  picked: PickedCycle[]
  skipped: SkippedSnapshot[]
} {
  const sorted = [...snapshots].sort((a, b) =>
    (a.entryDate || a.date).localeCompare(b.entryDate || b.date)
  )
  const picked: PickedCycle[] = []
  const skipped: SkippedSnapshot[] = []
  let cursor: string | null = null

  for (const snap of sorted) {
    if (!snap.entryDate) {
      skipped.push({ date: snap.date, entryDate: null, reason: 'no-entry-date' })
      continue
    }
    if (cursor !== null && snap.entryDate < cursor) {
      skipped.push({ date: snap.date, entryDate: snap.entryDate, reason: 'holding' })
      continue
    }
    const items: ScoreSnapshotItem[] = snap.data || []
    const confirmed = items.find(i => i.exitDate)
    const exitDate = confirmed?.exitDate || addTradingDays(snap.entryDate, HORIZON_DAYS)
    picked.push({ snap, exitDate })
    cursor = exitDate
  }

  return { picked, skipped }
}

// ===== 시뮬레이션 타입 =====
export interface SimHolding {
  code: string
  name: string
  score: number
  entryPrice: number
  quantity: number
  cost: number          // 투입금 (수수료 제외)
  exitPrice: number
  proceeds: number      // 매도금 (수수료·세금 제외)
  profit: number
  returnPct: number
  isMatured: boolean
}

export interface SimCycle {
  index: number         // 회차 (1부터)
  date: string          // 스코어일
  entryDate: string
  exitDate: string
  matured: boolean      // 매수 종목 전부가 exitPrice를 가짐
  noTrade: boolean      // 한 주도 매수하지 못함
  holdings: SimHolding[]
  investAmount: number
  startAsset: number
  endAsset: number      // 비용후
  endAssetGross: number // 비용전
  profit: number
  returnPct: number
  tradeCost: number
}

export interface SimInput {
  snapshots: ScoreSnapshotFull[]
  prices: Record<string, number>   // 미확정 종목 현재가 (code → 원)
  stockCount: number
  seedCash: number
}

export interface SimResult {
  cycles: SimCycle[]
  skipped: SkippedSnapshot[]
  seedCash: number
  finalAsset: number
  finalAssetGross: number
  totalReturnPct: number
  totalReturnPctGross: number
  totalCost: number
  maturedCount: number   // 확정 + 실매매 사이클 수 (지표 분모)
  pendingCount: number
  winCount: number
  winRate: number | null
  mdd: number
  avgReturnPct: number | null
  bestCycle: SimCycle | null
  worstCycle: SimCycle | null
}

// ===== 트랙 실행 =====
interface TrackCycle {
  holdings: SimHolding[]
  investAmount: number
  startAsset: number
  endAsset: number
  tradeCost: number
  matured: boolean
  noTrade: boolean
}

/** 자금 한 줄을 순차로 굴린다. withCost=false면 수수료·세금 0으로 계산 */
function runTrack(
  picked: PickedCycle[],
  prices: Record<string, number>,
  stockCount: number,
  seedCash: number,
  withCost: boolean,
): TrackCycle[] {
  const feeRate = withCost ? FEE_RATE : 0
  const taxRate = withCost ? TAX_RATE : 0
  const result: TrackCycle[] = []
  let asset = seedCash

  for (const { snap } of picked) {
    const startAsset = asset
    const items: ScoreSnapshotItem[] = snap.data || []
    const candidates = items
      .filter(i => i.entryPrice > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, stockCount)

    if (candidates.length === 0) {
      result.push({
        holdings: [], investAmount: 0, startAsset, endAsset: startAsset,
        tradeCost: 0, matured: true, noTrade: true,
      })
      continue
    }

    const per = startAsset / candidates.length
    const holdings: SimHolding[] = []
    let investAmount = 0
    let proceedsTotal = 0

    for (const c of candidates) {
      const quantity = Math.floor(per / c.entryPrice)
      const isMatured = c.exitPrice != null && c.exitPrice > 0
      const exitPrice = isMatured ? c.exitPrice! : (prices[c.code] || c.entryPrice)
      const cost = quantity * c.entryPrice
      const proceeds = quantity * exitPrice
      investAmount += cost
      proceedsTotal += proceeds
      holdings.push({
        code: c.code,
        name: c.name,
        score: c.total,
        entryPrice: c.entryPrice,
        quantity,
        cost,
        exitPrice,
        proceeds,
        profit: proceeds - cost,
        returnPct: ((exitPrice - c.entryPrice) / c.entryPrice) * 100,
        isMatured,
      })
    }

    const tradeCost =
      Math.round(investAmount * feeRate) + Math.round(proceedsTotal * (feeRate + taxRate))
    const leftover = startAsset - investAmount
    const endAsset = leftover + proceedsTotal - tradeCost

    result.push({
      holdings,
      investAmount,
      startAsset,
      endAsset,
      tradeCost,
      matured: holdings.filter(h => h.quantity > 0).every(h => h.isMatured),
      noTrade: holdings.every(h => h.quantity === 0),
    })
    asset = endAsset
  }

  return result
}

/** 고점 대비 최대 낙폭(%). 반환값은 0 이하 */
export function computeMdd(seedCash: number, assets: number[]): number {
  let peak = seedCash
  let mdd = 0
  for (const a of assets) {
    if (a > peak) peak = a
    const dd = ((a - peak) / peak) * 100
    if (dd < mdd) mdd = dd
  }
  return mdd
}

// ===== 진입점 =====
export function simulate(input: SimInput): SimResult {
  const { snapshots, prices, stockCount, seedCash } = input
  const { picked, skipped } = selectCycles(snapshots)

  const net = runTrack(picked, prices, stockCount, seedCash, true)
  const gross = runTrack(picked, prices, stockCount, seedCash, false)

  const cycles: SimCycle[] = picked.map((p, i) => ({
    index: i + 1,
    date: p.snap.date,
    entryDate: p.snap.entryDate!,
    exitDate: p.exitDate,
    matured: net[i].matured,
    noTrade: net[i].noTrade,
    holdings: net[i].holdings,
    investAmount: net[i].investAmount,
    startAsset: net[i].startAsset,
    endAsset: net[i].endAsset,
    endAssetGross: gross[i].endAsset,
    profit: net[i].endAsset - net[i].startAsset,
    returnPct:
      net[i].startAsset > 0
        ? ((net[i].endAsset - net[i].startAsset) / net[i].startAsset) * 100
        : 0,
    tradeCost: net[i].tradeCost,
  }))

  const finalAsset = cycles.length > 0 ? cycles[cycles.length - 1].endAsset : seedCash
  const finalAssetGross = cycles.length > 0 ? cycles[cycles.length - 1].endAssetGross : seedCash

  // 확정 + 실매매 사이클만 지표 분모로 쓴다
  const scored = cycles.filter(c => c.matured && !c.noTrade)
  const winCount = scored.filter(c => c.profit > 0).length

  return {
    cycles,
    skipped,
    seedCash,
    finalAsset,
    finalAssetGross,
    totalReturnPct: ((finalAsset - seedCash) / seedCash) * 100,
    totalReturnPctGross: ((finalAssetGross - seedCash) / seedCash) * 100,
    totalCost: cycles.reduce((s, c) => s + c.tradeCost, 0),
    maturedCount: scored.length,
    pendingCount: cycles.filter(c => !c.matured).length,
    winCount,
    winRate: scored.length > 0 ? (winCount / scored.length) * 100 : null,
    mdd: computeMdd(seedCash, scored.map(c => c.endAsset)),
    avgReturnPct:
      scored.length > 0 ? scored.reduce((s, c) => s + c.returnPct, 0) / scored.length : null,
    bestCycle: scored.length > 0 ? scored.reduce((a, b) => (b.returnPct > a.returnPct ? b : a)) : null,
    worstCycle: scored.length > 0 ? scored.reduce((a, b) => (b.returnPct < a.returnPct ? b : a)) : null,
  }
}
