<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import {
  UiButton, UiIcon, UiLoading, UiTab, openToast,
} from '@leechanyong/ispark-ui'
import { useWorkout } from '../composables/useWorkout'
import { useMeal } from '../composables/useMeal'
import CalendarMonth from '../components/calendar/CalendarMonth.vue'
import WorkoutTab from '../components/health/WorkoutTab.vue'
import MealTab from '../components/health/MealTab.vue'

// 날짜 & 월 상태
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const sideDateLabel = computed(() => {
  const [, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(selectedDate.value)
  const dayName = DAY_NAMES[dt.getDay()]
  return `${m}월 ${d}일 (${dayName})`
})

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else { currentMonth.value-- }
}

function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else { currentMonth.value++ }
}

function goToday() {
  const n = new Date()
  currentYear.value = n.getFullYear()
  currentMonth.value = n.getMonth() + 1
  selectedDate.value = formatDate(n)
}

watch([currentYear, currentMonth], () => {
  const n = new Date()
  if (currentYear.value === n.getFullYear() && currentMonth.value === n.getMonth() + 1) {
    selectedDate.value = formatDate(n)
  } else {
    selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  }
})

// 서브탭
const activeTab = ref('workout')
const tabItems = [
  { value: 'workout', label: '운동' },
  { value: 'meal', label: '식단' },
]

// Composables
const { workouts, recentWorkouts, monthHints: workoutHints, loading: workoutLoading, fetchByDate: fetchWorkouts, fetchMonthHints: fetchWorkoutHints, fetchRecent: fetchRecentWorkouts } = useWorkout()
const { meals, monthHints: mealHints, loading: mealLoading, fetchByDate: fetchMeals, fetchMonthHints: fetchMealHints } = useMeal()

// 캘린더 힌트용 이벤트 — 실제 제목 표시
const calendarHintEvents = computed(() => {
  const events: any[] = []
  for (const h of workoutHints.value) {
    events.push({ id: `w-${h.date}`, type: 'event', title: `💪 ${h.title}`, date: h.date, startTime: null, endTime: null, color: '#3b82f6', memo: null })
  }
  for (const h of mealHints.value) {
    events.push({ id: `m-${h.date}`, type: 'event', title: `🍚 ${h.title}`, date: h.date, startTime: null, endTime: null, color: '#22c55e', memo: null })
  }
  return events
})

const loading = computed(() => workoutLoading.value || mealLoading.value)

async function loadData() {
  try {
    await Promise.all([
      fetchWorkouts(selectedDate.value),
      fetchMeals(selectedDate.value),
    ])
  } catch (e: any) {
    openToast({ message: e.message || '데이터를 불러오는데 실패했습니다.', type: 'warning' })
  }
}

function currentMonthStr() {
  return `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`
}

async function loadMonthHints() {
  const month = currentMonthStr()
  await Promise.all([fetchWorkoutHints(month), fetchMealHints(month)])
}

watch(selectedDate, () => { loadData() })
watch([currentYear, currentMonth], () => { loadMonthHints() })
onMounted(() => {
  loadData()
  loadMonthHints()
  fetchRecentWorkouts()
})

async function onWorkoutSaved() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
}

async function onWorkoutDeleted() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
}

async function onMealSaved() {
  await fetchMeals(selectedDate.value)
}

async function onMealDeleted() {
  await fetchMeals(selectedDate.value)
}
</script>

<template>
  <div class="health-page">
    <UiLoading v-if="loading" overlay />

    <div class="health-page__body">
      <!-- 좌측: 월간 캘린더 -->
      <div class="health-page__grid">
        <div class="health-page__calendar-header">
          <div class="health-page__nav">
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 달" @click="prevMonth">
              <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
            </UiButton>
            <span class="health-page__month">{{ monthLabel }}</span>
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 달" @click="nextMonth">
              <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
            </UiButton>
            <UiButton class="health-page__today" variant="ghost" size="sm" @click="goToday">오늘</UiButton>
          </div>
        </div>
        <CalendarMonth
          :year="currentYear"
          :month="currentMonth"
          :events="calendarHintEvents"
          :selected-date="selectedDate"
          @select-date="selectedDate = $event"
        />
      </div>

      <!-- 우측: 사이드 패널 -->
      <div class="health-page__side">
        <div class="health-page__side-date">{{ sideDateLabel }}</div>
        <UiTab v-model="activeTab" :tabs="tabItems" />
        <div class="health-page__content">
          <WorkoutTab
            v-if="activeTab === 'workout'"
            :workouts="workouts"
            :recent-workouts="recentWorkouts"
            :loading="workoutLoading"
            :selected-date="selectedDate"
            @saved="onWorkoutSaved"
            @deleted="onWorkoutDeleted"
          />
          <MealTab
            v-if="activeTab === 'meal'"
            :meals="meals"
            :loading="mealLoading"
            :selected-date="selectedDate"
            @saved="onMealSaved"
            @deleted="onMealDeleted"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.health-page { max-width: 1100px; margin: 0 auto; position: relative; }

.health-page__body { display: flex; gap: 24px; align-items: flex-start; }
.health-page__grid { flex: 1; min-width: 0; }

.health-page__calendar-header {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px; gap: 12px;
}
.health-page__nav {
  display: flex; align-items: center; gap: 8px;
  :deep(.ui-button) { min-width: 36px; min-height: 36px; }
}
.health-page__month {
  font-size: 18px; font-weight: 700; color: #1f2937;
  min-width: 120px; text-align: center;
}

.health-page__side {
  flex-shrink: 0; width: 360px; position: sticky; top: 80px;
  max-height: calc(100vh - 140px); overflow-y: auto;
  background: #fff; border-radius: 12px; border: 1px solid #f3f4f6; padding: 16px;
}
.health-page__side-date { font-size: 17px; font-weight: 700; color: #1f2937; margin-bottom: 12px; }
.health-page__content { padding: 12px 0 0; }

@media (max-width: 1024px) {
  .health-page__body { flex-direction: column; gap: 0; }
  .health-page__side {
    width: 100%; position: static; max-height: none;
    background: none; border: none; border-radius: 0; padding: 0; margin-top: 16px;
  }
}
@media (max-width: 768px) {
  .health-page__calendar-header { gap: 8px; }
  .health-page__nav { gap: 4px; }
  .health-page__today { display: none !important; }
  .health-page__month { font-size: 16px; min-width: 100px; }
}
</style>
