# 가상매매 수익률 (Score Simulation) 설계 스펙

## 개요

Smart Score 랭킹대로 실제 돈을 넣었다면 계좌가 어떻게 됐을지를 **원 단위**로 보여준다.

기존 `ScoreBacktest.vue`(구간 스프레드 분석)는 "상위 그룹이 하위 그룹을 이기는가"를 **퍼센트**로 검증한다. 신호의 유무는 알 수 있지만 수수료·세금·단주 반올림·복리가 반영되지 않아 "그래서 내 돈이 얼마가 됐나"에는 답하지 못한다. 이 스펙은 그 빈칸을 채운다.

## 설계 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 표 형태 | 누적 자산 곡선형 | 회차별 손익이 다음 회차 원금이 되는 복리 흐름을 그대로 봄 |
| 자금 회전 | **논오버랩 복리** | D+3 보유 중에 저장된 스냅샷은 건너뛰고 자금 한 줄만 순차 운용 |
| 종목 선정 | 상위 N종목 **금액 균등** (N = 1/3/5/10 선택) | N을 바꿔가며 최적 종목 수를 눈으로 비교 |
| 거래비용 | 반영하되 **비용전·비용후 둘 다 표시** | 신호의 순수한 힘과 실수령액을 분리해서 판단 |
| 화면 배치 | 독립 카드 신규 (`ScoreBacktest` 아래) | 신호 검증(%)과 자금 결과(원)는 목적이 달라 카드 분리 |
| 계산 위치 | 프론트엔드 순수함수 + 스냅샷 캐시 composable | N·종자금 변경 시 서버 왕복 없이 즉시 재계산 |
| 백엔드 | **변경 없음** | 기존 `/score-snapshots` API와 `ScoreSnapshot.data` JSON만으로 충분 |

## 데이터 소스

기존 `ScoreSnapshot` 테이블을 그대로 쓴다. 스키마 변경 없음.

```ts
// frontend/src/api/stockApi.ts (기존)
interface ScoreSnapshotItem {
  code: string; name: string; theme: string
  rank: number; total: number
  supply: number; momentum: number; surge: number; valuation: number
  entryPrice: number          // 진입기준일 종가
  exitPrice?: number          // D+3 확정 시 채워짐
  returnPct?: number
  exitDate?: string
}
```

- `entryPrice` — 스냅샷 저장 시점에 기록된 진입가
- `exitPrice` — `scoreMaturity.ts` cron이 D+3(`HORIZON_DAYS = 3`) 종가로 확정
- 미확정 종목은 `fetchPrice()`로 현재가를 받아 평가

## 아키텍처

### 파일 구조

```
frontend/src/
  utils/
    scoreSimulation.ts          ← NEW (순수 계산 엔진)
    scoreSimulation.test.ts     ← NEW (vitest)
  composables/
    useScoreSnapshots.ts        ← NEW (스냅샷 로드 캐시 공유)
  components/stock/
    ScoreSimulation.vue         ← NEW (화면)
    ScoreBacktest.vue           ← MODIFIED (캐시 composable 사용으로 전환)
    StockDashboard.vue          ← MODIFIED (카드 삽입)
```

### 데이터 흐름

```
useScoreSnapshots()  ── 모듈 스코프 캐시 (요청 1회 공유)
   │  fetchSnapshotList() → 날짜별 fetchSnapshotByDate()
   │  미확정 종목 코드만 모아 fetchPrice() 1회
   ├──▶ ScoreBacktest.vue     (% 스프레드 — 기존 로직 유지)
   └──▶ ScoreSimulation.vue
             │  N, 종자금 (localStorage)
             ▼
        scoreSimulation.ts  ── 순수함수
             │  ① 논오버랩 사이클 추출
             │  ② 사이클별 매수·청산·비용 계산
             │  ③ 지표 집계
             ▼
        요약 4칸 · 자산곡선 차트 · 회차별 표 · 종목 상세 드로어
```

## 계산 엔진 (`scoreSimulation.ts`)

### ① 논오버랩 사이클 추출

스냅샷을 `entryDate` 오름차순으로 정렬한 뒤, 직전 사이클이 청산된 이후에 진입하는 스냅샷만 채택한다.

```
cursor = null                      // 직전 사이클 청산일
for snap of 스냅샷들(오름차순):
    if snap.entryDate 없음 → 스킵 (사유: 진입일 미기록)
    if cursor == null 또는 snap.entryDate >= cursor:
        채택
        청산일 = exitDate 있으면 그 값, 없으면 entryDate + 3거래일
        cursor = 청산일
    else:
        건너뜀 (사유: 직전 사이클 보유중)
```

거래일 계산은 기존 `ScoreBacktest.vue`의 `tradingDaysBetween()`과 동일한 규칙(주말 제외, 공휴일 무시)을 쓴다. 이 함수를 `scoreSimulation.ts`로 옮기고 `ScoreBacktest.vue`는 그것을 import 하도록 정리한다.

### ② 사이클별 손익

