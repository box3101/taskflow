<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon, UiTable } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { fetchInvestor } from '../../api/stockApi'
import type { InvestorData } from '../../api/stockApi'

type RecItem = { code: string; name: string; theme: string }

const props = defineProps<{
  holdings: { code: string; name: string }[]
  momentum: RecItem[]
  laggard: RecItem[]
  overheat: RecItem[]
}>()

const investorMap = ref<Record<string, InvestorData>>({})
const loading = ref(false)

// 모든 종목 코드+이름 통합 (중복 제거)
const allStocks = computed(() => {
  const map = new Map<string, { code: string; name: string; theme: string }>()
  for (const h of props.holdings) {
    if (h.code) map.set(h.code, { code: h.code, name: h.name, theme: '' })
  }
  for (const r of [...props.momentum, ...props.laggard, ...props.overheat]) {
    if (r.code && !map.has(r.code)) map.set(r.code, { code: r.code, name: r.name, theme: r.theme })
  }
  return [...map.values()]
})

// 연속 매수일 계산
function consecutiveDays(trends: InvestorData['trends'], type: 'foreign' | 'institution'): number {
  let count = 0
  for (const day of trends) {
    if (day[type] > 0) count++
    else break
  }
  return count
}

// 랭킹 데이터
const rankList = computed(() => {
  const list: { code: string; name: string; theme: string; foreignDays: number; instDays: number; maxDays: number }[] = []
  for (const stock of allStocks.value) {
    const data = investorMap.value[stock.code]
    if (!data?.trends?.length) continue
    const foreignDays = consecutiveDays(data.trends, 'foreign')
    const instDays = consecutiveDays(data.trends, 'institution')
    const maxDays = Math.max(foreignDays, instDays)
    if (maxDays >= 2) {
      list.push({ code: stock.code, name: stock.name, theme: stock.theme, foreignDays, instDays, maxDays })
    }
  }
  return list.sort((a, b) => b.maxDays - a.maxDays)
})

// 데이터 로드
async function loadAll() {
  const codes = allStocks.value.map(s => s.code).filter(c => !investorMap.value[c])
  if (codes.length === 0) return
  loading.value = true
  await Promise.all(codes.map(async (code) => {
    investorMap.value[code] = await fetchInvestor(code)
  }))
  loading.value = false
}

// 종목 목록 변경 시 자동 로드
watch(allStocks, () => loadAll(), { immediate: true })

const rankColumns: TableColumn[] = [
  { key: 'rank', label: '#', width: '36px', align: 'center' },
  { key: 'name', label: '종목명', width: '120px', align: 'left' },
  { key: 'theme', label: '테마', width: '80px', align: 'center', hideBelow: 640 },
  { key: 'foreignDays', label: '외인', width: '100px', align: 'center' },
  { key: 'instDays', label: '기관', width: '100px', align: 'center' },
]

const tableData = computed(() =>
  rankList.value.map((item, i) => ({ ...item, rank: i + 1 }))
)

function badgeVariant(days: number): 'default' | 'warning' | 'danger' {
  if (days >= 10) return 'danger'
  if (days >= 5) return 'warning'
  return 'default'
}
</script>

<template>
  <div class="consecutive-buy-rank">
    <div class="section-header">
      <h3><UiIcon name="flame" :size="18" /> 연속 매수 랭킹</h3>
      <span class="section-desc">외인·기관 연속 순매수 기준</span>
    </div>

    <div v-if="loading && rankList.length === 0" class="loading-msg">데이터 로딩 중...</div>

    <UiTable
      v-else
      :columns="rankColumns"
      :data="tableData"
      :bordered="false"
      size="sm"
      empty-text="연속 매수 2일 이상 종목이 없습니다."
    >
      <template #cell-rank="{ row }">
        <span class="col-rank">{{ row.rank }}</span>
      </template>
      <template #cell-theme="{ row }">
        <UiBadge v-if="row.theme" variant="default" size="sm">{{ row.theme }}</UiBadge>
      </template>
      <template #cell-foreignDays="{ row }">
        <UiBadge v-if="row.foreignDays >= 2" :variant="badgeVariant(row.foreignDays)" size="sm">
          {{ row.foreignDays }}일 연속
        </UiBadge>
        <span v-else class="no-signal">-</span>
      </template>
      <template #cell-instDays="{ row }">
        <UiBadge v-if="row.instDays >= 2" :variant="badgeVariant(row.instDays)" size="sm">
          {{ row.instDays }}일 연속
        </UiBadge>
        <span v-else class="no-signal">-</span>
      </template>
    </UiTable>
  </div>
</template>

<style lang="scss" scoped>
.consecutive-buy-rank {
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
.section-desc { font-size: 12px; color: #9ca3af; }

.col-rank { color: #9ca3af; font-weight: 600; }
.no-signal { color: #d1d5db; }

.loading-msg {
  text-align: center; padding: 24px; color: #9ca3af; font-size: 14px;
}

@media (max-width: 640px) {
  .consecutive-buy-rank { padding: 14px; }
}
</style>
