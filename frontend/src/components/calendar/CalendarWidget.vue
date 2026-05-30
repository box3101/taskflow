<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiLoading, UiEmpty, UiIcon, openToast } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { CalendarEvent } from '../../types/calendar'

const router = useRouter()
const loading = ref(true)
const events = ref<CalendarEvent[]>([])
const tomorrowCount = ref(0)

const typeBadge: Record<string, { label: string; bg: string; color: string }> = {
  event: { label: '일정', bg: '#dbeafe', color: '#3b82f6' },
  todo: { label: 'Todo', bg: '#fee2e2', color: '#ef4444' },
  issue: { label: 'Issue', bg: '#dcfce7', color: '#22c55e' },
}

const todayEvents = computed(() => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return events.value.filter(ev => ev.date === todayStr)
})

function formatTime(ev: CalendarEvent): string {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`
  if (ev.startTime) return ev.startTime
  if (ev.type !== 'event') return '마감 오늘'
  return '종일'
}

onMounted(async () => {
  try {
    const now = new Date()
    const { data } = await api.get('/calendar', {
      params: { year: now.getFullYear(), month: now.getMonth() + 1 },
    })
    events.value = data.data
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    tomorrowCount.value = data.data.filter((ev: CalendarEvent) => ev.date === tomorrowStr).length
  } catch {
    openToast({ message: '일정을 불러오는데 실패했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="calendar-widget">
    <div class="calendar-widget__header">
      <span class="calendar-widget__title">
        <UiIcon name="calendar" :size="16" />
        오늘의 일정
      </span>
      <button class="calendar-widget__link" @click="router.push('/calendar')">전체보기 →</button>
    </div>
    <UiLoading v-if="loading" overlay />
    <template v-else>
      <UiEmpty v-if="todayEvents.length === 0" icon="calendar" title="오늘 일정이 없습니다" />
      <div v-else class="calendar-widget__list">
        <div v-for="ev in todayEvents" :key="`${ev.type}-${ev.id}`" class="calendar-widget__item" :style="{ borderLeftColor: ev.color }">
          <div class="calendar-widget__item-content">
            <div class="calendar-widget__item-title">{{ ev.title }}</div>
            <div class="calendar-widget__item-time">{{ formatTime(ev) }}</div>
          </div>
          <span class="calendar-widget__item-badge" :style="{ background: typeBadge[ev.type].bg, color: typeBadge[ev.type].color }">
            {{ typeBadge[ev.type].label }}
          </span>
        </div>
      </div>
      <div v-if="tomorrowCount > 0" class="calendar-widget__tomorrow">내일 {{ tomorrowCount }}건의 일정이 있습니다</div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.calendar-widget { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #e6e8ec; position: relative; }
.calendar-widget__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.calendar-widget__title { font-size: 14px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 6px; }
.calendar-widget__link { font-size: 12px; color: #3b82f6; background: none; border: none; cursor: pointer; &:hover { text-decoration: underline; } }
.calendar-widget__list { display: flex; flex-direction: column; gap: 8px; }
.calendar-widget__item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f9fafb; border-radius: 8px; border-left: 3px solid; }
.calendar-widget__item-content { flex: 1; min-width: 0; }
.calendar-widget__item-title { font-size: 13px; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.calendar-widget__item-time { font-size: 11px; color: #6b7280; margin-top: 2px; }
.calendar-widget__item-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.calendar-widget__tomorrow { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 8px; }
</style>
