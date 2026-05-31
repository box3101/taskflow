<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiButton, UiIcon, UiLoading, UiTab, UiConfirm, UiToast,
  UiDropdownMenu, openToast,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import { useWorkout } from '../composables/useWorkout'
import { useMeal } from '../composables/useMeal'
import CalendarMonth from '../components/calendar/CalendarMonth.vue'
import WorkoutTab from '../components/health/WorkoutTab.vue'
import MealTab from '../components/health/MealTab.vue'

const router = useRouter()
const auth = useAuthStore()

// 사이드 메뉴 + 네비게이션
const menuOpen = ref(false)
const menuItems = [
  { label: '캘린더', value: 'calendar', icon: 'calendar' },
  { label: 'AI Tools', value: 'ai-tools', icon: 'bot' },
  { label: '프로젝트', value: 'projects', icon: 'folder' },
  { label: '개인할일', value: 'todos', icon: 'check-square' },
  { label: '건강', value: 'health', icon: 'heart-pulse' },
  { label: '주식', value: 'stock', icon: 'trending-up' },
]

function onMenuSelect(value: string) {
  menuOpen.value = false
  if (value === 'calendar') { router.push('/calendar'); return }
  if (value === 'health') { return }
  router.push(`/main?tab=${value}`)
}

const userMenuItems: DropdownMenuItemDef[] = [
  { value: 'logout', label: '로그아웃', icon: 'icon-arrow-right', color: 'danger' },
]

function onUserMenuSelect(value: string) {
  if (value === 'logout') { auth.logout(); router.push('/login') }
}

// 날짜 & 월 상태
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

