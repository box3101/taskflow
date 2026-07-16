<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiBadge, UiButton, UiIcon } from '@leechanyong/ispark-ui'
import { fetchSnapshotList, fetchSnapshotByDate, fetchPrice, matureSnapshots } from '../../api/stockApi'
import type { ScoreSnapshotItem } from '../../api/stockApi'

const HORIZON_DAYS = 3

// 스냅샷별 수익률 데이터
interface ScoredItem extends ScoreSnapshotItem {
  currentPrice: number
  computedReturn: number  // matured면 확정(D+3), 아니면 진행중(진입→현재)
  isMatured: boolean
}
interface SnapshotReturn {
  date: string
  entryDate: string | null
  matured: boolean
  items: ScoredItem[]
}

const loading = ref(false)
const maturing = ref(false)
const snapshotReturns = ref<SnapshotReturn[]>([])
const error = ref('')

// ── 거래일 계산 (주말 제외, 공휴일 무시) ──
function tradingDaysBetween(from: string, to: string): number {
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return Math.max(1, count)
}
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
      // 미확정 종목만 현재가 조회 (확정 종목은 종료가 고정)
      const pendingCodes = items.filter(i => i.exitPrice == null).map(i => i.code)
      const prices = pendingCodes.length > 0 ? await fetchPrice(pendingCodes) : {}

      const scored: ScoredItem[] = items.map(item => {
        const isMatured = item.exitPrice != null && item.exitPrice > 0
        const cur = prices[item.code]?.price || 0
        const entry = item.entryPrice || 0
        const computedReturn = isMatured
          ? (item.returnPct ?? 0)
          : (entry > 0 && cur > 0 ? ((cur - entry) / entry) * 100 : 0)
        return { ...item, currentPrice: cur, computedReturn, isMatured }
      })

      const withEntry = scored.filter(i => i.entryPrice > 0)
      results.push({
        date: full.date,
        entryDate: full.entryDate,
        matured: withEntry.length > 0 && withEntry.every(i => i.isMatured),
        items: scored,
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

// 만기 스냅샷 즉시 확정 (수동 트리거)
async function runMature() {
  maturing.value = true
  try {
    await matureSnapshots()
    await loadBacktestData()
  } catch (e) {
    console.error(e)
  } finally {
    maturing.value = false
  }
}

// ── 버킷 분할: 상·하위 20% (소표본 최소 2종목 가드, 겹침 방지) ──
function splitBuckets<T>(sorted: T[]): { top: T[]; mid: T[]; bottom: T[] } {
  const n = sorted.length
  const size = Math.max(2, Math.ceil(n * 0.2))
  return {
    top: sorted.slice(0, size),
    bottom: sorted.slice(n - size),
    mid: sorted.slice(size, Math.max(size, n - size)),
  }
}

// ── 날짜별 요약 (스냅샷 하나 = 동일 진입일 = 동일 기간) ──
interface DailySummary {
  date: string
  entryDate: string | null
  matured: boolean
  heldDays: number
  topAvg: number; midAvg: number; bottomAvg: number; spread: number
  totalStocks: number
}

const dailySummaries = computed<DailySummary[]>(() => {
  const today = todayStr()
  return snapshotReturns.value.map(snap => {
    const valid = snap.items.filter(i => i.entryPrice > 0 && (i.isMatured || i.currentPrice > 0))
    if (valid.length < 5) return null

    const sorted = [...valid].sort((a, b) => b.total - a.total)
    const { top, mid, bottom } = splitBuckets(sorted)
    const avg = (arr: typeof sorted) =>
      arr.length > 0 ? arr.reduce((s, i) => s + i.computedReturn, 0) / arr.length : 0

    // 보유일: 확정=진입→종료(D+3), 진행중=진입→오늘
    const exitDate = snap.items.find(i => i.exitDate)?.exitDate
    const heldDays = snap.entryDate
      ? tradingDaysBetween(snap.entryDate, snap.matured && exitDate ? exitDate : today)
      : HORIZON_DAYS

    const topAvg = avg(top)
    const bottomAvg = avg(bottom)
    return {
      date: snap.date,
      entryDate: snap.entryDate,
      matured: snap.matured,
      heldDays,
      topAvg, midAvg: avg(mid), bottomAvg, spread: topAvg - bottomAvg,
      totalStocks: valid.length,
    }
  }).filter(Boolean) as DailySummary[]
})

// ── 집계: 확정(D+3 고정기간) 스냅샷만 · 일자 동일가중 평균 ──
interface QuintileStats { label: string; avgReturn: number; days: number; color: string }

const maturedSummaries = computed(() => dailySummaries.value.filter(d => d.matured))

const quintileStats = computed<QuintileStats[]>(() => {
  const days = maturedSummaries.value
  if (days.length === 0) return []
  const mean = (sel: (d: DailySummary) => number) =>
    days.reduce((s, d) => s + sel(d), 0) / days.length
  return [
    { label: '상위 20%', avgReturn: mean(d => d.topAvg), days: days.length, color: '#ef4444' },
    { label: '중위 40%', avgReturn: mean(d => d.midAvg), days: days.length, color: '#6b7280' },
    { label: '하위 20%', avgReturn: mean(d => d.bottomAvg), days: days.length, color: '#3b82f6' },
  ]
})

// 스프레드: 확정 스냅샷들의 D+3 스프레드 평균
const spread = computed(() => {
  const days = maturedSummaries.value
  if (days.length === 0) return 0
  return days.reduce((s, d) => s + d.spread, 0) / days.length
})

const pendingCount = computed(() => dailySummaries.value.filter(d => !d.matured).length)

function formatPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}
function pctColor(v: number): string {
  if (v > 0) return '#ef4444'
  if (v < 0) return '#3b82f6'
  return '#6b7280'
}

loadBacktestData()
</script>

<template>
  <div class="score-backtest">
    <div class="section-header">
      <h3><UiIcon name="bar-chart-2" :size="18" /> 구간 스프레드 분석</h3>
      <div class="header-actions">
        <UiButton size="sm" variant="secondary" :disabled="maturing || loading" @click="runMature">
          {{ maturing ? '확정 중...' : '만기 확정' }}
        </UiButton>
        <UiButton size="sm" variant="secondary" :disabled="loading" @click="loadBacktestData">
          {{ loading ? '로딩...' : '새로고침' }}
        </UiButton>
      </div>
    </div>

    <p class="desc">
      점수 구간별 <b>D+{{ HORIZON_DAYS }} 고정기간</b> 수익률 — 상위가 하위를 이기면 스코어에 정보가 있는 것<br />
      집계는 <b>확정된 스냅샷만 · 일자 동일가중 평균</b> (진입 후 {{ HORIZON_DAYS }}거래일 경과 시 종가로 확정)
    </p>

    <div v-if="loading" class="loading-msg">스냅샷 분석 중...</div>
    <div v-else-if="error" class="loading-msg">{{ error }}</div>

    <template v-else>
      <!-- 전체 구간 스프레드 요약 (확정 스냅샷만) -->
      <template v-if="quintileStats.length > 0">
        <div class="spread-summary">
          <div class="spread-card" v-for="q in quintileStats" :key="q.label">
            <div class="q-label">{{ q.label }}</div>
            <div class="q-return" :style="{ color: pctColor(q.avgReturn) }">{{ formatPct(q.avgReturn) }}</div>
            <div class="q-count">{{ q.days }}일 평균</div>
          </div>
          <div class="spread-card spread-highlight">
            <div class="q-label">스프레드</div>
            <div class="q-return" :style="{ color: spread > 0 ? '#16a34a' : '#ef4444' }">
              {{ formatPct(spread) }}
            </div>
            <div class="q-count">상위-하위 (D+{{ HORIZON_DAYS }})</div>
          </div>
        </div>

        <!-- 스프레드 판정 -->
        <div class="verdict">
          <UiBadge :variant="spread > 1 ? 'danger' : spread > 0 ? 'warning' : 'default'" size="sm">
            {{ spread > 1 ? '유의미한 신호' : spread > 0 ? '약한 신호' : '노이즈 (스코어 개선 필요)' }}
          </UiBadge>
          <span class="verdict-note">
            * 확정 {{ maturedSummaries.length }}일<template v-if="pendingCount"> · 진행중 {{ pendingCount }}일</template>
            · 최소 5일 이상 쌓여야 판단 신뢰
          </span>
        </div>
      </template>

      <div v-else class="loading-msg">
        확정된(D+{{ HORIZON_DAYS }} 경과) 스냅샷이 아직 없습니다.<template v-if="pendingCount"> 진행중 {{ pendingCount }}일 — {{ HORIZON_DAYS }}거래일 뒤 자동 확정됩니다.</template>
      </div>

      <!-- 날짜별 스프레드 -->
      <div v-if="dailySummaries.length > 0" class="daily-section">
        <h4>날짜별 스프레드 <span class="h4-note">(누적 수익률 · 확정=D+{{ HORIZON_DAYS }} 고정)</span></h4>
        <table class="daily-table">
          <thead>
            <tr>
              <th>스코어일</th>
              <th>진입기준</th>
              <th>상태</th>
              <th>보유일</th>
              <th>상위20%</th>
              <th>중위</th>
              <th>하위20%</th>
              <th>스프레드</th>
              <th>종목수</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in dailySummaries" :key="d.date" :class="{ pending: !d.matured }">
              <td>{{ d.date.slice(5) }}</td>
              <td>{{ d.entryDate?.slice(5) || '-' }}</td>
              <td>
                <UiBadge :variant="d.matured ? 'success' : 'default'" size="sm">
                  {{ d.matured ? '확정' : '진행중' }}
                </UiBadge>
              </td>
              <td>{{ d.heldDays }}일</td>
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
.header-actions { display: flex; gap: 6px; }

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
  flex-wrap: wrap;
}
.verdict-note { font-size: 11px; color: #9ca3af; }

.daily-section {
  border-top: 1px solid #e6e8ec;
  padding-top: 16px;

  h4 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
  .h4-note { font-size: 11px; font-weight: 400; color: #9ca3af; }
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
  tr.pending td { opacity: 0.6; }
}

@media (max-width: 640px) {
  .score-backtest { padding: 14px; }
  .spread-summary { flex-wrap: wrap; }
  .spread-card { min-width: calc(50% - 8px); }
  .q-return { font-size: 16px; }
  .daily-table { font-size: 11px; th, td { padding: 4px 4px; } }
}
</style>
