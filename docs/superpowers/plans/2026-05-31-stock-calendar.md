# 주식 캘린더 (StockCalendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보유 종목 뉴스를 Claude Haiku로 중요도 분류하여 StockDashboard 내 미니 캘린더에 표시

**Architecture:** 프론트에서 보유 종목코드 전달 → 백엔드가 Google Apps Script로 뉴스 수집 → Claude Haiku로 중요도 분류 → DB 캐시 → 미니 캘린더 UI 표시. 확정 금융 일정은 정적 JSON.

**Tech Stack:** Vue 3, Express 5, Prisma, @anthropic-ai/sdk, Claude Haiku

---

### Task 1: Prisma 모델 추가 + 마이그레이션

**Files:**
- Modify: `backend/prisma/schema.prisma` (끝에 추가)

- [ ] **Step 1: schema.prisma에 StockNews, StockNewsCacheLog 모델 추가**

`backend/prisma/schema.prisma` 파일 끝(`CalendarEvent` 모델 뒤)에 추가:

```prisma
// 주식 뉴스 AI 분류 캐시
model StockNews {
  id          Int      @id @default(autoincrement())
  stockCode   String   @map("stock_code") @db.VarChar(10)
  stockName   String   @map("stock_name") @db.VarChar(50)
  title       String   @db.VarChar(300)
  summary     String   @db.VarChar(50)
  importance  String   @db.VarChar(10)
  reason      String   @db.VarChar(200)
  url         String   @db.VarChar(500)
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([stockCode, publishedAt])
  @@map("stock_news")
}

model StockNewsCacheLog {
  id        Int      @id @default(autoincrement())
  stockCode String   @unique @map("stock_code") @db.VarChar(10)
  fetchedAt DateTime @default(now()) @map("fetched_at")

  @@map("stock_news_cache_log")
}
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd backend
npx prisma migrate dev --name add_stock_news
```

Expected: `stock_news`, `stock_news_cache_log` 테이블 생성 완료

- [ ] **Step 3: Prisma 클라이언트 확인**

```bash
npx prisma generate
```

- [ ] **Step 4: 커밋**

```bash
git add backend/prisma/
git commit -m "feat(db): StockNews, StockNewsCacheLog 모델 추가"
```

---

### Task 2: @anthropic-ai/sdk 설치 + AI 분류 서비스

**Files:**
- Create: `backend/src/services/newsAnalyzer.ts`

- [ ] **Step 1: Anthropic SDK 설치**

```bash
cd backend
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: .env에 API 키 추가**

`backend/.env`에 추가 (이미 있으면 확인만):
```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: newsAnalyzer.ts 작성**

`backend/src/services/newsAnalyzer.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface NewsInput {
  title: string
  url: string
  time: string
}

interface AnalyzedNews {
  index: number
  importance: 'high' | 'medium' | 'low'
  summary: string
  reason: string
}

export async function analyzeNews(
  stockName: string,
  stockCode: string,
  newsList: NewsInput[]
): Promise<AnalyzedNews[]> {
  if (newsList.length === 0) return []

  const newsText = newsList
    .map((n, i) => `[${i}] ${n.title}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 뉴스들이 ${stockName}(${stockCode}) 주가에 미치는 영향을 분류해주세요.

${newsText}

각 뉴스에 대해 JSON 배열로만 응답 (다른 텍스트 없이):
[{"index":0,"importance":"high","summary":"15자이내요약","reason":"이유한줄"}]

기준:
- high: 실적 직접 영향 (수주, 계약, 실적, 규제, 소송, 대규모 투자)
- medium: 업종/간접 영향 (경쟁사 동향, 산업 트렌드, 정책)
- low: 약한 관련 (인사, 단순 보도, 행사)

summary는 15자 이내. reason은 한 문장.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as AnalyzedNews[]
  } catch {
    console.warn('[newsAnalyzer] JSON 파싱 실패:', text.slice(0, 200))
    return []
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add backend/src/services/newsAnalyzer.ts backend/package.json backend/package-lock.json
git commit -m "feat: Claude Haiku 뉴스 중요도 분류 서비스 추가"
```

---

### Task 3: 백엔드 API 라우트

**Files:**
- Create: `backend/src/routes/stockNews.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: stockNews.ts 라우터 작성**

`backend/src/routes/stockNews.ts`:

```typescript
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { analyzeNews } from '../services/newsAnalyzer'

const router = Router()
const prisma = new PrismaClient()

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwhUT0rUyUwZdjCqGP9dYCjfn2JBT7isV5m9KWxU6PPZappVe4fwz9QqQru0k8npvi0jQ/exec'
const SCRIPT_PW = 'average2026'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30분

// Google Apps Script에서 뉴스 가져오기
async function fetchNewsFromGAS(code: string) {
  const url = `${GOOGLE_SCRIPT_URL}?action=news&code=${code}&pw=${SCRIPT_PW}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.news || []) as { title: string; url: string; time: string }[]
}

