<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiButton, UiIcon, UiLoading, UiToggle, UiConfirm, UiToast, openToast } from '@leechanyong/ispark-ui'
import api from '../api/client'
import type { CalendarEvent } from '../types/calendar'
import CalendarMonth from '../components/calendar/CalendarMonth.vue'
import CalendarEventList from '../components/calendar/CalendarEventList.vue'
import CalendarEventForm from '../components/calendar/CalendarEventForm.vue'

const router = useRouter()
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

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const filteredEvents = computed(() => {
  return allEvents.value.filter(ev => {
    if (ev.type === 'todo' && !showTodo.value) return false
    if (ev.type === 'issue' && !showIssue.value) return false
    return true
  })
})

const selectedEvents = computed(() => {
  return filteredEvents.value.filter(ev => ev.date === selectedDate.value)
})

async function fetchEvents() {
  loading.value = true
  try {
    const { data } = await api.get('/calendar', {
      params: { year: currentYear.value, month: currentMonth.value },
    })
    allEvents.value = data.data
  } catch {
    openToast({ message: '일정을 불러오는데 실패했습니다.', type: 'error' })
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

onMounted(fetchEvents)
</script>

<template>
  <div class="calendar-page">
    <UiLoading v-if="loading" overlay />
    <div class="calendar-page__header">
      <div class="calendar-page__nav">
        <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 달" @click="prevMonth">
          <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
        </UiButton>
        <span class="calendar-page__month">{{ monthLabel }}</span>
        <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 달" @click="nextMonth">
          <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="goToday">오늘</UiButton>
      </div>
      <div class="calendar-page__actions">
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
        <UiButton size="sm" @click="openAdd">
          <UiIcon name="plus" :size="14" />
          일정 추가
        </UiButton>
      </div>
    </div>
    <CalendarMonth :year="currentYear" :month="currentMonth" :events="filteredEvents"
      :selected-date="selectedDate" @select-date="selectedDate = $event" />
    <CalendarEventList :date="selectedDate" :events="selectedEvents"
      @add="openAddOnDate" @edit-event="openEdit" />
    <CalendarEventForm v-model:open="drawerOpen" :event="editingEvent" :default-date="selectedDate"
      @saved="onSaved" @deleted="onDeleted" />
    <UiConfirm />
    <UiToast />
  </div>
</template>

<style scoped lang="scss">
.calendar-page { max-width: 800px; margin: 0 auto; padding: 24px; position: relative; }
.calendar-page__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
}
.calendar-page__nav { display: flex; align-items: center; gap: 8px; }
.calendar-page__month { font-size: 18px; font-weight: 700; color: #1f2937; min-width: 120px; text-align: center; }
.calendar-page__actions { display: flex; align-items: center; gap: 12px; }
.calendar-page__toggles { display: flex; gap: 12px; }
.calendar-page__toggle-label {
  display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; cursor: pointer;
}
.calendar-page__toggle-dot { width: 8px; height: 8px; border-radius: 50%; }
@media (max-width: 768px) {
  .calendar-page { padding: 12px; }
  .calendar-page__header { flex-direction: column; align-items: stretch; gap: 8px; }
  .calendar-page__nav { justify-content: center; }
  .calendar-page__actions { justify-content: space-between; }
  .calendar-page__toggles { gap: 8px; }
  .calendar-page__month { font-size: 16px; min-width: 100px; }
}
</style>
