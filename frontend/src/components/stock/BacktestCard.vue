<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiBadge, UiTab } from '@leechanyong/ispark-ui'

interface HoldResult {
  totalTrades: number
  winRate: number
  avgPnL: number
  avgWin: number
  avgLoss: number
  maxPnL: number
  minPnL: number
  maxDrawdown: number
  top5: { name: string; date: string; pnl: number }[]
  worst5: { name: string; date: string; pnl: number }[]
  byTheme: Record<string, { trades: number; avgPnL: number }>
}

interface BacktestData {
  analyzedAt: string
  period: string
  stockPool: number
  strategy: string
  holdPeriods: Record<string, HoldResult>
}

const data = ref<BacktestData | null>(null)
const activeHold = ref('5d')
const holdTabs = [
  { label: '1일', value: '1d' },
  { label: '3일', value: '3d' },
  { label: '5일', value: '5d' },
]

onMounted(async () => {
  try {
    const res = await fetch('/data/backtest-result.json')
    data.value = await res.json()
  } catch (e) {
    console.warn('백테스트 데이터 로드 실패:', e)
  }
})

function currentResult(): HoldResult | null {
  return data.value?.holdPeriods[activeHold.value] || null
}

function sortedThemes(r: HoldResult) {
  return Object.entries(r.byTheme)
    .map(([name, st]) => ({ name, ...st }))
    .sort((a, b) => b.avgPnL - a.avgPnL)
}

function formatDate(d: string) {
  if (!d || d.length < 8) return d
  return `${d.slice(4, 6)}/${d.slice(6, 8)}`
}
</script>

<template>
  <details class="backtest-card">
    <summary class="card-header">
      <h3>📈 백테스트 결과</h3>
      <span class="card-desc">모멘텀 초기 전략 · 118종목 · 4개월</span>
    </summary>

    <div v-if="data" class="card-body">
      <div class="strategy-info">
        <span>전략: {{ data.strategy }}</span>
        <span>기간: {{ data.period }}</span>
        <span>종목: {{ data.stockPool }}개</span>
      </div>

      <UiTab v-model="activeHold" :tabs="holdTabs" size="sm" alignment="left" />

      <div v-if="currentResult()" class="result-section">
        <!-- 핵심 지표 -->
        <div class="stat-cards">
          <div class="stat-card">
            <span class="stat-label">총 거래</span>
            <span class="stat-value">{{ currentResult()!.totalTrades }}건</span>
          </div>
          <div class="stat-card" :class="currentResult()!.winRate >= 50 ? 'positive' : 'negative'">
            <span class="stat-label">승률</span>
            <span class="stat-value">{{ currentResult()!.winRate }}%</span>
          </div>
          <div class="stat-card" :class="currentResult()!.avgPnL >= 0 ? 'positive' : 'negative'">
            <span class="stat-label">평균 수익</span>
            <span class="stat-value">{{ currentResult()!.avgPnL >= 0 ? '+' : '' }}{{ currentResult()!.avgPnL }}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">MDD</span>
            <span class="stat-value negative-text">{{ currentResult()!.maxDrawdown }}%</span>
          </div>
        </div>

        <!-- 승/패 평균 -->
        <div class="win-loss-bar">
          <div class="wl-item win">
            <span class="wl-label">평균 승</span>
            <span class="wl-value">+{{ currentResult()!.avgWin }}%</span>
          </div>
          <div class="wl-item loss">
            <span class="wl-label">평균 패</span>
            <span class="wl-value">{{ currentResult()!.avgLoss }}%</span>
          </div>
          <div class="wl-item best">
            <span class="wl-label">최대 수익</span>
            <span class="wl-value">+{{ currentResult()!.maxPnL }}%</span>
          </div>
          <div class="wl-item worst">
            <span class="wl-label">최대 손실</span>
            <span class="wl-value">{{ currentResult()!.minPnL }}%</span>
          </div>
        </div>

        <!-- 테마별 성과 -->
        <h4>테마별 성과</h4>
        <div class="theme-perf">
          <div
            v-for="t in sortedThemes(currentResult()!)"
            :key="t.name"
            class="theme-row"
          >
            <span class="theme-name">{{ t.name }}</span>
            <span class="theme-trades">{{ t.trades }}건</span>
            <UiBadge
              :variant="t.avgPnL >= 0 ? 'success' : 'danger'"
              size="sm"
            >{{ t.avgPnL >= 0 ? '+' : '' }}{{ t.avgPnL }}%</UiBadge>
          </div>
        </div>

        <!-- TOP 5 / WORST 5 -->
        <div class="top-worst">
          <div class="tw-section">
            <h4>TOP 5</h4>
            <div v-for="t in currentResult()!.top5" :key="t.name + t.date" class="tw-row">
              <span class="tw-name">{{ t.name }}</span>
              <span class="tw-date">{{ formatDate(t.date) }}</span>
              <span class="tw-pnl positive-text">+{{ t.pnl }}%</span>
            </div>
          </div>
          <div class="tw-section">
            <h4>WORST 5</h4>
            <div v-for="t in currentResult()!.worst5" :key="t.name + t.date" class="tw-row">
              <span class="tw-name">{{ t.name }}</span>
              <span class="tw-date">{{ formatDate(t.date) }}</span>
              <span class="tw-pnl negative-text">{{ t.pnl }}%</span>
            </div>
          </div>
        </div>
      </div>

      <p class="disclaimer">
        과거 수익률이 미래 수익을 보장하지 않습니다. 백테스트는 참고용입니다.
      </p>
    </div>

    <div v-else class="card-body empty">백테스트 데이터 로딩 중...</div>
  </details>
