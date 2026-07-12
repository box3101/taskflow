<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiBadge, UiButton, UiIcon, UiTable } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { fetchInvestor, saveScoreSnapshot, fetchSnapshotList, fetchSnapshotByDate, deleteSnapshot } from '../../api/stockApi'
import type { InvestorData, StockQuote, ScoreSnapshotItem, ScoreSnapshotSummary, ScoreSnapshotFull } from '../../api/stockApi'
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

// ── 스냅샷 저장/조회 ──
const saving = ref(false)
const savedToday = ref(false)
const showHistory = ref(false)
const snapshotList = ref<ScoreSnapshotSummary[]>([])
const selectedSnapshot = ref<ScoreSnapshotFull | null>(null)
const loadingHistory = ref(false)

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 다음 거래일 추정 (토→월, 일→월, 평일→다음날)
function getNextTradingDay(dateStr: string): string {
  const d = new Date(dateStr + 'T09:00:00')
  d.setDate(d.getDate() + 1)
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() + 2) // 토→월
  if (dow === 0) d.setDate(d.getDate() + 1) // 일→월
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function handleSaveSnapshot() {
  if (scoreList.value.length === 0) return
  saving.value = true
  try {
    const today = getTodayStr()
    const entryDate = getNextTradingDay(today)
    const items: ScoreSnapshotItem[] = scoreList.value.map((s, i) => ({
      code: s.code,
      name: s.name,
      theme: s.theme,
      rank: i + 1,
      total: s.total,
      supply: s.supply,
      momentum: s.momentum,
      surge: s.surge,
      valuation: s.valuation,
      entryPrice: props.themeQuotes[s.code]?.price || 0,
    }))
    await saveScoreSnapshot(today, entryDate, items)
    savedToday.value = true
  } catch (e) {
    console.error('스냅샷 저장 실패:', e)
  } finally {
    saving.value = false
  }
}

async function loadSnapshotList() {
  loadingHistory.value = true
  try {
    snapshotList.value = await fetchSnapshotList()
    // 오늘 이미 저장했는지 확인
    savedToday.value = snapshotList.value.some(s => s.date === getTodayStr())
  } catch { /* */ } finally {
    loadingHistory.value = false
  }
}

async function viewSnapshot(date: string) {
  selectedSnapshot.value = await fetchSnapshotByDate(date)
}

async function handleDeleteSnapshot(date: string) {
  if (!confirm(`${date} 스냅샷을 삭제할까요?`)) return
  await deleteSnapshot(date)
  snapshotList.value = snapshotList.value.filter(s => s.date !== date)
  if (selectedSnapshot.value?.date === date) selectedSnapshot.value = null
  if (date === getTodayStr()) savedToday.value = false
}

function toggleHistory() {
  showHistory.value = !showHistory.value
  if (showHistory.value && snapshotList.value.length === 0) {
    loadSnapshotList()
  }
}

// 초기 로드 시 오늘 저장 여부 확인
loadSnapshotList()
</script>

<template>
  <div class="smart-score">
    <div class="section-header">
      <h3><UiIcon name="trophy" :size="18" /> Smart Score 랭킹</h3>
      <div class="header-actions">
        <span class="section-desc">수급(45) + 등락률(30) + 회전율(10) + PER/PBR(15) <span v-if="loadedAt" class="loaded-at">{{ loadedAt }} 기준</span></span>
        <div class="action-buttons">
          <UiButton
            size="sm"
            :variant="savedToday ? 'default' : 'primary'"
            :disabled="saving || scoreList.length === 0"
            @click="handleSaveSnapshot"
          >
            {{ saving ? '저장중...' : savedToday ? '✓ 저장됨' : '오늘 스코어 저장' }}
          </UiButton>
          <UiButton size="sm" variant="secondary" @click="toggleHistory">
            {{ showHistory ? '닫기' : '히스토리' }}
          </UiButton>
        </div>
      </div>
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

    <!-- 스냅샷 히스토리 -->
    <div v-if="showHistory" class="snapshot-history">
      <h4>📊 스코어 스냅샷 히스토리</h4>

      <div v-if="loadingHistory" class="loading-msg">불러오는 중...</div>

      <div v-else-if="snapshotList.length === 0" class="loading-msg">저장된 스냅샷이 없습니다.</div>

      <div v-else class="history-content">
        <div class="history-list">
          <div
            v-for="snap in snapshotList"
            :key="snap.date"
            class="history-item"
            :class="{ active: selectedSnapshot?.date === snap.date }"
            @click="viewSnapshot(snap.date)"
          >
            <span class="hist-date">{{ snap.date }}</span>
            <span v-if="snap.entryDate" class="hist-entry">진입: {{ snap.entryDate }}</span>
            <button class="hist-delete" @click.stop="handleDeleteSnapshot(snap.date)">×</button>
          </div>
        </div>

        <!-- 선택된 스냅샷 상세 -->
        <div v-if="selectedSnapshot" class="snapshot-detail">
          <div class="detail-header">
            <strong>{{ selectedSnapshot.date }}</strong> 스코어
            <span v-if="selectedSnapshot.entryDate" class="detail-entry">(진입기준: {{ selectedSnapshot.entryDate }} 시가)</span>
          </div>
          <table class="snapshot-table">
            <thead>
              <tr>
                <th>#</th>
                <th>종목</th>
                <th>테마</th>
                <th>종합</th>
                <th>수급</th>
                <th>등락률</th>
                <th>회전율</th>
                <th>밸류</th>
                <th>기준가</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in (selectedSnapshot.data as ScoreSnapshotItem[])" :key="item.code">
                <td>{{ item.rank }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.theme }}</td>
                <td class="score-cell">{{ item.total }}</td>
                <td>{{ item.supply }}</td>
                <td>{{ item.momentum }}</td>
                <td>{{ item.surge }}</td>
                <td>{{ item.valuation }}</td>
                <td>{{ item.entryPrice?.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; white-space: nowrap; }
}
.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.action-buttons { display: flex; gap: 6px; }
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

// 스냅샷 히스토리
.snapshot-history {
  margin-top: 20px;
  border-top: 1px solid #e6e8ec;
  padding-top: 16px;

  h4 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
}

.history-content {
  display: flex;
  gap: 16px;
}

.history-list {
  min-width: 160px;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  background: #f9fafb;
  transition: background 0.15s;

  &:hover { background: #f3f4f6; }
  &.active { background: #eff6ff; border: 1px solid #bfdbfe; }
}

.hist-date { font-weight: 600; color: #374151; }
.hist-entry { font-size: 11px; color: #9ca3af; }
.hist-delete {
  margin-left: auto;
  border: none;
  background: none;
  color: #d1d5db;
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  &:hover { color: #ef4444; }
}

.snapshot-detail {
  flex: 1;
  min-width: 0;
}

.detail-header {
  font-size: 13px;
  margin-bottom: 8px;
  color: #374151;
}
.detail-entry { color: #6b7280; font-size: 12px; }

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 4px 8px;
    text-align: center;
    border-bottom: 1px solid #f3f4f6;
  }
  th {
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 11px;
  }
  td:nth-child(2) { text-align: left; font-weight: 500; }
  .score-cell { font-weight: 700; color: #374151; }
}

@media (max-width: 640px) {
  .smart-score { padding: 14px; }
  .section-header { flex-direction: column; gap: 8px; }
  .header-actions { align-items: flex-start; }
  .history-content { flex-direction: column; }
  .history-list { max-height: 150px; flex-direction: row; flex-wrap: wrap; }
  .snapshot-table { font-size: 11px; th, td { padding: 3px 4px; } }
}
</style>
