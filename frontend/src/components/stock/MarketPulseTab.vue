<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { UiButton, UiIcon, UiLoading, UiBadge, UiBadgeGroup, UiEmpty, UiCalendarMonth } from '@leechanyong/ispark-ui'
import type { CalendarMonthEvent } from '@leechanyong/ispark-ui'
import type { MarketEvent } from '../../types/stock'
import type { EventResultMap } from '../../api/stockApi'
import { fetchEventResults } from '../../api/stockApi'
import MarketEventDrawer from './MarketEventDrawer.vue'
import MarketOutlookCard from './MarketOutlookCard.vue'
import MarketJournalCard from './MarketJournalCard.vue'

const events = ref<MarketEvent[]>([])
const eventResults = ref<EventResultMap>({})
const loading = ref(true)

// 드로어 상태
const drawerOpen = ref(false)
const selectedEvent = ref<MarketEvent | null>(null)

function openEventDrawer(event: MarketEvent) {
  selectedEvent.value = event
  drawerOpen.value = true
}

function onResultSaved(eventId: string, data: { actual: string; memo: string; impact: string }) {
  eventResults.value = { ...eventResults.value, [eventId]: data }
}

// 캘린더 상태
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const sideDateLabel = computed(() => {
  const [, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(selectedDate.value)
  const dayName = DAY_NAMES[dt.getDay()]
  return `${m}월 ${d}일 (${dayName})`
})

function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else { currentMonth.value-- }
}

function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else { currentMonth.value++ }
}

function goToday() {
  const n = new Date()
  currentYear.value = n.getFullYear()
  currentMonth.value = n.getMonth() + 1
  selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

watch([currentYear, currentMonth], () => {
  const n = new Date()
  if (currentYear.value === n.getFullYear() && currentMonth.value === n.getMonth() + 1) {
    selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  } else {
    selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  }
})

// 카테고리 설정
const categoryColor: Record<string, string> = {
  'us-econ': '#ef5350',
  'us-earnings': '#42a5f5',
  'kr-schedule': '#ffa726',
  'global': '#ab47bc',
  'foreign-flow': '#26a69a',
  'sentiment': '#78909c',
}

const categoryLucideIcon: Record<string, string> = {
  'us-econ': 'landmark',
  'us-earnings': 'building-2',
  'kr-schedule': 'flag',
  'global': 'globe',
  'foreign-flow': 'bar-chart-3',
  'sentiment': 'activity',
}

const categoryLabel: Record<string, string> = {
  'us-econ': '경제',
  'us-earnings': '실적',
  'kr-schedule': '한국',
  'global': '글로벌',
  'foreign-flow': '외국인',
  'sentiment': '심리',
}

// 캘린더 이벤트 변환
const calendarEvents = computed<CalendarMonthEvent[]>(() => {
  return events.value.map((e, i) => ({
    id: `market-${i}`,
    start: e.date,
    title: e.title,
    color: categoryColor[e.category] || '#9ca3af',
  }))
})

// 선택 날짜의 이벤트
const dayEvents = computed(() =>
  events.value
    .filter(e => e.date === selectedDate.value)
    .sort((a, b) => b.importance - a.importance)
)

// 필터
const activeFilter = ref<string>('all')
const filters = [
  { key: 'all', label: '전체', variant: 'default' as const },
  { key: 'us-econ', label: '경제', variant: 'danger' as const },
  { key: 'us-earnings', label: '실적', variant: 'info' as const },
  { key: 'kr-schedule', label: '한국', variant: 'warning' as const },
  { key: 'global', label: '글로벌', variant: 'primary' as const },
]

const filteredDayEvents = computed(() => {
  if (activeFilter.value === 'all') return dayEvents.value
  return dayEvents.value.filter(e => e.category === activeFilter.value)
})

// 데이터 로드
async function loadEvents() {
  try {
    const res = await fetch('/data/market-events.json')
    events.value = await res.json()
  } catch (e) {
    console.warn('[MarketPulse] market-events.json 로드 실패:', e)
  }
}

async function loadResults() {
  try {
    eventResults.value = await fetchEventResults()
  } catch (e) {
    console.warn('[MarketPulse] 결과 데이터 로드 실패:', e)
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadEvents(), loadResults()])
  loading.value = false
})
</script>

