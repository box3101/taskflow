<script setup lang="ts">
import { computed } from 'vue'
import { UiIcon } from '@leechanyong/ispark-ui'
import type { FearGreedData } from '../../api/stockApi'

const props = defineProps<{
  fearGreed: FearGreedData
  foreignNet?: number | null
  vix?: string | null
}>()

const fgColor = computed(() => {
  const v = props.fearGreed.value
  if (v === null) return '#9ca3af'
  if (v <= 25) return '#3b82f6'
  if (v <= 45) return '#60a5fa'
  if (v <= 55) return '#9ca3af'
  if (v <= 75) return '#f97316'
  return '#ef4444'
})

const fgLabel = computed(() => {
  const v = props.fearGreed.value
  if (v === null) return 'N/A'
  if (v <= 25) return '극단공포'
  if (v <= 45) return '공포'
  if (v <= 55) return '중립'
  if (v <= 75) return '탐욕'
  return '극단탐욕'
})

const foreignColor = computed(() => {
  if (props.foreignNet == null) return '#9ca3af'
  return props.foreignNet >= 0 ? '#ef4444' : '#3b82f6'
})

function formatForeign(val: number | null | undefined) {
  if (val == null) return '-'
  const abs = Math.abs(val)
  const prefix = val >= 0 ? '+' : '-'
  if (abs >= 10000) return `${prefix}${(abs / 10000).toFixed(1)}조`
  return `${prefix}${abs.toLocaleString()}억`
}
</script>

<template>
  <div class="sentiment-bar">
    <div class="sentiment-item">
      <div class="sentiment-item__icon">
        <UiIcon name="heart-pulse" :size="16" color="danger" />
      </div>
      <span class="sentiment-item__label">공포탐욕</span>
      <span class="sentiment-item__value" :style="{ color: fgColor }">
        {{ fearGreed.value ?? '-' }}
      </span>
      <span class="sentiment-item__sub" :style="{ color: fgColor }">{{ fgLabel }}</span>
    </div>

    <div class="sentiment-divider"></div>

    <div class="sentiment-item">
      <div class="sentiment-item__icon">
        <UiIcon name="activity" :size="16" color="warning" />
      </div>
      <span class="sentiment-item__label">VIX</span>
      <span class="sentiment-item__value">{{ vix || '-' }}</span>
      <span class="sentiment-item__sub">변동성지수</span>
    </div>

    <div class="sentiment-divider"></div>

    <div class="sentiment-item">
      <div class="sentiment-item__icon">
        <UiIcon name="users" :size="16" color="primary" />
      </div>
      <span class="sentiment-item__label">외국인 순매수</span>
      <span class="sentiment-item__value" :style="{ color: foreignColor }">
        {{ formatForeign(foreignNet) }}
      </span>
      <span class="sentiment-item__sub">KOSPI 당일</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sentiment-bar {
  display: flex;
  align-items: stretch;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 16px 12px;
  margin-bottom: 20px;
  gap: 0;
}

.sentiment-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;

  &__icon {
    margin-bottom: 4px;
  }

  &__label {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
  }

  &__value {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.2;
    color: #1f2937;
  }

  &__sub {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 1px;
  }
}

.sentiment-divider {
  width: 1px;
  background: #e6e8ec;
  margin: 0 4px;
  align-self: stretch;
}

// 다크모드
[data-theme="dark"] {
  .sentiment-bar {
    background: #1e2028;
    border-color: #2d2f36;
  }
  .sentiment-divider { background: #2d2f36; }
  .sentiment-item__value { color: #e5e7eb; }
}
</style>
