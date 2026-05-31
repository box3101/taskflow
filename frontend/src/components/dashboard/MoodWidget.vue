<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiButton, openToast } from '@leechanyong/ispark-ui'
import { useMood, MOOD_EMOJIS } from '../../composables/useMood'

const { todayMood, monthStats, currentMonth, fetchMonth, saveMood, loading } = useMood()
const isEditing = ref(false)
const moodOptions = [5, 4, 3, 2, 1] as const

const monthLabel = (() => {
  const m = parseInt(currentMonth.slice(5, 7), 10)
  return `${m}월`
})()

async function onSelect(mood: 1 | 2 | 3 | 4 | 5) {
  try {
    await saveMood(mood)
    isEditing.value = false
  } catch {
    openToast({ message: '기분 저장에 실패했습니다.', type: 'warning' })
  }
}

function onEdit() {
  isEditing.value = true
}

onMounted(async () => {
  try {
    await fetchMonth()
  } catch {
    openToast({ message: '기분 데이터를 불러올 수 없습니다.', type: 'warning' })
  }
})
</script>

<template>
  <div class="mood-widget">
    <template v-if="!todayMood || isEditing">
      <p class="mood-widget__title">오늘 기분 어때?</p>
      <div class="mood-widget__options">
        <button
          v-for="mood in moodOptions"
          :key="mood"
          class="mood-widget__emoji-btn"
          :class="{ 'is-selected': todayMood?.mood === mood }"
          :aria-label="MOOD_EMOJIS[mood]"
          @click="onSelect(mood)"
        >
          {{ MOOD_EMOJIS[mood] }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="mood-widget__result">
        <span class="mood-widget__label">오늘의 기분</span>
        <span class="mood-widget__selected-emoji">{{ MOOD_EMOJIS[todayMood.mood] }}</span>
        <UiButton variant="ghost" size="sm" @click="onEdit">변경</UiButton>
      </div>
    </template>

    <div v-if="Object.keys(monthStats).length > 0" class="mood-widget__stats">
      <span class="mood-widget__stats-label">{{ monthLabel }}:</span>
      <template v-for="mood in moodOptions" :key="mood">
        <span v-if="monthStats[mood]" class="mood-widget__stat-item">
          {{ MOOD_EMOJIS[mood] }} {{ monthStats[mood] }}일
        </span>
      </template>
    </div>
    <div v-else-if="!loading" class="mood-widget__stats">
      <span class="mood-widget__stats-label">{{ monthLabel }}: 기록 없음</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mood-widget {
  background: $color-bg-elevated;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  border: 1px solid $color-border-light;
}

.mood-widget__title {
  margin: 0 0 $spacing-md;
  font-weight: $font-weight-semibold;
  color: $color-text-heading;
}

.mood-widget__options {
  display: flex;
  gap: $spacing-md;
}

.mood-widget__emoji-btn {
  font-size: 28px;
  line-height: 1;
  padding: $spacing-sm;
  border: none;
  background: none;
  border-radius: $border-radius-base;
  cursor: pointer;
  transition: transform $transition-fast, background $transition-fast;

  &:hover {
    transform: scale(1.2);
    background: $color-border-light;
  }

  &.is-selected {
    background: var(--color-primary-bg);
    transform: scale(1.2);
  }
}

.mood-widget__result {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.mood-widget__label {
  color: $color-text-primary;
  font-weight: $font-weight-medium;
}

.mood-widget__selected-emoji {
  font-size: 28px;
  line-height: 1;
}

.mood-widget__stats {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1px solid $color-border-light;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  flex-wrap: wrap;
}

.mood-widget__stats-label {
  font-weight: $font-weight-medium;
  color: $color-text-primary;
}

.mood-widget__stat-item {
  white-space: nowrap;
}
</style>
