<script setup lang="ts">
import { ref } from 'vue'
import { UiTab, UiBadge } from '@leechanyong/ispark-ui'
import type { TopValueStock } from '../../types/stock'

defineProps<{
  kospiStocks: TopValueStock[]
  kosdaqStocks: TopValueStock[]
  loading: boolean
}>()

const emit = defineEmits<{ load: [] }>()

const activeMarket = ref('kospi')
const tabs = [
  { label: 'KOSPI', value: 'kospi' },
  { label: 'KOSDAQ', value: 'kosdaq' },
]
const loaded = ref(false)

function onToggle() {
  if (!loaded.value) {
    loaded.value = true
    emit('load')
  }
}
</script>

<template>
  <details class="top-value-card" @toggle="onToggle">
    <summary class="card-header">
      <h3>🔥 거래대금 TOP</h3>
      <span v-if="loading" class="loading-text">로딩 중...</span>
    </summary>

    <div class="card-body">
      <UiTab v-model="activeMarket" :tabs="tabs" size="sm" alignment="left" />

      <div class="stock-table">
        <div class="row row--header">
          <span class="col-rank">#</span>
          <span class="col-name">종목명</span>
          <span class="col-price">현재가</span>
          <span class="col-chg">등락률</span>
          <span class="col-value">거래대금</span>
        </div>
        <div
          v-for="stock in (activeMarket === 'kospi' ? kospiStocks : kosdaqStocks)"
          :key="stock.code"
          class="row"
        >
          <span class="col-rank">{{ stock.rank }}</span>
          <span class="col-name">{{ stock.name }}</span>
          <span class="col-price">{{ stock.currentPrice.toLocaleString() }}</span>
          <span class="col-chg">
            <UiBadge
              :variant="stock.changePctToday >= 0 ? 'danger' : 'primary'"
              size="sm"
            >{{ stock.changePctToday >= 0 ? '+' : '' }}{{ stock.changePctToday.toFixed(2) }}%</UiBadge>
          </span>
          <span class="col-value">{{ Math.round(stock.accumulatedValue).toLocaleString() }}억</span>
        </div>

        <div v-if="(activeMarket === 'kospi' ? kospiStocks : kosdaqStocks).length === 0" class="empty">
          {{ loading ? '로딩 중...' : '데이터 없음' }}
        </div>
      </div>
    </div>
  </details>
</template>

<style lang="scss" scoped>
.top-value-card {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  overflow: hidden;

  &[open] { border-color: #c7d2fe; }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;

  h3 { font-size: 16px; font-weight: 700; margin: 0; }
  &:hover { background: #fafbfc; }
  &::marker { color: #9ca3af; }
}
.loading-text { font-size: 12px; color: #9ca3af; }

.card-body { padding: 0 20px 20px; }

.stock-table { margin-top: 12px; }

.row {
  display: grid;
  grid-template-columns: 40px 1fr 100px 90px 90px;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #f0f1f3;

  &:last-child { border-bottom: none; }

  &--header {
    font-weight: 600;
    color: #6b7280;
    font-size: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
}
.col-rank { text-align: center; color: #9ca3af; font-weight: 600; }
.col-name { color: #374151; }
.col-price { text-align: right; color: #374151; }
.col-chg { text-align: center; }
.col-value { text-align: right; color: #6b7280; font-size: 12px; }

.empty { text-align: center; padding: 20px; color: #9ca3af; font-size: 14px; }
</style>
