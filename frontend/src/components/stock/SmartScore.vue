<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon, UiTable, UiEmpty } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { fetchInvestor } from '../../api/stockApi'
import type { InvestorData, StockQuote } from '../../api/stockApi'

type ThemeDef = { label: string; stocks: { code: string; name: string }[] }

const props = defineProps<{
  themes: ThemeDef[]
  themeQuotes: Record<string, StockQuote>
}>()

const investorMap = ref<Record<string, InvestorData>>({})
const loading = ref(false)

// 테마 종목 중 quotes 있는 것만
const allStocks = computed(() => {
  const items: { code: string; name: string; theme: string; chg20: number; chg5: number }[] = []
  for (const theme of props.themes) {
    for (const stock of theme.stocks) {
      const q = props.themeQuotes[stock.code]
      if (!q) continue
      items.push({
        code: stock.code, name: stock.name, theme: theme.label,
        chg20: q.changePct20 || 0, chg5: q.changePct5 || 0,
      })
    }
  }
  return items
})

// ── 스코어링 함수 ──

// 연속 매수일
function consecutiveDays(trends: InvestorData['trends'], type: 'foreign' | 'institution'): number {
  let count = 0
  for (const day of trends) {
    if (day[type] > 0) count++
    else break
  }
  return count
}

// 연속 매도일
function consecutiveSellDays(trends: InvestorData['trends'], type: 'foreign' | 'institution'): number {
  let count = 0
  for (const day of trends) {
    if (day[type] < 0) count++
    else break
  }
  return count
}

// 최근 5일 순매수 금액 합산
function recentAmtSum(trends: InvestorData['trends'], type: 'foreignAmt' | 'institutionAmt'): number {
  return trends.slice(0, 5).reduce((sum, d) => sum + Math.max(0, d[type] || 0), 0)
}

// 수급 점수 (40점) - 외인 연속 매도 감점 포함
function supplyScore(data: InvestorData): { total: number; foreignDays: number; instDays: number; foreignSellDays: number; sellPenalty: number } {
  const foreignDays = consecutiveDays(data.trends, 'foreign')
  const instDays = consecutiveDays(data.trends, 'institution')
  const foreignSellDays = consecutiveSellDays(data.trends, 'foreign')

  // 연속매수일 (각 12점)
  const foreignDayScore = Math.min(foreignDays * 2, 12)
  const instDayScore = Math.min(instDays * 2, 12)

  // 최근 5일 순매수 금액 (시총 대비, 각 8점)
  const mcap = parseFloat(data.marketCap) || 0
  let foreignAmtScore = 0
  let instAmtScore = 0
  if (mcap > 0) {
    const fAmt = recentAmtSum(data.trends, 'foreignAmt')
    const iAmt = recentAmtSum(data.trends, 'institutionAmt')
    foreignAmtScore = Math.min((fAmt / mcap) * 2000, 8)
    instAmtScore = Math.min((iAmt / mcap) * 2000, 8)
  }

  // 외인 연속 매도 감점 (3일 이상부터, 최대 -12)
  let sellPenalty = 0
  if (foreignSellDays >= 3) {
    sellPenalty = Math.min(12, Math.round(foreignSellDays / 2))
    // 5일 순매도 금액이 크면 강도 보너스 +2
    const fSellAmt = data.trends.slice(0, 5).reduce((s, d) => s + Math.min(0, d.foreignAmt || 0), 0)
    if (Math.abs(fSellAmt) > 500000) sellPenalty = Math.min(12, sellPenalty + 2)
  }

  return {
    total: Math.max(0, Math.round(foreignDayScore + instDayScore + foreignAmtScore + instAmtScore) - sellPenalty),
    foreignDays,
    instDays,
    foreignSellDays,
    sellPenalty,
  }
}

// 등락률 점수 (25점) — 플래토 곡선: 강할수록 높은 점수, 감점 없음
function momentumScore(chg20: number, chg5: number): number {
  // 20일: 5% 이상부터 점수, 60%+면 만점 (0~18점)
  const score20 = Math.min(18, Math.max(0, (chg20 - 5) * 0.45))
  // 5일: 2% 이상부터 점수, 22%+면 만점 (0~7점)
  const score5 = Math.min(7, Math.max(0, (chg5 - 2) * 0.35))
  return Math.round(score20 + score5)
}

// 거래참여도 점수 (20점) — 외인+기관 최근 5일 거래 절대금액 기준
function participationScore(data: InvestorData, allAbsAmts: number[]): number {
  // 최근 5일 외인+기관 절대 거래금액 합산 (매수·매도 모두 포함)
  const absAmt = data.trends.slice(0, 5).reduce((sum, d) => {
    return sum + Math.abs(d.foreignAmt || 0) + Math.abs(d.institutionAmt || 0)
  }, 0)
  if (absAmt <= 0 || allAbsAmts.length === 0) return 0

  // 유니버스 내 백분위 (0~14점)
  const sorted = [...allAbsAmts].sort((a, b) => a - b)
  const rank = sorted.findIndex(v => v >= absAmt)
  const percentile = (rank >= 0 ? rank : sorted.length) / sorted.length
  const percentileScore = Math.round(percentile * 14)

  // 시총 대비 회전율 (0~6점)
  const mcap = parseFloat(data.marketCap) || 0
  let turnoverScore = 0
  if (mcap > 0) {
    turnoverScore = Math.round(Math.min((absAmt / mcap) * 30, 6))
  }

  return percentileScore + turnoverScore
}

