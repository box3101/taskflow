<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiButton, UiIcon, UiLoading } from '@leechanyong/ispark-ui'
import { openToast } from '@leechanyong/ispark-ui'
import { fetchGuardSettings, unlinkKakao } from '../../api/stockApi'

const loading = ref(true)
const saving = ref(false)
const settings = ref({
  kakaoLinked: false,
  kakaoExpiresAt: null as string | null,
})

onMounted(async () => {
  try {
    settings.value = await fetchGuardSettings()
  } finally {
    loading.value = false
  }
})

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
      <!-- 카카오 연동 -->
      <div class="stock-guard-settings__row">
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