// POST /stock-news/analyze — 뉴스 수집 + AI 분류 + DB 저장
router.post('/analyze', async (req, res) => {
  const { codes } = req.body as { codes: { code: string; name: string }[] }
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'codes 필요' })
  }

  try {
    for (const { code, name } of codes) {
      // 캐시 확인
      const cacheLog = await prisma.stockNewsCacheLog.findUnique({ where: { stockCode: code } })
      if (cacheLog && Date.now() - cacheLog.fetchedAt.getTime() < CACHE_TTL_MS) continue

      // 뉴스 수집
      const newsList = await fetchNewsFromGAS(code)
      if (newsList.length === 0) continue

      // AI 분류
      const analyzed = await analyzeNews(name, code, newsList)

      // DB 저장 (URL 기준 중복 제거)
      for (const item of analyzed) {
        const news = newsList[item.index]
        if (!news) continue

        // 발행일 파싱 (time 형식: "2026.06.01 09:30" 또는 "1시간 전" 등)
        let publishedAt = new Date()
        if (news.time && /^\d{4}\./.test(news.time)) {
          publishedAt = new Date(news.time.replace(/\./g, '-').replace(' ', 'T') + ':00')
        }

        await prisma.stockNews.upsert({
          where: { id: -1 }, // upsert 불가 → 중복 체크 후 create
          update: {},
          create: {
            stockCode: code,
            stockName: name,
            title: news.title,
            summary: item.summary,
            importance: item.importance,
            reason: item.reason,
            url: news.url,
            publishedAt,
          },
        })
      }

      // 중복 방지: URL 기준으로 기존 데이터 확인 후 insert
      // upsert 대신 findFirst + create 패턴 사용
      // (위 upsert는 작동 안 함 — 아래에서 수정)

      // 캐시 로그 갱신
      await prisma.stockNewsCacheLog.upsert({
        where: { stockCode: code },
        update: { fetchedAt: new Date() },
        create: { stockCode: code, fetchedAt: new Date() },
      })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[stock-news] analyze 에러:', err)
    res.status(500).json({ error: '뉴스 분석 실패' })
  }
})

// GET /stock-news/calendar — 월별 뉴스 캘린더 데이터
router.get('/calendar', async (req, res) => {
  const { codes, year, month } = req.query as { codes: string; year: string; month: string }
  if (!codes || !year || !month) {
    return res.status(400).json({ error: 'codes, year, month 필요' })
  }

  const codeList = codes.split(',')
  const y = parseInt(year)
  const m = parseInt(month)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  try {
    const news = await prisma.stockNews.findMany({
      where: {
        stockCode: { in: codeList },
        publishedAt: { gte: startDate, lte: endDate },
      },
      orderBy: [
        { importance: 'asc' }, // high < low 알파벳순이라 asc로 high 먼저
        { publishedAt: 'desc' },
      ],
    })

    // 날짜별 그룹핑
    const grouped: Record<string, any[]> = {}
    for (const n of news) {
      const dateStr = n.publishedAt.toISOString().split('T')[0]
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push({
        id: n.id,
        stockCode: n.stockCode,
        stockName: n.stockName,
        title: n.title,
        summary: n.summary,
        importance: n.importance,
        reason: n.reason,
        url: n.url,
        source: 'news',
      })
    }

    // 캐시 최신 시각 조회
    const latestCache = await prisma.stockNewsCacheLog.findFirst({
      where: { stockCode: { in: codeList } },
      orderBy: { fetchedAt: 'desc' },
    })

    res.json({
      data: grouped,
      lastFetched: latestCache?.fetchedAt || null,
    })
  } catch (err) {
    console.error('[stock-news] calendar 에러:', err)
    res.status(500).json({ error: '캘린더 데이터 조회 실패' })
  }
})

