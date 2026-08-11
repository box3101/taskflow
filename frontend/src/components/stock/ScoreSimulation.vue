<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiButton, UiIcon, UiTab, UiSelect, UiEmpty, UiChart, UiTable, UiBadge, UiDrawer } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption, TableColumn } from '@leechanyong/ispark-ui'
import { useScoreSnapshots } from '../../composables/useScoreSnapshots'
import { simulate, buildDailySeries, computeDailyMdd, HORIZON_DAYS } from '../../utils/scoreSimulation'
import type { SimCycle } from '../../utils/scoreSimulation'
import { formatPct, pctColor } from '../../utils/stockFormat'

const STORAGE_COUNT = 'taskflow.scoreSim.stockCount'
const STORAGE_SEED = 'taskflow.scoreSim.seedCash'

const { snapshots, prices, marks, loading, error, handleLoadSnapshots, handleRefreshSnapshots } = useScoreSnapshots()

// ===== 설정 (localStorage 저장) =====
const stockCount = ref(Math.max(1, Number(localStorage.getItem(STORAGE_COUNT)) || 3))
const seedCash = ref(Math.max(1, Number(localStorage.getItem(STORAGE_SEED)) || 10000000))

watch(stockCount, v => localStorage.setItem(STORAGE_COUNT, String(v)))
watch(seedCash, v => localStorage.setItem(STORAGE_SEED, String(v)))

const countTabs: TabItem[] = [
  { label: '상위 1', value: '1' },
  { label: '상위 3', value: '3' },
  { label: '상위 5', value: '5' },
  { label: '상위 10', value: '10' },
]
const countTab = computed({
  get: () => String(stockCount.value),
  set: (v: string) => { stockCount.value = Number(v) },
})

const seedOptions: SelectOption[] = [
  { label: '500만원', value: '5000000' },
  { label: '1,000만원', value: '10000000' },
  { label: '3,000만원', value: '30000000' },
  { label: '5,000만원', value: '50000000' },
]
const seedSelect = computed({
  get: () => String(seedCash.value),
  set: (v: string | number) => { seedCash.value = Number(v) },
})

// ===== 시뮬레이션 =====
const result = computed(() => simulate({
  snapshots: snapshots.value,
  prices: prices.value,
  stockCount: stockCount.value,
  seedCash: seedCash.value,
}))

const hasCycles = computed(() => result.value.cycles.length > 0)
const noEntryCount = computed(() => result.value.skipped.filter(s => s.reason === 'no-entry-date').length)

// ===== 일별 자산 시계열 =====
// 백엔드가 ScoreDailyMark를 기록하기 시작한 지 얼마 안 됐다면 마크가 비어있을 수 있다 — 그 경우 회차 기준으로 폴백한다
const dailySeries = computed(() => buildDailySeries(result.value.cycles, marks.value))
const hasDailySeries = computed(() => dailySeries.value.length > 0)

// ===== MDD =====
// 일별 시리즈가 있으면 회차 안쪽 낙폭까지 반영한 일별 MDD를, 없으면 회차 기준 MDD를 쓴다
const mddValue = computed(() =>
  hasDailySeries.value ? computeDailyMdd(result.value.seedCash, dailySeries.value) : result.value.mdd
)
const mddBasisLabel = computed(() => (hasDailySeries.value ? '일별 기준 최대낙폭' : '확정 회차 기준 최대낙폭'))