```
가용자금 = 직전 사이클 종료자산 (첫 회차는 종자금)
후보 = 스냅샷 종목 중 entryPrice > 0 인 것을 total 내림차순 정렬
대상 = 후보.slice(0, N)

종목당 배분 = 가용자금 / 대상.length
수량       = floor(배분 / entryPrice)         // 단주 없음, 잔돈은 현금
투입금     = 수량 × entryPrice
현금잔돈   = 가용자금 − 투입금 합계

매수비용   = round(투입금 합계 × 0.015%)
청산가     = exitPrice(확정) | 현재가(진행중)
매도금     = 수량 × 청산가
매도비용   = round(매도금 합계 × (0.015% + 0.15%))

종료자산   = 현금잔돈 + 매도금 합계 − 비용 합계
```

비용은 **종목별이 아니라 사이클 합계에 한 번** 반올림한다 (`round(Σ)`). 원 단위로 표시하므로 종목마다 반올림해 합치면 실제 체결과 몇 원씩 어긋난다.

**비용전 트랙을 나란히 하나 더 굴린다.** 비용전 자산은 자체 잔액으로 복리를 이어가므로 회차가 쌓일수록 두 곡선의 간격이 벌어진다 — 이 간격이 곧 과잉매매 비용이다.

비용 상수는 `scoreSimulation.ts` 상단에 모아 둔다.

```ts
export const FEE_RATE = 0.00015  // 수수료 (매수·매도 각각)
export const TAX_RATE = 0.0015   // 증권거래세 (매도시)
```

### ③ 지표

**확정 사이클** — 매수한 종목 전부가 `exitPrice`를 가진 사이클. 하나라도 미확정이면 진행중으로 본다.

| 지표 | 정의 |
|------|------|
| 최종자산 | 마지막 사이클 종료자산 (비용후) |
| 누적수익률 | (최종자산 − 종자금) / 종자금, 비용전·비용후 각각 |
| 승률 | 손익 > 0 인 사이클 / **확정 사이클** 수 |
| MDD | 확정 사이클 종료자산 기준 최대 낙폭 |
| 평균 사이클 수익률 | 확정 사이클 수익률의 산술평균 |
| 최고 / 최악 회차 | 확정 사이클 중 수익률 최대·최소 |
| 비용 합계 | 전 사이클 매수·매도 비용 총합 |

**진행중 사이클은 승률·MDD·평균·최고/최악에서 제외한다.** 최종자산과 누적수익률에는 현재가 평가로 포함하되 화면에 '진행중' 표시를 남긴다.

### 엣지 케이스

| 상황 | 처리 |
|------|------|
| 후보 종목 < N | 있는 만큼만 매수하되 **가용자금을 실제 종목 수로 균등 분할**(유휴 현금 없음). 데이터 조회 실패로 종목이 빠진 것이므로 현금 드래그를 만들지 않는다. 표에 실제 종목수 표기 |
| `entryPrice = 0` (조회 실패) | 해당 종목 제외 후 남은 종목으로 균등 배분 |
| 후보 0종목 | 그 회차는 전액 현금, 손익 0, 사이클로는 집계하되 승률 분모에서 제외 |
| `floor` 결과 수량 0 (주가 > 배분금) | 그 종목 미매수, 배분금은 현금 |
| 진행중 사이클 (현재가 조회 실패) | 진입가로 평가 (손익 0) + 경고 문구 |
| 확정 사이클 0개 | 승률·MDD 자리에 `-` 표시 |
| 사이클 0개 | `UiEmpty` — "스냅샷을 3거래일 이상 모아주세요" |
| `entryDate` 없는 구 스냅샷 | 스킵. 하단에 "진입일 미기록 N건 제외" 안내 |

## 화면 (`ScoreSimulation.vue`)

```
┌─ 가상매매 수익률                              [새로고침] ─┐
│  스코어 상위 N종목을 진입일 종가로 사서 D+3에 파는 것을
│  반복했을 때의 실제 돈 흐름 (논오버랩 복리)
│
│  종목수 [상위1][상위3●][상위5][상위10]   종자금 [1,000만원 ▾]
│
│  ┌──────────┬───────────┬────────┬─────────┐
│  │ 최종자산  │ 누적수익률 │  승률  │  MDD    │
│  │10,401,000│  +4.01%   │ 2/3    │ -0.59%  │
│  │          │비용전 +4.55%│ 67%   │         │
│  └──────────┴───────────┴────────┴─────────┘
│
│  [자산곡선 — UiChart type="line", 비용후 실선 / 비용전 점선]
│
│  회차별 (행 클릭 → 종목 상세)
│  ┌───┬───────┬───────┬────┬──────┬──────────┬──────────┬────────┬──────────┐
│  │회차│스코어일│ 진입  │종목│ 상태 │ 투입금    │ 평가금    │ 손익   │ 누적자산 │
│  │ 1 │ 08/05 │ 08/06 │ 3 │ 확정 │10,000,000│10,240,000│+240,000│10,240,000│
│  │ - │ 08/06 │   -   │ - │ 건너뜀 (직전 사이클 보유중)                     │
│  │ 2 │ 08/08 │ 08/11 │ 3 │ 확정 │10,240,000│10,180,000│ -60,000│10,180,000│
│  │ 3 │ 08/13 │ 08/14 │ 3 │진행중│10,180,000│10,455,000│+275,000│10,455,000│
│  └───┴───────┴───────┴────┴──────┴──────────┴──────────┴────────┴──────────┘
│  * 비용 합계 -54,000원 (수수료 0.015%×2 + 증권거래세 0.15%)
└────────────────────────────────────────────────────────┘
```

