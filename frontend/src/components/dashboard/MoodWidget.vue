<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { UiIcon, UiDrawer, openToast } from '@leechanyong/ispark-ui'
import { useMood, MOOD_EMOJIS, MOOD_LABELS } from '../../composables/useMood'

const { moods, todayMood, totalDays, currentMonth, fetchMonth, saveMood, loading } = useMood()
const showMemo = ref(false)
const editingMemo = ref(false)
const showDrawer = ref(false)
const memo = ref('')
const moodOptions = [1, 2, 3, 4, 5] as const

const monthLabel = (() => {
  const m = parseInt(currentMonth.slice(5, 7), 10)
  return `${m}월`
})()

// 오늘 메모가 있으면 view 모드로 표시
watch(todayMood, (v) => {
  if (v?.memo) {
    memo.value = v.memo
    showMemo.value = true
    editingMemo.value = false
  }
}, { immediate: true })

function sortedMoods() {
  return [...moods.value].sort((a, b) => b.date.localeCompare(a.date))
}

function formatDate(date: string) {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()} (${['일','월','화','수','목','금','토'][d.getDay()]})`
}

async function onSelect(mood: 1 | 2 | 3 | 4 | 5) {
  try {
    await saveMood(mood, memo.value)
  } catch {
    openToast({ message: '기분 저장에 실패했습니다.', type: 'warning' })
  }
}

function toggleMemo() {
  if (showMemo.value && !editingMemo.value) {
    // view 모드에서 토글 → 닫기
    showMemo.value = false
  } else if (showMemo.value && editingMemo.value) {
    // edit 모드에서 토글 → 닫기
    showMemo.value = false
    editingMemo.value = false
  } else {
    // 닫힌 상태 → 열기 (edit 모드)
    showMemo.value = true
    editingMemo.value = true
  }
}

async function saveMemo() {
  if (!todayMood.value) return
  editingMemo.value = false
  try {
    await saveMood(todayMood.value.mood, memo.value)
  } catch {
    openToast({ message: '메모 저장에 실패했습니다.', type: 'warning' })
  }
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
    <div class="mood-widget__header">
      <h3 class="mood-widget__title">오늘 하루 어땠나요?</h3>
      <button v-if="totalDays > 0" class="mood-widget__history" @click="showDrawer = true">기록 보기</button>
    </div>
    <div class="mood-widget__selector">
      <button
        v-for="mood in moodOptions"
        :key="mood"
        class="mood-btn"
        :class="{ 'is-selected': todayMood?.mood === mood }"
        :aria-label="`기분: ${MOOD_LABELS[mood]}`"
        @click="onSelect(mood)"
      >
        <span class="mood-btn__emoji">{{ MOOD_EMOJIS[mood] }}</span>
        <span class="mood-btn__label">{{ MOOD_LABELS[mood] }}</span>
      </button>
      <button class="mood-memo-toggle" :class="{ 'is-active': showMemo }" aria-label="메모 작성" @click="toggleMemo">
        <UiIcon name="edit" :size="14" />
      </button>
    </div>
    <div v-if="showMemo" class="mood-widget__memo">
      <!-- view 모드: 텍스트 클릭 → edit -->
      <p v-if="!editingMemo && memo" class="mood-widget__memo-view" @click="editingMemo = true">{{ memo }}</p>
      <!-- edit 모드: input -->
      <input
        v-else
        v-model="memo"
        type="text"
        placeholder="오늘 하루를 한마디로..."
        maxlength="200"
        @blur="saveMemo"
        @keyup.enter="saveMemo"
      />
    </div>
  </div>

  <!-- 기분 기록 Drawer -->
  <UiDrawer v-model:open="showDrawer" title="기분 기록" size="sm">
    <div class="mood-drawer">
      <div class="mood-drawer__summary">
        <span class="mood-drawer__month">{{ monthLabel }} 기록</span>
        <span class="mood-drawer__total">{{ totalDays }}일</span>
      </div>
      <div class="mood-drawer__list">
        <div v-for="entry in sortedMoods()" :key="entry.id" class="mood-drawer__item">
          <span class="mood-drawer__item-emoji">{{ MOOD_EMOJIS[entry.mood] }}</span>
          <div class="mood-drawer__item-content">
            <div class="mood-drawer__item-top">
              <span class="mood-drawer__item-label">{{ MOOD_LABELS[entry.mood] }}</span>
              <span class="mood-drawer__item-date">{{ formatDate(entry.date) }}</span>
            </div>
            <p v-if="entry.memo" class="mood-drawer__item-memo">{{ entry.memo }}</p>
          </div>
        </div>
      </div>
      <div v-if="moods.length === 0" class="mood-drawer__empty">아직 기록이 없어요</div>
    </div>
  </UiDrawer>
</template>

<style scoped>
.mood-widget {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #ecf0f3;
  border-radius: 12px;
  overflow: hidden;
}

.mood-widget__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 8px;
}
.mood-widget__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e2124;
}
.mood-widget__history {
  font-size: 11px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.mood-widget__history:hover { color: var(--color-primary, #3c69db); }

/* 이모지 선택 */
.mood-widget__selector {
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 0 16px 10px;
}
.mood-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  min-width: 46px;
  transition: background 0.15s;
}
.mood-btn:hover { background: #f4f5f7; }
.mood-btn.is-selected { background: #fff3ed; }
.mood-btn.is-selected .mood-btn__label { color: #d97757; font-weight: 600; }
.mood-btn__emoji { font-size: 22px; line-height: 1; }
.mood-btn__label { font-size: 11px; color: #9ca3af; font-weight: 500; }

/* 메모 토글 */
.mood-memo-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.15s, background 0.15s;
  align-self: center;
}
.mood-memo-toggle:hover { opacity: 0.7; background: #f4f5f7; }
.mood-memo-toggle.is-active { opacity: 1; background: #fff3ed; }

/* 메모 — 한 줄 input */
.mood-widget__memo { padding: 0 16px 10px; }
.mood-widget__memo input {
  width: 100%;
  height: 32px;
  border: 1px solid #ecf0f3;
  border-radius: 6px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  color: #374151;
  outline: none;
  transition: border-color 0.15s;
}
.mood-widget__memo input:focus { border-color: var(--color-primary, #3c69db); }
.mood-widget__memo input::placeholder { color: #c5cbd6; }
.mood-widget__memo-view {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  padding: 0 2px;
  cursor: pointer;
  line-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mood-widget__memo-view:hover { color: #374151; }

/* ═══ Drawer ═══ */
.mood-drawer { padding: 8px 0; }
.mood-drawer__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 12px;
  border-bottom: 1px solid #ecf0f3;
  margin-bottom: 4px;
}
.mood-drawer__month { font-size: 14px; font-weight: 600; color: #1e2124; }
.mood-drawer__total { font-size: 13px; color: #9ca3af; }

.mood-drawer__list { display: flex; flex-direction: column; }
.mood-drawer__item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f4f5f7;
}
.mood-drawer__item:last-child { border-bottom: none; }
.mood-drawer__item-emoji { font-size: 24px; line-height: 1; flex-shrink: 0; margin-top: 2px; }
.mood-drawer__item-content { flex: 1; min-width: 0; }
.mood-drawer__item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.mood-drawer__item-label { font-size: 14px; font-weight: 600; color: #1e2124; }
.mood-drawer__item-date { font-size: 12px; color: #9ca3af; }
.mood-drawer__item-memo { margin: 4px 0 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
.mood-drawer__empty { text-align: center; padding: 40px 0; font-size: 14px; color: #c5cbd6; }

@media (max-width: 640px) {
  .mood-widget { width: 100%; }
}
</style>
