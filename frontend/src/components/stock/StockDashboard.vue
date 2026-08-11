<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useStockData } from '../../composables/useStockData'
import HoldingSummary from './HoldingSummary.vue'
import InvestorTrend from './InvestorTrend.vue'
import SmartScore from './SmartScore.vue'
import ScoreBacktest from './ScoreBacktest.vue'
import ScoreSimulation from './ScoreSimulation.vue'
import ScorePortfolio from './ScorePortfolio.vue'
import StockCalendar from './StockCalendar.vue'


const {
  holdings, prices, quotes, themes, themeQuotes,
  loading, lastUpdated,
  investorData,
  loadAll, refreshPrices,
  saveHoldings, addHolding, removeHolding,
  startAutoRefresh, stopAutoRefresh,
} = useStockData()

const holdingCodes = computed(() => holdings.value.map(h => h.code).filter(Boolean))
const holdingsForCalendar = computed(() => holdings.value.map(h => ({ code: h.code, name: h.name })))


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
    <!-- 보유 종목 + 외인/기관 + 캘린더 (3열) -->
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

    <!-- Smart Score 랭킹 -->
    <SmartScore
      :themes="themes"
      :theme-quotes="themeQuotes"
    />

    <!-- 구간 스프레드 분석 -->
    <ScoreBacktest />

    <!-- 가상매매 수익률 -->
    <ScoreSimulation />

    <!-- 실자금 검증 포트폴리오 -->
    <ScorePortfolio />

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
    > :nth-child(1) { flex: 1 1 40%; }
    > :nth-child(2) { flex: 1 1 30%; }
    > :nth-child(3) { flex: 0 0 280px; }
  }
}

@media (max-width: 768px) {
  .stock-row {
    flex-direction: column;

    > * { flex-basis: auto !important; }
  }
}

</style>
