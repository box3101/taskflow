<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useStockData } from '../../composables/useStockData'
import HoldingSummary from './HoldingSummary.vue'
import ThemeOverview from './ThemeOverview.vue'
import TopValueCard from './TopValueCard.vue'
import RecommendCard from './RecommendCard.vue'

const {
  holdings, prices, quotes, themes, themeQuotes,
  kospiTop, kosdaqTop,
  loading, lastUpdated,
  recommendations,
  loadAll, refreshPrices, loadThemeQuotes, loadTopValue,
  saveHoldings, addHolding, removeHolding,
  startAutoRefresh, stopAutoRefresh,
} = useStockData()

const holdingSaved = ref(false)

function onSaveHoldings() {
  saveHoldings()
  holdingSaved.value = true
  setTimeout(() => { holdingSaved.value = false }, 2000)
}

async function onLoadThemeQuotes() {
  await loadThemeQuotes()
}

async function onLoadTopValue() {
  await loadTopValue()
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
    <!-- 보유 종목 (핵심) -->
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

    <!-- AI 추천 -->
    <RecommendCard
      :recommendations="recommendations"
      :loading="loading"
      @load-data="onLoadThemeQuotes"
    />

    <!-- 테마 동향 -->
    <ThemeOverview
      :themes="themes"
      :theme-quotes="themeQuotes"
      :loading="loading"
      @load-quotes="onLoadThemeQuotes"
    />

    <!-- 거래대금 TOP -->
    <TopValueCard
      :kospi-stocks="kospiTop"
      :kosdaq-stocks="kosdaqTop"
      :loading="loading"
      @load="onLoadTopValue"
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
