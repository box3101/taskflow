# Smart Score v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite SmartScore ranking algorithm to fix multi-collinearity, normalize thresholds, add bell-curve momentum, and properly handle missing data.

**Architecture:** Extract scoring functions from SmartScore.vue into a standalone `smartScoreV2.ts` utility (pure functions, testable without Vue). SmartScore.vue becomes a thin shell: data loading + rendering. All tuning parameters are exported constants at the top of the utility file.

**Tech Stack:** Vue 3 + TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-12-smart-score-v2-design.md`

## Global Constraints

- 모든 점수 함수는 순수 함수 (side-effect 없음)
- 튜닝 대상 파라미터는 `TUNING` 상수 객체로 파일 상단에 모아둠
- `console.warn`은 결측 데이터 로그용으로만 사용
- 기존 UI 구조(UiTable, 컬럼)는 최대한 유지, 라벨/배점 텍스트만 변경
- 테스트 인프라 없음 — 콘솔 검증 스텝으로 대체

---

### Task 1: 스코어링 유틸리티 파일 생성 + 튜닝 상수 + 타입 정의

**Files:**
- Create: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `InvestorData`, `InvestorTrend` types from `frontend/src/api/stockApi.ts`
- Produces: `TUNING` 상수, `StockInput`, `ScoreBreakdown`, `ValuationStatus` 타입 (모든 후속 Task에서 사용)

- [ ] **Step 1: 파일 생성 — 튜닝 상수 + 타입 정의**

```typescript
// frontend/src/utils/smartScoreV2.ts
import type { InvestorData, InvestorTrend } from '../api/stockApi'

// ── 튜닝 대상 파라미터 (데이터 분포 확인 후 조정) ──
export const TUNING = {
  volumeFilterCutoff: 0.2,        // 거래대금 하위 20% 필터
  sellPenaltyThreshold: 0.005,    // 시총 대비 매도 임계 0.5%
  sellPenaltyMax: 12,             // 매도 감점 최대
  pbrCoefficient: 1.5,            // PBR 선형 보간 계수
  // 등락률 종모양 파라미터
  momentum20Peak: [10, 25],       // 20일 피크 구간 (%)
  momentum20Max: 50,              // 20일 0점 수렴 지점 (%)
  momentum5Peak: [3, 10],         // 5일 피크 구간 (%)
  momentum5Max: 25,               // 5일 0점 수렴 지점 (%)
} as const

// ── 타입 ──

export interface StockInput {
  code: string
  name: string
  theme: string
  chg20: number    // changePct20
  chg5: number     // changePct5
  data: InvestorData
}

export type PerStatus = 'normal' | 'deficit' | 'missing'  // 정상 / 적자(음수) / 결측(NaN)
export type PbrStatus = 'normal' | 'missing'               // PBR은 음수=결측 처리

export interface ValuationResult {
  perScore: number
  pbrScore: number
  perStatus: PerStatus
  pbrStatus: PbrStatus
  maxPossible: number  // 실제 사용 가능한 밸류 만점 (8, 7, 15, 또는 0)
}

