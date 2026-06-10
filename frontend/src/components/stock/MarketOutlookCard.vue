<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiIcon, UiBadge } from '@leechanyong/ispark-ui'

interface OutlookData {
  updatedAt: string
  foreignFlow: {
    status: string
    consecutiveDays: number
    ytdTotal: string
    dailyAvg: string
    topSells: { name: string; amount: string }[]
    topBuys: string[]
    reasons: string[]
  }
  brokerageTargets: { name: string; target: string; note: string }[]
  reversalSignals: { label: string; current: string; target: string; status: string }[]
  outlook: string
  kospiPER: string
}

const data = ref<OutlookData | null>(null)
const expanded = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/data/market-outlook.json')
    data.value = await res.json()
  } catch (e) {
    console.warn('[MarketOutlook] 로드 실패:', e)
  }
})

const statusIcon: Record<string, string> = {
  warning: 'alert-triangle',
  pending: 'clock',
  ok: 'check-circle',
}

const statusColor: Record<string, string> = {
  warning: '#f59e0b',
  pending: '#9ca3af',
  ok: '#22c55e',
}
</script>

<template>
  <div class="outlook" v-if="data" @click="expanded = !expanded">
    <!-- 요약 헤더 -->
    <div class="outlook__header">
      <div class="outlook__title">
        <UiIcon name="radar" :size="16" color="primary" />
        <span>시장 전망</span>
        <UiBadge variant="danger" size="sm">
          외국인 {{ data.foreignFlow.consecutiveDays }}일 연속 매도
        </UiBadge>
      </div>
      <div class="outlook__meta">
        <span class="outlook__date">{{ data.updatedAt }} 기준</span>
        <UiIcon :name="expanded ? 'chevron-up' : 'chevron-down'" :size="16" />
      </div>
    </div>

    <!-- 요약 숫자 -->
    <div class="outlook__summary">
      <div class="outlook__stat">
        <span class="outlook__stat-label">연간 순매도</span>
        <span class="outlook__stat-value outlook__stat-value--sell">{{ data.foreignFlow.ytdTotal }}</span>
      </div>
      <div class="outlook__stat">
        <span class="outlook__stat-label">일평균</span>
        <span class="outlook__stat-value outlook__stat-value--sell">{{ data.foreignFlow.dailyAvg }}</span>
      </div>
      <div class="outlook__stat">
        <span class="outlook__stat-label">코스피 PER</span>
        <span class="outlook__stat-value">{{ data.kospiPER }}</span>
      </div>
      <div class="outlook__stat">
        <span class="outlook__stat-label">증권가 최고 목표</span>
        <span class="outlook__stat-value outlook__stat-value--buy">{{ data.brokerageTargets[0]?.target }}</span>
      </div>
    </div>

    <!-- 확장 상세 -->
    <div v-if="expanded" class="outlook__detail" @click.stop>
      <!-- 외국인 매도 현황 -->
      <div class="outlook__section">
        <h4><UiIcon name="trending-down" :size="14" color="danger" /> 외국인 매도 현황</h4>
        <div class="outlook__sells">
          <div v-for="s in data.foreignFlow.topSells" :key="s.name" class="sell-chip">
            {{ s.name }} <strong>{{ s.amount }}</strong>
          </div>
        </div>
        <div class="outlook__reasons">
          <span v-for="r in data.foreignFlow.reasons" :key="r" class="reason-tag">{{ r }}</span>
        </div>
        <div class="outlook__buys">
          <span class="buys-label"><UiIcon name="trending-up" :size="12" color="success" /> 매수 업종:</span>
          <span v-for="b in data.foreignFlow.topBuys" :key="b" class="buy-chip">{{ b }}</span>
        </div>
      </div>

      <!-- 증권사 목표 -->
      <div class="outlook__section">
        <h4><UiIcon name="building-2" :size="14" /> 증권사 코스피 전망</h4>
        <div class="outlook__targets">
          <div v-for="t in data.brokerageTargets" :key="t.name" class="target-row">
            <span class="target-name">{{ t.name }}</span>
            <span class="target-value">{{ t.target }}</span>
            <span class="target-note">{{ t.note }}</span>
          </div>
        </div>
      </div>

      <!-- 매수 전환 시그널 -->
      <div class="outlook__section">
        <h4><UiIcon name="radio" :size="14" color="warning" /> 매수 전환 시그널</h4>
        <div class="outlook__signals">
          <div v-for="s in data.reversalSignals" :key="s.label" class="signal-row">
            <UiIcon :name="statusIcon[s.status] || 'circle'" :size="14" :style="{ color: statusColor[s.status] }" />
            <span class="signal-label">{{ s.label }}</span>
            <span class="signal-current">{{ s.current }}</span>
            <UiIcon name="arrow-right" :size="12" />
            <span class="signal-target">{{ s.target }}</span>
          </div>
        </div>
      </div>

      <!-- 전망 요약 -->
      <div class="outlook__bottom">
        <UiIcon name="lightbulb" :size="14" color="warning" />
        <span>{{ data.outlook }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.outlook {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: box-shadow 0.15s;

  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }
}