// ===== 자산곡선 =====
// 라인차트 config 계약: { categories, datasets } — datasets는 Chart.js 데이터셋을 그대로 받는다
const assetChart = computed(() => {
  const cycles = result.value.cycles
  const series = dailySeries.value

  if (!hasDailySeries.value) {
    // 마크가 아직 없으면(과거 회차 등) 기존처럼 회차 기준으로 그린다
    return {
      categories: ['시작', ...cycles.map(c => c.entryDate.slice(5))],
      datasets: [
        {
          label: '비용후',
          data: [result.value.seedCash, ...cycles.map(c => c.endAsset)],
          borderColor: '#ef4444',
        },
        {
          label: '비용전',
          data: [result.value.seedCash, ...cycles.map(c => c.endAssetGross)],
          borderColor: '#9ca3af',
          borderDash: [4, 4],
        },
      ],
      tooltipValueSuffix: '원',
    }
  }

  // 비용전(수수료·세금 미차감) 트랙은 매수 수량이 비용후 트랙과 갈리기 때문에 일별 마크(종가)만으로는
  // 중간 날짜의 자산을 계산할 수 없다 — 아는 값(회차 종료 시점)만 점으로 찍고 나머지는 null로 비워
  // 끊긴 선으로 그린다. 억지로 이어 붙이면 실제로 계산하지 않은 값을 있는 것처럼 보여주게 된다.
  return {
    categories: ['시작', ...series.map(p => p.date.slice(5))],
    datasets: [
      {
        label: '비용후',
        data: [result.value.seedCash, ...series.map(p => p.asset)],
        borderColor: '#ef4444',
      },
      {
        label: '비용전',
        data: [
          result.value.seedCash,
          ...series.map(p => {
            if (!p.isCycleEnd) return null
            return cycles.find(c => c.index === p.cycleIndex)?.endAssetGross ?? null
          }),
        ],
        borderColor: '#9ca3af',
        borderDash: [4, 4],
        spanGaps: false,
      },
    ],
    tooltipValueSuffix: '원',
  }
})

// ===== 표시 헬퍼 =====
const won = (v: number) => Math.round(v).toLocaleString()

// ===== 회차별 표 =====
const cycleColumns: TableColumn[] = [
  { key: 'no', label: '회차', width: '52px', align: 'center' },
  { key: 'date', label: '스코어일', width: '72px', align: 'center' },
  { key: 'entry', label: '기산일', width: '64px', align: 'center', hideBelow: 640 },
  { key: 'stocks', label: '종목', width: '48px', align: 'center' },
  { key: 'status', label: '상태', width: '64px', align: 'center' },
  { key: 'invest', label: '투입금', width: '96px', align: 'right', hideBelow: 480 },
  { key: 'endAsset', label: '평가금', width: '96px', align: 'right' },
  { key: 'profit', label: '손익', width: '92px', align: 'right' },
  { key: 'returnPct', label: '수익률', width: '72px', align: 'right' },
]

const cycleRows = computed(() =>
  result.value.cycles.map(c => ({
    no: c.index,
    date: c.date.slice(5),
    entry: c.entryDate.slice(5),
    stocks: c.holdings.filter(h => h.quantity > 0).length,
    status: c.noTrade ? '매매없음' : c.matured ? '확정' : '진행중',
    invest: c.investAmount,
    endAsset: c.endAsset,
    profit: c.profit,
    returnPct: c.returnPct,
    badge: c.noTrade ? 'default' : c.matured ? 'success' : 'default',
    cycle: c,
  }))
)

// ===== 종목 상세 드로어 =====
const drawerOpen = ref(false)
const selectedCycle = ref<SimCycle | null>(null)

function openCycleDetail(row: { cycle: SimCycle }) {
  selectedCycle.value = row.cycle
  drawerOpen.value = true
}

// 건너뛴 스냅샷 (보유중이라 매매 못 한 날)
const holdingSkipped = computed(() => result.value.skipped.filter(s => s.reason === 'holding'))

handleLoadSnapshots()
</script>

