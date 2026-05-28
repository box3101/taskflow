<script setup lang="ts">
import { UiBadge } from '@leechanyong/ispark-ui'

export interface SkillLevel {
  id: number
  order: number
  title: string
  description: string
  icon: string
  status: 'locked' | 'in_progress' | 'completed'
  score: number | null
  completedAt: string | null
}

defineProps<{
  level: SkillLevel
}>()

defineEmits<{ click: [] }>()

const statusConfig = {
  locked: { label: '🔒 잠금', variant: 'default' as const },
  in_progress: { label: '🔄 진행중', variant: 'warning' as const },
  completed: { label: '✅ 완료', variant: 'success' as const },
}
</script>

<template>
  <div
    class="skill-card"
    :class="[`skill-card--${level.status}`]"
    @click="$emit('click')"
  >
    <div class="skill-card__level">Lv.{{ level.order }}</div>
    <div class="skill-card__icon">{{ level.icon }}</div>
    <h3 class="skill-card__title">{{ level.title }}</h3>
    <p class="skill-card__desc">{{ level.description }}</p>
    <div class="skill-card__footer">
      <UiBadge :variant="statusConfig[level.status].variant" size="sm">
        {{ statusConfig[level.status].label }}
      </UiBadge>
      <UiBadge v-if="level.score !== null" variant="info" size="sm">
        {{ level.score }}점
      </UiBadge>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skill-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
    transform: translateY(-2px);
  }

  &--locked {
    opacity: 0.5;
    &:hover { opacity: 0.7; }
  }

  &--completed {
    border-color: #86efac;
    background: #f0fdf4;
  }

  &--in_progress {
    border-color: #fbbf24;
    background: #fffbeb;
  }

  &__level {
    font-size: 11px;
    font-weight: 700;
    color: #3b82f6;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  &__icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 6px;
  }

  &__desc {
    font-size: 13px;
    color: #6b7280;
    margin: 0 0 12px;
    line-height: 1.4;
  }

  &__footer {
    display: flex;
    gap: 6px;
    align-items: center;
  }
}
</style>