### 컴포넌트 매핑 (ispark-ui 우선)

| 요소 | 컴포넌트 |
|------|----------|
| 종목수 선택 | `UiTab` (상위 1/3/5/10) |
| 종자금 선택 | `UiSelect` (500만 / 1,000만 / 3,000만 / 5,000만) |
| 자산곡선 | `UiChart type="line"` (`show-legend`) |
| 회차별 표 | `UiTable` (`SmartScore.vue` 패턴 준용) |
| 종목 상세 | `UiDrawer` |
| 상태 뱃지 | `UiBadge` (확정 `success` / 진행중 `default`) |
| 빈 상태 | `UiEmpty` |
| 로딩 | 텍스트 안내 (`ScoreBacktest.vue`의 `.loading-msg` 패턴 준용) |

### 종목 상세 드로어

회차 행 클릭 시 그 회차의 종목별 명세를 연다.

| 종목 | 점수 | 매수가 | 수량 | 투입금 | 청산가 | 손익 | 수익률 |

### 설정 저장

`N`과 `종자금`은 `localStorage`에 저장한다 (`taskflow.scoreSim.stockCount`, `taskflow.scoreSim.seedCash`). 값이 바뀌면 스냅샷 재조회 없이 계산만 다시 돌린다.

### 색상 규칙

기존 `ScoreBacktest.vue`와 동일하게 맞춘다.

| 값 | 색 |
|----|-----|
| 상승 | `#ef4444` (빨강) |
| 하락 | `#3b82f6` (파랑) |
| 보합 | `#6b7280` |
| 스프레드/강조 | `#16a34a` |

## 스냅샷 캐시 (`useScoreSnapshots.ts`)

CLAUDE.md의 composable 반환 패턴을 따른다 (Pinia `defineStore` 미사용, `storeToRefs` 미사용).

```ts
// ===== 상태 변수 =====
const snapshots = ref<ScoreSnapshotFull[]>([])
const loading = ref(false)
let inflight: Promise<void> | null = null   // 동시 마운트 시 요청 1회 보장

// ===== 조회 =====
const handleLoadSnapshots = async () => { ... }   // 캐시 있으면 즉시 반환
const handleRefreshSnapshots = async () => { ... } // 캐시 무효화 후 재조회

export const useScoreSnapshots = () => {
  return { snapshots, loading, handleLoadSnapshots, handleRefreshSnapshots }
}
```

두 카드가 동시에 마운트돼도 `inflight` Promise를 공유하므로 API 호출은 1회다. 어느 카드에서 새로고침을 눌러도 양쪽이 함께 갱신된다.

`ScoreBacktest.vue`는 자체 `loadBacktestData()`의 스냅샷 로드 구간만 이 composable로 교체한다. 스프레드 계산 로직은 건드리지 않는다.

## 테스트 (`scoreSimulation.test.ts`)

`vitest`가 이미 설정되어 있다 (`npm run test`).

| 케이스 | 검증 내용 |
|--------|-----------|
| 논오버랩 추출 | 겹친 스냅샷이 '건너뜀'으로 분류되고 사이클 수가 맞는가 |
| 단주 처리 | `floor` 수량 + 잔돈이 현금으로 남아 총액이 보존되는가 |
| 비용 분리 | 비용전/비용후 종료자산이 각자의 잔액으로 복리를 이어가는가 (**2사이클 이상**으로 검증 — 1사이클은 두 트랙의 수량이 같아 분기가 드러나지 않는다) |
| 종목 부족 | 후보 < N일 때 가용자금이 실제 종목 수로 균등 분할되는가 (유휴 현금 없음) |
| `entryPrice = 0` | 해당 종목 제외 후 남은 종목으로 균등 배분되는가 |
| 미매수 종목 | `floor` 결과 0주인 종목이 확정 판정에서 제외되는가 |
| 진행중 사이클 | 승률·MDD 분모에서 제외되는가 |
| 사이클 0개 | 빈 결과를 안전하게 반환하는가 |
| MDD | 자산이 오르내릴 때 최대 낙폭이 정확한가 |

## 범위 밖 (YAGNI)

- 손절·익절 규칙 — 고정 D+3 청산만
- 슬리피지 입력란 — 상수로 0 고정
- 테마 필터링 / 종목 제외 목록
- 벤치마크(코스피) 대비 초과수익
- 전략 비교표 (상위3 vs 상위5 동시 표시) — N 토글로 순차 비교
- 백엔드 API·스키마 변경