// 사이드 패널 날짜 라벨 ("6월 1일 (월)")
const sideDateLabel = computed(() => {
  const [, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(selectedDate.value)
  const dayName = DAY_NAMES[dt.getDay()]
  return `${m}월 ${d}일 (${dayName})`
})

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 월 네비게이션
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

// 월 변경 시 selectedDate 조정
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
const { workouts, recentWorkouts, hintDates: workoutHintDates, loading: workoutLoading, fetchByDate: fetchWorkouts, fetchMonthHints: fetchWorkoutHints, fetchRecent: fetchRecentWorkouts } = useWorkout()
const { meals, hintDates: mealHintDates, loading: mealLoading, fetchByDate: fetchMeals, fetchMonthHints: fetchMealHints } = useMeal()

// 캘린더 힌트용 이벤트 — CalendarEvent 형식으로 변환
const calendarHintEvents = computed(() => {
  const events: any[] = []
  for (const date of workoutHintDates.value) {
    events.push({ id: `w-${date}`, type: 'event', title: '운동', date, startTime: null, endTime: null, color: '#3b82f6', memo: null })
  }
  for (const date of mealHintDates.value) {
    events.push({ id: `m-${date}`, type: 'event', title: '식단', date, startTime: null, endTime: null, color: '#22c55e', memo: null })
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

// 운동 이벤트 핸들러
async function onWorkoutSaved() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
  await loadMonthHints()
}

async function onWorkoutDeleted() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
  await loadMonthHints()
}

// 식단 이벤트 핸들러
async function onMealSaved() {
  await fetchMeals(selectedDate.value)
  await loadMonthHints()
}

async function onMealDeleted() {
  await fetchMeals(selectedDate.value)
  await loadMonthHints()
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <button class="menu-toggle-btn" @click="menuOpen = !menuOpen">
          <UiIcon :name="menuOpen ? 'x' : 'menu'" :size="20" />
        </button>
        <img src="/logo.svg" alt="CYLEE" class="header-logo" @click="router.push('/')" style="cursor: pointer;" />
      </div>
      <div class="header-right">
        <UiDropdownMenu
          :items="userMenuItems"
          :title="auth.user?.name"
          align="end"
          @select="onUserMenuSelect"
        >
          <template #trigger>
            <button class="user-avatar-btn">
              <span class="user-avatar">{{ auth.user?.name?.charAt(0) }}</span>
            </button>
          </template>
        </UiDropdownMenu>
      </div>
    </header>

    <!-- 사이드 메뉴 오버레이 -->
    <Transition name="overlay-fade">
      <div v-if="menuOpen" class="menu-overlay" @click="menuOpen = false" />
    </Transition>

    <!-- 사이드 메뉴 패널 -->
    <Transition name="slide-left">
      <nav v-if="menuOpen" class="side-menu">
        <button class="side-menu__item" @click="menuOpen = false; router.push('/')">
          <UiIcon name="home" :size="20" />
          <span>홈</span>
        </button>
        <button
          v-for="item in menuItems"
          :key="item.value"
          class="side-menu__item"
          :class="{ 'side-menu__item--active': item.value === 'health' }"
          @click="onMenuSelect(item.value)"
        >
          <UiIcon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </Transition>

    <main class="main">
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

            <!-- 서브탭 -->
            <UiTab v-model="activeTab" :tabs="tabItems" />

            <!-- 컨텐츠 영역 -->
            <div class="health-page__content">
              <!-- 운동 탭 -->
              <WorkoutTab
                v-if="activeTab === 'workout'"
                :workouts="workouts"
                :recent-workouts="recentWorkouts"
                :loading="workoutLoading"
                :selected-date="selectedDate"
                @saved="onWorkoutSaved"
                @deleted="onWorkoutDeleted"
              />

              <!-- 식단 탭 -->
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
    </main>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <button class="bottom-nav__item" @click="router.push('/')">
        <UiIcon name="home" :size="18" />
        <span>홈</span>
      </button>
      <button
        v-for="item in menuItems"
        :key="item.value"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': item.value === 'health' }"
        @click="onMenuSelect(item.value)"
      >
        <UiIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <UiConfirm />
    <UiToast />
  </div>
</template>

<style scoped lang="scss">
// 레이아웃 (DashboardView와 동일)
.layout { min-height: 100vh; padding-top: 56px; padding-bottom: 56px; background: #f8f9fb; }
.header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 101;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px; background: #fff; border-bottom: 1px solid #e6e8ec;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-logo { height: 24px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.menu-toggle-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; background: none;
  border-radius: 8px; cursor: pointer; color: #374151;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.user-avatar-btn {
  display: flex; align-items: center; background: none; border: none;
  cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.user-avatar {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: #4f6af6; color: #fff; font-size: 14px; font-weight: 600;
}
.menu-overlay { position: fixed; inset: 0; z-index: 99; background: rgba(0, 0, 0, 0.3); }
.side-menu {
  position: fixed; top: 56px; left: 0; bottom: 0;
  width: 260px; z-index: 100; background: #fff; border-right: 1px solid #e6e8ec;
  padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto;
}
.side-menu__item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 14px; border: none; background: none; border-radius: 8px;
  font-size: 14px; color: #374151; cursor: pointer; transition: background 0.15s, color 0.15s;
  &:hover { background: #f3f4f6; }
  &--active { background: #eef2ff; color: #4f6af6; font-weight: 600; }
}
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 101;
  height: 56px; background: #fff; border-top: 1px solid #e6e8ec;
  display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 16px;
}
.bottom-nav__item {
  display: flex; align-items: center; gap: 6px;
  border: none; background: none; padding: 10px 16px;
  border-radius: 8px; font-size: 13px; color: #9ca3af;
  cursor: pointer; transition: background 0.15s, color 0.15s; min-height: 44px;
  &:hover { background: #f3f4f6; color: #374151; }
  &--active { background: #eef2ff; color: #4f6af6; font-weight: 600; }
}
.slide-left-enter-active, .slide-left-leave-active { transition: transform 0.25s ease; }
.slide-left-enter-from, .slide-left-leave-to { transform: translateX(-100%); }
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }
.main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

// 건강 페이지
.health-page { max-width: 1100px; margin: 0 auto; position: relative; }

.health-page__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.health-page__grid {
  flex: 1;
  min-width: 0;
}

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
  flex-shrink: 0;
  width: 360px;
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f3f4f6;
  padding: 16px;
}

.health-page__side-date {
  font-size: 17px; font-weight: 700; color: #1f2937;
  margin-bottom: 12px;
}

.health-page__content {
  padding: 12px 0 0;
}

@media (max-width: 1024px) {
  .health-page__body {
    flex-direction: column;
    gap: 0;
  }
  .health-page__side {
    width: 100%;
    position: static;
    max-height: none;
    background: none;
    border: none;
    border-radius: 0;
    padding: 0;
    margin-top: 16px;
  }
}

@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item { flex-direction: column; gap: 2px; padding: 6px 12px; font-size: 10px; }
  .main { padding: 16px 12px; }
  .health-page__calendar-header { gap: 8px; }
  .health-page__nav { gap: 4px; }
  .health-page__today { display: none !important; }
  .health-page__month { font-size: 16px; min-width: 100px; }
}
</style>
