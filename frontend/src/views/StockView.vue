<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from '@leechanyong/ispark-ui'
import StockDashboard from '../components/stock/StockDashboard.vue'
import StockGuardOverlay from '../components/stock/StockGuardOverlay.vue'
import { fetchGuardStatus, type GuardStatus } from '../api/stockApi'

const route = useRoute()
const toast = useToast()

const guardStatus = ref<GuardStatus | null>(null)
const loading = ref(true)

onMounted(async () => {
  // 카카오 연동 완료 시 토스트
  if (route.query.kakao === 'linked') {
    toast.success('카카오톡 연동이 완료되었습니다!')
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
    <StockGuardOverlay
      v-if="guardStatus?.enabled && !guardStatus?.accessible"
      :status="guardStatus!"
    />
    <StockDashboard v-else />
  </div>
</template>
