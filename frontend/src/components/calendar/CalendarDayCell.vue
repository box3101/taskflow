<script setup lang="ts">
import type { CalendarEvent } from '../../types/calendar'

const props = defineProps<{
  day: number
  dow: number // 0=일, 6=토
  lanes: (CalendarEvent | null)[] // 레인별 일정 (null = 여러 날 일정이 지나가는 빈 자리)
  hidden: number                  // 표시 못 한 일정 수 (+N)
  count: number                   // 전체 일정 수
  isToday: boolean
  isSelected: boolean
  isOtherMonth: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

// 다일(범위) 항목 여부
function isRange(ev: CalendarEvent): boolean {
  return !!ev.span && ev.span !== 'single'
}

// 막대 스타일: 범위는 색 채운 막대(흰 글씨), 단일은 기존 좌측 보더
function hintStyle(ev: CalendarEvent) {
  if (isRange(ev)) return { background: ev.color, color: '#fff', borderLeftColor: 'transparent' }
  return { borderLeftColor: ev.color }
}

function hintClass(ev: CalendarEvent) {
  if (!isRange(ev)) return 'day-cell__hint--single'
  return ['day-cell__hint--range', `day-cell__hint--${ev.span}`]
}

// 제목은 시작일·단일, 또는 주 시작(일요일=연속 막대 이어받는 칸)에만 표시
function showTitle(ev: CalendarEvent): boolean {
  if (!isRange(ev)) return true
  return ev.span === 'start' || props.dow === 0
}
</script>

<template>
  <button
    class="day-cell"
    :class="{
      'day-cell--today': isToday,
      'day-cell--selected': isSelected,
      'day-cell--other': isOtherMonth,
      'day-cell--sunday': dow === 0,
      'day-cell--saturday': dow === 6,
    }"
    role="gridcell"
    :aria-label="`${day}일${count ? `, 일정 ${count}건` : ''}`"
    @click="emit('select')"
  >
    <span class="day-cell__number">{{ day }}</span>
    <div v-if="count" class="day-cell__hints">
      <template v-for="(ev, i) in lanes" :key="i">
        <div
          v-if="ev"
          class="day-cell__hint"
          :class="hintClass(ev)"
          :style="hintStyle(ev)"
        >
          <span v-if="showTitle(ev)" class="day-cell__hint-title">{{ ev.title }}</span>
        </div>
        <!-- 여러 날 일정이 지나가는 빈 레인: 높이만 유지 -->
        <div v-else class="day-cell__hint day-cell__hint--empty"></div>
      </template>
      <span v-if="hidden > 0" class="day-cell__more">
        +{{ hidden }}
      </span>
    </div>
  </button>
</template>

<style scoped lang="scss">
.day-cell {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 2px 10px; min-height: 72px; border: none; background: none;
  border-radius: 8px; cursor: pointer; transition: background 0.15s;
  overflow: hidden; min-width: 0;
  &:hover { background: #f9fafb; }
  &--selected { background: #eff6ff; }
  &--other {
    opacity: 0.4;
  }
  &--sunday .day-cell__number { color: #ef4444; }
  &--saturday .day-cell__number { color: #3b82f6; }
  &--other.day-cell--sunday .day-cell__number,
  &--other.day-cell--saturday .day-cell__number { color: inherit; }
  // today는 마지막에 → 토요일/일요일 색상보다 우선
  &--today .day-cell__number {
    background: #3b82f6; color: #fff !important; border-radius: 50%;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  }
}
.day-cell__number { font-size: 13px; font-weight: 500; color: #374151; line-height: 1; }
.day-cell__hints {
  display: flex; flex-direction: column; gap: 3px;
  width: 100%; padding: 0 2px; margin-top: 2px;
  min-width: 0; overflow: visible;
}
.day-cell__hint {
  display: flex; align-items: center; min-width: 0;
  min-height: 15px; box-sizing: border-box;
  border-left: 3px solid #3b82f6; padding: 1px 3px;
  border-radius: 0 2px 2px 0; background: rgba(0, 0, 0, 0.03);
}
// 여러 날 일정이 지나가는 빈 레인 — 높이만 유지(투명)
.day-cell__hint--empty {
  border-left: none; background: transparent;
}
.day-cell__hint-title {
  font-size: 10px; color: #4b5563; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  min-width: 0;
}
// 다일(범위) 막대 — 칸 좌우 끝까지 채워 가로로 이어지게 (양끝만 둥글게)
.day-cell__hint--range {
  border-left: none; padding: 1px 4px; border-radius: 0;
  margin: 0 -4px; // 칸 경계까지 full-bleed → 옆 칸 막대와 연결
  .day-cell__hint-title { color: #fff; font-weight: 500; }
}
.day-cell__hint--start { border-radius: 3px 0 0 3px; }
.day-cell__hint--end { border-radius: 0 3px 3px 0; }
.day-cell__hint--single { border-radius: 0 2px 2px 0; }
.day-cell__more { font-size: 9px; color: #9ca3af; line-height: 1; text-align: left; padding-left: 6px; margin-top: 1px; }
@media (max-width: 768px) {
  .day-cell { min-height: 60px; padding: 4px 1px 8px; }
  .day-cell__number { font-size: 11px; }
  .day-cell__hint { padding: 0 2px; border-left-width: 2px; }
  .day-cell__hint-title { font-size: 9px; line-height: 1.4; }
  .day-cell__hints { padding: 0 1px; }
}
</style>
