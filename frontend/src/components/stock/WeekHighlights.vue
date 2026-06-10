<script setup lang="ts">
import { computed } from 'vue'
import { UiIcon } from '@leechanyong/ispark-ui'
import type { MarketEvent } from '../../types/stock'

const props = defineProps<{
  events: MarketEvent[]
}>()

// 이번 주 중요 이벤트 (importance >= 2)
const weekEvents = computed(() => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return props.events
    .filter(e => {
      const d = new Date(e.date)
      return d >= monday && d <= sunday && e.importance >= 2
    })
    .sort((a, b) => a.date.localeCompare(b.date))
})

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function isPast(dateStr: string) {
  return dateStr < new Date().toISOString().split('T')[0]
}
</script>

<template>
  <div class="week-highlights" v-if="weekEvents.length > 0">
    <div class="week-highlights__header">
      <UiIcon name="zap" :size="16" color="warning" />
      <h3>이번 주 핵심 일정</h3>
    </div>
    <div class="week-highlights__scroll">
      <div
        v-for="event in weekEvents"
        :key="event.id"
        class="highlight-card"
        :class="{
          'highlight-card--today': isToday(event.date),
          'highlight-card--past': isPast(event.date),
        }"
        :style="{ borderColor: categoryColor[event.category] || '#9ca3af' }"
      >
        <span class="highlight-card__date">{{ formatDate(event.date) }}</span>
        <span class="highlight-card__title">
          <UiIcon
            :name="categoryLucideIcon[event.category] || 'calendar'"
            :size="14"
            :style="{ color: categoryColor[event.category] }"
          />
          {{ event.title }}
        </span>
        <span v-if="event.expected" class="highlight-card__expected">
          {{ event.expected }}
        </span>
        <span class="highlight-card__dots">
          <span v-for="n in event.importance" :key="n" class="dot" :style="{ background: categoryColor[event.category] || '#ef4444' }"></span>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.week-highlights {
  margin-bottom: 16px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    h3 { font-size: 15px; font-weight: 700; margin: 0; }
  }

  &__scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
    padding-right: 16px; // 마지막 카드 잘림 방지
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar { height: 3px; }
    &::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

    // 우측 여백 확보 (스크롤 끝)
    &::after {
      content: '';
      flex-shrink: 0;
      width: 1px;
    }
  }
}

.highlight-card {
  flex-shrink: 0;
  min-width: 150px;
  max-width: 180px;
  padding: 10px 12px;
  border-radius: 10px;
  border-left: 3px solid #9ca3af;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.15s;

  &:hover { transform: translateY(-2px); }

  &--today {
    background: #fffde7;
    box-shadow: 0 2px 8px rgba(255, 167, 38, 0.15);
  }

  &--past {
    opacity: 0.45;
  }

  &__date {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
  }

  &__expected {
    font-size: 11px;
    color: #6b7280;
  }

  &__dots {
    display: flex;
    gap: 3px;
    margin-top: 2px;
  }
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
}

// 다크모드
[data-theme="dark"] {
  .highlight-card {
    background: #1e2028;
    &--today { background: #2a2520; }
    &__title { color: #e5e7eb; }
    &__date { color: #6b7280; }
    &__expected { color: #9ca3af; }
  }
}
</style>