</template>

<style lang="scss" scoped>
.backtest-card {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  overflow: hidden;
  &[open] { border-color: #86efac; }
}

.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; cursor: pointer;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
  &:hover { background: #f0fdf4; }
  &::marker { color: #22c55e; }
}
.card-desc { font-size: 12px; color: #9ca3af; }
.card-body { padding: 0 20px 20px; }
.empty { text-align: center; padding: 24px; color: #9ca3af; }

.strategy-info {
  display: flex; gap: 16px; margin: 12px 0;
  font-size: 12px; color: #6b7280;
  span { background: #f3f4f6; padding: 4px 8px; border-radius: 4px; }
}

.result-section { margin-top: 16px; }

.stat-cards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;
}
.stat-card {
  text-align: center; padding: 12px 8px; border-radius: 8px; background: #f9fafb;
  &.positive { background: #f0fdf4; }
  &.negative { background: #fef2f2; }
}
.stat-label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 4px; }
.stat-value { display: block; font-size: 20px; font-weight: 800; color: #1f2937; }
.positive .stat-value { color: #16a34a; }
.negative .stat-value { color: #dc2626; }
.negative-text { color: #dc2626 !important; }
.positive-text { color: #16a34a; }

.win-loss-bar {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;
}
.wl-item {
  padding: 8px; border-radius: 6px; text-align: center;
  &.win { background: #f0fdf4; }
  &.loss { background: #fef2f2; }
  &.best { background: #ecfdf5; }
  &.worst { background: #fff1f2; }
}
.wl-label { display: block; font-size: 11px; color: #6b7280; }
.wl-value { display: block; font-size: 14px; font-weight: 700; }
.win .wl-value { color: #16a34a; }
.loss .wl-value { color: #dc2626; }
.best .wl-value { color: #059669; }
.worst .wl-value { color: #e11d48; }

h4 { font-size: 14px; font-weight: 700; margin: 16px 0 8px; color: #374151; }

.theme-perf { margin-bottom: 16px; }
.theme-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0; font-size: 13px; border-bottom: 1px solid #f0f1f3;
  &:last-child { border-bottom: none; }
}
.theme-name { flex: 1; color: #374151; }
.theme-trades { color: #9ca3af; font-size: 12px; }

.top-worst { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tw-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 13px;
}
.tw-name { flex: 1; color: #374151; }
.tw-date { color: #9ca3af; font-size: 12px; }
.tw-pnl { font-weight: 700; font-size: 13px; }

.disclaimer { font-size: 11px; color: #9ca3af; margin-top: 12px; }

@media (max-width: 640px) {
  .card-body { padding: 0 12px 12px; }
  .summary-cards { grid-template-columns: 1fr 1fr; }
  .period-summary { grid-template-columns: 1fr 1fr; }
  .top-worst { grid-template-columns: 1fr; }
}
</style>
