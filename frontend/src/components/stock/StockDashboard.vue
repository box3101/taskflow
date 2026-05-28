<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useStockData } from '../../composables/useStockData'
import HoldingSummary from './HoldingSummary.vue'
import InvestorTrend from './InvestorTrend.vue'
import FearGreedGauge from './FearGreedGauge.vue'
import RecommendCard from './RecommendCard.vue'
import ThemeOverview from './ThemeOverview.vue'
import TopValueCard from './TopValueCard.vue'

const {
  holdings, prices, quotes, themes, themeQuotes,
  kospiTop, kosdaqTop,
  loading, lastUpdated,
  recMomentum, recLaggard, recOverheat,
  investorData, fearGreed,
  loadAll, refreshPrices, loadThemeQuotes, loadTopValue,
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

    <!-- 외인/기관 + 공포탐욕 (2열) -->
    <div class="two-col">
      <InvestorTrend
        :data="investorData"
        :holding-codes="holdingCodes"
      />
      <FearGreedGauge :data="fearGreed" />
    </div>

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

    <!-- 거래대금 TOP -->
    <TopValueCard
      :kospi-stocks="kospiTop"
      :kosdaq-stocks="kosdaqTop"
      :loading="loading"
      @load="loadTopValue"
    />
  </div>
</template>

<style lang="scss" scoped>
.stock-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
}

@media (max-width: 640px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
