<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiIcon, UiToggle, UiLoading, openToast } from '@leechanyong/ispark-ui'
import { usePreferences } from '../composables/usePreferences'

const { preferences, load, save } = usePreferences()
const loading = ref(true)

const menuDefs = [
  { key: 'calendar', label: '캘린더', icon: 'calendar', desc: '일정 관리' },
  { key: 'projects', label: '프로젝트', icon: 'folder', desc: '프로젝트·이슈 관리' },
  { key: 'todos', label: '할일', icon: 'check-square', desc: '개인 할일 목록' },
  { key: 'stock', label: '주식', icon: 'trending-up', desc: '시황·매매일지·대시보드' },
  { key: 'memos', label: '메모', icon: 'sticky-note', desc: '빠른 메모' },
  { key: 'health', label: '건강', icon: 'heart-pulse', desc: '운동·식단 기록' },
  { key: 'ai-tools', label: 'AI Tools', icon: 'bot', desc: 'AI 도구 가이드' },
]

function isVisible(key: string): boolean {
  const vis = preferences.value.menuVisibility
  if (!vis) return true
  return vis[key] !== false
}

async function toggle(key: string, value: boolean) {
  const vis = { ...preferences.value.menuVisibility, [key]: value }
  await save({ ...preferences.value, menuVisibility: vis })
  openToast({ message: value ? `${key} 메뉴를 켰습니다.` : `${key} 메뉴를 숨겼습니다.`, type: 'success' })
}

onMounted(async () => {
  await load()
  loading.value = false
})
</script>

<template>
  <div class="settings">
    <h2 class="settings__title">
      <UiIcon name="settings" :size="20" />
      설정
    </h2>

    <UiLoading v-if="loading" />

    <template v-else>
      <section class="settings__section">
        <h3 class="settings__section-title">메뉴 표시 설정</h3>
        <p class="settings__section-desc">사용하지 않는 메뉴를 숨길 수 있습니다. 홈은 항상 표시됩니다.</p>

        <div class="settings__menu-list">
          <div
            v-for="item in menuDefs"
            :key="item.key"
            class="settings__menu-item"
          >
            <div class="settings__menu-info">
              <UiIcon :name="item.icon" :size="18" />
              <div>
                <span class="settings__menu-label">{{ item.label }}</span>
                <span class="settings__menu-desc">{{ item.desc }}</span>
              </div>
            </div>
            <UiToggle
              :model-value="isVisible(item.key)"
              @update:model-value="toggle(item.key, $event)"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.settings {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 80px;

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 24px;
  }

  &__section {
    margin-bottom: 32px;
  }

  &__section-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 4px;
  }

  &__section-desc {
    font-size: 13px;
    color: #9ca3af;
    margin: 0 0 16px;
  }

  &__menu-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: #fff;
    border-radius: 10px;
    transition: background 0.15s;

    &:hover { background: #f9fafb; }
  }

  &__menu-info {
    display: flex;
    align-items: center;
    gap: 12px;

    div {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
  }

  &__menu-label {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  &__menu-desc {
    font-size: 12px;
    color: #9ca3af;
  }
}

:global([data-theme="dark"]) {
  .settings__menu-item { background: #1f2937; &:hover { background: #262830; } }
  .settings__menu-label { color: #e5e7eb; }
}
</style>