export default router
```

- [ ] **Step 2: upsert 로직 수정 — URL 기준 중복 방지**

위 코드의 analyze 라우트에서 upsert 부분을 수정. `stockNews.upsert`는 URL에 unique 제약이 없으므로 `findFirst + create` 패턴으로 교체:

```typescript
// 기존 upsert 블록 대체
const existing = await prisma.stockNews.findFirst({
  where: { stockCode: code, url: news.url },
})
if (!existing) {
  await prisma.stockNews.create({
    data: {
      stockCode: code,
      stockName: name,
      title: news.title,
      summary: item.summary,
      importance: item.importance,
      reason: item.reason,
      url: news.url,
      publishedAt,
    },
  })
}
```

- [ ] **Step 3: app.ts에 라우터 등록**

`backend/src/app.ts` 수정:

import 추가:
```typescript
import stockNewsRouter from './routes/stockNews'
```

라우터 등록 추가 (기존 `app.use('/stock', stockRouter)` 아래):
```typescript
app.use('/stock-news', stockNewsRouter)
```

- [ ] **Step 4: 커밋**

```bash
git add backend/src/routes/stockNews.ts backend/src/app.ts
git commit -m "feat(api): 주식 뉴스 분석/캘린더 API 라우트 추가"
```

---

### Task 4: 확정 금융 일정 JSON

**Files:**
- Create: `frontend/public/data/stock-events.json`

- [ ] **Step 1: stock-events.json 생성**

`frontend/public/data/stock-events.json`:

```json
[
  { "date": "2026-06-18", "title": "FOMC 금리 결정", "type": "macro", "importance": "high", "relatedCodes": [] },
  { "date": "2026-07-23", "title": "SK하이닉스 2Q 실적발표", "type": "earnings", "importance": "high", "relatedCodes": ["000660"] },
  { "date": "2026-07-29", "title": "삼성전자 2Q 실적발표", "type": "earnings", "importance": "high", "relatedCodes": ["005930"] },
  { "date": "2026-07-30", "title": "FOMC 금리 결정", "type": "macro", "importance": "high", "relatedCodes": [] },
  { "date": "2026-09-17", "title": "FOMC 금리 결정", "type": "macro", "importance": "high", "relatedCodes": [] },
  { "date": "2026-06-25", "title": "옵션 만기일", "type": "macro", "importance": "medium", "relatedCodes": [] }
]
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/public/data/stock-events.json
git commit -m "feat: 확정 금융 일정 데이터 추가"
```

---

### Task 5: 프론트 API 함수

**Files:**
- Modify: `frontend/src/api/stockApi.ts`

- [ ] **Step 1: 뉴스 분석 및 캘린더 API 함수 추가**

`frontend/src/api/stockApi.ts` 파일 끝에 추가:

```typescript
import api from './client'

export interface StockNewsItem {
  id: number
  stockCode: string
  stockName: string
  title: string
  summary: string
  importance: 'high' | 'medium' | 'low'
  reason: string
  url: string
  source: 'news' | 'event'
}

export interface StockCalendarData {
  data: Record<string, StockNewsItem[]>
  lastFetched: string | null
}

export async function analyzeStockNews(codes: { code: string; name: string }[]): Promise<void> {
  await api.post('/stock-news/analyze', { codes })
}

export async function fetchStockCalendar(
  codes: string[],
  year: number,
  month: number
): Promise<StockCalendarData> {
  const { data } = await api.get('/stock-news/calendar', {
    params: { codes: codes.join(','), year, month },
  })
  return data
}

