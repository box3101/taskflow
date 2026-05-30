<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CalendarEvent } from '../../types/calendar'
import CalendarDayCell from './CalendarDayCell.vue'

const props = defineProps<{
  year: number
  month: number
  events: CalendarEvent[]
  selectedDate: string
}>()

const emit = defineEmits<{
  selectDate: [date: string]
  swipeLeft: []
  swipeRight: []
}>()

// 터치 스와이프
const touchStartX = ref(0)
const touchStartY = ref(0)

function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX.value
  const dy = e.changedTouches[0].clientY - touchStartY.value
  // 세로 스크롤보다 가로 이동이 클 때만 스와이프 판정
  if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
  if (dx < 0) emit('swipeLeft')
  else emit('swipeRight')
}

const dayNames = ['월', '화', '수', '목', '금', '토', '일']

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const calendarDays = computed(() => {
  const firstDay = new Date(props.year, props.month - 1, 1)
  const lastDay = new Date(props.year, props.month, 0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const days: { day: number; dateStr: string; isOtherMonth: boolean }[] = []
  const prevLastDay = new Date(props.year, props.month - 1, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i
    const m = props.month - 1
    const y = m < 1 ? props.year - 1 : props.year
    const actualMonth = m < 1 ? 12 : m
    days.push({ day: d, dateStr: `${y}-${String(actualMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: true })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ day: d, dateStr: `${props.year}-${String(props.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: false })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = props.month + 1
    const y = m > 12 ? props.year + 1 : props.year
    const actualMonth = m > 12 ? 1 : m
    days.push({ day: d, dateStr: `${y}-${String(actualMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: true })
  }
  return days
})

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of props.events) {
    const list = map.get(ev.date) || []
    list.push(ev)
    map.set(ev.date, list)
  }
  return map
})
</script>

<template>
  <div class="calendar-month" role="grid" aria-label="월간 캘린더"
    @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
    <div class="calendar-month__header" role="row">
      <div v-for="name in dayNames" :key="name" class="calendar-month__day-name"
        :class="{ 'calendar-month__day-name--weekend': name === '토' || name === '일' }" role="columnheader">
        {{ name }}
      </div>
    </div>
    <div class="calendar-month__grid">
      <CalendarDayCell v-for="(d, i) in calendarDays" :key="i"
        :day="d.day" :events="eventsByDate.get(d.dateStr) || []"
        :is-today="d.dateStr === today" :is-selected="d.dateStr === selectedDate"
        :is-other-month="d.isOtherMonth" @select="emit('selectDate', d.dateStr)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.calendar-month__header {
  display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px;
}
.calendar-month__day-name {
  font-size: 12px; font-weight: 600; color: #6b7280; padding: 8px 0;
  &--weekend { color: #ef4444; }
}
.calendar-month__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
@media (max-width: 768px) {
  .calendar-month__day-name { font-size: 11px; padding: 6px 0; }
}
</style>
