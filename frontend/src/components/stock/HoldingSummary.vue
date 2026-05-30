<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiBadge, UiIcon } from '@leechanyong/ispark-ui'
import type { StockHolding, StockPrice, StockQuote } from '../../types/stock'

const VISIBLE_COUNT = 5
const expanded = ref(false)

const props = defineProps<{
  holdings: StockHolding[]
  prices: Record<string, StockPrice>
  quotes: Record<string, StockQuote>
  loading: boolean
  lastUpdated: string
}>()

const emit = defineEmits<{
  save: []
  add: []
  remove: [idx: number]
  refresh: []
  'update:holdings': [holdings: StockHolding[]]
}>()

// 보유 기간 계산
function getHoldingDays(buyDate: string) {
  if (!buyDate) return 0
  return Math.floor((Date.now() - new Date(buyDate + 'T00:00:00').getTime()) / 86400000)
}

function getDaysMsg(days: number) {
  if (days < 30) return '인내심을 가지세요.'
  if (days < 90) return '3개월 목표를 향해!'
  if (days < 180) return '훌륭합니다! 반년 홀딩.'
  if (days < 365) return '진정한 투자자의 길.'
  return '🏆 1년 이상! 워런 버핏급.'
}

// 수익률 계산
function calcReturn(h: StockHolding) {
  const p = props.prices[h.code]
  if (!p || !h.buyPrice) return null
  const pnl = (p.price - h.buyPrice) * h.qty
  const pct = ((p.price - h.buyPrice) / h.buyPrice) * 100
  return { pnl, pct }
}
</script>

<template>
  <div class="holding-summary">
    <div class="section-header">
      <h3><UiIcon name="trending-up" :size="18" /> 보유 종목</h3>
      <div class="header-actions">
        <span v-if="lastUpdated" class="last-updated">{{ lastUpdated }} 갱신</span>
        <UiButton size="sm" variant="ghost" @click="emit('refresh')"><UiIcon name="refresh-cw" :size="14" /></UiButton>
        <UiButton size="sm" variant="ghost" @click="emit('add')">+ 종목</UiButton>
      </div>
    </div>

    <div v-for="(h, idx) in (expanded ? holdings : holdings.slice(0, VISIBLE_COUNT))" :key="idx" class="holding-item">
      <!-- 종목 헤더 -->
      <div class="holding-top">
        <div class="holding-name-row">
          <span class="holding-name">{{ h.name || h.code }}</span>
          <span class="holding-code">{{ h.code }}</span>
        </div>
      </div>

      <!-- 실시간 시세 (API 연동) -->
      <div v-if="prices[h.code]" class="live-price">
        <div class="price-main">
          <span class="current-price">{{ prices[h.code].price.toLocaleString() }}원</span>
          <UiBadge
            :variant="prices[h.code].changePctToday >= 0 ? 'danger' : 'primary'"
            size="sm"
          >
            {{ prices[h.code].changePctToday >= 0 ? '▲' : '▼' }}
            {{ Math.abs(prices[h.code].changePctToday).toFixed(2) }}%
          </UiBadge>
          <span class="change-amount" :class="prices[h.code].changeAmount >= 0 ? 'up' : 'down'">
            {{ prices[h.code].changeAmount >= 0 ? '+' : '' }}{{ prices[h.code].changeAmount.toLocaleString() }}
          </span>
        </div>

        <!-- 수익률 -->
        <div v-if="calcReturn(h)" class="return-cards">
          <div class="return-card" :class="calcReturn(h)!.pct >= 0 ? 'positive' : 'negative'">
            <span class="return-label">수익률</span>
            <span class="return-value">{{ calcReturn(h)!.pct >= 0 ? '+' : '' }}{{ calcReturn(h)!.pct.toFixed(2) }}%</span>
          </div>
          <div class="return-card" :class="calcReturn(h)!.pnl >= 0 ? 'positive' : 'negative'">
            <span class="return-label">수익금</span>
            <span class="return-value">{{ calcReturn(h)!.pnl >= 0 ? '+' : '' }}{{ Math.round(calcReturn(h)!.pnl).toLocaleString() }}원</span>
          </div>
          <div class="return-card neutral">
            <span class="return-label">보유</span>
            <span class="return-value day-count">D+{{ getHoldingDays(h.buyDate) }}</span>
            <span class="return-sub">{{ getDaysMsg(getHoldingDays(h.buyDate)) }}</span>
          </div>
        </div>

        <!-- 등락률 배지 -->
        <div v-if="quotes[h.code]" class="quote-badges">
          <UiBadge
            :variant="quotes[h.code].changePct5 >= 0 ? 'danger' : 'primary'"
            size="sm"
          >5일 {{ quotes[h.code].changePct5 >= 0 ? '+' : '' }}{{ quotes[h.code].changePct5.toFixed(1) }}%</UiBadge>
          <UiBadge
            :variant="quotes[h.code].changePct20 >= 0 ? 'danger' : 'primary'"
            size="sm"
          >20일 {{ quotes[h.code].changePct20 >= 0 ? '+' : '' }}{{ quotes[h.code].changePct20.toFixed(1) }}%</UiBadge>
        </div>

        <!-- 시고저 -->
        <div class="ohlc-bar">
          <span>시 {{ prices[h.code].open.toLocaleString() }}</span>
          <span class="ohlc-sep">—</span>
          <span>고 {{ prices[h.code].high.toLocaleString() }}</span>
          <span class="ohlc-sep">—</span>
          <span>저 {{ prices[h.code].low.toLocaleString() }}</span>
        </div>
      </div>

      <!-- 로딩 상태 -->
      <div v-else-if="loading" class="live-price-loading">
        시세 로딩 중...
      </div>

    </div>

    <!-- 더보기/접기 -->
    <button
      v-if="holdings.length > VISIBLE_COUNT"
      class="more-btn"
      @click="expanded = !expanded"
    >
      {{ expanded ? '접기' : `${holdings.length - VISIBLE_COUNT}개 종목 더보기` }}
    </button>

  </div>
