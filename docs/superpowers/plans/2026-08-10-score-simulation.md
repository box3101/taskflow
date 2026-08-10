# 가상매매 수익률 (Score Simulation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smart Score 랭킹대로 자금을 굴렸다면 계좌가 어떻게 됐을지를 원 단위 누적 자산 곡선으로 보여주는 카드를 주식 탭에 추가한다.

**Architecture:** 계산은 `frontend/src/utils/scoreSimulation.ts` 순수함수가 전담하고 vitest로 검증한다. 스냅샷 로드는 `useScoreSnapshots()` composable이 모듈 스코프에 캐시해 기존 `ScoreBacktest.vue`와 신규 `ScoreSimulation.vue`가 공유한다. 백엔드·스키마 변경은 없다.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, SCSS, `@leechanyong/ispark-ui` (UiTab / UiSelect / UiChart / UiTable / UiDrawer / UiEmpty / UiBadge), vitest

**Spec:** `docs/superpowers/specs/2026-08-10-score-simulation-design.md`

**작업 디렉터리:** 모든 명령은 `C:\projects\taskflow\frontend` 기준. npm 명령은 **Bash 툴**로 실행한다 (이 환경의 PowerShell `npm.ps1`이 손상돼 파싱 에러가 남).

---

## File Structure

| 파일 | 책임 |
|------|------|
| `src/utils/scoreSimulation.ts` (Create) | 거래일 유틸 · 논오버랩 사이클 선택 · 손익 계산 · 지표 집계. Vue 의존성 없는 순수함수만 |
| `src/utils/scoreSimulation.test.ts` (Create) | 위 모듈의 vitest 단위 테스트 |
| `src/composables/useScoreSnapshots.ts` (Create) | 스냅샷 + 미확정 종목 현재가를 모듈 스코프에 1회 로드해 카드 간 공유 |
| `src/components/stock/ScoreSimulation.vue` (Create) | 화면 — 컨트롤 / 요약 4칸 / 자산곡선 / 회차별 표 / 종목 드로어 |
| `src/components/stock/ScoreBacktest.vue` (Modify) | 자체 스냅샷 로드를 composable로 교체, 거래일 유틸을 공용 모듈에서 import |
| `src/components/stock/StockDashboard.vue` (Modify) | `ScoreBacktest` 아래에 `ScoreSimulation` 삽입 |

---

## Task 1: vitest 설치 (테스트 실행 환경 복구)

`vitest`가 `package.json` devDependencies에는 있으나 `node_modules`에 설치돼 있지 않다. 이후 모든 태스크가 테스트로 검증되므로 먼저 복구한다.

**Files:** 없음 (의존성 설치만)

- [ ] **Step 1: 현재 실패를 확인**

Bash 툴로 실행:
```bash
cd /c/projects/taskflow/frontend && npx vitest run 2>&1 | tail -5
```
Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest'`

- [ ] **Step 2: 설치**

```bash
cd /c/projects/taskflow/frontend && npm install
```
Expected: 정상 종료. `added N packages` 출력.

- [ ] **Step 3: 기존 테스트가 통과하는지 확인**

```bash
cd /c/projects/taskflow/frontend && npm run test
```
Expected: `src/utils/movieDisplay.test.ts` PASS, 실패 0건

- [ ] **Step 4: 커밋**

`package-lock.json`만 변경됐다면 커밋한다. 변경이 없으면 이 스텝은 건너뛴다.

```bash
cd /c/projects/taskflow && git add frontend/package-lock.json && git commit -m "chore: 프론트엔드 vitest 설치 복구"
```

---

## Task 2: 상수 · 거래일 유틸

**Files:**
- Create: `frontend/src/utils/scoreSimulation.ts`
- Create: `frontend/src/utils/scoreSimulation.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/utils/scoreSimulation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tradingDaysBetween, addTradingDays, HORIZON_DAYS, FEE_RATE, TAX_RATE } from './scoreSimulation'

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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: FAIL — `Failed to resolve import "./scoreSimulation"`

- [ ] **Step 3: 최소 구현**

`frontend/src/utils/scoreSimulation.ts`:

```ts
// 스코어 랭킹 가상매매 시뮬레이션 — Vue 의존성 없는 순수 계산 모듈
// 스펙: docs/superpowers/specs/2026-08-10-score-simulation-design.md

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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: PASS 5건

