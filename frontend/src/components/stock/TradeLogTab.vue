<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { UiButton, UiIcon, UiEmpty, UiLoading, openToast, openConfirm } from '@leechanyong/ispark-ui'
import CalendarMonth from '../calendar/CalendarMonth.vue'
import TradeLogForm from './TradeLogForm.vue'
import { useTradeLog, STATUS_LABELS, STATUS_COLORS, type TradeLog } from '../../composables/useTradeLog'

const { logs, loading, fetchLogs, addLog, updateLog, deleteLog } = useTradeLog()

const formOpen = ref(false)
const editingLog = ref<TradeLog | null>(null)

// 캘린더 상태
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

const sideDateLabel = computed(() => {
  const [, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(selectedDate.value)
  const dayName = DAY_NAMES[dt.getDay()]
  return `${m}월 ${d}일 (${dayName})`
})

function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else { currentMonth.value-- }
}

function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else { currentMonth.value++ }
}

function goToday() {
  const n = new Date()
  currentYear.value = n.getFullYear()
  currentMonth.value = n.getMonth() + 1
  selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

watch([currentYear, currentMonth], () => {
  const n = new Date()
  if (currentYear.value === n.getFullYear() && currentMonth.value === n.getMonth() + 1) {
    selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  } else {
    selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  }
})

// 캘린더 힌트 이벤트 (매수일 기준 점 표시)
const calendarEvents = computed(() => {
  return logs.value.map(log => ({
    id: log.id,
    type: 'event',
    title: `${log.stockName}`,
    date: log.buyDate,
    startTime: null,
    endTime: null,
    color: STATUS_COLORS[log.status] || '#3b82f6',
    memo: null,
  }))
})

// 선택 날짜의 매매 기록
const dayLogs = computed(() =>
  logs.value.filter(l => l.buyDate === selectedDate.value)
)

onMounted(() => {
  fetchLogs().catch(() => {})
})

function openNew() {
  editingLog.value = null
  formOpen.value = true
}

function openEdit(log: TradeLog) {
  editingLog.value = log
  formOpen.value = true
}

function getPnl(log: TradeLog): { pct: number; amount: number } | null {
  if (!log.sellPrice || !log.buyPrice) return null
  const pct = ((log.sellPrice - log.buyPrice) / log.buyPrice) * 100
  const amount = (log.sellPrice - log.buyPrice) * log.quantity
  return { pct, amount }
}

async function handleSaved(data: Partial<TradeLog>) {
  try {
    if (editingLog.value?.id) {
      await updateLog(editingLog.value.id, data)
      openToast({ message: '수정되었습니다.', type: 'success' })
    } else {
      await addLog(data)
      openToast({ message: '매매 기록이 추가되었습니다.', type: 'success' })
    }
    formOpen.value = false
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}

async function handleDelete(id: string) {
  const ok = await openConfirm({
    title: '매매 기록 삭제',
    message: '이 기록을 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!ok) return
  try {
    await deleteLog(id)
    formOpen.value = false
    openToast({ message: '삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

function formatPrice(n: number): string {
  return n.toLocaleString() + '원'
}

// 성과 요약
const stats = computed(() => {
  const all = logs.value
  const closed = all.filter(l => l.sellPrice && (l.status === 'profit' || l.status === 'stopped'))
  const holding = all.filter(l => l.status === 'holding')
  const wins = closed.filter(l => l.sellPrice! > l.buyPrice)
  const losses = closed.filter(l => l.sellPrice! <= l.buyPrice)

  const totalPnl = closed.reduce((sum, l) => sum + (l.sellPrice! - l.buyPrice) * l.quantity, 0)
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0
  const avgWin = wins.length > 0
    ? wins.reduce((sum, l) => sum + ((l.sellPrice! - l.buyPrice) / l.buyPrice) * 100, 0) / wins.length
    : 0
  const avgLoss = losses.length > 0
    ? losses.reduce((sum, l) => sum + ((l.sellPrice! - l.buyPrice) / l.buyPrice) * 100, 0) / losses.length
    : 0

  return { totalPnl, winRate, avgWin, avgLoss, holdingCount: holding.length, closedCount: closed.length, totalCount: all.length }
})
</script>

<template>
  <div class="trade-log">
    <UiLoading v-if="loading" overlay />

    <!-- 성과 요약 -->
    <div v-if="stats.totalCount > 0" class="trade-log__stats">
      <div class="trade-log__stat">
        <span class="trade-log__stat-value" :class="{ 'text-plus': stats.totalPnl > 0, 'text-minus': stats.totalPnl < 0 }">
          {{ stats.totalPnl > 0 ? '+' : '' }}{{ stats.totalPnl.toLocaleString() }}원
        </span>
        <span class="trade-log__stat-label">총 손익</span>
      </div>
      <div class="trade-log__stat">
        <span class="trade-log__stat-value">{{ stats.winRate.toFixed(0) }}%</span>
        <span class="trade-log__stat-label">승률</span>
      </div>
      <div class="trade-log__stat">
        <span class="trade-log__stat-value text-plus">{{ stats.avgWin > 0 ? '+' : '' }}{{ stats.avgWin.toFixed(1) }}%</span>
        <span class="trade-log__stat-label">평균 수익</span>
      </div>
      <div class="trade-log__stat">
        <span class="trade-log__stat-value text-minus">{{ stats.avgLoss.toFixed(1) }}%</span>
        <span class="trade-log__stat-label">평균 손실</span>
      </div>
      <div class="trade-log__stat">
        <span class="trade-log__stat-value">{{ stats.holdingCount }}</span>
        <span class="trade-log__stat-label">보유중</span>
      </div>
      <div class="trade-log__stat">
        <span class="trade-log__stat-value">{{ stats.closedCount }}</span>
        <span class="trade-log__stat-label">완료</span>
      </div>
    </div>

    <!-- 캘린더 + 사이드 패널 -->
    <div class="trade-log__body">
      <!-- 캘린더 -->
      <div class="trade-log__calendar">
        <div class="trade-log__cal-header">
          <UiButton variant="outline" size="sm" icon-only aria-label="이전 달" @click="prevMonth">
            <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
          </UiButton>
          <span class="trade-log__cal-month">{{ monthLabel }}</span>
          <UiButton variant="outline" size="sm" icon-only aria-label="다음 달" @click="nextMonth">
            <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
          </UiButton>
          <UiButton variant="ghost" size="sm" @click="goToday">오늘</UiButton>
        </div>
        <CalendarMonth
          :year="currentYear"
          :month="currentMonth"
          :events="calendarEvents"
          :selected-date="selectedDate"
          @select-date="selectedDate = $event"
          @swipe-left="nextMonth"
          @swipe-right="prevMonth"
        />
      </div>

      <!-- 사이드: 선택 날짜 매매 기록 -->
      <div class="trade-log__side">
        <div class="trade-log__side-header">
          <span class="trade-log__side-date">{{ sideDateLabel }}</span>
        </div>

        <UiEmpty
          v-if="dayLogs.length === 0"
          title="매매 기록 없음"
          description="이 날짜에 매매 기록이 없습니다."
        />

        <div v-else class="trade-log__list">
          <div
            v-for="log in dayLogs"
            :key="log.id"
            class="trade-log__item"
            @click="openEdit(log)"
          >
            <div class="trade-log__item-top">
              <span class="trade-log__name">{{ log.stockName }}</span>
              <span class="trade-log__spacer" />
              <span
                v-if="getPnl(log)"
                class="trade-log__pnl"
                :class="{ 'trade-log__pnl--plus': getPnl(log)!.pct > 0, 'trade-log__pnl--minus': getPnl(log)!.pct < 0 }"
              >
                {{ getPnl(log)!.pct > 0 ? '+' : '' }}{{ getPnl(log)!.pct.toFixed(1) }}%
              </span>
              <span class="trade-log__status" :style="{ color: STATUS_COLORS[log.status] }">
                {{ STATUS_LABELS[log.status] }}
              </span>
            </div>
            <div class="trade-log__item-mid">
              <span class="trade-log__price">{{ formatPrice(log.buyPrice) }}</span>
              <span v-if="log.sellPrice" class="trade-log__arrow">→</span>
              <span v-if="log.sellPrice" class="trade-log__price">{{ formatPrice(log.sellPrice) }}</span>
              <span class="trade-log__qty">{{ log.quantity }}주</span>
              <span v-if="log.targetPrice" class="trade-log__target">목표 {{ formatPrice(log.targetPrice) }}</span>
            </div>
            <div v-if="log.memo" class="trade-log__item-memo">
              {{ log.memo.slice(0, 60) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="trade-log__fab" @click="openNew" aria-label="새 매매 기록">
      <UiIcon name="plus" :size="24" />
    </button>

    <!-- 폼 드로어 -->
    <TradeLogForm
      :open="formOpen"
      :log="editingLog"
      @update:open="formOpen = $event"
      @saved="handleSaved"
      @deleted="handleDelete"
    />
  </div>
</template>

<style scoped lang="scss">
.trade-log__stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.trade-log__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.trade-log__stat-value {
  font-size: 15px;
  font-weight: 700;
  color: #1a1f2b;
}

.trade-log__stat-label {
  font-size: 11px;
  color: #9ca3af;
}

.text-plus { color: #ef4444; }
.text-minus { color: #3b82f6; }

// 캘린더 + 사이드 레이아웃
.trade-log__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.trade-log__calendar {
  flex: 1;
  min-width: 0;
}

.trade-log__cal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  justify-content: center;
}

.trade-log__cal-month {
  font-size: 16px;
  font-weight: 700;
  min-width: 100px;
  text-align: center;
}

.trade-log__side {
  width: 380px;
  flex-shrink: 0;
}

.trade-log__side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.trade-log__side-date {
  font-size: 16px;
  font-weight: 700;
  color: #1a1f2b;
}

.trade-log__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trade-log__item {
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  &:hover { background: #f9fafb; }
}

.trade-log__item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.trade-log__name {
  font-size: 15px;
  font-weight: 700;
  color: #1a1f2b;
}

.trade-log__spacer { flex: 1; }

.trade-log__pnl {
  font-size: 14px;
  font-weight: 700;
  &--plus { color: #ef4444; }
  &--minus { color: #3b82f6; }
}

.trade-log__status {
  font-size: 12px;
  font-weight: 600;
}

.trade-log__item-mid {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}

.trade-log__price { font-weight: 600; }
.trade-log__arrow { color: #9ca3af; }
.trade-log__qty { color: #6b7280; font-size: 12px; }
.trade-log__target { color: #22c55e; font-size: 12px; margin-left: auto; }

.trade-log__item-memo {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log__fab {
  position: fixed;
  right: 20px;
  bottom: 76px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #4f6af6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 106, 246, 0.4);
  transition: transform 0.15s;
  z-index: 50;

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.95); }
}

@media (max-width: 768px) {
  .trade-log__stats { grid-template-columns: repeat(3, 1fr); }
  .trade-log__body { flex-direction: column; }
  .trade-log__side { width: 100%; }
}

:global([data-theme="dark"]) {
  .trade-log__stats { background: #1f2937; }
  .trade-log__stat-value { color: #f3f4f6; }
  .trade-log__item { background: #1f2937; }
  .trade-log__item:hover { background: #374151; }
  .trade-log__name { color: #f3f4f6; }
  .trade-log__side-date { color: #f3f4f6; }
  .trade-log__cal-month { color: #f3f4f6; }
}
</style>
