<script setup lang="ts">
// vue
import { UiBadge } from '@leechanyong/ispark-ui'
import type { InvestorData } from '../../api/stockApi'

const props = defineProps<{
  data: Record<string, InvestorData>
  holdingCodes: string[]
}>()

// 외인 연속 매수일 계산
function consecutiveBuyDays(trends: InvestorData['trends'], type: 'foreign' | 'institution') {
  let count = 0
  for (const day of trends) {
    if (day[type] > 0) count++
    else break
  }
  return count
}
</script>

<template>
  <div class="investor-trend">
    <div class="section-header">
      <h3>🏛️ 외인/기관 동향</h3>
    </div>

    <div v-for="code in holdingCodes" :key="code" class="investor-block">
      <div v-if="data[code] && data[code].trends.length > 0">
        <!-- PER/PBR -->
        <div class="meta-row">
          <span class="meta-item">PER {{ data[code].per }}</span>
          <span class="meta-item">PBR {{ data[code].pbr }}</span>
        </div>

        <!-- 5거래일 테이블 -->
        <div class="trend-table">
          <div class="trend-row trend-row--header">
            <span class="col-date">날짜</span>
            <span class="col-val">외국인</span>
            <span class="col-val">기관</span>
            <span class="col-val">개인</span>
          </div>
          <div
            v-for="day in data[code].trends"
            :key="day.date"
            class="trend-row"
          >
            <span class="col-date">{{ day.date }}</span>
            <span class="col-val" :class="day.foreign > 0 ? 'buy' : day.foreign < 0 ? 'sell' : ''">
              {{ day.foreign > 0 ? '+' : '' }}{{ day.foreign.toLocaleString() }}
            </span>
            <span class="col-val" :class="day.institution > 0 ? 'buy' : day.institution < 0 ? 'sell' : ''">
              {{ day.institution > 0 ? '+' : '' }}{{ day.institution.toLocaleString() }}
            </span>
            <span class="col-val" :class="day.individual > 0 ? 'buy' : day.individual < 0 ? 'sell' : ''">
              {{ day.individual > 0 ? '+' : '' }}{{ day.individual.toLocaleString() }}
            </span>
          </div>
        </div>

        <!-- 연속 매수 요약 -->
        <div class="trend-summary">
          <UiBadge
            v-if="consecutiveBuyDays(data[code].trends, 'foreign') >= 2"
            variant="danger"
            size="sm"
          >
            외국인 {{ consecutiveBuyDays(data[code].trends, 'foreign') }}일 연속 매수
          </UiBadge>
          <UiBadge
            v-if="consecutiveBuyDays(data[code].trends, 'institution') >= 2"
            variant="warning"
            size="sm"
          >
            기관 {{ consecutiveBuyDays(data[code].trends, 'institution') }}일 연속 매수
          </UiBadge>
          <span
            v-if="consecutiveBuyDays(data[code].trends, 'foreign') >= 5 || consecutiveBuyDays(data[code].trends, 'institution') >= 5"
            class="long-term-signal"
          >
            📌 연기금/외인 연속 매수 = 장기 관점 긍정 시그널
          </span>
        </div>
      </div>

      <div v-else class="loading-msg">외인/기관 데이터 로딩 중...</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.investor-trend {
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

.meta-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}
.meta-item {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 4px;
}

.trend-table { margin-bottom: 12px; }
.trend-row {
  display: grid;
  grid-template-columns: 90px 1fr 1fr 1fr;
  gap: 8px;
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
.col-date { color: #9ca3af; font-size: 12px; }
.col-val {
  text-align: right;
  font-weight: 500;
  &.buy { color: #ef4444; }
  &.sell { color: #3b82f6; }
}

.trend-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.long-term-signal {
  font-size: 12px;
  color: #b45309;
  font-weight: 600;
}

.loading-msg {
  text-align: center;
  padding: 16px;
  color: #9ca3af;
  font-size: 14px;
}

@media (max-width: 640px) {
  .investor-trend { padding: 14px; }
  .trend-row {
    grid-template-columns: 70px 1fr 1fr 1fr;
    font-size: 12px;
  }
}
</style>
