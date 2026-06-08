<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  UiIcon, UiButton, UiDropdownMenu, UiConfirm, UiToast, openToast,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../composables/useTheme'
import MemoForm from '../components/memo/MemoForm.vue'
import { useMemo, type MemoEntry } from '../composables/useMemo'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const menuOpen = ref(false)
const { theme, toggle: toggleTheme } = useTheme()

const menuItems = [
  { label: '홈', value: '', icon: 'home', path: '/', pinned: true },
  { label: '캘린더', value: 'calendar', icon: 'calendar', path: '/calendar', pinned: true },
  { label: 'AI Tools', value: 'ai-tools', icon: 'bot', path: '/ai-tools', pinned: false },
  { label: '프로젝트', value: 'projects', icon: 'folder', path: '/projects', pinned: true },
  { label: '할일', value: 'todos', icon: 'check-square', path: '/todos', pinned: true },
  { label: '메모', value: 'memos', icon: 'sticky-note', path: '/memos', pinned: false },
  { label: '건강', value: 'health', icon: 'heart-pulse', path: '/health', pinned: false },
  { label: '주식', value: 'stock', icon: 'trending-up', path: '/stock', pinned: false },
]

const pinnedItems = menuItems.filter(item => item.pinned)
const moreItems = menuItems.filter(item => !item.pinned)

// 더보기 메뉴 열림 상태
const moreOpen = ref(false)

const currentValue = computed(() => {
  const path = route.path
  const match = menuItems.find(item => item.path !== '/' && path.startsWith(item.path))
  return match?.value ?? ''
})

// 현재 활성 메뉴가 더보기에 포함된 항목인지
const isMoreActive = computed(() => {
  return moreItems.some(item => currentValue.value === item.value)
})

function navigate(item: typeof menuItems[0]) {
  menuOpen.value = false
  moreOpen.value = false
  router.push(item.path)
}

const userMenuItems: DropdownMenuItemDef[] = [
  { value: 'logout', label: '로그아웃', icon: 'icon-arrow-right', color: 'danger' },
]

function onUserMenuSelect(value: string) {
  if (value === 'logout') { auth.logout(); router.push('/login') }
}

// 글로벌 메모 퀵 추가
const { addMemo } = useMemo()
const quickMemoOpen = ref(false)

// 홈(/)에서만 글로벌 메모 FAB 표시
const isHomePage = computed(() => route.path === '/')

