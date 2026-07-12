<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiBadge, UiButton, UiIcon } from '@leechanyong/ispark-ui'
import { fetchSnapshotList, fetchSnapshotByDate, fetchPrice } from '../../api/stockApi'
import type { ScoreSnapshotItem } from '../../api/stockApi'

// 스냅샷별 수익률 데이터
interface SnapshotReturn {
  date: string
  entryDate: string | null
  items: (ScoreSnapshotItem & { currentPrice: number; returnPct: number })[]
}

const loading = ref(false)
const snapshotReturns = ref<SnapshotReturn[]>([])
const error = ref('')

async function loadBacktestData() {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchSnapshotList()
    if (list.length === 0) {
      error.value = '저장된 스냅샷이 없습니다. Smart Score에서 먼저 스코어를 저장하세요.'
      return
    }

    const results: SnapshotReturn[] = []

    for (const snap of list) {
      const full = await fetchSnapshotByDate(snap.date)
      if (!full || !full.data) continue

      const items = full.data as ScoreSnapshotItem[]
      const codes = items.map(i => i.code)

      // 현재가 조회
      const prices = await fetchPrice(codes)

      const withReturns = items.map(item => {
        const cur = prices[item.code]?.price || 0
        const entry = item.entryPrice || 0
        const returnPct = entry > 0 && cur > 0 ? ((cur - entry) / entry) * 100 : 0
        return { ...item, currentPrice: cur, returnPct }
      })

      results.push({
        date: full.date,
        entryDate: full.entryDate,
        items: withReturns,
      })
    }

    snapshotReturns.value = results
  } catch (e) {
    error.value = '데이터 로드 실패'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 구간 스프레드 계산: 점수 상위 20% / 중위 / 하위 20%
interface QuintileStats {
  label: string
  avgReturn: number
  count: number
  color: string
}

const quintileStats = computed<QuintileStats[]>(() => {
  // 모든 스냅샷의 종목을 풀어서 하나로 합침
  const allItems = snapshotReturns.value.flatMap(s => s.items.filter(i => i.entryPrice > 0 && i.currentPrice > 0))
  if (allItems.length < 5) return []

  // 점수 기준으로 정렬
  const sorted = [...allItems].sort((a, b) => b.total - a.total)
  const n = sorted.length
  const top20 = sorted.slice(0, Math.ceil(n * 0.2))
  const mid = sorted.slice(Math.ceil(n * 0.3), Math.ceil(n * 0.7))
  const bottom20 = sorted.slice(Math.floor(n * 0.8))

  const avg = (arr: typeof sorted) =>
    arr.length > 0 ? arr.reduce((s, i) => s + i.returnPct, 0) / arr.length : 0

  return [
    { label: '상위 20%', avgReturn: avg(top20), count: top20.length, color: '#ef4444' },
    { label: '중위 40%', avgReturn: avg(mid), count: mid.length, color: '#6b7280' },
    { label: '하위 20%', avgReturn: avg(bottom20), count: bottom20.length, color: '#3b82f6' },
  ]
})

// 스프레드: 상위 - 하위
const spread = computed(() => {
  if (quintileStats.value.length < 3) return 0
  return quintileStats.value[0].avgReturn - quintileStats.value[2].avgReturn
})

// 날짜별 요약
interface DailySummary {
  date: string
  entryDate: string | null
  topAvg: number
  midAvg: number
  bottomAvg: number
  spread: number
  totalStocks: number
}

const dailySummaries = computed<DailySummary[]>(() => {
  return snapshotReturns.value.map(snap => {
    const valid = snap.items.filter(i => i.entryPrice > 0 && i.currentPrice > 0)
    if (valid.length < 5) return null

    const sorted = [...valid].sort((a, b) => b.total - a.total)
    const n = sorted.length
    const top20 = sorted.slice(0, Math.ceil(n * 0.2))
    const mid = sorted.slice(Math.ceil(n * 0.3), Math.ceil(n * 0.7))
    const bottom20 = sorted.slice(Math.floor(n * 0.8))

    const avg = (arr: typeof sorted) =>
      arr.length > 0 ? arr.reduce((s, i) => s + i.returnPct, 0) / arr.length : 0

    const topAvg = avg(top20)
    const bottomAvg = avg(bottom20)

    return {
      date: snap.date,
      entryDate: snap.entryDate,
      topAvg,
      midAvg: avg(mid),
      bottomAvg,
      spread: topAvg - bottomAvg,
      totalStocks: valid.length,
    }
  }).filter(Boolean) as DailySummary[]
})

function formatPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function pctColor(v: number): string {
  if (v > 0) return '#ef4444'
  if (v < 0) return '#3b82f6'
  return '#6b7280'
}

// 로드
loadBacktestData()
</script>

<template>
  <div class="score-backtest">
    <div class="section-header">
      <h3><UiIcon name="bar-chart-2" :size="18" /> 구간 스프레드 분석</h3>
      <UiButton size="sm" variant="secondary" :disabled="loading" @click="loadBacktestData">
        {{ loading ? '로딩...' : '새로고침' }}
      </UiButton>
    </div>

    <p class="desc">점수 구간별 forward 수익률 비교 — 상위가 하위를 이기면 스코어에 정보가 있는 것</p>

    <div v-if="loading" class="loading-msg">스냅샷 분석 중...</div>
    <div v-else-if="error" class="loading-msg">{{ error }}</div>

    <template v-else-if="quintileStats.length > 0">
      <!-- 전체 구간 스프레드 요약 -->
      <div class="spread-summary">
        <div class="spread-card" v-for="q in quintileStats" :key="q.label">
          <div class="q-label">{{ q.label }}</div>
          <div class="q-return" :style="{ color: pctColor(q.avgReturn) }">{{ formatPct(q.avgReturn) }}</div>
          <div class="q-count">{{ q.count }}종목</div>
        </div>
        <div class="spread-card spread-highlight">
          <div class="q-label">스프레드</div>
          <div class="q-return" :style="{ color: spread > 0 ? '#16a34a' : '#ef4444' }">
            {{ formatPct(spread) }}
          </div>
          <div class="q-count">상위-하위</div>
        </div>
      </div>

      <!-- 스프레드 판정 -->
      <div class="verdict">
        <UiBadge :variant="spread > 2 ? 'danger' : spread > 0 ? 'warning' : 'default'" size="sm">
          {{ spread > 2 ? '유의미한 신호' : spread > 0 ? '약한 신호' : '노이즈 (스코어 개선 필요)' }}
        </UiBadge>
        <span class="verdict-note">* 최소 5일 이상 스냅샷이 쌓여야 의미있는 판단 가능</span>
      </div>

      <!-- 날짜별 스프레드 -->
      <div v-if="dailySummaries.length > 0" class="daily-section">
        <h4>날짜별 스프레드</h4>
        <table class="daily-table">
          <thead>
            <tr>
              <th>스코어일</th>
              <th>진입기준</th>
              <th>상위20%</th>
              <th>중위</th>
              <th>하위20%</th>
              <th>스프레드</th>
              <th>종목수</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in dailySummaries" :key="d.date">
              <td>{{ d.date.slice(5) }}</td>
              <td>{{ d.entryDate?.slice(5) || '-' }}</td>
              <td :style="{ color: pctColor(d.topAvg) }">{{ formatPct(d.topAvg) }}</td>
              <td :style="{ color: pctColor(d.midAvg) }">{{ formatPct(d.midAvg) }}</td>
              <td :style="{ color: pctColor(d.bottomAvg) }">{{ formatPct(d.bottomAvg) }}</td>
              <td :style="{ color: d.spread > 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }">{{ formatPct(d.spread) }}</td>
              <td>{{ d.totalStocks }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else class="loading-msg">
      스냅샷 데이터가 부족합니다. Smart Score에서 매일 스코어를 저장하세요.
    </div>
  </div>
</template>

<style lang="scss" scoped>
.score-backtest {
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

.loading-msg { text-align: center; padding: 24px; color: #9ca3af; font-size: 14px; }

.spread-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.spread-card {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.spread-highlight {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.q-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
.q-return { font-size: 20px; font-weight: 700; }
.q-count { font-size: 11px; color: #9ca3af; margin-top: 2px; }

.verdict {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.verdict-note { font-size: 11px; color: #9ca3af; }

.daily-section {
  border-top: 1px solid #e6e8ec;
  padding-top: 16px;

  h4 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
}

.daily-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 8px;
    text-align: center;
    border-bottom: 1px solid #f3f4f6;
  }
  th {
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 11px;
  }
}

@media (max-width: 640px) {
  .score-backtest { padding: 14px; }
  .spread-summary { flex-wrap: wrap; }
  .spread-card { min-width: calc(50% - 8px); }
  .q-return { font-size: 16px; }
  .daily-table { font-size: 11px; th, td { padding: 4px 4px; } }
}
</style>