export async function fetchStockEvents(): Promise<any[]> {
  const res = await fetch('/data/stock-events.json')
  return res.json()
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/api/stockApi.ts
git commit -m "feat: 주식 뉴스 캘린더 API 함수 추가"
```

---

### Task 6: StockCalendar.vue 컴포넌트

**Files:**
- Create: `frontend/src/components/stock/StockCalendar.vue`

- [ ] **Step 1: StockCalendar.vue 작성**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { UiIcon, UiLoading } from '@leechanyong/ispark-ui'
import {
  analyzeStockNews, fetchStockCalendar, fetchStockEvents,
  type StockNewsItem,
} from '../../api/stockApi'

const props = defineProps<{
  holdings: { code: string; name: string }[]
}>()

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const loading = ref(false)
const newsMap = ref<Record<string, StockNewsItem[]>>({})
const selectedDate = ref<string | null>(null)
const stockEvents = ref<any[]>([])

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const calendarDays = computed(() => {
  const y = currentYear.value
  const m = currentMonth.value
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  const startDow = firstDay.getDay()
  const days: { day: number; dateStr: string; isOther: boolean; dow: number }[] = []

  // 이전 달
  const prevLast = new Date(y, m - 1, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i
    const pm = m - 1 < 1 ? 12 : m - 1
    const py = m - 1 < 1 ? y - 1 : y
    days.push({ day: d, dateStr: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOther: true, dow: days.length % 7 })
  }
  // 현재 달
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOther: false, dow: days.length % 7 })
  }
  // 다음 달
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nm = m + 1 > 12 ? 1 : m + 1
    const ny = m + 1 > 12 ? y + 1 : y
    days.push({ day: d, dateStr: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOther: true, dow: days.length % 7 })
  }
  return days
})

const selectedItems = computed(() => {
  if (!selectedDate.value) return []
  return newsMap.value[selectedDate.value] || []
})

function getItems(dateStr: string): StockNewsItem[] {
  return (newsMap.value[dateStr] || []).slice(0, 3)
}

function importanceColor(imp: string) {
  if (imp === 'high') return '#ef4444'
  if (imp === 'medium') return '#f59e0b'
  return '#9ca3af'
}

function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else currentMonth.value--
}

function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else currentMonth.value++
}

async function loadData() {
  if (props.holdings.length === 0) return
  loading.value = true
  try {
    // 뉴스 분석 트리거 (캐시 30분 이내면 백엔드에서 스킵)
    await analyzeStockNews(props.holdings)

    // 캘린더 데이터 조회
    const codes = props.holdings.map(h => h.code)
    const result = await fetchStockCalendar(codes, currentYear.value, currentMonth.value)
    const merged = { ...result.data }

    // 확정 일정 합치기
    for (const ev of stockEvents.value) {
      const isRelevant = ev.relatedCodes.length === 0 ||
        ev.relatedCodes.some((c: string) => codes.includes(c))
      if (!isRelevant) continue
      if (!merged[ev.date]) merged[ev.date] = []
      merged[ev.date].push({
        id: 0,
        stockCode: '',
        stockName: '',
        title: ev.title,
        summary: ev.title,
        importance: ev.importance,
        reason: ev.type === 'macro' ? '거시경제 이벤트' : '기업 일정',
        url: '',
        source: 'event',
      })
    }

    // importance 정렬 (high → medium → low)
    for (const key of Object.keys(merged)) {
      merged[key].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return (order[a.importance as keyof typeof order] ?? 2) - (order[b.importance as keyof typeof order] ?? 2)
      })
    }

    newsMap.value = merged
  } catch (e) {
    console.warn('[StockCalendar] 데이터 로드 실패:', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  stockEvents.value = await fetchStockEvents()
  loadData()
})

watch([currentYear, currentMonth], () => loadData())
</script>

<template>
  <div class="stock-cal">
    <div class="stock-cal__header">
      <button class="stock-cal__nav-btn" @click="prevMonth">
        <UiIcon name="chevron-left" :size="16" />
      </button>
      <span class="stock-cal__title">{{ monthLabel }}</span>
      <button class="stock-cal__nav-btn" @click="nextMonth">
        <UiIcon name="chevron-right" :size="16" />
      </button>
    </div>

    <div class="stock-cal__grid">
      <div v-for="name in dayNames" :key="name" class="stock-cal__dow"
        :class="{ 'stock-cal__dow--sun': name === '일', 'stock-cal__dow--sat': name === '토' }">
        {{ name }}
      </div>
      <button
        v-for="(d, i) in calendarDays" :key="i"
        class="stock-cal__cell"
        :class="{
          'stock-cal__cell--other': d.isOther,
          'stock-cal__cell--selected': selectedDate === d.dateStr,
          'stock-cal__cell--sun': d.dow === 0,
          'stock-cal__cell--sat': d.dow === 6,
        }"
        @click="selectedDate = selectedDate === d.dateStr ? null : d.dateStr"
      >
        <span class="stock-cal__day">{{ d.day }}</span>
        <div v-if="getItems(d.dateStr).length" class="stock-cal__dots">
          <span
            v-for="(item, j) in getItems(d.dateStr)" :key="j"
            class="stock-cal__dot"
            :style="{ background: importanceColor(item.importance) }"
          />
        </div>
      </button>
    </div>

    <UiLoading v-if="loading" overlay />

    <!-- 선택 날짜 상세 -->
    <div v-if="selectedDate && selectedItems.length" class="stock-cal__detail">
      <div class="stock-cal__detail-title">{{ selectedDate }}</div>
      <div v-for="item in selectedItems" :key="item.id || item.title" class="stock-cal__news">
        <span class="stock-cal__imp" :style="{ background: importanceColor(item.importance) }" />
        <div class="stock-cal__news-body">
          <a v-if="item.url" :href="item.url" target="_blank" class="stock-cal__news-title">
            {{ item.summary }}
          </a>
          <span v-else class="stock-cal__news-title">{{ item.summary }}</span>
          <span v-if="item.stockName" class="stock-cal__news-stock">{{ item.stockName }}</span>
          <span class="stock-cal__news-reason">{{ item.reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stock-cal {
  background: #fff; border-radius: 12px; padding: 16px;
  border: 1px solid #e6e8ec; position: relative;
}
.stock-cal__header {
  display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;
}
.stock-cal__nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid #e6e8ec; border-radius: 6px;
  background: #fff; cursor: pointer; color: #374151;
  &:hover { background: #f3f4f6; }
}
.stock-cal__title { font-size: 14px; font-weight: 700; color: #1f2937; }
.stock-cal__grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px;
}
.stock-cal__dow {
  font-size: 10px; font-weight: 600; color: #9ca3af; text-align: center; padding: 4px 0;
  &--sun { color: #ef4444; }
  &--sat { color: #3b82f6; }
}
.stock-cal__cell {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 4px 2px; min-height: 36px; border: none; background: none;
  border-radius: 6px; cursor: pointer;
  &:hover { background: #f9fafb; }
  &--other { opacity: 0.3; }
  &--selected { background: #eff6ff; }
  &--sun .stock-cal__day { color: #ef4444; }
  &--sat .stock-cal__day { color: #3b82f6; }
}
.stock-cal__day { font-size: 11px; font-weight: 500; color: #374151; }
.stock-cal__dots { display: flex; gap: 2px; }
.stock-cal__dot { width: 5px; height: 5px; border-radius: 50%; }
.stock-cal__detail {
  margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;
}
.stock-cal__detail-title {
  font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 8px;
}
.stock-cal__news {
  display: flex; gap: 8px; padding: 6px 0;
  & + & { border-top: 1px solid #f9fafb; }
}
.stock-cal__imp {
  width: 4px; border-radius: 2px; flex-shrink: 0; align-self: stretch;
}
.stock-cal__news-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stock-cal__news-title {
  font-size: 13px; color: #1f2937; font-weight: 500;
  text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  &:hover { color: #3b82f6; }
}
.stock-cal__news-stock {
  font-size: 10px; color: #3b82f6; font-weight: 500;
}
.stock-cal__news-reason { font-size: 11px; color: #9ca3af; }
</style>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/stock/StockCalendar.vue
git commit -m "feat: StockCalendar 미니 캘린더 컴포넌트"
```

---

### Task 7: StockDashboard에 StockCalendar 통합

**Files:**
- Modify: `frontend/src/components/stock/StockDashboard.vue`

- [ ] **Step 1: StockDashboard.vue에 import 추가**

```typescript
import StockCalendar from './StockCalendar.vue'
```

- [ ] **Step 2: holdings를 props로 전달할 수 있도록 데이터 확인**

`StockDashboard.vue`에서 `useStockData()` composable을 통해 `holdings`를 사용 중. holdings의 형태를 확인하고 `{ code, name }[]` 형태로 StockCalendar에 전달.

- [ ] **Step 3: 템플릿에 StockCalendar 추가**

기존 Row 3 (`SmartScore`) 아래에 추가:

```html
<!-- Row 4: 주식 캘린더 -->
<div class="dashboard-row">
  <div class="dashboard-col dashboard-col--full">
    <StockCalendar :holdings="holdingsForCalendar" />
  </div>
</div>
```

script에 computed 추가:

```typescript
const holdingsForCalendar = computed(() =>
  holdings.value.map(h => ({ code: h.code, name: h.name }))
)
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/stock/StockDashboard.vue
git commit -m "feat: StockDashboard에 주식 캘린더 위젯 통합"
```

---

### Task 8: 통합 테스트 + 최종 확인

- [ ] **Step 1: 백엔드 서버 시작 확인**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: 프론트 서버 시작 확인**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: 주식 대시보드에서 StockCalendar 표시 확인**

`http://localhost:5173/main?tab=stock`에서:
1. 미니 캘린더가 StockDashboard 하단에 표시되는지
2. 보유 종목이 있으면 뉴스 분석이 트리거되는지 (네트워크 탭 확인)
3. 날짜 클릭 시 상세 뉴스 목록이 나오는지
4. 월 이동이 작동하는지

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: 주식 캘린더 기능 완성 — AI 뉴스 분류 + 미니 캘린더"
```
