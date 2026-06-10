<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiBadge, UiBadgeGroup, UiIcon, UiEmpty } from '@leechanyong/ispark-ui'
import type { MarketEvent } from '../../types/stock'

const props = defineProps<{
  events: MarketEvent[]
}>()

const activeFilter = ref<string>('all')

const filters = [
  { key: 'all', label: '전체', variant: 'default' as const },
  { key: 'us-econ', label: '경제', variant: 'danger' as const },
  { key: 'us-earnings', label: '실적', variant: 'info' as const },
  { key: 'foreign-flow', label: '외국인', variant: 'success' as const },
  { key: 'kr-schedule', label: '한국', variant: 'warning' as const },
  { key: 'global', label: '글로벌', variant: 'primary' as const },
  { key: 'sentiment', label: '심리', variant: 'default' as const },
]

const categoryVariant: Record<string, string> = {
  'us-econ': 'danger',
  'us-earnings': 'info',
  'kr-schedule': 'warning',
  'global': 'primary',
  'foreign-flow': 'success',
  'sentiment': 'default',
}

const categoryLucideIcon: Record<string, string> = {
  'us-econ': 'landmark',
  'us-earnings': 'building-2',
  'kr-schedule': 'flag',
  'global': 'globe',
  'foreign-flow': 'bar-chart-3',
  'sentiment': 'activity',
}

const categoryColor: Record<string, string> = {
  'us-econ': '#ef5350',
  'us-earnings': '#42a5f5',
  'kr-schedule': '#ffa726',
  'global': '#ab47bc',
  'foreign-flow': '#26a69a',
  'sentiment': '#78909c',
}

const filteredEvents = computed(() => {
  let list = props.events
  if (activeFilter.value !== 'all') {
    list = list.filter(e => e.category === activeFilter.value)
  }
  return list.sort((a, b) => a.date.localeCompare(b.date))
})

const today = computed(() => new Date().toISOString().split('T')[0])

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
}

function isPast(dateStr: string) {
  return dateStr < today.value
}

function isToday(dateStr: string) {
  return dateStr === today.value
}
</script>

<template>
  <div class="market-events">
    <div class="market-events__header">
      <UiIcon name="calendar-range" :size="16" />
      <h3>일정 리스트</h3>
    </div>

    <!-- 카테고리 필터 -->
    <UiBadgeGroup :gap="6" class="market-events__filters">
      <UiBadge
        v-for="f in filters"
        :key="f.key"
        :variant="activeFilter === f.key ? f.variant : 'default'"
        size="sm"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </UiBadge>
    </UiBadgeGroup>

    <!-- 이벤트 리스트 -->
    <div v-if="filteredEvents.length > 0" class="market-events__list">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-row"
        :class="{
          'event-row--past': isPast(event.date),
          'event-row--today': isToday(event.date),
        }"
      >
        <div class="event-row__date">
          <span class="date-text">{{ formatDate(event.date) }}</span>
          <span v-if="event.time" class="time-text">{{ event.time }}</span>
        </div>
        <div class="event-row__icon">
          <UiIcon
            :name="categoryLucideIcon[event.category] || 'calendar'"
            :size="16"
            :style="{ color: categoryColor[event.category] }"
          />
        </div>
        <div class="event-row__content">
          <div class="event-row__title">
            <span>{{ event.title }}</span>
            <UiBadge
              v-if="isToday(event.date)"
              variant="warning"
              size="sm"
            >
              오늘
            </UiBadge>
          </div>
          <div v-if="event.subtitle" class="event-row__subtitle">{{ event.subtitle }}</div>
          <div v-if="event.expected || event.previous || event.actual" class="event-row__data">
            <span v-if="event.expected" class="data-tag">
              <UiIcon name="target" :size="10" /> 예상 {{ event.expected }}
            </span>
            <span v-if="event.previous" class="data-tag">
              <UiIcon name="history" :size="10" /> 이전 {{ event.previous }}
            </span>
            <span v-if="event.actual" class="data-tag data-tag--actual">
              <UiIcon name="check-circle" :size="10" /> 실제 {{ event.actual }}
            </span>
          </div>
          <div v-if="event.impact" class="event-row__impact">
            <UiIcon name="lightbulb" :size="12" color="warning" />
            {{ event.impact }}
          </div>
        </div>
        <div class="event-row__importance">
          <span
            v-for="n in event.importance"
            :key="n"
            class="dot"
            :style="{ background: categoryColor[event.category] || '#ef4444' }"
          ></span>
        </div>
      </div>
    </div>

    <UiEmpty v-else description="해당 카테고리의 일정이 없습니다" />
  </div>
</template>

<style lang="scss" scoped>
.market-events {
  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    h3 { font-size: 15px; font-weight: 700; margin: 0; }
  }

  &__filters {
    margin-bottom: 14px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
}

.filter-chip {
  cursor: pointer;
  transition: opacity 0.15s;
  &:not(.filter-chip--active) { opacity: 0.45; }
  &:hover { opacity: 0.85; }
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s;

  &:hover { background: rgba(0, 0, 0, 0.02); }

  &--past { opacity: 0.4; }

  &--today {
    background: #fffde7;
    border-left: 3px solid #ffa726;
    padding-left: 9px;
  }

  &__date {
    flex-shrink: 0;
    width: 72px;
    display: flex;
    flex-direction: column;
    gap: 1px;

    .date-text {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }
    .time-text {
      font-size: 11px;
      color: #9ca3af;
    }
  }

  &__icon {
    flex-shrink: 0;
    padding-top: 1px;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  &__subtitle {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
  }

  &__data {
    display: flex;
    gap: 8px;
    margin-top: 5px;
    flex-wrap: wrap;
  }

  &__impact {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
    margin-top: 5px;
    line-height: 1.4;
  }

  &__importance {
    flex-shrink: 0;
    display: flex;
    gap: 3px;
    padding-top: 4px;
  }
}

.data-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;

  &--actual {
    background: #dcfce7;
    color: #16a34a;
    font-weight: 600;
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
  .event-row {
    &:hover { background: rgba(255, 255, 255, 0.03); }
    &--today { background: #2a2520; border-left-color: #ffa726; }
    &__date .date-text { color: #d1d5db; }
    &__title { color: #e5e7eb; }
  }
  .data-tag {
    background: #2d2f36;
    color: #9ca3af;
    &--actual { background: #1a3a2a; color: #4ade80; }
  }
}
</style>
