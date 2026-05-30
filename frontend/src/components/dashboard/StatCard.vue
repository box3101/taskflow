<script setup lang="ts">
import { UiIcon } from '@leechanyong/ispark-ui'

defineProps<{
  icon: string
  iconBg?: string
  label: string
  value: number
  sub?: string
}>()
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__icon" :style="{ background: iconBg || '#eff3ff' }">
      <UiIcon :name="icon" :size="20" />
    </div>
    <div class="stat-card__info">
      <span class="stat-card__label">{{ label }}</span>
      <span class="stat-card__value">
        {{ value }}<span v-if="sub" class="stat-card__sub">{{ sub }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  color: #374151;
}

.stat-card__info {
  display: flex;
  flex-direction: column;
}

.stat-card__label {
  font-size: 11px;
  color: #9ca3af;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-card__sub {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 400;
}
</style>