- [ ] **Step 5: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/utils/scoreSimulation.ts frontend/src/utils/scoreSimulation.test.ts && git commit -m "feat: 가상매매 시뮬레이션 거래일 유틸 추가"
```

---

## Task 3: 논오버랩 사이클 선택

D+3 보유 중에 저장된 스냅샷은 건너뛰고, 자금 한 줄만 순차 운용할 스냅샷을 고른다.

**Files:**
- Modify: `frontend/src/utils/scoreSimulation.ts` (파일 끝에 추가)
- Modify: `frontend/src/utils/scoreSimulation.test.ts` (파일 끝에 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`scoreSimulation.test.ts` 상단 import 문을 아래로 교체:

```ts
import { describe, it, expect } from 'vitest'
import type { ScoreSnapshotFull, ScoreSnapshotItem } from '../api/stockApi'
import {
  tradingDaysBetween, addTradingDays, selectCycles,
  HORIZON_DAYS, FEE_RATE, TAX_RATE,
} from './scoreSimulation'

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
```

파일 끝에 추가:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: FAIL — `selectCycles is not a function` (또는 export 없음 에러)

- [ ] **Step 3: 최소 구현**

`scoreSimulation.ts` 파일 끝에 추가:

```ts
import type { ScoreSnapshotFull, ScoreSnapshotItem } from '../api/stockApi'

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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: PASS 11건 (Task 2의 5건 + 6건)

