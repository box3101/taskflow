<script setup lang="ts">
import type { CalendarEvent } from '../../types/calendar'

const props = defineProps<{
  day: number
  events: CalendarEvent[]
  isToday: boolean
  isSelected: boolean
  isOtherMonth: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

const maxDots = 3
</script>

<template>
  <button
    class="day-cell"
    :class="{
      'day-cell--today': isToday,
      'day-cell--selected': isSelected,
      'day-cell--other': isOtherMonth,
    }"
    role="gridcell"
    :aria-label="`${day}일${events.length ? `, 일정 ${events.length}건` : ''}`"
    @click="emit('select')"
  >
    <span class="day-cell__number">{{ day }}</span>
    <div v-if="events.length" class="day-cell__dots">
      <span
        v-for="(ev, i) in events.slice(0, maxDots)"
        :key="i"
        class="day-cell__dot"
        :style="{ backgroundColor: ev.color }"
      />
      <span v-if="events.length > maxDots" class="day-cell__more">
        +{{ events.length - maxDots }}
      </span>
    </div>
  </button>
</template>

<style scoped lang="scss">
.day-cell {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 4px; min-height: 56px; border: none; background: none;
  border-radius: 8px; cursor: pointer; transition: background 0.15s;
  &:hover { background: #f9fafb; }
  &--today .day-cell__number {
    background: #3b82f6; color: #fff; border-radius: 50%;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  }
  &--selected { background: #eff6ff; }
  &--other { .day-cell__number { color: #d1d5db; } }
}
.day-cell__number { font-size: 13px; font-weight: 500; color: #374151; line-height: 1; }
.day-cell__dots { display: flex; gap: 2px; align-items: center; }
.day-cell__dot { width: 6px; height: 6px; border-radius: 50%; }
.day-cell__more { font-size: 9px; color: #9ca3af; line-height: 1; }
@media (max-width: 768px) {
  .day-cell { min-height: 44px; padding: 6px 2px; }
  .day-cell__number { font-size: 11px; }
  .day-cell__dot { width: 4px; height: 4px; }
}
</style>
