<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useStockData } from '../../composables/useStockData'
import HoldingSummary from './HoldingSummary.vue'
import InvestorTrend from './InvestorTrend.vue'
import RecommendCard from './RecommendCard.vue'
import ThemeOverview from './ThemeOverview.vue'
import SmartScore from './SmartScore.vue'
import StockCalendar from './StockCalendar.vue'
import TomorrowOutlook from './TomorrowOutlook.vue'

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
const holdingsForCalendar = computed(() => holdings.value.map(h => ({ code: h.code, name: h.name })))
const firstHolding = computed(() => holdings.value[0] || { code: '', name: '' })

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
    <!-- 내일 장 전망 -->
    <TomorrowOutlook v-if="firstHolding.code" :code="firstHolding.code" :name="firstHolding.name" />

    <!-- 보유 종목 + 외인/기관 동향 + 캘린더 (3열) -->
    <div class="stock-row stock-row--three">
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

      <InvestorTrend
        :data="investorData"
        :holding-codes="holdingCodes"
      />

      <StockCalendar :holdings="holdingsForCalendar" />
    </div>

    <!-- AI 종목 분석 + 테마 동향 (좌우 배치) -->
    <div class="stock-row">
      <RecommendCard
        :momentum="recMomentum"
        :laggard="recLaggard"
        :overheat="recOverheat"
        :loading="loading"
        @load-data="loadThemeQuotes"
      />

      <ThemeOverview
        :themes="themes"
        :theme-quotes="themeQuotes"
        :loading="loading"
        @load-quotes="loadThemeQuotes"
      />
    </div>

    <!-- Smart Score 랭킹 -->
    <SmartScore
      :themes="themes"
      :theme-quotes="themeQuotes"
    />

  </div>
</template>

<style lang="scss" scoped>
.stock-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-row {
  display: flex;
  gap: 16px;

  > :first-child { flex: 1 1 60%; min-width: 0; }
  > :last-child  { flex: 1 1 40%; min-width: 0; }

  &--three {
    > :first-child { flex: 1 1 40%; }
    > :nth-child(2) { flex: 1 1 30%; }
    > :last-child { flex: 0 0 280px; }
  }
}

@media (max-width: 768px) {
  .stock-row {
    flex-direction: column;

    > :first-child,
    > :nth-child(2),
    > :last-child { flex-basis: auto; }
  }
}

</style>
