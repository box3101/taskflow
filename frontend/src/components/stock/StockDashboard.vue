<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useStockData } from '../../composables/useStockData'
import HoldingSummary from './HoldingSummary.vue'
import InvestorTrend from './InvestorTrend.vue'
import RecommendCard from './RecommendCard.vue'
import ThemeOverview from './ThemeOverview.vue'

const {
  holdings, prices, quotes, themes, themeQuotes,
  loading, lastUpdated,
  recMomentum, recLaggard, recOverheat,
  investorData,
  loadAll, refreshPrices, loadThemeQuotes,
  saveHoldings, addHolding, removeHolding,
  startAutoRefresh, stopAutoRefresh,
} = useStockData()

const holdingCodes = computed(() => holdings.value.map(h => h.code).filter(Boolean))

function onSaveHoldings() {
  saveHoldings()
}

onMounted(async () => {
  await loadAll()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="stock-dashboard">
    <!-- 보유 종목 -->
    <HoldingSummary
      :holdings="holdings"
      :prices="prices"
      :quotes="quotes"
      :loading="loading"
      :last-updated="lastUpdated"
      @save="onSaveHoldings"
      @add="addHolding"
      @remove="removeHolding"
      @refresh="refreshPrices"
    />

    <!-- 외인/기관 동향 -->
    <InvestorTrend
      :data="investorData"
      :holding-codes="holdingCodes"
    />

    <!-- AI 종목 분석 (3탭) -->
    <RecommendCard
      :momentum="recMomentum"
      :laggard="recLaggard"
      :overheat="recOverheat"
      :loading="loading"
      @load-data="loadThemeQuotes"
    />

    <!-- 테마 동향 -->
    <ThemeOverview
      :themes="themes"
      :theme-quotes="themeQuotes"
      :loading="loading"
      @load-quotes="loadThemeQuotes"
    />

  </div>
</template>

<style lang="scss" scoped>
.stock-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

</style>