export interface SupplyResult {
  total: number
  foreignRatio: number   // 10일 중 순매수일 비율 (0~1)
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
  supply: number       // 45점 만점
  momentum: number     // 30점 만점
  surge: number        // 10점 만점
  valuation: number    // 15점 만점
  foreignRatio: number
  instRatio: number
  foreignSellDays: number
  overextended: boolean
  valuationMissing: boolean  // 부분/전체 결측 여부
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /c/clone-ispark-ui-20260526-231454/taskflow/frontend && npx vue-tsc --noEmit 2>&1 | head -5`
Expected: 에러 없음 (import만 있고 사용하는 코드 없으므로)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 유틸리티 파일 생성 — 타입 + 튜닝 상수"
```

---

### Task 2: 거래대금 필터 + 수급 점수 (45점)

**Files:**
- Modify: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `StockInput`, `TUNING`, `InvestorData` from Task 1
- Produces: `filterByVolume(stocks: StockInput[]): StockInput[]`, `calcSupply(data: InvestorData, allAmtRatios: number[]): SupplyResult`

- [ ] **Step 1: 거래대금 필터 함수**

`smartScoreV2.ts` 하단에 추가:

```typescript
// ── 0. 거래대금 필터 ──

/** 5일 외인+기관 절대거래금액 합산 */
export function absAmtSum(trends: InvestorTrend[]): number {
  return trends.slice(0, 5).reduce(
    (sum, d) => sum + Math.abs(d.foreignAmt || 0) + Math.abs(d.institutionAmt || 0),
    0,
  )
}

/** 유니버스 하위 N% 거래대금 종목 제외 */
export function filterByVolume(stocks: StockInput[]): StockInput[] {
  const amts = stocks.map(s => absAmtSum(s.data.trends))
  const sorted = [...amts].sort((a, b) => a - b)
  const cutoffIndex = Math.floor(sorted.length * TUNING.volumeFilterCutoff)
  const cutoffValue = sorted[cutoffIndex] ?? 0
  return stocks.filter((s, i) => amts[i] >= cutoffValue)
}
```

- [ ] **Step 2: 수급 지속성 — 순매수일 비율**

```typescript
// ── 1. 수급 45점 ──

/** 최근 N일 중 순매수일 비율 (0~1) */
function buyDayRatio(trends: InvestorTrend[], type: 'foreign' | 'institution', days = 10): number {
  const slice = trends.slice(0, days)
  if (slice.length === 0) return 0
  const buyDays = slice.filter(d => d[type] > 0).length
  return buyDays / slice.length
}

/** 연속 매도일 (기존 로직 유지) */
function consecutiveSellDays(trends: InvestorTrend[]): number {
  let count = 0
  for (const day of trends) {
    if (day.foreign < 0) count++
    else break
  }
  return count
}
```

- [ ] **Step 3: 수급 금액 — 백분위 기반**

```typescript
/** 5일 순매수합 / 시총 비율 (음수는 0 처리) */
function netBuyRatio(trends: InvestorTrend[], type: 'foreignAmt' | 'institutionAmt', mcap: number): number {
  if (mcap <= 0) return 0
  const sum = trends.slice(0, 5).reduce((s, d) => s + Math.max(0, d[type] || 0), 0)
  return sum / mcap
}

/** 값의 유니버스 내 백분위 (0~1) */
function percentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0
  const sorted = [...allValues].sort((a, b) => a - b)
  const rank = sorted.findIndex(v => v >= value)
  return (rank >= 0 ? rank : sorted.length) / sorted.length
}
```

- [ ] **Step 4: 수급 통합 함수**

```typescript
/**
 * 수급 점수 (45점)
 * @param allForeignRatios 유니버스 전체의 외인 순매수/시총 비율 배열 (백분위용)
 * @param allInstRatios 유니버스 전체의 기관 순매수/시총 비율 배열 (백분위용)
 */
export function calcSupply(
  data: InvestorData,
  allForeignRatios: number[],
  allInstRatios: number[],
): SupplyResult {
  const mcap = parseFloat(data.marketCap) || 0

  // 지속성 20점: 순매수일 비율
  const foreignRatio = buyDayRatio(data.trends, 'foreign')
  const instRatio = buyDayRatio(data.trends, 'institution')
  const foreignDayScore = Math.round(foreignRatio * 10)   // 최대 10
  const instDayScore = Math.round(instRatio * 10)          // 최대 10

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
    // 비율 비례 감점: 임계 초과분에 비례, 최대 TUNING.sellPenaltyMax
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
```

- [ ] **Step 5: 빌드 확인**

Run: `cd /c/clone-ispark-ui-20260526-231454/taskflow/frontend && npx vue-tsc --noEmit 2>&1 | head -10`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 수급 점수 + 거래대금 필터 구현"
```

---

### Task 3: 등락률 점수 (30점) — 종 모양 곡선

**Files:**
- Modify: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `TUNING` from Task 1
- Produces: `calcMomentum(chg20: number, chg5: number): number`

- [ ] **Step 1: 종 모양 헬퍼 + 등락률 함수**

`smartScoreV2.ts`에 추가:

```typescript
// ── 2. 등락률 30점 — 종 모양 ──

/**
 * 종 모양 점수: 피크 구간은 고원(만점), 양쪽으로 선형 감쇠
 * @param value 등락률 (%)
 * @param peakStart 고원 시작 (%)
 * @param peakEnd 고원 끝 (%)
 * @param maxDecay 우측 0점 수렴 지점 (%)
 * @param maxScore 만점
 */
function bellScore(value: number, peakStart: number, peakEnd: number, maxDecay: number, maxScore: number): number {
  if (value <= 0) return 0
  if (value < peakStart) {
    // 좌측: 0 → peakStart 선형 상승
    return (value / peakStart) * maxScore
  }
  if (value <= peakEnd) {
    // 고원: 만점
    return maxScore
  }
  if (value < maxDecay) {
    // 우측: peakEnd → maxDecay 선형 하강
    return ((maxDecay - value) / (maxDecay - peakEnd)) * maxScore
  }
  return 0
}

/** 등락률 점수 (30점) */
export function calcMomentum(chg20: number, chg5: number): number {
  const score20 = bellScore(
    chg20,
    TUNING.momentum20Peak[0], TUNING.momentum20Peak[1],
    TUNING.momentum20Max,
    22,  // 최대 22점
  )
  const score5 = bellScore(
    chg5,
    TUNING.momentum5Peak[0], TUNING.momentum5Peak[1],
    TUNING.momentum5Max,
    8,   // 최대 8점
  )
  return Math.round(score20 + score5)
}
```

- [ ] **Step 2: 콘솔 검증 — bellScore 동작 확인**

`smartScoreV2.ts` 맨 하단에 임시 검증 코드 추가 후 브라우저 콘솔에서 확인:

```typescript
// 임시 검증 (확인 후 삭제)
if (import.meta.env.DEV) {
  console.log('[SmartScoreV2] bellScore 검증:',
    'chg20=0%→', bellScore(0, 10, 25, 50, 22),     // 0
    'chg20=10%→', bellScore(10, 10, 25, 50, 22),    // 22 (고원 시작)
    'chg20=20%→', bellScore(20, 10, 25, 50, 22),    // 22 (고원 중간)
    'chg20=37.5%→', bellScore(37.5, 10, 25, 50, 22), // 11 (중간 감쇠)
    'chg20=50%→', bellScore(50, 10, 25, 50, 22),    // 0 (우측 끝)
    'chg20=60%→', bellScore(60, 10, 25, 50, 22),    // 0
  )
}
```

- [ ] **Step 3: 커밋 (검증 코드 삭제 후)**

검증 코드 삭제 후:

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 등락률 종모양 곡선 구현"
```

---

### Task 4: 회전율 surge 점수 (10점)

**Files:**
- Modify: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `InvestorData`, `percentile()` from Task 2
- Produces: `calcSurge(data: InvestorData, allSurgeRatios: number[]): number`

- [ ] **Step 1: surge 비율 + 백분위 점수**

```typescript
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
export function surgeRatio(data: InvestorData): number {
  const mcap = parseFloat(data.marketCap) || 0
  if (mcap <= 0) return 0
  const short = avgTurnover(data.trends, 5, mcap)
  // 장기: 가용 데이터 전체 (보통 ~20일, 60일 미만이면 전체 사용)
  const longDays = Math.max(data.trends.length, 5)
  const long = avgTurnover(data.trends, longDays, mcap)
  if (long <= 0) return 0
  return short / long
}

/** 회전율 점수 (10점): surge 비율의 유니버스 백분위 */
export function calcSurge(data: InvestorData, allSurgeRatios: number[]): number {
  const ratio = surgeRatio(data)
  return Math.round(percentile(ratio, allSurgeRatios) * 10)
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 회전율 surge 점수 구현"
```

---

### Task 5: PER/PBR 밸류에이션 (15점) — 선형 보간 + 독립 판정

**Files:**
- Modify: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `InvestorData`, `TUNING`, `ValuationResult` from Task 1
- Produces: `calcValuation(data: InvestorData): ValuationResult`

- [ ] **Step 1: 선형 보간 + 지표별 독립 판정**

```typescript
// ── 4. PER/PBR 15점 — 선형 보간 ──

/** PER 점수: max(1, min(8, 8 - (PER-5)*0.28)), 적자=2, NaN=missing */
function perScore(raw: string): { score: number; status: PerStatus } {
  const per = parseFloat(raw)
  if (isNaN(per) || raw === '-') return { score: 0, status: 'missing' }
  if (per < 0) return { score: 2, status: 'deficit' }
  return { score: Math.max(1, Math.min(8, 8 - (per - 5) * 0.28)), status: 'normal' }
}

/** PBR 점수: max(1, min(7, 7 - (PBR-0.5)*k)), 음수/NaN=missing */
function pbrScore(raw: string): { score: number; status: PbrStatus } {
  const pbr = parseFloat(raw)
  if (isNaN(pbr) || pbr < 0 || raw === '-') return { score: 0, status: 'missing' }
  return {
    score: Math.max(1, Math.min(7, 7 - (pbr - 0.5) * TUNING.pbrCoefficient)),
    status: 'normal',
  }
}

/** 밸류에이션 점수 — PER/PBR 독립 판정 */
export function calcValuation(data: InvestorData): ValuationResult {
  const per = perScore(data.per)
  const pbr = pbrScore(data.pbr)

  // 결측 로그
  if (per.status === 'missing') {
    console.warn(`[SmartScore] PER 결측: marketCap=${data.marketCap}, per="${data.per}"`)
  }
  if (pbr.status === 'missing') {
    console.warn(`[SmartScore] PBR 결측: marketCap=${data.marketCap}, pbr="${data.pbr}"`)
  }

  // 실제 사용 가능한 밸류 만점
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
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 PER/PBR 선형 보간 + 독립 판정"
```

---

### Task 6: 종합 점수 계산 — 재정규화 + 과열감점 + 랭킹

**Files:**
- Modify: `frontend/src/utils/smartScoreV2.ts`

**Interfaces:**
- Consumes: `calcSupply`, `calcMomentum`, `calcSurge`, `calcValuation`, `filterByVolume`, `surgeRatio`, `netBuyRatio`, all from Tasks 1-5
- Produces: `calculateRanking(stocks: StockInput[]): ScoreBreakdown[]`

- [ ] **Step 1: 과열감점 함수**

```typescript
// ── 5. 과열 감점 ──

function overheatPenalty(chg20: number, chg5: number, foreignRatio: number, instRatio: number): number {
  const overextended = chg20 > 90 || chg5 > 40
  if (!overextended) return 0

  // 수급 동반: 10일 중 3일+ 순매수 (비율 0.3+)
  const hasSupply = foreignRatio >= 0.3 || instRatio >= 0.3
  if (chg20 > 100) return hasSupply ? 12 : 22
  return hasSupply ? 8 : 18
}
```

- [ ] **Step 2: 종합 랭킹 함수**

```typescript
// ── 종합 랭킹 ──

/** 메인 엔트리: 종목 배열 → 상위 20 랭킹 */
export function calculateRanking(stocks: StockInput[]): ScoreBreakdown[] {
  // 0. 거래대금 필터
  const filtered = filterByVolume(stocks)

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
    const baseMax = 85 + val.maxPossible  // 실제 이론 만점
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
```

- [ ] **Step 3: netBuyRatio를 export로 변경**

Task 2에서 작성한 `netBuyRatio`는 모듈 내부 함수인데, Task 6의 `calculateRanking`에서도 사용하므로 `function` 앞에 `export` 불필요 — 같은 파일이라 접근 가능. 확인만 하면 됨.

- [ ] **Step 4: 빌드 확인**

Run: `cd /c/clone-ispark-ui-20260526-231454/taskflow/frontend && npx vue-tsc --noEmit 2>&1 | head -10`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts
git commit -m "feat: Smart Score v2 종합 랭킹 — 재정규화 + 과열감점"
```

---

### Task 7: SmartScore.vue 리와이어 — 유틸리티 연결 + UI 업데이트

**Files:**
- Modify: `frontend/src/components/stock/SmartScore.vue`

**Interfaces:**
- Consumes: `calculateRanking`, `StockInput`, `ScoreBreakdown` from `smartScoreV2.ts`
- Produces: 최종 UI 렌더링 (변경된 컬럼 라벨, 배점 텍스트)

- [ ] **Step 1: import 교체 + 기존 스코어링 함수 전체 삭제**

SmartScore.vue의 `<script setup>` 섹션을 교체. 기존 스코어링 함수들(`consecutiveDays`, `consecutiveSellDays`, `recentAmtSum`, `supplyScore`, `momentumScore`, `participationScore`, `valuationScore`)을 모두 삭제하고 유틸리티로 대체:

```typescript
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon, UiTable } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { fetchInvestor } from '../../api/stockApi'
import type { InvestorData, StockQuote } from '../../api/stockApi'
import { calculateRanking, type StockInput, type ScoreBreakdown } from '../../utils/smartScoreV2'