<template>
  <div class="score-simulation">
    <div class="section-header">
      <h3><UiIcon name="trending-up" :size="18" /> 가상매매 수익률</h3>
      <UiButton size="sm" variant="secondary" :disabled="loading" @click="handleRefreshSnapshots">
        {{ loading ? '로딩...' : '새로고침' }}
      </UiButton>
    </div>

    <p class="desc">
      스코어 상위 N종목을 <b>스코어일 종가</b>로 사서 만기 기산일부터 <b>D+{{ HORIZON_DAYS }}</b>에 파는 것을 반복했을 때의 실제 돈 흐름<br />
      보유 중에 저장된 스냅샷은 건너뛰고 자금 한 줄만 순차로 굴린다 (논오버랩 복리)
    </p>

    <!-- 설정 -->
    <div class="sim-controls">
      <UiTab v-model="countTab" :tabs="countTabs" align="left" size="sm" />
      <div class="seed-wrap">
        <span class="seed-label">종자금</span>
        <UiSelect v-model="seedSelect" :options="seedOptions" size="sm" />
      </div>
    </div>

    <div v-if="loading" class="loading-msg">시뮬레이션 계산 중...</div>
    <div v-else-if="error" class="loading-msg">{{ error }}</div>

    <UiEmpty
      v-else-if="!hasCycles"
      title="계산할 사이클이 없습니다."
      description="Smart Score에서 스코어를 저장하고 3거래일 이상 모아주세요."
    />

    <template v-else>
      <!-- 요약 4칸 -->
      <div class="sim-summary">
        <div class="sum-card">
          <div class="s-label">최종자산</div>
          <div class="s-value">{{ won(result.finalAsset) }}원</div>
          <div class="s-sub">종자금 {{ won(result.seedCash) }}원</div>
        </div>
        <div class="sum-card">
          <div class="s-label">누적수익률</div>
          <div class="s-value" :style="{ color: pctColor(result.totalReturnPct) }">
            {{ formatPct(result.totalReturnPct) }}
          </div>
          <div class="s-sub">비용전 {{ formatPct(result.totalReturnPctGross) }}</div>
        </div>
        <div class="sum-card">
          <div class="s-label">승률</div>
          <div class="s-value">
            {{ result.winRate === null ? '-' : `${result.winCount}/${result.maturedCount}` }}
          </div>
          <div class="s-sub">
            {{ result.winRate === null ? '확정 회차 없음' : `${result.winRate.toFixed(0)}%` }}
          </div>
        </div>
        <div class="sum-card">
          <div class="s-label">MDD</div>
          <div class="s-value" :style="{ color: mddValue < 0 ? '#3b82f6' : '#6b7280' }">
            {{ mddValue === 0 ? '-' : `${mddValue.toFixed(2)}%` }}
          </div>
          <div class="s-sub">{{ mddBasisLabel }}</div>
        </div>
      </div>

      <!-- 자산곡선 -->
      <div class="chart-wrap">
        <UiChart type="line" :config="assetChart" :show-legend="true" />
      </div>

      <p v-if="result.avgReturnPct !== null && result.bestCycle && result.worstCycle" class="stat-note">
        회차 평균 <b :style="{ color: pctColor(result.avgReturnPct) }">{{ formatPct(result.avgReturnPct) }}</b>
        · 최고 {{ result.bestCycle.index }}회차 {{ formatPct(result.bestCycle.returnPct) }}
        · 최악 {{ result.worstCycle.index }}회차 {{ formatPct(result.worstCycle.returnPct) }}
      </p>

      <p class="cost-note">
        비용 합계 <b>-{{ won(result.totalCost) }}원</b>
        (수수료 0.015%×2 + 증권거래세 0.15%)
        <template v-if="result.pendingCount"> · 진행중 {{ result.pendingCount }}회차</template>
        <template v-if="noEntryCount"> · 진입일 미기록 {{ noEntryCount }}건 제외</template>
      </p>

      <!-- 회차별 -->
      <div class="cycle-section">
        <h4>회차별 <span class="h4-note">(행을 누르면 종목 상세)</span></h4>
        <UiTable
          :columns="cycleColumns"
          :data="(cycleRows as any)"
          size="sm"
          @row-click="(row: any) => openCycleDetail(row)"
        >
          <template #cell-status="{ row }: any">
            <UiBadge :variant="row.badge" size="sm">{{ row.status }}</UiBadge>
          </template>
          <template #cell-invest="{ row }: any">{{ won(row.invest) }}</template>
          <template #cell-endAsset="{ row }: any">{{ won(row.endAsset) }}</template>
          <template #cell-profit="{ row }: any">
            <span :style="{ color: pctColor(row.profit), fontWeight: 700 }">
              {{ row.profit >= 0 ? '+' : '' }}{{ won(row.profit) }}
            </span>
          </template>
          <template #cell-returnPct="{ row }: any">
            <span :style="{ color: pctColor(row.returnPct) }">{{ formatPct(row.returnPct) }}</span>
          </template>
        </UiTable>

        <p v-if="holdingSkipped.length" class="skip-note">
          건너뜀 {{ holdingSkipped.length }}건 (직전 사이클 보유중):
          {{ holdingSkipped.map(s => s.date.slice(5)).join(', ') }}
        </p>
      </div>
    </template>

    <!-- 종목 상세 -->
    <UiDrawer v-model:open="drawerOpen" :title="`${selectedCycle?.index ?? 0}회차 종목 상세`" width="520px">
      <div v-if="selectedCycle" class="detail-body">
        <p class="detail-meta">
          스코어일 {{ selectedCycle.date }} · 기산 {{ selectedCycle.entryDate }} · 청산 {{ selectedCycle.exitDate }}
          <UiBadge :variant="selectedCycle.noTrade ? 'default' : selectedCycle.matured ? 'success' : 'default'" size="sm">
            {{ selectedCycle.noTrade ? '매매없음' : selectedCycle.matured ? '확정' : '진행중' }}
          </UiBadge>
        </p>
        <table class="detail-table">
          <thead>
            <tr>
              <th>종목</th>
              <th>점수</th>
              <th>매수가</th>
              <th>수량</th>
              <th>투입금</th>
              <th>청산가</th>
              <th>손익</th>
              <th>수익률</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in selectedCycle.holdings" :key="h.code">
              <td class="td-name">{{ h.name }}</td>
              <td>{{ h.score }}</td>
              <td>{{ won(h.entryPrice) }}</td>
              <td>{{ h.quantity }}</td>
              <td>{{ won(h.cost) }}</td>
              <td>{{ won(h.exitPrice) }}</td>
              <td :style="{ color: pctColor(h.profit), fontWeight: 700 }">
                {{ h.profit >= 0 ? '+' : '' }}{{ won(h.profit) }}
              </td>
              <td :style="{ color: pctColor(h.returnPct) }">{{ formatPct(h.returnPct) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="detail-foot">
          투입 {{ won(selectedCycle.investAmount) }}원 · 거래비용 {{ won(selectedCycle.tradeCost) }}원 ·
          종료자산 {{ won(selectedCycle.endAsset) }}원
        </p>
      </div>
    </UiDrawer>
  </div>
</template>

<style lang="scss" scoped>
.score-simulation {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}

.desc { font-size: 12px; color: #9ca3af; margin: 0 0 16px; }

.sim-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.seed-wrap { display: flex; align-items: center; gap: 8px; }
.seed-label { font-size: 12px; color: #6b7280; font-weight: 600; white-space: nowrap; }

.loading-msg { text-align: center; padding: 24px; color: #9ca3af; font-size: 14px; }

.sim-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.sum-card {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}
.s-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
.s-value { font-size: 20px; font-weight: 700; }
.s-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }

.chart-wrap {
  height: 220px;
  margin-bottom: 12px;
  :deep(.ui-chart-canvas-wrap) { min-height: 0; }
}

.stat-note { font-size: 12px; color: #6b7280; margin: 0 0 6px; }
.cost-note { font-size: 11px; color: #9ca3af; margin: 0 0 16px; }

.cycle-section {
  border-top: 1px solid #e6e8ec;
  padding-top: 16px;

  h4 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
  .h4-note { font-size: 11px; font-weight: 400; color: #9ca3af; }
}
.skip-note { font-size: 11px; color: #9ca3af; margin: 8px 0 0; }

.detail-body { font-size: 13px; }
.detail-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 12px; color: #6b7280; margin: 0 0 12px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 8px;
    text-align: right;
    border-bottom: 1px solid #f3f4f6;
  }
  th {
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 11px;
    text-align: right;
  }
  .td-name { text-align: left; font-weight: 500; color: #374151; }
  th:first-child { text-align: left; }
}
.detail-foot { font-size: 11px; color: #9ca3af; margin: 10px 0 0; }

@media (max-width: 640px) {
  .score-simulation { padding: 14px; }
  .sim-summary { flex-wrap: wrap; }
  .sum-card { min-width: calc(50% - 8px); }
  .s-value { font-size: 16px; }
  .detail-table { font-size: 11px; th, td { padding: 4px 4px; } }
}
</style>
