<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { openToast } from '@leechanyong/ispark-ui'
import StockDashboard from '../components/stock/StockDashboard.vue'

const route = useRoute()

onMounted(() => {
  // 카카오 연동 완료 시 토스트
  if (route.query.kakao === 'linked') {
    openToast({ message: '카카오톡 연동이 완료되었습니다!', type: 'success' })
    window.history.replaceState({}, '', '/stock')
  }
})
</script>

<template>
  <StockDashboard />
</template>
