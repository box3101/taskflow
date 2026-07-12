<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon, UiTable } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { fetchInvestor } from '../../api/stockApi'
import type { InvestorData, StockQuote } from '../../api/stockApi'
import { calculateRanking, type StockInput, type ScoreBreakdown } from '../../utils/smartScoreV2'

type ThemeDef = { label: string; stocks: { code: string; name: string }[] }

const props = defineProps<{
  themes: ThemeDef[]
  themeQuotes: Record<string, StockQuote>
}>()

const investorMap = ref<Record<string, InvestorData>>({})
const loading = ref(false)
const loadedAt = ref('')

// 테마 종목 중 quotes + investor 데이터 있는 것만
const stockInputs = computed<StockInput[]>(() => {
  const items: StockInput[] = []
  for (const theme of props.themes) {
    for (const stock of theme.stocks) {
      const q = props.themeQuotes[stock.code]
      const data = investorMap.value[stock.code]
      if (!q || !data?.trends?.length) continue
      items.push({
        code: stock.code,
        name: stock.name,
        theme: theme.label,
        chg20: q.changePct20 || 0,
        chg5: q.changePct5 || 0,
        data,
      })
    }
  }
  return items
})

// v2 랭킹 계산
const scoreList = computed<ScoreBreakdown[]>(() => calculateRanking(stockInputs.value))

// investor 데이터 로드 (10개씩 배치)
async function loadInvestorData() {
  const allCodes: string[] = []
  for (const theme of props.themes) {
    for (const stock of theme.stocks) {
      if (props.themeQuotes[stock.code] && !investorMap.value[stock.code]) {
        allCodes.push(stock.code)
      }
    }
  }
  if (allCodes.length === 0) return
  loading.value = true
  const BATCH = 10
  for (let i = 0; i < allCodes.length; i += BATCH) {
    const batch = allCodes.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(code => fetchInvestor(code)))
    batch.forEach((code, idx) => { investorMap.value[code] = results[idx] })
  }
  loading.value = false
  const now = new Date()
  loadedAt.value = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

watch(() => [props.themes, props.themeQuotes], () => loadInvestorData(), { immediate: true, deep: true })

const scoreColumns: TableColumn[] = [
  { key: 'rank', label: '#', width: '36px', align: 'center' },
  { key: 'name', label: '종목명', width: '120px', align: 'left' },
  { key: 'theme', label: '테마', width: '80px', align: 'center', hideBelow: 640 },
  { key: 'total', label: '종합', width: '66px', align: 'center' },
  { key: 'supply', label: '수급', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'momentum', label: '등락률', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'surge', label: '회전율', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'valuation', label: 'PER/PBR', width: '54px', align: 'center', hideBelow: 480 },
]

const tableData = computed(() =>
  scoreList.value.map((item, i) => ({
    ...item,
    rank: i + 1,
  }))
)

function scoreBadgeVariant(score: number): 'danger' | 'warning' | 'default' {
  if (score >= 80) return 'danger'
  if (score >= 60) return 'warning'
  return 'default'
}
</script>

<template>
  <div class="smart-score">
    <div class="section-header">
      <h3><UiIcon name="trophy" :size="18" /> Smart Score 랭킹</h3>
      <span class="section-desc">수급(45) + 등락률(30) + 회전율(10) + PER/PBR(15) <span v-if="loadedAt" class="loaded-at">{{ loadedAt }} 기준</span></span>
    </div>

    <div v-if="loading && scoreList.length === 0" class="loading-msg">
      종목 분석 중... ({{ Object.keys(investorMap).length }}/{{ stockInputs.length }})
    </div>

    <UiTable
      v-else
      :columns="scoreColumns"
      :data="tableData"
      :bordered="false"
      size="sm"
      empty-text="분석할 종목이 없습니다."
    >
      <template #cell-rank="{ row }">
        <span class="col-rank">{{ row.rank }}</span>
      </template>
      <template #cell-name="{ row }">
        <span class="col-name">
          {{ row.name }}
          <span v-if="row.foreignRatio >= 0.5 || row.instRatio >= 0.5" class="streak-info">
            <template v-if="row.foreignRatio >= 0.5">외{{ Math.round(row.foreignRatio * 10) }}/10</template>
            <template v-if="row.foreignRatio >= 0.5 && row.instRatio >= 0.5"> </template>
            <template v-if="row.instRatio >= 0.5">기{{ Math.round(row.instRatio * 10) }}/10</template>
          </span>
          <span v-if="row.foreignSellDays >= 3" class="sell-streak-info">외매도{{ row.foreignSellDays }}일</span>
          <span v-if="row.overextended" class="overheat-badge">과열</span>
          <span v-if="row.valuationMissing" class="missing-badge">밸류결측</span>
        </span>
      </template>
      <template #cell-theme="{ row }">
        <UiBadge variant="default" size="sm">{{ row.theme }}</UiBadge>
      </template>
      <template #cell-total="{ row }">
        <UiBadge :variant="scoreBadgeVariant(row.total)" size="sm">{{ row.total }}점</UiBadge>
      </template>
    </UiTable>
  </div>
</template>

<style lang="scss" scoped>
.smart-score {
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
.section-desc { font-size: 12px; color: #9ca3af; display: flex; align-items: center; gap: 6px; }
.loaded-at { font-size: 11px; color: #6b7280; font-weight: 500; }

.col-rank { color: #9ca3af; font-weight: 600; }
.col-name {
  color: #374151;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.streak-info { font-size: 11px; color: #ef4444; font-weight: 600; }
.sell-streak-info { font-size: 10px; color: #3b82f6; font-weight: 600; }
.overheat-badge {
  font-size: 10px; color: #fff; background: #f97316;
  padding: 1px 5px; border-radius: 3px; font-weight: 600;
}
.missing-badge {
  font-size: 10px; color: #6b7280; background: #f3f4f6;
  padding: 1px 5px; border-radius: 3px; font-weight: 600;
}

.loading-msg {
  text-align: center; padding: 24px; color: #9ca3af; font-size: 14px;
}

@media (max-width: 640px) {
  .smart-score { padding: 14px; }
}
</style>
