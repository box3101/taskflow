<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiButton, UiIcon, UiLoading, UiToggle, UiConfirm, UiToast,
  UiDropdownMenu, openToast,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'
import type { CalendarEvent } from '../types/calendar'
import CalendarMonth from '../components/calendar/CalendarMonth.vue'
import CalendarEventList from '../components/calendar/CalendarEventList.vue'
import CalendarEventForm from '../components/calendar/CalendarEventForm.vue'
import CalendarTodoDrawer from '../components/calendar/CalendarTodoDrawer.vue'
import CalendarIssueDrawer from '../components/calendar/CalendarIssueDrawer.vue'

const router = useRouter()
const auth = useAuthStore()

// 사이드 메뉴 + 네비게이션
const menuOpen = ref(false)
const menuItems = [
  { label: '캘린더', value: 'calendar', icon: 'calendar' },
  { label: 'AI Tools', value: 'ai-tools', icon: 'bot' },
  { label: '프로젝트', value: 'projects', icon: 'folder' },
  { label: '개인할일', value: 'todos', icon: 'check-square' },
  { label: '주식', value: 'stock', icon: 'trending-up' },
]

function onMenuSelect(value: string) {
  menuOpen.value = false
  if (value === 'calendar') return
  router.push(`/main?tab=${value}`)
}

const userMenuItems: DropdownMenuItemDef[] = [
  { value: 'logout', label: '로그아웃', icon: 'icon-arrow-right', color: 'danger' },
]

function onUserMenuSelect(value: string) {
  if (value === 'logout') { auth.logout(); router.push('/login') }
}
const loading = ref(true)
const allEvents = ref<CalendarEvent[]>([])

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)

const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const showTodo = ref(true)
const showIssue = ref(true)

const drawerOpen = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

const todoDrawerOpen = ref(false)
const todoDrawerId = ref<number | null>(null)
const issueDrawerOpen = ref(false)
const issueDrawerId = ref<number | null>(null)
const issueDrawerProjectId = ref<number | null>(null)

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const filteredEvents = computed(() => {
  return allEvents.value.filter(ev => {
    if (ev.type === 'todo' && !showTodo.value) return false
    if (ev.type === 'issue' && !showIssue.value) return false
    return true
  })
})

const selectedEvents = computed(() => {
  return filteredEvents.value.filter(ev => ev.date === selectedDate.value)
})

