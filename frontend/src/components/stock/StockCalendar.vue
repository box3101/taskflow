<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { UiIcon, UiLoading, UiModal } from '@leechanyong/ispark-ui'
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
const impactModal = ref(false)
const impactData = ref<{ title: string; grade: string; direction: string; detail: string } | null>(null)

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const calendarDays = computed(() => {
  const y = currentYear.value
  const m = currentMonth.value
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  const startDow = firstDay.getDay()
  const days: { day: number; dateStr: string; isOther: boolean; dow: number }[] = []

  const prevLast = new Date(y, m - 1, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i
    const pm = m - 1 < 1 ? 12 : m - 1
    const py = m - 1 < 1 ? y - 1 : y
    days.push({ day: d, dateStr: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOther: true, dow: days.length % 7 })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOther: false, dow: days.length % 7 })
  }
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
    await analyzeStockNews(props.holdings)

    const codes = props.holdings.map(h => h.code)
    const result = await fetchStockCalendar(codes, currentYear.value, currentMonth.value)
    const merged = { ...result.data }

    for (const ev of stockEvents.value) {
      const isRelevant = ev.relatedCodes.length === 0 ||
        ev.relatedCodes.some((c: string) => codes.includes(c))
      if (!isRelevant) continue
      if (!merged[ev.date]) merged[ev.date] = []
      merged[ev.date].push({
        id: 0, stockCode: '', stockName: '',
        title: ev.title, summary: ev.title,
        importance: ev.importance,
        reason: ev.type === 'macro' ? '거시경제 이벤트' : '기업 일정',
        url: '', source: 'event',
        impact: ev.impact || null,
      })
    }

    for (const key of Object.keys(merged)) {
      merged[key].sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return (order[a.importance] ?? 2) - (order[b.importance] ?? 2)
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
  try { stockEvents.value = await fetchStockEvents() } catch { /* 정적 일정 로드 실패 무시 */ }
  loadData()
})

// holdings가 나중에 로드되면 재조회
watch(() => props.holdings.length, (len, oldLen) => {
  if (len > 0 && oldLen === 0) loadData()
})

function showImpact(item: any) {
  if (item.impact) {
    impactData.value = { title: item.title, ...item.impact }
    impactModal.value = true
  } else if (item.url) {
    window.open(item.url, '_blank')
  }
}

watch([currentYear, currentMonth], () => {
  selectedDate.value = null
  loadData()
})
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

    <div v-if="selectedDate && selectedItems.length" class="stock-cal__detail">
      <div class="stock-cal__detail-title">{{ selectedDate }}</div>
      <div v-for="item in selectedItems" :key="item.id || item.title"
        class="stock-cal__news" :class="{ 'stock-cal__news--clickable': item.impact || item.url }"
        @click="showImpact(item)">
        <span class="stock-cal__imp" :style="{ background: importanceColor(item.importance) }" />
        <div class="stock-cal__news-body">
          <span class="stock-cal__news-title">{{ item.summary }}</span>
          <span v-if="item.stockName" class="stock-cal__news-stock">{{ item.stockName }}</span>
          <span class="stock-cal__news-reason">{{ item.reason }}</span>
        </div>
        <UiIcon v-if="item.impact" name="chevron-right" :size="14" class="stock-cal__arrow" />
      </div>
    </div>

    <!-- 영향 분석 모달 -->
    <UiModal v-model:open="impactModal" :title="impactData?.title || ''" size="sm">
      <div v-if="impactData" class="impact-modal">
        <div class="impact-modal__badges">
          <span class="impact-modal__grade" :class="'impact-modal__grade--' + impactData.grade">
            영향도: {{ impactData.grade }}
          </span>
          <span class="impact-modal__dir">{{ impactData.direction }}</span>
        </div>
        <div class="impact-modal__detail">
          <p v-for="(para, pi) in impactData.detail.split('\n\n')" :key="pi" class="impact-modal__para">
            {{ para }}
          </p>
        </div>
      </div>
    </UiModal>
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
.stock-cal__news--clickable { cursor: pointer; &:hover { background: #f9fafb; } }
.stock-cal__arrow { color: #d1d5db; flex-shrink: 0; align-self: center; }
.stock-cal__detail { max-height: 300px; overflow-y: auto; }

// 영향 분석 모달
.impact-modal {
  padding: 4px 0;
}
.impact-modal__badges {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.impact-modal__grade {
  font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px;
  &--상 { background: #fef2f2; color: #ef4444; }
  &--중 { background: #fffbeb; color: #f59e0b; }
  &--하 { background: #f0fdf4; color: #22c55e; }
}
.impact-modal__dir {
  font-size: 12px; color: #6b7280; padding: 3px 10px;
  background: #f3f4f6; border-radius: 12px;
}
.impact-modal__detail {
  font-size: 13px; color: #374151; line-height: 1.8;
  background: #f9fafb; border-radius: 8px; padding: 14px 16px;
}
.impact-modal__para {
  margin: 0;
  & + & { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
}
</style>
