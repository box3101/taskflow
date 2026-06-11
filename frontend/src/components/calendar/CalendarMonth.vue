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

// 한 칸에 표시할 최대 레인 수 (초과분은 +N)
const MAX_LANES = 3

interface DayLayout {
  lanes: (CalendarEvent | null)[] // 레인별 일정(빈 레인은 null → 높이 유지용 placeholder)
  hidden: number                  // 표시 못 한 일정 수 (+N)
  count: number                   // 해당 날짜 전체 일정 수
}

// 주(week) 단위로 여러 날 일정에 고정 레인을 부여 → 같은 일정이 모든 날에서 같은 줄에 위치(가로 연속 막대)
const dayLayouts = computed(() => {
  const byDate = new Map<string, CalendarEvent[]>()
  for (const ev of props.events) {
    const list = byDate.get(ev.date) || []
    list.push(ev)
    byDate.set(ev.date, list)
  }

  const isRange = (ev: CalendarEvent) => !!ev.span && ev.span !== 'single'
  const result = new Map<string, DayLayout>()
  const days = calendarDays.value

  for (let w = 0; w < 6; w++) {
    const week = days.slice(w * 7, w * 7 + 7)

    // 1) 이 주의 여러 날 세그먼트 수집 (type+id로 묶어 같은 일정의 칸 범위 파악)
    interface Seg { colStart: number; colEnd: number; perCol: Map<number, CalendarEvent>; lane: number }
    const segs = new Map<string, Seg>()
    week.forEach((d, col) => {
      for (const ev of byDate.get(d.dateStr) || []) {
        if (!isRange(ev)) continue
        const key = `${ev.type}-${ev.id}`
        let s = segs.get(key)
        if (!s) { s = { colStart: col, colEnd: col, perCol: new Map(), lane: -1 }; segs.set(key, s) }
        s.colStart = Math.min(s.colStart, col)
        s.colEnd = Math.max(s.colEnd, col)
        s.perCol.set(col, ev)
      }
    })

    // 2) 그리디 레인 배정 — 시작 칸 빠른 순, 긴 막대 우선 (겹치지 않는 최소 레인)
    const segList = [...segs.values()].sort(
      (a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart),
    )
    const laneRanges: Array<Array<[number, number]>> = []
    for (const seg of segList) {
      let lane = 0
      while (true) {
        const ranges = laneRanges[lane] || []
        const overlap = ranges.some(([s, e]) => seg.colStart <= e && seg.colEnd >= s)
        if (!overlap) {
          seg.lane = lane
          ;(laneRanges[lane] ||= []).push([seg.colStart, seg.colEnd])
          break
        }
        lane++
      }
    }

    // 3) 칸별 레인 구성: 여러 날 일정은 고정 레인에, 단일 일정은 남는 레인에 채움
    week.forEach((d, col) => {
      const dayEvents = byDate.get(d.dateStr) || []
      const lanes: (CalendarEvent | null)[] = []
      for (const seg of segList) {
        if (col < seg.colStart || col > seg.colEnd) continue
        const ev = seg.perCol.get(col)
        if (ev) lanes[seg.lane] = ev
      }
      for (const ev of dayEvents) {
        if (isRange(ev)) continue
        let idx = 0
        while (lanes[idx]) idx++
        lanes[idx] = ev
      }
      // 비어있는(여러 날 일정이 지나가는 빈) 레인은 null placeholder로 채워 높이 유지
      for (let i = 0; i < lanes.length; i++) if (lanes[i] === undefined) lanes[i] = null
      const visible = lanes.slice(0, MAX_LANES).filter(Boolean).length
      result.set(d.dateStr, { lanes, hidden: dayEvents.length - visible, count: dayEvents.length })
    })
  }
  return result
})

const emptyLayout: DayLayout = { lanes: [], hidden: 0, count: 0 }
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
        :day="d.day" :dow="d.dow"
        :lanes="(dayLayouts.get(d.dateStr) || emptyLayout).lanes.slice(0, MAX_LANES)"
        :hidden="(dayLayouts.get(d.dateStr) || emptyLayout).hidden"
        :count="(dayLayouts.get(d.dateStr) || emptyLayout).count"
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
  // 행(주) 간격은 여유 있게, 열 간격은 0 → 여러 날 막대가 칸 사이에서 끊기지 않고 가로로 이어짐
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px 0;
  will-change: transform;
}
@media (max-width: 768px) {
  .calendar-month__day-name { font-size: 11px; padding: 6px 0; }
}
</style>