// PER/PBR 점수 (15점)
function valuationScore(data: InvestorData): number {
  const per = parseFloat(data.per)
  const pbr = parseFloat(data.pbr)

  let perScore = 0
  if (!isNaN(per) && per > 0) {
    if (per <= 10) perScore = 8
    else if (per <= 20) perScore = 5
    else if (per <= 30) perScore = 3
    else perScore = 1
  }

  let pbrScore = 0
  if (!isNaN(pbr) && pbr > 0) {
    if (pbr <= 1) pbrScore = 7
    else if (pbr <= 2) pbrScore = 5
    else if (pbr <= 5) pbrScore = 3
    else pbrScore = 1
  }

  return perScore + pbrScore
}

// 종합 랭킹
type ScoreItem = {
  code: string; name: string; theme: string
  total: number; supply: number; momentum: number; participation: number; valuation: number
  foreignDays: number; instDays: number; foreignSellDays: number
  overextended: boolean
}

const scoreList = computed<ScoreItem[]>(() => {
  // 참여도 백분위 계산용: 각 종목의 외인+기관 5일 절대거래금액
  const allAbsAmts: number[] = []
  for (const stock of allStocks.value) {
    const data = investorMap.value[stock.code]
    if (!data?.trends?.length) continue
    const amt = data.trends.slice(0, 5).reduce((s, d) => s + Math.abs(d.foreignAmt || 0) + Math.abs(d.institutionAmt || 0), 0)
    allAbsAmts.push(amt)
  }

  const list: ScoreItem[] = []
  for (const stock of allStocks.value) {
    const data = investorMap.value[stock.code]
    if (!data?.trends?.length) continue

    const sup = supplyScore(data)
    const mom = momentumScore(stock.chg20, stock.chg5)
    const part = participationScore(data, allAbsAmts)
    const val = valuationScore(data)

    const overextended = stock.chg20 > 90 || stock.chg5 > 40
    // 과열 리스크 감점: 수급 동반이면 소폭, 없으면 크게
    let riskPenalty = 0
    if (overextended) {
      const hasStreak = sup.foreignDays >= 3 || sup.instDays >= 3
      if (stock.chg20 > 100) riskPenalty = hasStreak ? 12 : 22
      else riskPenalty = hasStreak ? 8 : 18
    }

    const total = sup.total + mom + part + val - riskPenalty

    list.push({
      code: stock.code, name: stock.name, theme: stock.theme,
      total, supply: sup.total, momentum: mom, participation: part, valuation: val,
      foreignDays: sup.foreignDays, instDays: sup.instDays, foreignSellDays: sup.foreignSellDays, overextended,
    })
  }
  return list.sort((a, b) => b.total - a.total).slice(0, 20)
})

// investor 데이터 로드 (10개씩 배치)
async function loadInvestorData() {
  const codes = allStocks.value.map(s => s.code).filter(c => !investorMap.value[c])
  if (codes.length === 0) return
  loading.value = true
  const BATCH = 10
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(code => fetchInvestor(code)))
    batch.forEach((code, idx) => { investorMap.value[code] = results[idx] })
  }
  loading.value = false
}

watch(allStocks, () => loadInvestorData(), { immediate: true })

const scoreColumns: TableColumn[] = [
  { key: 'rank', label: '#', width: '36px', align: 'center' },
  { key: 'name', label: '종목명', align: 'left' },
  { key: 'theme', label: '테마', width: '80px', align: 'center', hideBelow: 640 },
  { key: 'total', label: '종합', width: '66px', align: 'center' },
  { key: 'supply', label: '수급', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'momentum', label: '등락률', width: '48px', align: 'center', hideBelow: 480 },
  { key: 'participation', label: '거래량', width: '48px', align: 'center', hideBelow: 480 },
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
      <span class="section-desc">수급(40) + 등락률(25) + 거래대금(20) + PER/PBR(15)</span>
    </div>

    <div v-if="loading && scoreList.length === 0" class="loading-msg">
      종목 분석 중... ({{ Object.keys(investorMap).length }}/{{ allStocks.length }})
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
          <span v-if="row.foreignDays >= 2 || row.instDays >= 2" class="streak-info">
            <template v-if="row.foreignDays >= 2">외{{ row.foreignDays }}일</template>
            <template v-if="row.foreignDays >= 2 && row.instDays >= 2"> </template>
            <template v-if="row.instDays >= 2">기{{ row.instDays }}일</template>
          </span>
          <span v-if="row.foreignSellDays >= 3" class="sell-streak-info">외매도{{ row.foreignSellDays }}일</span>
          <span v-if="row.overextended" class="overheat-badge">과열</span>
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
.section-desc { font-size: 12px; color: #9ca3af; }

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

.loading-msg {
  text-align: center; padding: 24px; color: #9ca3af; font-size: 14px;
}

@media (max-width: 640px) {
  .smart-score { padding: 14px; }
}
</style>
