<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiButton, UiIcon, UiEmpty, UiLoading, UiBadge, openToast, openConfirm } from '@leechanyong/ispark-ui'
import TradeLogForm from './TradeLogForm.vue'
import { useTradeLog, STATUS_LABELS, STATUS_COLORS, type TradeLog } from '../../composables/useTradeLog'

const { logs, loading, fetchLogs, addLog, updateLog, deleteLog } = useTradeLog()

const formOpen = ref(false)
const editingLog = ref<TradeLog | null>(null)
const filterStatus = ref<string>('all')

const filterTabs = [
  { value: 'all', label: '전체' },
  { value: 'holding', label: '보유중' },
  { value: 'profit', label: '익절' },
  { value: 'stopped', label: '손절' },
  { value: 'watching', label: '관망' },
]

onMounted(() => {
  fetchLogs().catch(() => {})
})

function onFilterChange(status: string) {
  filterStatus.value = status
  fetchLogs(status === 'all' ? undefined : status).catch(() => {})
}

function openNew() {
  editingLog.value = null
  formOpen.value = true
}

function openEdit(log: TradeLog) {
  editingLog.value = log
  formOpen.value = true
}

// 수익률 계산 (매도가 있을 때만)
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
</script>

<template>
  <div class="trade-log">
    <!-- 필터 탭 -->
    <div class="trade-log__filters">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        class="trade-log__filter"
        :class="{ 'trade-log__filter--active': filterStatus === tab.value }"
        @click="onFilterChange(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 로딩 -->
    <UiLoading v-if="loading" />

    <!-- 빈 상태 -->
    <UiEmpty
      v-else-if="logs.length === 0"
      title="매매 기록이 없습니다"
      description="새 매매 기록을 추가해보세요!"
    />

    <!-- 리스트 -->
    <div v-else class="trade-log__list">
      <div
        v-for="log in logs"
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
          <span
            class="trade-log__status"
            :style="{ color: STATUS_COLORS[log.status] }"
          >
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
        <div class="trade-log__item-bottom">
          <span class="trade-log__date">{{ log.buyDate }}</span>
          <span v-if="log.memo" class="trade-log__memo">{{ log.memo.slice(0, 40) }}</span>
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
.trade-log__filters {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.trade-log__filter {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: none;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover { background: #f3f4f6; }
  &--active {
    background: #4f6af6;
    color: #fff;
    border-color: #4f6af6;
  }
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
  margin-bottom: 4px;
}

.trade-log__price {
  font-weight: 600;
}

.trade-log__arrow {
  color: #9ca3af;
}

.trade-log__qty {
  color: #6b7280;
  font-size: 12px;
}

.trade-log__target {
  color: #22c55e;
  font-size: 12px;
  margin-left: auto;
}

.trade-log__item-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #9ca3af;
}

.trade-log__memo {
  color: #6b7280;
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

:global([data-theme="dark"]) {
  .trade-log__item { background: #1f2937; }
  .trade-log__item:hover { background: #374151; }
  .trade-log__name { color: #f3f4f6; }
  .trade-log__filter {
    border-color: #374151;
    color: #9ca3af;
    &:hover { background: #374151; }
    &--active { background: #4f6af6; color: #fff; border-color: #4f6af6; }
  }
}
</style>
