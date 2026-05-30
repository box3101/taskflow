<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiIcon } from '@leechanyong/ispark-ui'
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

// 최근 5일 순매수 금액 합산
function recentAmtSum(trends: InvestorData['trends'], type: 'foreignAmt' | 'institutionAmt'): number {
  return trends.slice(0, 5).reduce((sum, d) => sum + Math.max(0, d[type] || 0), 0)
}

// 수급 점수 (40점)
function supplyScore(data: InvestorData): { total: number; foreignDays: number; instDays: number } {
  const foreignDays = consecutiveDays(data.trends, 'foreign')
  const instDays = consecutiveDays(data.trends, 'institution')

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

  return {
    total: Math.round(foreignDayScore + instDayScore + foreignAmtScore + instAmtScore),
    foreignDays,
    instDays,
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
  foreignDays: number; instDays: number
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
      foreignDays: sup.foreignDays, instDays: sup.instDays, overextended,
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

    <div v-else-if="scoreList.length === 0" class="empty-msg">분석할 종목이 없습니다.</div>

    <div v-else class="score-table">
      <div class="score-row score-row--header">
        <span class="col-rank">#</span>
        <span class="col-name">종목명</span>
        <span class="col-theme">테마</span>
        <span class="col-score">종합</span>
        <span class="col-detail">수급</span>
        <span class="col-detail">등락률</span>
        <span class="col-detail">거래량</span>
        <span class="col-detail">PER/PBR</span>
      </div>
      <div
        v-for="(item, i) in scoreList"
        :key="item.code"
        class="score-row"
        :class="{ 'score-row--top3': i < 3 }"
      >
        <span class="col-rank">{{ i + 1 }}</span>
        <span class="col-name">
          {{ item.name }}
          <span v-if="item.foreignDays >= 2 || item.instDays >= 2" class="streak-info">
            <template v-if="item.foreignDays >= 2">외{{ item.foreignDays }}일</template>
            <template v-if="item.foreignDays >= 2 && item.instDays >= 2"> </template>
            <template v-if="item.instDays >= 2">기{{ item.instDays }}일</template>
          </span>
          <span v-if="item.overextended" class="overheat-badge">과열</span>
        </span>
        <span class="col-theme">
          <UiBadge variant="default" size="sm">{{ item.theme }}</UiBadge>
        </span>
        <span class="col-score">
          <UiBadge :variant="scoreBadgeVariant(item.total)" size="sm">
            {{ item.total }}점
          </UiBadge>
        </span>
        <span class="col-detail">{{ item.supply }}</span>
        <span class="col-detail">{{ item.momentum }}</span>
        <span class="col-detail">{{ item.participation }}</span>
        <span class="col-detail">{{ item.valuation }}</span>
      </div>
    </div>
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

.score-table { margin-bottom: 4px; }

.score-row {
  display: grid;
  grid-template-columns: 32px 1fr 80px 66px 44px 44px 44px 44px;
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

  &--top3 {
    background: #fffbeb;
    border-radius: 4px;
  }
}

.col-rank { text-align: center; color: #9ca3af; font-weight: 600; }
.col-name {
  color: #374151;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.streak-info {
  font-size: 11px;
  color: #ef4444;
  font-weight: 600;
}
.overheat-badge {
  font-size: 10px;
  color: #fff;
  background: #f97316;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}
.col-theme { text-align: center; }
.col-score { text-align: center; }
.col-detail { text-align: center; font-size: 12px; color: #6b7280; }

.loading-msg,
.empty-msg {
  text-align: center;
  padding: 24px;
  color: #9ca3af;
  font-size: 14px;
}

@media (max-width: 640px) {
  .smart-score { padding: 14px; }
  .score-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .score-row {
    min-width: 480px;
    grid-template-columns: 28px 1fr 66px 54px 38px 38px 38px 38px;
    font-size: 12px;
  }
}
</style>
