<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  UiButton, UiIcon, UiLoading, UiToggle, openToast,
} from '@leechanyong/ispark-ui'
import api from '../api/client'
import { getCached, setCached } from '../composables/useCachedFetch'
import type { CalendarEvent } from '../types/calendar'
import CalendarMonth from '../components/calendar/CalendarMonth.vue'
import CalendarEventList from '../components/calendar/CalendarEventList.vue'
import CalendarEventForm from '../components/calendar/CalendarEventForm.vue'
import CalendarTodoDrawer from '../components/calendar/CalendarTodoDrawer.vue'
import CalendarIssueDrawer from '../components/calendar/CalendarIssueDrawer.vue'

const loading = ref(true)
const allEvents = ref<CalendarEvent[]>([])

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)

const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const showTodo = ref(true)
const showIssue = ref(true)

const drawerOpen = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

const todoDrawerOpen = ref(false)
const todoDrawerId = ref<number | null>(null)
const issueDrawerOpen = ref(false)
const issueDrawerId = ref<number | null>(null)
const issueDrawerProjectId = ref<number | null>(null)

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const filteredEvents = computed(() => {
  return allEvents.value.filter(ev => {
    if (ev.type === 'todo') return showTodo.value
    if (ev.type === 'issue') return showIssue.value
    return true // 캘린더 일정은 항상 표시
  })
})

const selectedEvents = computed(() => {
  return filteredEvents.value.filter(ev => ev.date === selectedDate.value)
})

