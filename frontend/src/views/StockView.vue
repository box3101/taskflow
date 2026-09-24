<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { openToast } from '@leechanyong/ispark-ui'
import ForeignFlowDashboard from '../components/stock/ForeignFlowDashboard.vue'

const route = useRoute()

onMounted(() => {
  if (route.query.kakao === 'linked') {
    openToast({ message: '카카오톡 연동이 완료되었습니다!', type: 'success' })
    window.history.replaceState({}, '', '/stock')
  }
})
</script>

<template>
  <ForeignFlowDashboard />
</template>