async function fetchEvents() {
  loading.value = true
  try {
    const { data } = await api.get('/calendar', {
      params: { year: currentYear.value, month: currentMonth.value },
    })
    allEvents.value = data.data
  } catch {
    openToast({ message: '일정을 불러오는데 실패했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
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
  selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

watch([currentYear, currentMonth], () => {
  const n = new Date()
  if (currentYear.value === n.getFullYear() && currentMonth.value === n.getMonth() + 1) {
    selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  } else {
    selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  }
  fetchEvents()
})

function openAdd() { editingEvent.value = null; drawerOpen.value = true }
function openAddOnDate() { editingEvent.value = null; drawerOpen.value = true }
function openEdit(ev: CalendarEvent) { editingEvent.value = ev; drawerOpen.value = true }
function onSaved() { fetchEvents() }
function onDeleted() { fetchEvents() }

function openTodoDrawer(ev: CalendarEvent) {
  todoDrawerId.value = ev.id
  todoDrawerOpen.value = true
}
function openIssueDrawer(ev: CalendarEvent) {
  issueDrawerId.value = ev.id
  issueDrawerProjectId.value = ev.projectId ?? null
  issueDrawerOpen.value = true
}
function onTodoSavedOrDeleted() { fetchEvents() }
function onIssueSavedOrDeleted() { fetchEvents() }

onMounted(fetchEvents)
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
          :class="{ 'side-menu__item--active': item.value === 'calendar' }"
          @click="onMenuSelect(item.value)"
        >
          <UiIcon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </Transition>

    <main class="main">
  <div class="calendar-page">
    <UiLoading v-if="loading" overlay />
    <div class="calendar-page__header">
      <div class="calendar-page__nav">
        <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 달" @click="prevMonth">
          <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
        </UiButton>
        <span class="calendar-page__month">{{ monthLabel }}</span>
        <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 달" @click="nextMonth">
          <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
        </UiButton>
        <UiButton class="calendar-page__today" variant="ghost" size="sm" @click="goToday">오늘</UiButton>
      </div>
      <div class="calendar-page__toggles">
        <label class="calendar-page__toggle-label">
          <span class="calendar-page__toggle-dot" style="background: #ef4444;" />
          <UiToggle v-model="showTodo" />
          <span>Todo</span>
        </label>
        <label class="calendar-page__toggle-label">
          <span class="calendar-page__toggle-dot" style="background: #22c55e;" />
          <UiToggle v-model="showIssue" />
          <span>Issue</span>
        </label>
      </div>
    </div>
    <!-- FAB: 일정 추가 -->
    <button class="calendar-page__fab" @click="openAdd" aria-label="일정 추가">
      <UiIcon name="plus" :size="22" />
    </button>
    <CalendarMonth :year="currentYear" :month="currentMonth" :events="filteredEvents"
      :selected-date="selectedDate" @select-date="selectedDate = $event"
      @swipe-left="nextMonth" @swipe-right="prevMonth" />
    <CalendarEventList :date="selectedDate" :events="selectedEvents"
      @add="openAddOnDate" @edit-event="openEdit"
      @open-todo="openTodoDrawer" @open-issue="openIssueDrawer" />
    <CalendarEventForm v-model:open="drawerOpen" :event="editingEvent" :default-date="selectedDate"
      @saved="onSaved" @deleted="onDeleted" />
    <CalendarTodoDrawer v-model:open="todoDrawerOpen" :todo-id="todoDrawerId"
      @saved="onTodoSavedOrDeleted" @deleted="onTodoSavedOrDeleted" />
    <CalendarIssueDrawer v-model:open="issueDrawerOpen" :issue-id="issueDrawerId"
      :project-id="issueDrawerProjectId"
      @saved="onIssueSavedOrDeleted" @deleted="onIssueSavedOrDeleted" />
    <UiConfirm />
    <UiToast />
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
        :class="{ 'bottom-nav__item--active': item.value === 'calendar' }"
        @click="onMenuSelect(item.value)"
      >
        <UiIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
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

// 캘린더 본체
.calendar-page { max-width: 800px; margin: 0 auto; position: relative; }
.calendar-page__header {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px; gap: 12px; position: relative;
}
.calendar-page__toggles {
  display: flex; gap: 12px; flex-shrink: 0;
  position: absolute; right: 0;
}
.calendar-page__toggle-label {
  display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; cursor: pointer;
}
.calendar-page__toggle-dot { width: 8px; height: 8px; border-radius: 50%; }
.calendar-page__nav {
  display: flex; align-items: center; gap: 8px;
  :deep(.ui-button) { min-width: 36px; min-height: 36px; }
}
.calendar-page__month { font-size: 18px; font-weight: 700; color: #1f2937; min-width: 120px; text-align: center; }
.calendar-page__fab {
  position: fixed; bottom: 76px; right: 24px; z-index: 50;
  width: 52px; height: 52px; border-radius: 50%;
  background: #4f6af6; color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.4);
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(79, 106, 246, 0.5); }
  &:active { transform: scale(0.95); }
}
@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item { flex-direction: column; gap: 2px; padding: 6px 12px; font-size: 10px; }
  .main { padding: 16px 12px; }
  .calendar-page__header { gap: 8px; }
  .calendar-page__toggles { position: static; gap: 8px; margin-left: auto; }
  .calendar-page__nav { gap: 4px; }
  .calendar-page__today { display: none !important; }
  .calendar-page__month { font-size: 16px; min-width: 100px; }
  .calendar-page__fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}
</style>
