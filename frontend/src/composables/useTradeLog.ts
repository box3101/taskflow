import { ref, computed } from 'vue'
import api from '../api/client'

export interface TradeLog {
  id: string
  stockName: string
  stockCode: string
  buyPrice: number
  targetPrice: number | null
  stopLoss: number | null
  sellPrice: number | null
  quantity: number
  status: 'holding' | 'profit' | 'stopped' | 'watching'
  buyDate: string
  sellDate: string | null
  memo: string | null
  strategy: string | null
  realPnl: number | null
  entryReason: string | null
  exitReason: string | null
  createdAt: string
  updatedAt: string
}

export const STRATEGY_LABELS: Record<string, string> = {
  morning_dip: '모닝딥',
  dip_scalp: '급락단타',
  breakout: '돌파',
  pullback: '눌림목',
  earnings_news: '실적/뉴스',
  impulse: '즉흥',
  unclassified: '미분류',
}

export const STATUS_LABELS: Record<string, string> = {
  holding: '보유중',
  profit: '익절',
  stopped: '손절',
  watching: '관망',
}

export const STATUS_COLORS: Record<string, string> = {
  holding: '#3b82f6',
  profit: '#22c55e',
  stopped: '#ef4444',
  watching: '#9ca3af',
}

// 모듈 레벨 상태 (네비게이션 시 유지 = 캐시 역할, 재진입 시 빈 화면 없음)
const logs = ref<TradeLog[]>([])
let logsLoaded = false

export function useTradeLog() {
  const loading = ref(false)

  const holdingLogs = computed(() => logs.value.filter(l => l.status === 'holding'))
  const completedLogs = computed(() => logs.value.filter(l => l.status !== 'holding' && l.status !== 'watching'))

  async function fetchLogs(status?: string) {
    // 이미 받아둔 데이터가 있으면 로딩 표시 없이 갱신 (상태 필터 시에는 로딩 표시)
    if (!logsLoaded || status) loading.value = true
    try {
      const params: Record<string, string> = {}
      if (status) params.status = status
      const { data } = await api.get('/trade-logs', { params })
      logs.value = data.data
      logsLoaded = true
    } catch {
      // 갱신 실패 시 기존(stale) 데이터 유지
    } finally {
      loading.value = false
    }
  }

  async function addLog(entry: Partial<TradeLog>) {
    const { data } = await api.post('/trade-logs', entry)
    logs.value.unshift(data.data)
    return data.data
  }

  async function updateLog(id: string, entry: Partial<TradeLog>) {
    const { data } = await api.put(`/trade-logs/${id}`, entry)
    const idx = logs.value.findIndex(l => l.id === id)
    if (idx >= 0) logs.value[idx] = data.data
    return data.data
  }

  async function deleteLog(id: string) {
    await api.delete(`/trade-logs/${id}`)
    logs.value = logs.value.filter(l => l.id !== id)
  }

  return { logs, loading, holdingLogs, completedLogs, fetchLogs, addLog, updateLog, deleteLog }
}
