<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { UiTab, openToast } from '@leechanyong/ispark-ui'
import type { TabItem } from '@leechanyong/ispark-ui'
import StockDashboard from '../components/stock/StockDashboard.vue'
import TradeLogTab from '../components/stock/TradeLogTab.vue'
import MarketPulseTab from '../components/stock/MarketPulseTab.vue'

const route = useRoute()
const activeTab = ref('pulse')

const tabs: TabItem[] = [
  { value: 'pulse', label: '시황' },
  { value: 'journal', label: '매매일지' },
  { value: 'dashboard', label: '대시보드' },
]

onMounted(() => {
  if (route.query.kakao === 'linked') {
    openToast({ message: '카카오톡 연동이 완료되었습니다!', type: 'success' })
    window.history.replaceState({}, '', '/stock')
  }
  if (route.query.tab === 'journal') {
    activeTab.value = 'journal'
  }
})
</script>

<template>
  <div>
    <UiTab v-model="activeTab" :tabs="tabs" align="left" />
    <div style="margin-top: 16px;">
      <StockDashboard v-if="activeTab === 'dashboard'" />
      <TradeLogTab v-if="activeTab === 'journal'" />
      <MarketPulseTab v-if="activeTab === 'pulse'" />
    </div>
  </div>
</template>