type ThemeDef = { label: string; stocks: { code: string; name: string }[] }

const props = defineProps<{
  themes: ThemeDef[]
  themeQuotes: Record<string, StockQuote>
}>()

const investorMap = ref<Record<string, InvestorData>>({})
const loading = ref(false)
const loadedAt = ref('')

// 테마 종목 중 quotes + investor 데이터 있는 것만
const stockInputs = computed<StockInput[]>(() => {
  const items: StockInput[] = []
  for (const theme of props.themes) {
    for (const stock of theme.stocks) {
      const q = props.themeQuotes[stock.code]
      const data = investorMap.value[stock.code]
      if (!q || !data?.trends?.length) continue
      items.push({
        code: stock.code,
        name: stock.name,
        theme: theme.label,
        chg20: q.changePct20 || 0,
        chg5: q.changePct5 || 0,
        data,
      })
    }
  }
  return items
})

// v2 랭킹 계산
const scoreList = computed<ScoreBreakdown[]>(() => calculateRanking(stockInputs.value))

// investor 데이터 로드 (10개씩 배치)
async function loadInvestorData() {
  const allCodes: string[] = []
  for (const theme of props.themes) {
    for (const stock of theme.stocks) {
      if (props.themeQuotes[stock.code] && !investorMap.value[stock.code]) {
        allCodes.push(stock.code)
      }
    }
  }
  if (allCodes.length === 0) return
  loading.value = true
  const BATCH = 10
  for (let i = 0; i < allCodes.length; i += BATCH) {
    const batch = allCodes.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(code => fetchInvestor(code)))
    batch.forEach((code, idx) => { investorMap.value[code] = results[idx] })
  }
  loading.value = false
  const now = new Date()
  loadedAt.value = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

