<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { openToast } from '@leechanyong/ispark-ui'
import StockDashboard from '../components/stock/StockDashboard.vue'
import StockGuardOverlay from '../components/stock/StockGuardOverlay.vue'
import { fetchGuardStatus, type GuardStatus } from '../api/stockApi'

const route = useRoute()

const guardStatus = ref<GuardStatus | null>(null)
const loading = ref(true)

onMounted(async () => {
  // 카카오 연동 완료 시 토스트
  if (route.query.kakao === 'linked') {
    openToast({ message: '카카오톡 연동이 완료되었습니다!', type: 'success' })
    window.history.replaceState({}, '', '/stock')
  }

  try {
    guardStatus.value = await fetchGuardStatus()
  } catch {
    // Guard API 실패 시 접근 허용
    guardStatus.value = { enabled: false, accessible: true, currentWindow: null, nextOpenTime: null, windows: [] }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="!loading">
    <StockDashboard />
  </div>
</template>