async function handleQuickMemoSaved(memo: MemoEntry) {
  try {
    await addMemo({ title: memo.title, content: memo.content, color: memo.color })
    openToast({ message: '메모가 추가되었습니다.', type: 'success' })
    quickMemoOpen.value = false
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <button class="menu-toggle-btn" @click="menuOpen = !menuOpen">
          <UiIcon :name="menuOpen ? 'x' : 'menu'" :size="20" />
        </button>
        <img src="/logo.svg" alt="TaskFlow" class="header-logo" @click="router.push('/')" style="cursor: pointer;" />
      </div>
      <div class="header-right">
        <!-- 다크모드 토글 (숨김) -->
        <!--
        <UiButton variant="ghost" size="sm" icon-only :aria-label="theme === 'dark' ? '라이트 모드' : '다크 모드'" @click="toggleTheme">
          <template #icon-left>
            <UiIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
          </template>
        </UiButton>
        -->
        <UiButton class="storybook-link" as="a" href="https://box3101.github.io/ispark-ui/" target="_blank" size="sm" variant="outline">📖 Storybook</UiButton>
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
        <button
          v-for="item in menuItems"
          :key="item.value"
          class="side-menu__item"
          :class="{ 'side-menu__item--active': currentValue === item.value }"
          @click="navigate(item)"
        >
          <UiIcon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </Transition>

    <main class="main">
      <router-view />
    </main>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <!-- 고정 탭 -->
      <button
        v-for="item in pinnedItems"
        :key="item.value"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': currentValue === item.value }"
        @click="navigate(item)"
      >
        <UiIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
      <!-- 더보기 버튼 -->
      <div class="bottom-nav__more-wrapper">
        <button
          class="bottom-nav__item"
          :class="{ 'bottom-nav__item--active': isMoreActive }"
          @click.stop="moreOpen = !moreOpen"
        >
          <UiIcon name="ellipsis" :size="18" />
          <span>더보기</span>
        </button>
        <!-- 더보기 팝업 -->
        <Transition name="more-popup">
          <div v-if="moreOpen" class="more-popup">
            <button
              v-for="item in moreItems"
              :key="item.value"
              class="more-popup__item"
              :class="{ 'more-popup__item--active': currentValue === item.value }"
              @click="navigate(item)"
            >
              <UiIcon :name="item.icon" :size="18" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </nav>
    <!-- 더보기 백드롭 -->
    <div v-if="moreOpen" class="more-backdrop" @click="moreOpen = false" />

    <!-- 글로벌 메모 FAB -->
    <button
      v-if="isHomePage"
      class="global-memo-fab"
      @click="quickMemoOpen = true"
      aria-label="빠른 메모"
    >
      <UiIcon name="pencil" :size="22" />
    </button>

    <!-- 글로벌 메모 폼 -->
    <MemoForm
      :open="quickMemoOpen"
      @update:open="quickMemoOpen = $event"
      @saved="handleQuickMemoSaved"
    />

    <UiConfirm />
    <UiToast />
  </div>
</template>

<style scoped lang="scss">
.layout { min-height: 100vh; padding-top: 56px; padding-bottom: 56px; background: #fff; }

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

.menu-overlay {
  position: fixed; inset: 0; z-index: 99;
  background: rgba(0, 0, 0, 0.3);
}

.side-menu {
  position: fixed; top: 56px; left: 0; bottom: 0;
  width: 260px; z-index: 100;
  background: #fff; border-right: 1px solid #e6e8ec;
  padding: 12px 8px;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}

.side-menu__item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 14px;
  border: none; background: none; border-radius: 8px;
  font-size: 14px; color: #374151; cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { background: #f3f4f6; }
  &--active { background: #eef2ff; color: #4f6af6; font-weight: 600; }
}

.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 101;
  height: 56px; background: #fff; border-top: 1px solid #e6e8ec;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 0 16px;
}

.bottom-nav__item {
  display: flex; align-items: center; gap: 6px;
  border: none; background: none; padding: 10px 16px;
  border-radius: 8px; font-size: 13px; color: #9ca3af;
  cursor: pointer; transition: background 0.15s, color 0.15s;
  min-height: 44px;
  &:hover { background: #f3f4f6; color: #374151; }
  &--active { background: #eef2ff; color: #4f6af6; font-weight: 600; }
}

.bottom-nav__more-wrapper {
  position: relative;
}

.more-popup {
  position: absolute; bottom: calc(100% + 8px); right: 0;
  background: #fff; border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
  padding: 6px;
  min-width: 160px;
  z-index: 102;
}

.more-popup__item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 14px;
  border: none; background: none; border-radius: 8px;
  font-size: 14px; color: #374151; cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  &:hover { background: #f3f4f6; }
  &--active { background: #eef2ff; color: #4f6af6; font-weight: 600; }
}

.more-backdrop {
  position: fixed; inset: 0; z-index: 100;
}

.more-popup-enter-active { transition: opacity 0.15s, transform 0.15s; }
.more-popup-leave-active { transition: opacity 0.1s, transform 0.1s; }
.more-popup-enter-from { opacity: 0; transform: translateY(8px); }
.more-popup-leave-to { opacity: 0; transform: translateY(8px); }

.slide-left-enter-active,
.slide-left-leave-active { transition: transform 0.25s ease; }
.slide-left-enter-from,
.slide-left-leave-to { transform: translateX(-100%); }

.overlay-fade-enter-active,
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from,
.overlay-fade-leave-to { opacity: 0; }

.main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .header-right { gap: 8px; }
  .storybook-link { display: none !important; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item {
    flex-direction: column; gap: 2px;
    padding: 6px 12px; font-size: 10px;
  }
  .main { padding: 16px 12px; }
}

.global-memo-fab {
  position: fixed;
  right: 20px;
  bottom: 76px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #4f6af6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 106, 246, 0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 50;

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(79, 106, 246, 0.5);
  }
  &:active {
    transform: scale(0.95);
  }
}

// 다크모드
:global([data-theme="dark"]) {
  .layout { background: #111827; color: #d1d5db; }
  .header { background: #1f2937; border-bottom-color: #374151; }
  .menu-toggle-btn { color: #d1d5db; &:hover { background: #374151; } }
  .side-menu { background: #1f2937; border-right-color: #374151; }
  .side-menu__item { color: #d1d5db; &:hover { background: #374151; } }
  .bottom-nav { background: #1f2937; border-top-color: #374151; }
  .bottom-nav__item { color: #9ca3af; &:hover { background: #374151; color: #d1d5db; } }
  .user-avatar-btn:hover { background: #374151; }
}
</style>