- [ ] **Step 5: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/utils/scoreSimulation.ts frontend/src/utils/scoreSimulation.test.ts && git commit -m "feat: 논오버랩 사이클 선택 로직 추가"
```

---

## Task 4: 사이클별 손익 계산

비용을 적용한 트랙과 적용하지 않은 트랙을 각각 독립적으로 굴려 두 수치를 동시에 낸다.

**Files:**
- Modify: `frontend/src/utils/scoreSimulation.ts` (파일 끝에 추가)
- Modify: `frontend/src/utils/scoreSimulation.test.ts` (파일 끝에 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`scoreSimulation.test.ts`의 import 문에 `simulate` 추가:

```ts
import {
  tradingDaysBetween, addTradingDays, selectCycles, simulate,
  HORIZON_DAYS, FEE_RATE, TAX_RATE,
} from './scoreSimulation'
```

파일 끝에 추가:

```ts
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

  it('사이클이 없으면 종자금 그대로 반환한다', () => {
    const r = simulate({ snapshots: [], prices: {}, stockCount: 3, seedCash: 1000000 })
    expect(r.cycles).toEqual([])
    expect(r.finalAsset).toBe(1000000)
    expect(r.totalReturnPct).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: FAIL — `simulate is not a function`

- [ ] **Step 3: 최소 구현**

`scoreSimulation.ts` 파일 끝에 추가:

```ts
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
      matured: holdings.every(h => h.isMatured),
      noTrade: holdings.every(h => h.quantity === 0),
    })
    asset = endAsset
  }

  return result
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

  return {
    cycles,
    skipped,
    seedCash,
    finalAsset,
    finalAssetGross,
    totalReturnPct: ((finalAsset - seedCash) / seedCash) * 100,
    totalReturnPctGross: ((finalAssetGross - seedCash) / seedCash) * 100,
    totalCost: cycles.reduce((s, c) => s + c.tradeCost, 0),
    maturedCount: 0,
    pendingCount: 0,
    winCount: 0,
    winRate: null,
    mdd: 0,
    avgReturnPct: null,
    bestCycle: null,
    worstCycle: null,
  }
}
```

지표 필드는 Task 5에서 채운다. 이 태스크에서는 손익 계산만 검증한다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: PASS 20건

- [ ] **Step 5: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/utils/scoreSimulation.ts frontend/src/utils/scoreSimulation.test.ts && git commit -m "feat: 사이클 손익 계산 — 단주 버림·비용 전후 2트랙"
```

---

## Task 5: 지표 집계

승률·MDD·평균·최고/최악을 채운다. 진행중 사이클과 매매 없는 사이클은 분모에서 뺀다.

**Files:**
- Modify: `frontend/src/utils/scoreSimulation.ts`
- Modify: `frontend/src/utils/scoreSimulation.test.ts` (파일 끝에 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

import 문에 `computeMdd` 추가:

```ts
import {
  tradingDaysBetween, addTradingDays, selectCycles, simulate, computeMdd,
  HORIZON_DAYS, FEE_RATE, TAX_RATE,
} from './scoreSimulation'
```

파일 끝에 추가:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /c/projects/taskflow/frontend && npx vitest run src/utils/scoreSimulation.test.ts
```
Expected: FAIL — `computeMdd is not a function`, 그리고 `maturedCount` 등이 0으로 남아 실패

- [ ] **Step 3: 구현**

`scoreSimulation.ts`의 `simulate` 함수 **바로 위**에 추가:

```ts
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
```

`simulate` 함수의 `return { ... }` 직전에 추가:

```ts
  // 확정 + 실매매 사이클만 지표 분모로 쓴다
  const scored = cycles.filter(c => c.matured && !c.noTrade)
  const winCount = scored.filter(c => c.profit > 0).length
```

`simulate`의 return 블록에서 지표 6줄을 아래로 교체:

```ts
    maturedCount: scored.length,
    pendingCount: cycles.filter(c => !c.matured).length,
    winCount,
    winRate: scored.length > 0 ? (winCount / scored.length) * 100 : null,
    mdd: computeMdd(seedCash, scored.map(c => c.endAsset)),
    avgReturnPct:
      scored.length > 0 ? scored.reduce((s, c) => s + c.returnPct, 0) / scored.length : null,
    bestCycle: scored.length > 0 ? scored.reduce((a, b) => (b.returnPct > a.returnPct ? b : a)) : null,
    worstCycle: scored.length > 0 ? scored.reduce((a, b) => (b.returnPct < a.returnPct ? b : a)) : null,
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /c/projects/taskflow/frontend && npm run test
```
Expected: PASS 29건, 실패 0건

- [ ] **Step 5: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/utils/scoreSimulation.ts frontend/src/utils/scoreSimulation.test.ts && git commit -m "feat: 시뮬레이션 지표 집계 — 승률·MDD·평균·최고최악"
```

---

## Task 6: 스냅샷 캐시 composable

**Files:**
- Create: `frontend/src/composables/useScoreSnapshots.ts`

- [ ] **Step 1: composable 작성**

`frontend/src/composables/useScoreSnapshots.ts`:

```ts
import { ref } from 'vue'
import { fetchSnapshotList, fetchSnapshotByDate, fetchPrice } from '../api/stockApi'
import type { ScoreSnapshotFull } from '../api/stockApi'

// ===== 상태 변수 (모듈 스코프 — 카드 간 공유) =====
const snapshots = ref<ScoreSnapshotFull[]>([])
const prices = ref<Record<string, number>>({})   // 미확정 종목 현재가
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let inflight: Promise<void> | null = null

// ===== 조회 =====
const loadOnce = async () => {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchSnapshotList()
    const fulls: ScoreSnapshotFull[] = []
    for (const s of list) {
      const full = await fetchSnapshotByDate(s.date)
      if (full && Array.isArray(full.data)) fulls.push(full)
    }
    snapshots.value = fulls

    // 미확정 종목 현재가는 코드 중복 제거 후 1회만 조회
    const pendingCodes = [...new Set(
      fulls.flatMap(f => f.data.filter(i => i.exitPrice == null).map(i => i.code))
    )]
    if (pendingCodes.length > 0) {
      const res = await fetchPrice(pendingCodes)
      const map: Record<string, number> = {}
      for (const [code, q] of Object.entries(res)) map[code] = q.price || 0
      prices.value = map
    } else {
      prices.value = {}
    }
    loaded.value = true
  } catch (e) {
    error.value = '스냅샷 로드 실패'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 이미 로드됐으면 즉시 반환, 진행 중이면 그 Promise를 공유한다
const handleLoadSnapshots = async () => {
  if (loaded.value) return
  if (!inflight) inflight = loadOnce().finally(() => { inflight = null })
  await inflight
}

// 캐시를 버리고 다시 받는다 (두 카드 모두 갱신됨)
const handleRefreshSnapshots = async () => {
  loaded.value = false
  if (!inflight) inflight = loadOnce().finally(() => { inflight = null })
  await inflight
}

export const useScoreSnapshots = () => {
  return { snapshots, prices, loading, loaded, error, handleLoadSnapshots, handleRefreshSnapshots }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /c/projects/taskflow/frontend && npx vue-tsc --noEmit
```
Expected: 에러 0건

- [ ] **Step 3: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/composables/useScoreSnapshots.ts && git commit -m "feat: 스코어 스냅샷 캐시 composable 추가"
```

---

## Task 7: ScoreBacktest.vue를 공용 캐시로 전환

기존 카드가 스냅샷을 자체 로드하던 것을 composable로 바꿔 중복 호출을 없앤다. 스프레드 계산 로직은 건드리지 않는다.

**Files:**
- Modify: `frontend/src/components/stock/ScoreBacktest.vue:1-105`

- [ ] **Step 1: 전환 전 화면 확인**

브라우저에서 `http://localhost:5174` 주식 탭을 열고 '구간 스프레드 분석' 카드의 날짜별 표 내용을 캡처하거나 메모해 둔다. 전환 후 동일해야 한다.

- [ ] **Step 2: import와 상태 변수 교체**

`ScoreBacktest.vue` 1~26행을 아래로 교체:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiBadge, UiButton, UiIcon } from '@leechanyong/ispark-ui'
import { matureSnapshots } from '../../api/stockApi'
import type { ScoreSnapshotItem } from '../../api/stockApi'
import { useScoreSnapshots } from '../../composables/useScoreSnapshots'
import { tradingDaysBetween } from '../../utils/scoreSimulation'

const HORIZON_DAYS = 3

// 스냅샷별 수익률 데이터
interface ScoredItem extends ScoreSnapshotItem {
  currentPrice: number
  computedReturn: number  // matured면 확정(D+3), 아니면 진행중(진입→현재)
  isMatured: boolean
}
interface SnapshotReturn {
  date: string
  entryDate: string | null
  matured: boolean
  items: ScoredItem[]
}

const { snapshots, prices: snapPrices, loading, error, handleLoadSnapshots, handleRefreshSnapshots } = useScoreSnapshots()

const maturing = ref(false)
const snapshotReturns = ref<SnapshotReturn[]>([])
```

- [ ] **Step 3: 거래일 헬퍼와 로드 함수 교체**

이어지는 `// ── 거래일 계산 ──` 주석부터 `runMature` 함수 끝(기존 105행)까지를 아래로 교체:

```ts
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 스냅샷이 없을 때 보여줄 안내 (에러보다 우선)
const emptyNotice = computed(() => {
  if (error.value) return error.value
  if (!loading.value && snapshots.value.length === 0) {
    return '저장된 스냅샷이 없습니다. Smart Score에서 먼저 스코어를 저장하세요.'
  }
  return ''
})

function buildReturns() {
  snapshotReturns.value = snapshots.value.map(full => {
    const items = full.data as ScoreSnapshotItem[]
    const scored: ScoredItem[] = items.map(item => {
      const isMatured = item.exitPrice != null && item.exitPrice > 0
      const cur = snapPrices.value[item.code] || 0
      const entry = item.entryPrice || 0
      const computedReturn = isMatured
        ? (item.returnPct ?? 0)
        : (entry > 0 && cur > 0 ? ((cur - entry) / entry) * 100 : 0)
      return { ...item, currentPrice: cur, computedReturn, isMatured }
    })

    const withEntry = scored.filter(i => i.entryPrice > 0)
    return {
      date: full.date,
      entryDate: full.entryDate,
      matured: withEntry.length > 0 && withEntry.every(i => i.isMatured),
      items: scored,
    }
  })
}

async function loadBacktestData() {
  await handleLoadSnapshots()
  buildReturns()
}

async function refreshBacktestData() {
  await handleRefreshSnapshots()
  buildReturns()
}

// 만기 스냅샷 즉시 확정 (수동 트리거)
async function runMature() {
  maturing.value = true
  try {
    await matureSnapshots()
    await refreshBacktestData()
  } catch (e) {
    console.error(e)
  } finally {
    maturing.value = false
  }
}
```

- [ ] **Step 4: 보유일 계산의 거래일 호출부 보정**

기존 `tradingDaysBetween`은 최소 1을 반환했지만 공용 유틸은 순수 카운트를 반환한다. `dailySummaries` 안의 `heldDays` 계산을 아래로 교체:

```ts
    const heldDays = snap.entryDate
      ? Math.max(1, tradingDaysBetween(snap.entryDate, snap.matured && exitDate ? exitDate : today))
      : HORIZON_DAYS
```

- [ ] **Step 5: 템플릿의 새로고침·에러 표시 교체**

새로고침 버튼(기존 205~207행)을 아래로 교체:

```vue
        <UiButton size="sm" variant="secondary" :disabled="loading" @click="refreshBacktestData">
          {{ loading ? '로딩...' : '새로고침' }}
        </UiButton>
```

에러 표시 줄(기존 217행)을 아래로 교체:

```vue
    <div v-else-if="emptyNotice" class="loading-msg">{{ emptyNotice }}</div>
```

`v-else-if="error"`를 쓰던 자리가 모두 `emptyNotice`로 바뀌었는지 확인한다.

- [ ] **Step 6: 타입 체크**

```bash
cd /c/projects/taskflow/frontend && npx vue-tsc --noEmit
```
Expected: 에러 0건

- [ ] **Step 7: 화면 확인**

브라우저에서 주식 탭을 새로고침하고 '구간 스프레드 분석' 표가 Step 1과 동일한지 확인한다. 개발자도구 Network 탭에서 `score-snapshots` 요청이 스냅샷 수 + 1회만 나가는지 본다.

- [ ] **Step 8: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/components/stock/ScoreBacktest.vue && git commit -m "refactor: 구간 스프레드 카드를 공용 스냅샷 캐시로 전환"
```

---

## Task 8: ScoreSimulation.vue — 컨트롤 + 요약 4칸

**Files:**
- Create: `frontend/src/components/stock/ScoreSimulation.vue`
- Modify: `frontend/src/components/stock/StockDashboard.vue:9-11, 91-94`

- [ ] **Step 1: 컴포넌트 작성**

`frontend/src/components/stock/ScoreSimulation.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiButton, UiIcon, UiTab, UiSelect, UiEmpty } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption } from '@leechanyong/ispark-ui'
import { useScoreSnapshots } from '../../composables/useScoreSnapshots'
import { simulate, HORIZON_DAYS } from '../../utils/scoreSimulation'

const STORAGE_COUNT = 'taskflow.scoreSim.stockCount'
const STORAGE_SEED = 'taskflow.scoreSim.seedCash'

const { snapshots, prices, loading, handleLoadSnapshots, handleRefreshSnapshots } = useScoreSnapshots()

// ===== 설정 (localStorage 저장) =====
const stockCount = ref(Number(localStorage.getItem(STORAGE_COUNT)) || 3)
const seedCash = ref(Number(localStorage.getItem(STORAGE_SEED)) || 10000000)

watch(stockCount, v => localStorage.setItem(STORAGE_COUNT, String(v)))
watch(seedCash, v => localStorage.setItem(STORAGE_SEED, String(v)))

const countTabs: TabItem[] = [
  { label: '상위 1', value: '1' },
  { label: '상위 3', value: '3' },
  { label: '상위 5', value: '5' },
  { label: '상위 10', value: '10' },
]
const countTab = computed({
  get: () => String(stockCount.value),
  set: (v: string) => { stockCount.value = Number(v) },
})

const seedOptions: SelectOption[] = [
  { label: '500만원', value: '5000000' },
  { label: '1,000만원', value: '10000000' },
  { label: '3,000만원', value: '30000000' },
  { label: '5,000만원', value: '50000000' },
]
const seedSelect = computed({
  get: () => String(seedCash.value),
  set: (v: string | number) => { seedCash.value = Number(v) },
})

// ===== 시뮬레이션 =====
const result = computed(() => simulate({
  snapshots: snapshots.value,
  prices: prices.value,
  stockCount: stockCount.value,
  seedCash: seedCash.value,
}))

const hasCycles = computed(() => result.value.cycles.length > 0)
const noEntryCount = computed(() => result.value.skipped.filter(s => s.reason === 'no-entry-date').length)

// ===== 표시 헬퍼 =====
const won = (v: number) => Math.round(v).toLocaleString()
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const pctColor = (v: number) => (v > 0 ? '#ef4444' : v < 0 ? '#3b82f6' : '#6b7280')

handleLoadSnapshots()
</script>

<template>
  <div class="score-simulation">
    <div class="section-header">
      <h3><UiIcon name="trending-up" :size="18" /> 가상매매 수익률</h3>
      <UiButton size="sm" variant="secondary" :disabled="loading" @click="handleRefreshSnapshots">
        {{ loading ? '로딩...' : '새로고침' }}
      </UiButton>
    </div>

    <p class="desc">
      스코어 상위 N종목을 진입일 종가로 사서 <b>D+{{ HORIZON_DAYS }}</b>에 파는 것을 반복했을 때의 실제 돈 흐름<br />
      보유 중에 저장된 스냅샷은 건너뛰고 자금 한 줄만 순차로 굴린다 (논오버랩 복리)
    </p>

    <!-- 설정 -->
    <div class="sim-controls">
      <UiTab v-model="countTab" :tabs="countTabs" align="left" size="sm" />
      <div class="seed-wrap">
        <span class="seed-label">종자금</span>
        <UiSelect v-model="seedSelect" :options="seedOptions" size="sm" />
      </div>
    </div>

    <div v-if="loading" class="loading-msg">시뮬레이션 계산 중...</div>

    <UiEmpty
      v-else-if="!hasCycles"
      title="계산할 사이클이 없습니다."
      description="Smart Score에서 스코어를 저장하고 3거래일 이상 모아주세요."
    />

    <template v-else>
      <!-- 요약 4칸 -->
      <div class="sim-summary">
        <div class="sum-card">
          <div class="s-label">최종자산</div>
          <div class="s-value">{{ won(result.finalAsset) }}원</div>
          <div class="s-sub">종자금 {{ won(result.seedCash) }}원</div>
        </div>
        <div class="sum-card">
          <div class="s-label">누적수익률</div>
          <div class="s-value" :style="{ color: pctColor(result.totalReturnPct) }">
            {{ pct(result.totalReturnPct) }}
          </div>
          <div class="s-sub">비용전 {{ pct(result.totalReturnPctGross) }}</div>
        </div>
        <div class="sum-card">
          <div class="s-label">승률</div>
          <div class="s-value">
            {{ result.winRate === null ? '-' : `${result.winCount}/${result.maturedCount}` }}
          </div>
          <div class="s-sub">
            {{ result.winRate === null ? '확정 회차 없음' : `${result.winRate.toFixed(0)}%` }}
          </div>
        </div>
        <div class="sum-card">
          <div class="s-label">MDD</div>
          <div class="s-value" :style="{ color: result.mdd < 0 ? '#3b82f6' : '#6b7280' }">
            {{ result.mdd === 0 ? '-' : `${result.mdd.toFixed(2)}%` }}
          </div>
          <div class="s-sub">확정 회차 기준 최대낙폭</div>
        </div>
      </div>

      <p v-if="result.avgReturnPct !== null && result.bestCycle && result.worstCycle" class="stat-note">
        회차 평균 <b :style="{ color: pctColor(result.avgReturnPct) }">{{ pct(result.avgReturnPct) }}</b>
        · 최고 {{ result.bestCycle.index }}회차 {{ pct(result.bestCycle.returnPct) }}
        · 최악 {{ result.worstCycle.index }}회차 {{ pct(result.worstCycle.returnPct) }}
      </p>

      <p class="cost-note">
        비용 합계 <b>-{{ won(result.totalCost) }}원</b>
        (수수료 0.015%×2 + 증권거래세 0.15%)
        <template v-if="result.pendingCount"> · 진행중 {{ result.pendingCount }}회차</template>
        <template v-if="noEntryCount"> · 진입일 미기록 {{ noEntryCount }}건 제외</template>
      </p>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.score-simulation {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}

.desc { font-size: 12px; color: #9ca3af; margin: 0 0 16px; }

.sim-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.seed-wrap { display: flex; align-items: center; gap: 8px; }
.seed-label { font-size: 12px; color: #6b7280; font-weight: 600; white-space: nowrap; }

.loading-msg { text-align: center; padding: 24px; color: #9ca3af; font-size: 14px; }

.sim-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.sum-card {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}
.s-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
.s-value { font-size: 20px; font-weight: 700; }
.s-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }

.stat-note { font-size: 12px; color: #6b7280; margin: 0 0 6px; }
.cost-note { font-size: 11px; color: #9ca3af; margin: 0 0 16px; }

@media (max-width: 640px) {
  .score-simulation { padding: 14px; }
  .sim-summary { flex-wrap: wrap; }
  .sum-card { min-width: calc(50% - 8px); }
  .s-value { font-size: 16px; }
}
</style>
```

- [ ] **Step 2: 대시보드에 삽입**

`StockDashboard.vue` 10행 아래에 import 추가:

```ts
import ScoreSimulation from './ScoreSimulation.vue'
```

`<!-- 구간 스프레드 분석 -->` 블록 아래(기존 91행 `<ScoreBacktest />` 다음)에 추가:

```vue
    <!-- 가상매매 수익률 -->
    <ScoreSimulation />
```

- [ ] **Step 3: 타입 체크**

```bash
cd /c/projects/taskflow/frontend && npx vue-tsc --noEmit
```
Expected: 에러 0건

- [ ] **Step 4: 화면 확인**

브라우저 주식 탭에서 '가상매매 수익률' 카드가 '구간 스프레드 분석' 아래에 보이는지, 상위 1/3/5/10 토글과 종자금 변경 시 요약 숫자가 즉시 바뀌는지 확인한다. 새로고침해도 선택이 유지되어야 한다.

- [ ] **Step 5: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/components/stock/ScoreSimulation.vue frontend/src/components/stock/StockDashboard.vue && git commit -m "feat: 가상매매 수익률 카드 — 컨트롤·요약 지표"
```

---

## Task 9: 자산곡선 차트

**Files:**
- Modify: `frontend/src/components/stock/ScoreSimulation.vue`

- [ ] **Step 1: import에 UiChart 추가**

```ts
import { UiButton, UiIcon, UiTab, UiSelect, UiEmpty, UiChart } from '@leechanyong/ispark-ui'
```

- [ ] **Step 2: 차트 config 계산 추가**

`// ===== 표시 헬퍼 =====` 주석 **바로 위**에 추가:

```ts
// ===== 자산곡선 =====
// 라인차트 config 계약: { categories, datasets } — datasets는 Chart.js 데이터셋을 그대로 받는다
const assetChart = computed(() => {
  const cycles = result.value.cycles
  return {
    categories: ['시작', ...cycles.map(c => c.entryDate.slice(5))],
    datasets: [
      {
        label: '비용후',
        data: [result.value.seedCash, ...cycles.map(c => c.endAsset)],
        borderColor: '#ef4444',
      },
      {
        label: '비용전',
        data: [result.value.seedCash, ...cycles.map(c => c.endAssetGross)],
        borderColor: '#9ca3af',
        borderDash: [4, 4],
      },
    ],
    tooltipValueSuffix: '원',
  }
})
```

- [ ] **Step 3: 템플릿에 차트 삽입**

요약 4칸 블록(`.sim-summary`를 닫는 `</div>`)과 `<p v-if="result.avgReturnPct !== null ...` 사이에 추가:

```vue
      <!-- 자산곡선 -->
      <div class="chart-wrap">
        <UiChart type="line" :config="assetChart" :show-legend="true" />
      </div>
```

- [ ] **Step 4: 스타일 추가**

`.stat-note` 규칙 **위**에 추가:

```scss
.chart-wrap {
  height: 220px;
  margin-bottom: 12px;
  :deep(.ui-chart-canvas-wrap) { min-height: 0; }
}
```

- [ ] **Step 5: 화면 확인**

브라우저에서 카드에 선 두 개(빨간 실선 = 비용후, 회색 점선 = 비용전)가 그려지는지 확인한다. 상위 N을 바꾸면 곡선이 다시 그려져야 한다. 툴팁에 `비용후: 10,240,000원` 형식으로 뜨는지 본다.

- [ ] **Step 6: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/components/stock/ScoreSimulation.vue && git commit -m "feat: 가상매매 자산곡선 차트 추가"
```

---

## Task 10: 회차별 표 + 종목 상세 드로어

**Files:**
- Modify: `frontend/src/components/stock/ScoreSimulation.vue`

- [ ] **Step 1: import 확장**

```ts
import { UiButton, UiIcon, UiTab, UiSelect, UiEmpty, UiChart, UiTable, UiBadge, UiDrawer } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption, TableColumn } from '@leechanyong/ispark-ui'
import { simulate, HORIZON_DAYS } from '../../utils/scoreSimulation'
import type { SimCycle } from '../../utils/scoreSimulation'
```

- [ ] **Step 2: 표 데이터와 드로어 상태 추가**

`// ===== 표시 헬퍼 =====` 블록 **아래**에 추가:

```ts
// ===== 회차별 표 =====
const cycleColumns: TableColumn[] = [
  { key: 'no', label: '회차', width: '52px', align: 'center' },
  { key: 'date', label: '스코어일', width: '72px', align: 'center' },
  { key: 'entry', label: '진입', width: '64px', align: 'center', hideBelow: 640 },
  { key: 'stocks', label: '종목', width: '48px', align: 'center' },
  { key: 'status', label: '상태', width: '64px', align: 'center' },
  { key: 'invest', label: '투입금', width: '96px', align: 'right', hideBelow: 480 },
  { key: 'endAsset', label: '평가금', width: '96px', align: 'right' },
  { key: 'profit', label: '손익', width: '92px', align: 'right' },
  { key: 'returnPct', label: '수익률', width: '72px', align: 'right' },
]

const cycleRows = computed(() =>
  result.value.cycles.map(c => ({
    no: c.index,
    date: c.date.slice(5),
    entry: c.entryDate.slice(5),
    stocks: c.holdings.filter(h => h.quantity > 0).length,
    status: c.matured ? '확정' : '진행중',
    invest: c.investAmount,
    endAsset: c.endAsset,
    profit: c.profit,
    returnPct: c.returnPct,
    matured: c.matured,
    cycle: c,
  }))
)

// ===== 종목 상세 드로어 =====
const drawerOpen = ref(false)
const selectedCycle = ref<SimCycle | null>(null)

function openCycleDetail(row: { cycle: SimCycle }) {
  selectedCycle.value = row.cycle
  drawerOpen.value = true
}

// 건너뛴 스냅샷 (보유중이라 매매 못 한 날)
const holdingSkipped = computed(() => result.value.skipped.filter(s => s.reason === 'holding'))
```

- [ ] **Step 3: 템플릿에 표 삽입**

`<p class="cost-note">` **아래**에 추가:

```vue
      <!-- 회차별 -->
      <div class="cycle-section">
        <h4>회차별 <span class="h4-note">(행을 누르면 종목 상세)</span></h4>
        <UiTable
          :columns="cycleColumns"
          :data="(cycleRows as any)"
          size="sm"
          @row-click="(row: any) => openCycleDetail(row)"
        >
          <template #cell-status="{ row }: any">
            <UiBadge :variant="row.matured ? 'success' : 'default'" size="sm">{{ row.status }}</UiBadge>
          </template>
          <template #cell-invest="{ row }: any">{{ won(row.invest) }}</template>
          <template #cell-endAsset="{ row }: any">{{ won(row.endAsset) }}</template>
          <template #cell-profit="{ row }: any">
            <span :style="{ color: pctColor(row.profit), fontWeight: 700 }">
              {{ row.profit >= 0 ? '+' : '' }}{{ won(row.profit) }}
            </span>
          </template>
          <template #cell-returnPct="{ row }: any">
            <span :style="{ color: pctColor(row.returnPct) }">{{ pct(row.returnPct) }}</span>
          </template>
        </UiTable>

        <p v-if="holdingSkipped.length" class="skip-note">
          건너뜀 {{ holdingSkipped.length }}건 (직전 사이클 보유중):
          {{ holdingSkipped.map(s => s.date.slice(5)).join(', ') }}
        </p>
      </div>
```

- [ ] **Step 4: 템플릿에 드로어 삽입**

`</template>` (v-else 템플릿 닫기) **다음**, 최상위 `</div>` **앞**에 추가:

```vue
    <!-- 종목 상세 -->
    <UiDrawer v-model:open="drawerOpen" :title="`${selectedCycle?.index ?? 0}회차 종목 상세`" width="520px">
      <div v-if="selectedCycle" class="detail-body">
        <p class="detail-meta">
          스코어일 {{ selectedCycle.date }} · 진입 {{ selectedCycle.entryDate }} · 청산 {{ selectedCycle.exitDate }}
          <UiBadge :variant="selectedCycle.matured ? 'success' : 'default'" size="sm">
            {{ selectedCycle.matured ? '확정' : '진행중' }}
          </UiBadge>
        </p>
        <table class="detail-table">
          <thead>
            <tr>
              <th>종목</th>
              <th>점수</th>
              <th>매수가</th>
              <th>수량</th>
              <th>투입금</th>
              <th>청산가</th>
              <th>손익</th>
              <th>수익률</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in selectedCycle.holdings" :key="h.code">
              <td class="td-name">{{ h.name }}</td>
              <td>{{ h.score }}</td>
              <td>{{ won(h.entryPrice) }}</td>
              <td>{{ h.quantity }}</td>
              <td>{{ won(h.cost) }}</td>
              <td>{{ won(h.exitPrice) }}</td>
              <td :style="{ color: pctColor(h.profit), fontWeight: 700 }">
                {{ h.profit >= 0 ? '+' : '' }}{{ won(h.profit) }}
              </td>
              <td :style="{ color: pctColor(h.returnPct) }">{{ pct(h.returnPct) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="detail-foot">
          투입 {{ won(selectedCycle.investAmount) }}원 · 거래비용 {{ won(selectedCycle.tradeCost) }}원 ·
          종료자산 {{ won(selectedCycle.endAsset) }}원
        </p>
      </div>
    </UiDrawer>
```

- [ ] **Step 5: 스타일 추가**

`@media` 블록 **위**에 추가:

```scss
.cycle-section {
  border-top: 1px solid #e6e8ec;
  padding-top: 16px;

  h4 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
  .h4-note { font-size: 11px; font-weight: 400; color: #9ca3af; }
}
.skip-note { font-size: 11px; color: #9ca3af; margin: 8px 0 0; }

.detail-body { font-size: 13px; }
.detail-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 12px; color: #6b7280; margin: 0 0 12px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 8px;
    text-align: right;
    border-bottom: 1px solid #f3f4f6;
  }
  th {
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 11px;
    text-align: right;
  }
  .td-name { text-align: left; font-weight: 500; color: #374151; }
  th:first-child { text-align: left; }
}
.detail-foot { font-size: 11px; color: #9ca3af; margin: 10px 0 0; }
```

`@media (max-width: 640px)` 블록 안에 추가:

```scss
  .detail-table { font-size: 11px; th, td { padding: 4px 4px; } }
```

- [ ] **Step 6: 화면 확인**

브라우저에서 회차별 표가 뜨고, 행을 클릭하면 우측 드로어에 그 회차 종목 명세가 나오는지 확인한다. 건너뛴 스냅샷이 있으면 표 아래 안내 문구가 보여야 한다.

- [ ] **Step 7: 커밋**

```bash
cd /c/projects/taskflow && git add frontend/src/components/stock/ScoreSimulation.vue && git commit -m "feat: 가상매매 회차별 표 + 종목 상세 드로어"
```

---

## Task 11: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

```bash
cd /c/projects/taskflow/frontend && npm run test
```
Expected: PASS 29건 이상, 실패 0건

- [ ] **Step 2: 타입 체크**

```bash
cd /c/projects/taskflow/frontend && npx vue-tsc --noEmit
```
Expected: 에러 0건

- [ ] **Step 3: 프로덕션 빌드**

```bash
cd /c/projects/taskflow/frontend && npm run build
```
Expected: 정상 종료, `dist/` 생성

- [ ] **Step 4: 화면 최종 점검**

주식 탭에서 다음을 순서대로 확인한다.

| 확인 항목 | 기대 결과 |
|-----------|-----------|
| 상위 1 / 3 / 5 / 10 전환 | 요약·차트·표가 모두 즉시 재계산 |
| 종자금 변경 | 최종자산이 비례해서 바뀜, 수익률(%)은 거의 동일 |
| 브라우저 새로고침 | 마지막 선택한 N·종자금이 유지됨 |
| Network 탭 | `score-snapshots` 요청이 두 카드 합쳐 스냅샷 수 + 1회 |
| 구간 스프레드 카드 | Task 7 이전과 동일한 숫자 |
| 회차 행 클릭 | 드로어에 종목별 명세 표시 |
| 어느 카드든 새로고침 | 두 카드가 함께 갱신됨 |

- [ ] **Step 5: 최종 커밋 (변경이 남아 있으면)**

```bash
cd /c/projects/taskflow && git status --short
```
변경이 없으면 완료. 남아 있으면 내용을 확인하고 커밋한다.

---

## 완료 기준

- [ ] `npm run test` 전체 통과
- [ ] `npx vue-tsc --noEmit` 에러 0건
- [ ] `npm run build` 성공
- [ ] 주식 탭에 '가상매매 수익률' 카드가 뜨고 N·종자금 변경이 즉시 반영됨
- [ ] '구간 스프레드 분석' 카드 동작·숫자가 이전과 동일
- [ ] 스냅샷 API 호출이 두 카드 합쳐 1세트만 발생