watch(() => [props.themes, props.themeQuotes], () => loadInvestorData(), { immediate: true, deep: true })

const scoreColumns: TableColumn[] = [
  { key: 'rank', label: '#', width: '36px', align: 'center' },
  { key: 'name', label: '종목명', width: '120px', align: 'left' },
  { key: 'theme', label: '테마', width: '80px', align: 'center', hideBelow: 640 },
  { key: 'total', label: '종합', width: '66px', align: 'center' },
  { key: 'supply', label: '수급', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'momentum', label: '등락률', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'surge', label: '회전율', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'valuation', label: 'PER/PBR', width: '54px', align: 'center', hideBelow: 480 },
]

const tableData = computed(() =>
  scoreList.value.map((item, i) => ({
    ...item,
    rank: i + 1,
  }))
)

function scoreBadgeVariant(score: number): 'danger' | 'warning' | 'default' {
  if (score >= 80) return 'danger'
  if (score >= 60) return 'warning'
  return 'default'
}
</script>
```

- [ ] **Step 2: 템플릿 업데이트 — 라벨 + 뱃지 표시 변경**

```html
<template>
  <div class="smart-score">
    <div class="section-header">
      <h3><UiIcon name="trophy" :size="18" /> Smart Score 랭킹</h3>
      <span class="section-desc">수급(45) + 등락률(30) + 회전율(10) + PER/PBR(15) <span v-if="loadedAt" class="loaded-at">{{ loadedAt }} 기준</span></span>
    </div>

    <div v-if="loading && scoreList.length === 0" class="loading-msg">
      종목 분석 중... ({{ Object.keys(investorMap).length }}/{{ stockInputs.length }})
    </div>

    <UiTable
      v-else
      :columns="scoreColumns"
      :data="tableData"
      :bordered="false"
      size="sm"
      empty-text="분석할 종목이 없습니다."
    >
      <template #cell-rank="{ row }">
        <span class="col-rank">{{ row.rank }}</span>
      </template>
      <template #cell-name="{ row }">
        <span class="col-name">
          {{ row.name }}
          <span v-if="row.foreignRatio >= 0.5 || row.instRatio >= 0.5" class="streak-info">
            <template v-if="row.foreignRatio >= 0.5">외{{ Math.round(row.foreignRatio * 10) }}/10</template>
            <template v-if="row.foreignRatio >= 0.5 && row.instRatio >= 0.5"> </template>
            <template v-if="row.instRatio >= 0.5">기{{ Math.round(row.instRatio * 10) }}/10</template>
          </span>
          <span v-if="row.foreignSellDays >= 3" class="sell-streak-info">외매도{{ row.foreignSellDays }}일</span>
          <span v-if="row.overextended" class="overheat-badge">과열</span>
          <span v-if="row.valuationMissing" class="missing-badge">밸류결측</span>
        </span>
      </template>
      <template #cell-theme="{ row }">
        <UiBadge variant="default" size="sm">{{ row.theme }}</UiBadge>
      </template>
      <template #cell-total="{ row }">
        <UiBadge :variant="scoreBadgeVariant(row.total)" size="sm">{{ row.total }}점</UiBadge>
      </template>
    </UiTable>
  </div>
</template>
```

- [ ] **Step 3: 스타일에 밸류결측 뱃지 추가**

기존 `<style>` 블록의 `.overheat-badge` 뒤에 추가:

```scss
.missing-badge {
  font-size: 10px; color: #6b7280; background: #f3f4f6;
  padding: 1px 5px; border-radius: 3px; font-weight: 600;
}
```

- [ ] **Step 4: 빌드 확인**

Run: `cd /c/clone-ispark-ui-20260526-231454/taskflow/frontend && npx vue-tsc --noEmit 2>&1 | head -10`
Expected: 에러 없음

- [ ] **Step 5: 브라우저에서 동작 확인**

- 주식 탭 → Smart Score 랭킹 로드 확인
- 배점 텍스트: "수급(45) + 등락률(30) + 회전율(10) + PER/PBR(15)"
- 컬럼: 거래량 → 회전율
- 순매수일 비율 표시: 외7/10, 기8/10 형태
- 결측 종목에 "밸류결측" 뱃지 표시 + 콘솔에 warn 로그

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/utils/smartScoreV2.ts frontend/src/components/stock/SmartScore.vue
git commit -m "feat: Smart Score v2 완성 — SmartScore.vue 리와이어 + UI 업데이트"
```
