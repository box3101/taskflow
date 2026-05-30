<script setup lang="ts">
import { ref } from 'vue'
import { UiBadge, UiIcon } from '@leechanyong/ispark-ui'
import type { ThemeDef, StockQuote } from '../../types/stock'

const props = defineProps<{
  themes: ThemeDef[]
  themeQuotes: Record<string, StockQuote>
  loading: boolean
}>()

const emit = defineEmits<{ loadQuotes: [] }>()
const loaded = ref(false)

function onOpen() {
  if (!loaded.value && Object.keys(props.themeQuotes).length === 0) {
    loaded.value = true
    emit('loadQuotes')
  }
}

// 테마 평균 등락률
function themeAvg(theme: ThemeDef, field: 'changePct5' | 'changePct20') {
  const vals = theme.stocks
    .map(s => props.themeQuotes[s.code])
    .filter(Boolean)
    .map(q => q[field])
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
</script>

<template>
  <div class="theme-overview">
    <div class="section-header" @click="onOpen">
      <h3><UiIcon name="bar-chart-2" :size="18" /> 테마 동향 ({{ themes.length }}개 테마)</h3>
      <span v-if="loading" class="loading-text">로딩 중...</span>
    </div>

    <div v-if="themes.length === 0" class="empty-msg">테마 데이터를 불러오는 중...</div>

    <div v-else class="theme-list">
      <details v-for="theme in themes" :key="theme.key" class="theme-group">
        <summary class="theme-header" @click="onOpen">
          <span class="theme-icon">{{ theme.icon }}</span>
          <span class="theme-label">{{ theme.label }}</span>
          <span class="theme-count">{{ theme.stocks.length }}종목</span>
          <UiBadge
            v-if="Object.keys(themeQuotes).length > 0"
            :variant="themeAvg(theme, 'changePct20') >= 0 ? 'danger' : 'primary'"
            size="sm"
          >
            20일 {{ themeAvg(theme, 'changePct20') >= 0 ? '+' : '' }}{{ themeAvg(theme, 'changePct20').toFixed(1) }}%
          </UiBadge>
        </summary>

        <div class="theme-stocks">
          <div class="stock-row stock-row--header">
            <span class="col-name">종목명</span>
            <span class="col-price">현재가</span>
            <span class="col-chg">5일</span>
            <span class="col-chg">20일</span>
          </div>
          <div
            v-for="stock in theme.stocks"
            :key="stock.code"
            class="stock-row"
          >
            <span class="col-name">{{ stock.name }}</span>
            <span class="col-price">
              {{ themeQuotes[stock.code]?.price?.toLocaleString() || '-' }}
            </span>
            <span class="col-chg">
              <UiBadge
                v-if="themeQuotes[stock.code]"
                :variant="themeQuotes[stock.code].changePct5 >= 0 ? 'danger' : 'primary'"
                size="sm"
              >{{ themeQuotes[stock.code].changePct5 >= 0 ? '+' : '' }}{{ themeQuotes[stock.code].changePct5.toFixed(1) }}%</UiBadge>
              <span v-else class="no-data">-</span>
            </span>
            <span class="col-chg">
              <UiBadge
                v-if="themeQuotes[stock.code]"
                :variant="themeQuotes[stock.code].changePct20 >= 0 ? 'danger' : 'primary'"
                size="sm"
              >{{ themeQuotes[stock.code].changePct20 >= 0 ? '+' : '' }}{{ themeQuotes[stock.code].changePct20.toFixed(1) }}%</UiBadge>
              <span v-else class="no-data">-</span>
            </span>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.theme-overview {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  cursor: pointer;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}
.loading-text { font-size: 12px; color: #9ca3af; }
.empty-msg { text-align: center; color: #9ca3af; padding: 20px; font-size: 14px; }

.theme-group {
  margin-bottom: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;

  &[open] { border-color: #c7d2fe; }
}

.theme-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  background: #f9fafb;

  &:hover { background: #f3f4f6; }
  &::marker { color: #9ca3af; }
}
.theme-icon { font-size: 18px; }
.theme-label { font-weight: 600; color: #1f2937; }
.theme-count { font-size: 12px; color: #9ca3af; margin-left: auto; margin-right: 8px; }

.theme-stocks { padding: 8px 12px 12px; }

.stock-row {
  display: grid;
  grid-template-columns: 1fr 100px 80px 80px;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
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
.col-name { color: #374151; }
.col-price { text-align: right; color: #374151; }
.col-chg { text-align: center; }
.no-data { color: #d1d5db; }

@media (max-width: 640px) {
  .theme-overview { padding: 14px; }
  .theme-stocks { padding: 6px 8px 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .stock-row {
    min-width: 340px;
    grid-template-columns: 1fr 80px 60px 60px;
    font-size: 12px;
  }
  .theme-header { font-size: 13px; padding: 8px 10px; }
}
</style>
