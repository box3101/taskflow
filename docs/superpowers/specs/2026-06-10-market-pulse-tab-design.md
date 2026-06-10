# 시황 탭 설계 (Market Pulse Tab)

## 개요

Stock 페이지(`/stock`)에 "시황" 탭을 추가한다.
기존 탭: 매매일지 | 대시보드 → 매매일지 | 대시보드 | **시황**

미국 주요 경제일정, 기업 실적발표, 외국인 매매동향, 글로벌 이벤트, 한국 증시 일정, 시장 심리 지표를 한 화면에서 볼 수 있는 대시보드.

## 레이아웃

하이브리드 구조:

```
┌─────────────────────────────────────────────┐
│  ⚡ 이번 주 핵심 일정 (가로 스크롤 배너)       │
│  [6/11 CPI] [6/13 마이크론] [6/18 FOMC]     │
├───────────┬───────────┬─────────────────────┤
│ 공포탐욕   │ VIX       │ 외국인 순매수        │
│   72      │  14.2     │  -2,340억            │
├─────────────────────────────────────────────┤
│ [전체] [경제] [실적] [외국인] [한국] [글로벌]  │
├─────────────────────────────────────────────┤
│ 6/11  🇺🇸 CPI (YoY)       예상 3.1%   🔴🔴🔴 │
│ 6/13  🏢 마이크론 실적     EPS $1.12   🔴🔴   │
│ 6/18  🇺🇸 FOMC 금리결정   동결 예상    🔴🔴🔴 │
│ 6/20  🇰🇷 옵션만기일                   🔴🔴   │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### 상단: 핵심 일정 배너
- 이번 주 중요도 높은(🔴🔴🔴) 이벤트를 가로 스크롤 카드로 표시
- 카테고리별 색상: 경제(빨강), 실적(파랑), 한국(주황), 글로벌(보라)

### 중단: 시장 심리 게이지 (3칸)
- 공포탐욕지수: 기존 `fetchFearGreed()` 활용
- VIX: JSON 데이터 (수동 업데이트)
- 외국인 순매수: 기존 `fetchInvestor()` 확장

### 하단: 통합 일정 리스트
- 카테고리 필터 칩: 전체 | 경제 | 실적 | 외국인 | 한국 | 글로벌
- 날짜순 정렬, 중요도(🔴) 표시
- 지난 일정은 흐리게, 이번 주는 하이라이트

## 데이터 구조

### 1. 정적 JSON 파일: `public/data/market-events.json`

```typescript
interface MarketEvent {
  id: string
  date: string              // "2026-06-11"
  time?: string             // "21:30" (한국시간)
  category: 'us-econ' | 'us-earnings' | 'foreign-flow' | 'global' | 'kr-schedule' | 'sentiment'
  title: string             // "CPI (YoY)"
  subtitle?: string         // "소비자물가지수 전년비"
  importance: 1 | 2 | 3     // 🔴 개수
  expected?: string         // "3.1%"
  previous?: string         // "3.2%"
  actual?: string           // 발표 후 업데이트
  impact?: string           // "예상 하회 시 금리인하 기대↑ → 코스피 호재"
  country: 'US' | 'KR' | 'EU' | 'JP' | 'CN' | 'GLOBAL'
}
```

### 2. 심리 지표: 기존 API 활용 + JSON 보조

| 지표 | 소스 |
|------|------|
| 공포탐욕지수 | 기존 `fetchFearGreed()` |
| VIX | `market-events.json`의 sentiment 카테고리 |
| 외국인 순매수 | 기존 `fetchInvestor()` 확장 (KOSPI 전체) |

## 컴포넌트 구조

```
components/stock/
├── MarketPulseTab.vue          # 시황 탭 메인
├── WeekHighlights.vue          # 이번 주 핵심 일정 배너
├── MarketSentimentBar.vue      # 심리 게이지 3칸
└── MarketEventList.vue         # 카테고리 필터 + 일정 리스트
```

## 파일 변경 목록

### 신규 파일
1. `frontend/src/components/stock/MarketPulseTab.vue` — 시황 탭 메인 컴포넌트
2. `frontend/src/components/stock/WeekHighlights.vue` — 이번 주 핵심 카드
3. `frontend/src/components/stock/MarketSentimentBar.vue` — 심리 지표 게이지
4. `frontend/src/components/stock/MarketEventList.vue` — 통합 이벤트 리스트
5. `frontend/public/data/market-events.json` — 정적 이벤트 데이터

### 수정 파일
1. `frontend/src/views/StockView.vue` — "시황" 탭 추가
2. `frontend/src/types/stock.ts` — `MarketEvent` 타입 추가

## JSON 데이터 초기 내용

2026년 6~7월 주요 일정을 미리 채워둔다:
- 미국: CPI, PPI, FOMC, NFP, GDP, 소매판매, ISM 제조업
- 실적: 엔비디아, 마이크론, 애플, 테슬라, TSMC, 삼성전자
- 한국: 옵션만기일, 한국은행 금통위, MSCI 리밸런싱
- 글로벌: ECB 금리결정, BOJ 정책회의, G7 정상회의

## 향후 확장 가능성

- Claude API로 월간 이벤트 JSON 자동 생성
- 실적 발표 후 actual 값 자동 업데이트
- 알림 기능 (중요 일정 D-1 알림)
