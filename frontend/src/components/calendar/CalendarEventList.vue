<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiIcon } from '@leechanyong/ispark-ui'
import type { CalendarEvent } from '../../types/calendar'

const props = defineProps<{
  date: string
  events: CalendarEvent[]
}>()

const emit = defineEmits<{
  add: []
  editEvent: [event: CalendarEvent]
  openTodo: [event: CalendarEvent]
  openIssue: [event: CalendarEvent]
}>()

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const formattedDate = computed(() => {
  const d = new Date(props.date + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`
})

const typeLabel = {
  event: '일정',
  todo: '할일',
  issue: '이슈',
}

function onClickEvent(ev: CalendarEvent) {
  if (ev.type === 'event') emit('editEvent', ev)
  else if (ev.type === 'todo') emit('openTodo', ev)
  else if (ev.type === 'issue') emit('openIssue', ev)
}

function formatTime(ev: CalendarEvent): string {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`
  if (ev.startTime) return ev.startTime
  if (ev.type !== 'event') return '마감일'
  return '종일'
}
</script>

<template>
  <div class="event-list">
    <div class="event-list__header">
      <div class="event-list__header-left">
        <span class="event-list__date">{{ formattedDate }}</span>
        <span v-if="events.length > 0" class="event-list__count">{{ events.length }}건</span>
      </div>
      <UiButton size="sm" variant="outline" @click="emit('add')">
        <UiIcon name="plus" :size="14" />
        이 날짜에 추가
      </UiButton>
    </div>
    <div v-if="events.length === 0" class="event-list__empty">이 날짜에 일정이 없습니다</div>
    <div v-else class="event-list__items">
      <button v-for="ev in events" :key="`${ev.type}-${ev.id}`" class="event-item"
        :style="{ borderLeftColor: ev.color }" @click="onClickEvent(ev)">
        <div class="event-item__content">
          <div class="event-item__title">{{ ev.title }}</div>
          <div class="event-item__meta">
            <span>{{ formatTime(ev) }}</span>
            <span v-if="ev.location"> · {{ ev.location }}</span>
            <span v-if="ev.projectName"> · {{ ev.projectName }}</span>
          </div>
        </div>
        <span class="event-item__type" :style="{ color: ev.color }">{{ typeLabel[ev.type] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.event-list { border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 8px; }
.event-list__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
  position: sticky; top: 0; background: #fff; padding-bottom: 4px;
}
.event-list__header-left {
  display: flex; align-items: center; gap: 8px;
}
.event-list__date { font-size: 14px; font-weight: 700; color: #1f2937; }
.event-list__count { font-size: 12px; color: #9ca3af; }
.event-list__empty { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; }
.event-list__items { display: flex; flex-direction: column; gap: 6px; }
.event-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: #f9fafb; border: none; border-left: 3px solid; border-radius: 8px;
  cursor: pointer; text-align: left; width: 100%; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.event-item__content { flex: 1; min-width: 0; }
.event-item__title { font-size: 13px; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-item__meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
.event-item__type { font-size: 11px; white-space: nowrap; flex-shrink: 0; font-weight: 500; }
@media (max-width: 768px) { .event-item { padding: 8px 10px; } }
</style>