<template>
  <div class="pulse">
    <UiLoading v-if="loading" />
    <template v-else>
      <!-- 시장 전망 카드 -->
      <MarketOutlookCard />

      <!-- 캘린더 + 사이드 패널 -->
      <div class="pulse__body">
        <!-- 캘린더 -->
        <div class="pulse__calendar">
          <div class="pulse__cal-header">
            <UiButton variant="outline" size="sm" icon-only aria-label="이전 달" @click="prevMonth">
              <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
            </UiButton>
            <span class="pulse__cal-month">{{ monthLabel }}</span>
            <UiButton variant="outline" size="sm" icon-only aria-label="다음 달" @click="nextMonth">
              <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="goToday">오늘</UiButton>
          </div>
          <UiCalendarMonth
            v-model:year="currentYear"
            v-model:month="currentMonth"
            :events="calendarEvents"
            :selected-date="selectedDate"
            @select-date="selectedDate = $event"
            @select-event="selectedDate = $event.start"
          />
        </div>

        <!-- 사이드: 선택 날짜 이벤트 -->
        <div class="pulse__side">
          <div class="pulse__side-header">
            <span class="pulse__side-date">{{ sideDateLabel }}</span>
          </div>

          <!-- 카테고리 필터 -->
          <UiBadgeGroup :gap="6" class="pulse__filters">
            <UiBadge
              v-for="f in filters"
              :key="f.key"
              :variant="activeFilter === f.key ? f.variant : 'default'"
              size="sm"
              class="pulse__filter-chip"
              :class="{ 'pulse__filter-chip--active': activeFilter === f.key }"
              @click="activeFilter = f.key"
            >
              {{ f.label }}
            </UiBadge>
          </UiBadgeGroup>

          <UiEmpty
            v-if="filteredDayEvents.length === 0"
            title="일정 없음"
            description="이 날짜에 시장 이벤트가 없습니다."
          />

          <div v-else class="pulse__list">
            <div
              v-for="event in filteredDayEvents"
              :key="event.id"
              class="pulse__item"
              @click="openEventDrawer(event)"
            >
              <div class="pulse__item-top">
                <UiIcon
                  :name="categoryLucideIcon[event.category] || 'calendar'"
                  :size="16"
                  :style="{ color: categoryColor[event.category] }"
                />
                <span class="pulse__item-title">{{ event.title }}</span>
                <span class="pulse__item-dots">
                  <span
                    v-for="n in event.importance"
                    :key="n"
                    class="dot"
                    :style="{ background: categoryColor[event.category] || '#ef4444' }"
                  ></span>
                </span>
              </div>
              <div v-if="event.subtitle" class="pulse__item-sub">{{ event.subtitle }}</div>
              <div v-if="event.time" class="pulse__item-time">
                <UiIcon name="clock" :size="12" /> {{ event.time }}
              </div>
              <div v-if="event.expected || event.previous || eventResults[event.id]?.actual || event.actual" class="pulse__item-data">
                <span v-if="event.expected" class="data-tag">
                  <UiIcon name="target" :size="10" /> 예상 {{ event.expected }}
                </span>
                <span v-if="event.previous" class="data-tag">
                  <UiIcon name="history" :size="10" /> 이전 {{ event.previous }}
                </span>
                <span v-if="eventResults[event.id]?.actual || event.actual" class="data-tag data-tag--actual">
                  <UiIcon name="check-circle" :size="10" /> 실제 {{ eventResults[event.id]?.actual || event.actual }}
                </span>
              </div>
              <div v-if="event.impact" class="pulse__item-impact">
                <UiIcon name="lightbulb" :size="12" color="warning" />
                {{ event.impact }}
              </div>
            </div>
          </div>

          <!-- 시황 일지 -->
          <MarketJournalCard :selected-date="selectedDate" />
        </div>
      </div>
    </template>

    <!-- 이벤트 상세 드로어 -->
    <MarketEventDrawer
      :open="drawerOpen"
      :event="selectedEvent"
      :saved-actual="selectedEvent ? (eventResults[selectedEvent.id]?.actual || selectedEvent.actual || null) : null"
      :saved-memo="selectedEvent ? eventResults[selectedEvent.id]?.memo : null"
      :saved-impact="selectedEvent ? eventResults[selectedEvent.id]?.impact : null"
      @update:open="drawerOpen = $event"
      @saved="onResultSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.pulse {
  padding-bottom: 80px;
}

// 캘린더 + 사이드 레이아웃
.pulse__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.pulse__calendar {
  flex: 1;
  min-width: 0;
}

.pulse__cal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  justify-content: center;
}

.pulse__cal-month {
  font-size: 16px;
  font-weight: 700;
  min-width: 100px;
  text-align: center;
}

// 사이드 패널
.pulse__side {
  width: 380px;
  flex-shrink: 0;
}

.pulse__side-header {
  margin-bottom: 10px;
}

.pulse__side-date {
  font-size: 16px;
  font-weight: 700;
  color: #1a1f2b;
}

.pulse__filters {
  margin-bottom: 12px;
}

.pulse__filter-chip {
  cursor: pointer;
  transition: opacity 0.15s;
  &:not(.pulse__filter-chip--active) { opacity: 0.45; }
  &:hover { opacity: 0.85; }
}

// 이벤트 리스트
.pulse__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pulse__item {
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #f9fafb; }
}

.pulse__item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pulse__item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.pulse__item-dots {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pulse__item-sub {
  font-size: 12px;
  color: #9ca3af;
  padding-left: 22px;
}

.pulse__item-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
  padding-left: 22px;
}

.pulse__item-data {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-left: 22px;
  margin-top: 2px;
}

.data-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;

  &--actual {
    background: #dcfce7;
    color: #16a34a;
    font-weight: 600;
  }
}

.pulse__item-impact {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
  padding-left: 22px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .pulse__body { flex-direction: column; }
  .pulse__side { width: 100%; }
}

// 다크모드
:global([data-theme="dark"]) {
  .pulse__side-date { color: #f3f4f6; }
  .pulse__cal-month { color: #f3f4f6; }
  .pulse__item { background: #1f2937; }
  .pulse__item-title { color: #e5e7eb; }
  .data-tag {
    background: #2d2f36;
    color: #9ca3af;
    &--actual { background: #1a3a2a; color: #4ade80; }
  }
}
</style>