</template>

<style lang="scss" scoped>
.holding-summary {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.last-updated {
  font-size: 12px;
  color: #9ca3af;
}

.holding-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 12px;
  &:last-of-type { margin-bottom: 0; }
}

.holding-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.holding-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}
.holding-code {
  font-size: 12px;
  color: #9ca3af;
}
.remove-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none;
  border-radius: 6px; cursor: pointer; color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}

// 실시간 시세
.live-price { margin-bottom: 12px; }

.price-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.current-price {
  font-size: 28px;
  font-weight: 800;
  color: #1f2937;
}
.change-amount {
  font-size: 14px;
  font-weight: 600;
  &.up { color: #ef4444; }
  &.down { color: #3b82f6; }
}

// 수익률 카드
.return-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.return-card {
  padding: 12px;
  border-radius: 8px;
  text-align: center;

  &.positive { background: #fef2f2; }
  &.negative { background: #eff6ff; }
  &.neutral { background: #f0fdf4; }
}
.return-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
.return-value {
  display: block;
  font-size: 18px;
  font-weight: 700;

  .positive & { color: #ef4444; }
  .negative & { color: #3b82f6; }
  .neutral & { color: #4f6af6; }
}
.return-sub {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}
.day-count {
  font-size: 20px;
  font-weight: 800;
}

// 등락률 배지
.quote-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

// 시고저
.ohlc-bar {
  display: flex;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}
.ohlc-sep { color: #d1d5db; }

.live-price-loading {
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

// 입력 필드
.holding-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 10px;
}
.field {
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 4px;
  }
}
.date-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dce4e9;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #3b82f6; }
}

.more-btn {
  display: block;
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  font-size: 13px;
  color: #3c69db;
  background: none;
  border: none;
  cursor: pointer;
  text-align: center;
  border-radius: 6px;

  &:hover {
    background: #f3f4f6;
  }
}


@media (max-width: 640px) {
  .holding-summary { padding: 14px; }
  .section-header { flex-wrap: wrap; gap: 8px; }
  .holding-name-row { flex-wrap: wrap; }
  .code-input { width: 100%; }
  .current-price { font-size: 22px; }
  .price-main { flex-wrap: wrap; gap: 6px; }
  .return-cards { grid-template-columns: 1fr; }
  .return-value { font-size: 16px; }
  .day-count { font-size: 18px; }
  .ohlc-bar { flex-wrap: wrap; font-size: 12px; }
  .holding-fields { grid-template-columns: 1fr 1fr; }
}
</style>
