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

// 날짜 상태
const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const dateLabel = computed(() => {
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dayName = DAY_NAMES[dt.getDay()]
  return `${y}년 ${m}월 ${d}일 (${dayName})`
})

function prevDate() {
  const dt = new Date(selectedDate.value)
  dt.setDate(dt.getDate() - 1)
  selectedDate.value = formatDate(dt)
}

function nextDate() {
  const dt = new Date(selectedDate.value)
  dt.setDate(dt.getDate() + 1)
  selectedDate.value = formatDate(dt)
}

function goToday() {
  const n = new Date()
  selectedDate.value = formatDate(n)
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isToday = computed(() => selectedDate.value === formatDate(new Date()))

// 서브탭
const activeTab = ref('workout')
const tabItems = [
  { value: 'workout', label: '운동' },
  { value: 'meal', label: '식단' },
]

// Composables
const { workouts, recentWorkouts, loading: workoutLoading, fetchByDate: fetchWorkouts, fetchRecent: fetchRecentWorkouts } = useWorkout()
const { meals, loading: mealLoading, fetchByDate: fetchMeals } = useMeal()

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

watch(selectedDate, () => { loadData() })
onMounted(() => {
  loadData()
  fetchRecentWorkouts()
})

// 운동 이벤트 핸들러
async function onWorkoutSaved() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
}

async function onWorkoutDeleted() {
  await fetchWorkouts(selectedDate.value)
  await fetchRecentWorkouts()
}

// 식단 이벤트 핸들러
async function onMealSaved() {
  await fetchMeals(selectedDate.value)
}

async function onMealDeleted() {
  await fetchMeals(selectedDate.value)
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

        <!-- 날짜 네비게이션 -->
        <div class="health-page__date-nav">
          <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 날" @click="prevDate">
            <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
          </UiButton>
          <span class="health-page__date-label">{{ dateLabel }}</span>
          <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 날" @click="nextDate">
            <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
          </UiButton>
          <UiButton v-if="!isToday" variant="ghost" size="sm" @click="goToday">오늘</UiButton>
        </div>

        <!-- 서브탭 -->
        <UiTab v-model="activeTab" :items="tabItems" />

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
.health-page { max-width: 640px; margin: 0 auto; position: relative; }

.health-page__date-nav {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 20px;
}

.health-page__date-label {
  font-size: 18px; font-weight: 700; color: #1f2937;
  min-width: 180px; text-align: center;
}

.health-page__content {
  padding: 16px 0;
}

@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item { flex-direction: column; gap: 2px; padding: 6px 12px; font-size: 10px; }
  .main { padding: 16px 12px; }
  .health-page__date-label { font-size: 16px; min-width: 160px; }
}
</style>