.outlook__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.outlook__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}

.outlook__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.outlook__date {
  font-size: 11px;
  color: #9ca3af;
}

// 요약 숫자
.outlook__summary {
  display: flex;
  gap: 16px;
}

.outlook__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 8px;
}

.outlook__stat-label {
  font-size: 11px;
  color: #9ca3af;
}

.outlook__stat-value {
  font-size: 16px;
  font-weight: 800;
  color: #1f2937;

  &--sell { color: #3b82f6; }
  &--buy { color: #ef4444; }
}

// 상세
.outlook__detail {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: default;
}

.outlook__section {
  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    margin: 0 0 8px 0;
  }
}

// 매도 현황
.outlook__sells {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.sell-chip {
  padding: 4px 10px;
  background: #eff6ff;
  border-radius: 6px;
  font-size: 12px;
  color: #3b82f6;
  strong { font-weight: 700; }
}

.outlook__reasons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.reason-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  color: #6b7280;
}

.outlook__buys {
  display: flex;
  align-items: center;
  gap: 6px;
}

.buys-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.buy-chip {
  font-size: 12px;
  padding: 2px 8px;
  background: #ecfdf5;
  border-radius: 4px;
  color: #16a34a;
  font-weight: 600;
}

// 증권사 목표
.outlook__targets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;

  &:nth-child(1) { background: #fef2f2; }
  &:nth-child(2) { background: #f9fafb; }
  &:nth-child(3) { background: #f9fafb; }
  &:nth-child(4) { background: #f9fafb; }
}

.target-name {
  font-weight: 600;
  color: #374151;
  min-width: 80px;
}

.target-value {
  font-weight: 800;
  color: #ef4444;
  min-width: 100px;
}

.target-note {
  font-size: 11px;
  color: #9ca3af;
}

// 시그널
.outlook__signals {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.signal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 10px;
  background: #f9fafb;
  border-radius: 6px;
}

.signal-label {
  font-weight: 600;
  color: #374151;
  min-width: 70px;
}

.signal-current {
  color: #6b7280;
  min-width: 100px;
}

.signal-target {
  color: #16a34a;
  font-weight: 600;
}

// 전망
.outlook__bottom {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  background: #fffbeb;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .outlook__summary { flex-wrap: wrap; }
  .outlook__stat { min-width: calc(50% - 8px); }
}

// 다크모드
:global([data-theme="dark"]) {
  .outlook {
    background: #1e2028;
    border-color: #2d2f36;
  }
  .outlook__stat { background: #262830; }
  .outlook__stat-value { color: #e5e7eb; }
  .sell-chip { background: #1e293b; }
  .buy-chip { background: #1a3a2a; }
  .reason-tag { background: #2d2f36; }
  .target-row { background: #262830 !important; }
  .target-row:nth-child(1) { background: #2a2020 !important; }
  .target-name { color: #d1d5db; }
  .signal-row { background: #262830; }
  .signal-label { color: #d1d5db; }
  .outlook__bottom { background: #2a2520; }
}
</style>
