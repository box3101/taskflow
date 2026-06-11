<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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

// 드래그 스와이프
const dragX = ref(0)
const isDragging = ref(false)
const isAnimating = ref(false)
const slideDirection = ref<'left' | 'right' | null>(null)
let startX = 0
let startY = 0
let locked = false // 방향 잠금 (가로/세로)

function onPointerDown(e: PointerEvent) {
  if (isAnimating.value) return
  isDragging.value = true
  locked = false
  startX = e.clientX
  startY = e.clientY
  dragX.value = 0
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  // 첫 이동에서 방향 잠금
  if (!locked && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    locked = true
    if (Math.abs(dy) > Math.abs(dx)) {
      // 세로 스크롤 → 드래그 취소
      isDragging.value = false
      dragX.value = 0
      return
    }
  }
  if (locked) {
    dragX.value = dx
  }
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false

  const threshold = 80
  if (Math.abs(dragX.value) > threshold) {
    // 슬라이드 아웃 애니메이션
    slideDirection.value = dragX.value < 0 ? 'left' : 'right'
    isAnimating.value = true

    setTimeout(() => {
      if (slideDirection.value === 'left') emit('swipeLeft')
      else emit('swipeRight')
    }, 200)
  } else {
    // 스냅백
    dragX.value = 0
  }
}

// month 변경 시 슬라이드 인 애니메이션
watch([() => props.year, () => props.month], () => {
  if (isAnimating.value) {
    // 슬라이드 인: 반대 방향에서 들어옴
    const dir = slideDirection.value
    dragX.value = dir === 'left' ? 300 : -300
    slideDirection.value = null
    isAnimating.value = false

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dragX.value = 0
      })
    })
  }
})

const gridStyle = computed(() => {
  if (isAnimating.value) {
    // 슬라이드 아웃
    const target = slideDirection.value === 'left' ? -100 : 100
    return {
      transform: `translateX(${target}%)`,
      transition: 'transform 0.2s ease-out',
      opacity: '0.3',
    }
  }
  if (dragX.value !== 0 && !isDragging.value) {
    // 스냅백 또는 슬라이드 인
    return {
      transform: 'translateX(0)',
      transition: 'transform 0.25s ease-out',
    }
  }
  if (isDragging.value) {
    return {
      transform: `translateX(${dragX.value}px)`,
      transition: 'none',
    }
  }
  return {}
})

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const calendarDays = computed(() => {
  const firstDay = new Date(props.year, props.month - 1, 1)
  const lastDay = new Date(props.year, props.month, 0)
  const startDow = firstDay.getDay() // 일요일 = 0
  const days: { day: number; dateStr: string; isOtherMonth: boolean; dow: number }[] = []
  const prevLastDay = new Date(props.year, props.month - 1, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i
    const m = props.month - 1
    const y = m < 1 ? props.year - 1 : props.year
    const actualMonth = m < 1 ? 12 : m
    const dow = (startDow - i - 1 + 7) % 7
    days.push({ day: d, dateStr: `${y}-${String(actualMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: true, dow })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dow = (startDow + d - 1) % 7
    days.push({ day: d, dateStr: `${props.year}-${String(props.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: false, dow })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = props.month + 1
    const y = m > 12 ? props.year + 1 : props.year
    const actualMonth = m > 12 ? 1 : m
    const dow = (days.length) % 7
    days.push({ day: d, dateStr: `${y}-${String(actualMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isOtherMonth: true, dow })
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
  // 다일(범위) 항목을 위쪽 레인에 고정 → 날짜 칸을 가로질러 막대가 이어져 보이도록
  for (const list of map.values()) {
    list.sort((a, b) => {
      const ra = a.span && a.span !== 'single' ? 0 : 1
      const rb = b.span && b.span !== 'single' ? 0 : 1
      return ra - rb
    })
  }
  return map
})
</script>

<template>
  <div class="calendar-month" role="grid" aria-label="월간 캘린더"
    @pointerdown="onPointerDown" @pointermove="onPointerMove"
    @pointerup="onPointerUp" @pointercancel="onPointerUp"
    style="touch-action: pan-y;">
    <div class="calendar-month__header" role="row">
      <div v-for="name in dayNames" :key="name" class="calendar-month__day-name"
        :class="{
          'calendar-month__day-name--sunday': name === '일',
          'calendar-month__day-name--saturday': name === '토',
        }" role="columnheader">
        {{ name }}
      </div>
    </div>
    <div class="calendar-month__grid" :style="gridStyle">
      <CalendarDayCell v-for="(d, i) in calendarDays" :key="i"
        :day="d.day" :dow="d.dow" :events="eventsByDate.get(d.dateStr) || []"
        :is-today="d.dateStr === today" :is-selected="d.dateStr === selectedDate"
        :is-other-month="d.isOtherMonth" @select="emit('selectDate', d.dateStr)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.calendar-month {
  overflow: hidden;
  user-select: none;
  width: 100%;
}
.calendar-month__header {
  display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px;
}
.calendar-month__day-name {
  font-size: 12px; font-weight: 600; color: #6b7280; padding: 8px 0;
  background: #f3f4f6; border-bottom: 1px solid #e5e7eb;
  &--sunday { color: #ef4444; }
  &--saturday { color: #3b82f6; }
}
.calendar-month__grid {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;
  will-change: transform;
}
@media (max-width: 768px) {
  .calendar-month__day-name { font-size: 11px; padding: 6px 0; }
}
</style>
