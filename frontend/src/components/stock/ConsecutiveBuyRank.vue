<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon } from '@leechanyong/ispark-ui'
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

    <div v-else-if="rankList.length === 0" class="empty-msg">연속 매수 2일 이상 종목이 없습니다.</div>

    <div v-else class="rank-table">
      <div class="rank-row rank-row--header">
        <span class="col-rank">#</span>
        <span class="col-name">종목명</span>
        <span class="col-theme">테마</span>
        <span class="col-days">외인</span>
        <span class="col-days">기관</span>
      </div>
      <div
        v-for="(item, i) in rankList"
        :key="item.code"
        class="rank-row"
      >
        <span class="col-rank">{{ i + 1 }}</span>
        <span class="col-name">{{ item.name }}</span>
        <span class="col-theme">
          <UiBadge v-if="item.theme" variant="default" size="sm">{{ item.theme }}</UiBadge>
        </span>
        <span class="col-days">
          <UiBadge v-if="item.foreignDays >= 2" :variant="badgeVariant(item.foreignDays)" size="sm">
            {{ item.foreignDays }}일 연속
          </UiBadge>
          <span v-else class="no-signal">-</span>
        </span>
        <span class="col-days">
          <UiBadge v-if="item.instDays >= 2" :variant="badgeVariant(item.instDays)" size="sm">
            {{ item.instDays }}일 연속
          </UiBadge>
          <span v-else class="no-signal">-</span>
        </span>
      </div>
    </div>
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

.rank-table { margin-bottom: 4px; }

.rank-row {
  display: grid;
  grid-template-columns: 36px 1fr 90px 100px 100px;
  gap: 6px;
  align-items: center;
  padding: 8px 4px;
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
.col-name { color: #374151; font-weight: 500; }
.col-theme { text-align: center; }
.col-days { text-align: center; }
.no-signal { color: #d1d5db; }

.loading-msg,
.empty-msg {
  text-align: center;
  padding: 24px;
  color: #9ca3af;
  font-size: 14px;
}

@media (max-width: 640px) {
  .consecutive-buy-rank { padding: 14px; }
  .rank-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .rank-row {
    min-width: 360px;
    grid-template-columns: 28px 1fr 70px 80px 80px;
    font-size: 12px;
  }
}
</style>
