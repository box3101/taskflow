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
  flex-shrink: 0;
  width: 220px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #ecf0f3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.mood-widget__title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1e2124;
}

.mood-widget__options {
  display: flex;
  gap: 6px;
}

.mood-widget__emoji-btn {
  font-size: 22px;
  line-height: 1;
  padding: 4px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;

  &:hover {
    transform: scale(1.2);
    background: #ecf0f3;
  }

  &.is-selected {
    background: var(--color-primary-bg, #eff3ff);
    transform: scale(1.2);
  }
}

.mood-widget__result {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mood-widget__label {
  color: #4d5462;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.mood-widget__selected-emoji {
  font-size: 24px;
  line-height: 1;
}

.mood-widget__stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ecf0f3;
  color: #64748b;
  font-size: 11px;
  flex-wrap: wrap;
}

.mood-widget__stats-label {
  font-weight: 500;
  color: #4d5462;
}

.mood-widget__stat-item {
  white-space: nowrap;
}

@media (max-width: 640px) {
  .mood-widget {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mood-widget__title {
    margin: 0;
  }

  .mood-widget__stats {
    border-top: none;
    margin-top: 0;
    padding-top: 0;
  }
}
</style>
