# 주식 캘린더 (StockCalendar) 설계

## 개요
보유 종목별 뉴스 + 확정 금융 일정을 Claude Haiku가 주가 영향도(high/medium/low)로 분류하여 StockDashboard 내 미니 캘린더에 하루 최대 3개 표시.

## 데이터 흐름

```
보유종목 (localStorage stock-holdings-v2)
  ↓
Google Apps Script → 종목별 뉴스 fetch (기존 fetchNews 재활용)
  ↓
백엔드 POST /stock/analyze-news
  → Claude Haiku API로 중요도 분류 (high/medium/low + 한줄 요약)
  → StockNews 테이블에 캐시 저장
  ↓
프론트 GET /stock/news-calendar?codes=000660,005930&year=2026&month=6
  → 날짜별 뉴스 + 확정 일정 통합 응답
  ↓
StockCalendar 미니 캘린더 컴포넌트에 표시
  - 하루 최대 3개 (high 우선 정렬)
  - 컬러 바: 빨강(high), 주황(medium), 회색(low)
  - 클릭 시 원문 URL 열림
```

## 갱신 전략
- 대시보드 진입 시 마지막 갱신으로부터 30분 경과했으면 자동 재갱신
- 별도 스케줄러/크론 없음 (프론트 트리거 방식)
- 갱신 중 로딩 표시, 이전 캐시 데이터는 즉시 표시

## DB 모델

### StockNews (신규)

```prisma
model StockNews {
  id          Int      @id @default(autoincrement())
  stockCode   String   @map("stock_code") @db.VarChar(10)
  stockName   String   @map("stock_name") @db.VarChar(50)
  title       String   @db.VarChar(300)
  summary     String   @db.VarChar(50)
  importance  String   @db.VarChar(10)  // high, medium, low
  reason      String   @db.VarChar(200)
  url         String   @db.VarChar(500)
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([stockCode, publishedAt])
  @@map("stock_news")
}
```

### StockNewsCacheLog (갱신 추적)

```prisma
model StockNewsCacheLog {
  id        Int      @id @default(autoincrement())
  stockCode String   @map("stock_code") @db.VarChar(10)
  fetchedAt DateTime @default(now()) @map("fetched_at")

  @@unique([stockCode])
  @@map("stock_news_cache_log")
}
```

## 확정 일정 (정적 데이터)

`public/data/stock-events.json`:

```json
[
  {
    "date": "2026-06-18",
    "title": "FOMC 금리 결정",
    "type": "macro",
    "importance": "high",
    "relatedCodes": []
  },
  {
    "date": "2026-07-23",
    "title": "SK하이닉스 2Q 실적발표",
    "type": "earnings",
    "importance": "high",
    "relatedCodes": ["000660"]
  }
]
```

- `type`: macro(거시경제), earnings(실적), dividend(배당), ipo, etc.
- `relatedCodes` 비어있으면 전체 종목 해당 (FOMC 등)
- 분기 1회 수동 업데이트

## 백엔드 API

### GET /stock/news-calendar
종목코드들의 월별 뉴스 + 확정 일정 통합 반환.

**Query:** `codes=000660,005930&year=2026&month=6`

**응답:**
```json
{
  "data": {
    "2026-06-02": [
      {
        "id": 1,
        "stockCode": "000660",
        "stockName": "SK하이닉스",
        "title": "HBM4 양산 본격화",
        "summary": "HBM4 양산 개시",
        "importance": "high",
        "reason": "HBM 매출 비중 확대 직접 영향",
        "url": "https://...",
        "source": "news"
      }
    ],
    "2026-06-18": [
      {
        "title": "FOMC 금리 결정",
        "importance": "high",
        "source": "event"
      }
    ]
  },
  "lastFetched": "2026-06-01T09:30:00Z"
}
```

### POST /stock/analyze-news
뉴스 수집 + AI 분류 + DB 저장 트리거.

**Body:** `{ "codes": ["000660", "005930"] }`

**내부 처리:**
1. 각 종목별 Google Apps Script로 뉴스 fetch
2. Claude Haiku API로 중요도 분류
3. StockNews 테이블에 upsert (URL 기준 중복 제거)
4. StockNewsCacheLog 갱신 시각 업데이트

## AI 프롬프트 (Claude Haiku)

```
다음 뉴스들이 {종목명}({종목코드}) 주가에 미치는 영향을 분류해주세요.

{뉴스 목록 - 제목 + URL}

각 뉴스에 대해 JSON 배열로 응답:
[
  {
    "index": 0,
    "importance": "high",
    "summary": "HBM4 양산 개시",
    "reason": "HBM 매출 비중 확대로 실적 직접 영향"
  }
]

기준:
- high: 실적 직접 영향 (수주, 계약, 실적, 규제, 소송, 대규모 투자)
- medium: 업종/간접 영향 (경쟁사 동향, 산업 트렌드, 정책)
- low: 약한 관련 (인사, 단순 보도, 행사)

summary는 15자 이내. reason은 한 문장.
```

## 프론트엔드 컴포넌트

### StockCalendar.vue (신규)
StockDashboard 내 미니 캘린더 위젯.

**구성:**
- 월 네비게이션 (< 6월 >)
- 7x6 그리드 (요일 헤더 + 날짜 셀)
- 각 셀에 최대 3개 힌트 바 (importance 컬러)
- 클릭 시 해당 날짜 뉴스 목록 팝오버/패널

**컬러:**
- high: `#ef4444` (빨강)
- medium: `#f59e0b` (주황)
- low: `#9ca3af` (회색)

### StockCalendarDetail.vue (신규)
날짜 클릭 시 뉴스 상세 목록.

**표시 정보:**
- 종목명 뱃지
- 뉴스 제목 (클릭 → 원문 링크)
- AI 요약 + 중요도 이유
- importance 컬러 라벨

## 파일 목록

### 신규 파일
- `frontend/src/components/stock/StockCalendar.vue`
- `frontend/src/components/stock/StockCalendarDetail.vue`
- `backend/src/routes/stockNews.ts`
- `backend/prisma/migrations/xxx_add_stock_news/migration.sql`
- `frontend/public/data/stock-events.json`

### 수정 파일
- `backend/prisma/schema.prisma` — StockNews, StockNewsCacheLog 모델 추가
- `backend/src/app.ts` — stockNews 라우터 등록
- `frontend/src/components/stock/StockDashboard.vue` — StockCalendar 컴포넌트 추가
- `backend/package.json` — @anthropic-ai/sdk 의존성 추가