async function fetchEvents() {
  // 월별 캐시: 본 적 있는 달이면 즉시 표시 → 백그라운드 갱신
  const cacheKey = `calendar-${currentYear.value}-${currentMonth.value}`
  const cached = getCached<CalendarEvent[]>(cacheKey)
  if (cached) {
    allEvents.value = cached
    loading.value = false
  } else {
    loading.value = true
  }
  try {
    const { data } = await api.get('/calendar', {
      params: { year: currentYear.value, month: currentMonth.value },
    })
    allEvents.value = data.data
    setCached(cacheKey, data.data)
  } catch {
    // 갱신 실패 시 기존(stale) 데이터 유지, 캐시 없을 때만 알림
    if (!cached) openToast({ message: '일정을 불러오는데 실패했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
}

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
  fetchEvents()
})

function openAdd() { editingEvent.value = null; drawerOpen.value = true }
function openAddOnDate() { editingEvent.value = null; drawerOpen.value = true }
function openEdit(ev: CalendarEvent) { editingEvent.value = ev; drawerOpen.value = true }
function onSaved() { fetchEvents() }
function onDeleted() { fetchEvents() }

function openTodoDrawer(ev: CalendarEvent) {
  todoDrawerId.value = ev.id
  todoDrawerOpen.value = true
}
function openIssueDrawer(ev: CalendarEvent) {
  issueDrawerId.value = ev.id
  issueDrawerProjectId.value = ev.projectId ?? null
  issueDrawerOpen.value = true
}
function onTodoSavedOrDeleted() { fetchEvents() }
function onIssueSavedOrDeleted() { fetchEvents() }

onMounted(fetchEvents)
</script>

<template>
  <div class="calendar-page">
    <UiLoading v-if="loading" overlay />
    <!-- FAB: 일정 추가 -->
    <button class="calendar-page__fab" @click="openAdd" aria-label="일정 추가">
      <UiIcon name="plus" :size="22" />
    </button>
    <div class="calendar-page__body">
      <div class="calendar-page__grid">
        <div class="calendar-page__header">
          <div class="calendar-page__nav">
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 달" @click="prevMonth">
              <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
            </UiButton>
            <span class="calendar-page__month">{{ monthLabel }}</span>
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 달" @click="nextMonth">
              <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
            </UiButton>
            <UiButton class="calendar-page__today" variant="ghost" size="sm" @click="goToday">오늘</UiButton>
          </div>
          <div class="calendar-page__toggles">
            <label class="calendar-page__toggle-label">
              <span class="calendar-page__toggle-dot" style="background: #ef4444;" />
              <UiToggle v-model="showTodo" />
              <span>Todo</span>
            </label>
            <label class="calendar-page__toggle-label">
              <span class="calendar-page__toggle-dot" style="background: #22c55e;" />
              <UiToggle v-model="showIssue" />
              <span>Issue</span>
            </label>
          </div>
        </div>
        <CalendarMonth :year="currentYear" :month="currentMonth" :events="filteredEvents"
          :selected-date="selectedDate" @select-date="selectedDate = $event"
          @swipe-left="nextMonth" @swipe-right="prevMonth" />
      </div>
      <div class="calendar-page__side">
        <CalendarEventList :date="selectedDate" :events="selectedEvents"
          @add="openAddOnDate" @edit-event="openEdit"
          @open-todo="openTodoDrawer" @open-issue="openIssueDrawer" />
      </div>
    </div>
    <CalendarEventForm v-model:open="drawerOpen" :event="editingEvent" :default-date="selectedDate"
      @saved="onSaved" @deleted="onDeleted" />
    <CalendarTodoDrawer v-model:open="todoDrawerOpen" :todo-id="todoDrawerId"
      @saved="onTodoSavedOrDeleted" @deleted="onTodoSavedOrDeleted" />
    <CalendarIssueDrawer v-model:open="issueDrawerOpen" :issue-id="issueDrawerId"
      :project-id="issueDrawerProjectId"
      @saved="onIssueSavedOrDeleted" @deleted="onIssueSavedOrDeleted" />
  </div>
</template>

<style scoped lang="scss">
.calendar-page { max-width: 1100px; margin: 0 auto; position: relative; }
.calendar-page__body { display: flex; gap: 24px; align-items: flex-start; }
.calendar-page__grid { flex: 1; min-width: 0; }
.calendar-page__side {
  flex-shrink: 0; width: 280px; position: sticky; top: 80px;
  max-height: calc(100vh - 140px); overflow-y: auto;
  background: #fff; border-radius: 12px; border: 1px solid #f3f4f6; padding: 0 16px 16px;
  :deep(.event-list) { border-top: none; padding-top: 0; margin-top: 0; }
  :deep(.event-list__header) { position: sticky; top: 0; background: #fff; padding: 16px 0 4px; margin-bottom: 6px; }
}
.calendar-page__header {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px; gap: 12px; position: relative;
}
.calendar-page__toggles {
  display: flex; gap: 12px; flex-shrink: 0; position: absolute; left: 0;
}
.calendar-page__toggle-label {
  display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; cursor: pointer;
}
.calendar-page__toggle-dot { width: 8px; height: 8px; border-radius: 50%; }
.calendar-page__nav {
  display: flex; align-items: center; gap: 8px;
  :deep(.ui-button) { min-width: 36px; min-height: 36px; }
}
.calendar-page__month { font-size: 18px; font-weight: 700; color: #1f2937; min-width: 120px; text-align: center; }
.calendar-page__fab {
  position: fixed; bottom: 76px; right: 24px; z-index: 50;
  width: 52px; height: 52px; border-radius: 50%;
  background: #4f6af6; color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.4);
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(79, 106, 246, 0.5); }
  &:active { transform: scale(0.95); }
}
@media (max-width: 1024px) {
  .calendar-page__body { flex-direction: column; gap: 0; }
  .calendar-page__side {
    width: 100%; position: static; max-height: none;
    background: none; border: none; border-radius: 0; padding: 0;
  }
}
@media (max-width: 768px) {
  .calendar-page__header { gap: 8px; }
  .calendar-page__toggles { position: static; gap: 8px; margin-left: auto; }
  .calendar-page__nav { gap: 4px; }
  .calendar-page__today { display: none !important; }
  .calendar-page__month { font-size: 16px; min-width: 100px; }
  .calendar-page__fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}
</style>
