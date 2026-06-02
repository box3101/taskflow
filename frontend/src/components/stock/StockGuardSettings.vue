<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiToggle, UiButton, UiIcon, UiLoading } from '@leechanyong/ispark-ui'
import { openToast } from '@leechanyong/ispark-ui'
import {
  fetchGuardSettings, updateGuardSettings, unlinkKakao,
  type GuardSettings, type GuardWindow,
} from '../../api/stockApi'

const loading = ref(true)
const saving = ref(false)
const settings = ref<GuardSettings>({
  enabled: false,
  windows: [],
  kakaoLinked: false,
  kakaoExpiresAt: null,
})

const editWindows = ref<GuardWindow[]>([])

onMounted(async () => {
  try {
    settings.value = await fetchGuardSettings()
    editWindows.value = [...settings.value.windows]
  } finally {
    loading.value = false
  }
})

async function toggleEnabled() {
  saving.value = true
  try {
    const newEnabled = !settings.value.enabled
    await updateGuardSettings({ enabled: newEnabled })
    settings.value.enabled = newEnabled
    openToast({ message: newEnabled ? 'Stock Guard 활성화' : 'Stock Guard 비활성화', type: 'success' })
  } catch {
    openToast({ message: '설정 변경에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function saveWindows() {
  saving.value = true
  try {
    await updateGuardSettings({ windows: editWindows.value })
    settings.value.windows = [...editWindows.value]
    openToast({ message: '시간 설정이 저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '시간 설정 저장에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

function linkKakao() {
  const apiUrl = import.meta.env.VITE_API_URL || ''
  const token = localStorage.getItem('token')
  window.location.href = `${apiUrl}/stock/guard/kakao/auth?token=${token}`
}

async function handleUnlinkKakao() {
  saving.value = true
  try {
    await unlinkKakao()
    settings.value.kakaoLinked = false
    openToast({ message: '카카오톡 연동이 해제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '카카오톡 연동 해제에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="stock-guard-settings">
    <UiLoading v-if="loading" overlay />

    <template v-else>
      <!-- Guard ON/OFF -->
      <div class="stock-guard-settings__row">
        <div class="stock-guard-settings__row-label">
          <UiIcon name="shield" :size="18" />
          <span>Stock Guard</span>
        </div>
        <UiToggle :model-value="settings.enabled" @update:model-value="toggleEnabled" />
      </div>

      <!-- 시간 설정 -->
      <div v-if="settings.enabled" class="stock-guard-settings__windows">
        <div class="stock-guard-settings__row-label">
          <UiIcon name="clock" :size="18" />
          <span>확인 시간</span>
        </div>
        <div
          v-for="(w, i) in editWindows"
          :key="i"
          class="stock-guard-settings__window-row"
        >
          <span class="stock-guard-settings__round">{{ i + 1 }}회</span>
          <input type="time" v-model="editWindows[i].open" class="stock-guard-settings__time-input" />
          <span>~</span>
          <input type="time" v-model="editWindows[i].close" class="stock-guard-settings__time-input" />
        </div>
        <UiButton size="sm" variant="outline" :loading="saving" @click="saveWindows">
          시간 저장
        </UiButton>
      </div>

      <!-- 카카오 연동 -->
      <div v-if="settings.enabled" class="stock-guard-settings__row">
        <div class="stock-guard-settings__row-label">
          <UiIcon name="message-circle" :size="18" />
          <span>카카오톡 알림</span>
        </div>
        <div v-if="settings.kakaoLinked" class="stock-guard-settings__kakao-status">
          <span class="stock-guard-settings__linked">연동됨</span>
          <UiButton size="sm" variant="ghost" @click="handleUnlinkKakao" :loading="saving">
            해제
          </UiButton>
        </div>
        <UiButton v-else size="sm" @click="linkKakao" :loading="saving">
          카카오톡 연동
        </UiButton>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.stock-guard-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg-secondary);
  border-radius: 0.75rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__row-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  &__windows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__window-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  &__round {
    width: 2rem;
    font-weight: 600;
  }

  &__time-input {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  &__kakao-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__linked {
    font-size: 0.8125rem;
    color: var(--color-success);
    font-weight: 500;
  }
}
</style>
