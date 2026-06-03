import { ref, computed } from 'vue'
import api from '../api/client'

export interface MemoEntry {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export const MEMO_COLORS: { value: string; label: string; bg: string }[] = [
  { value: 'yellow', label: '노랑', bg: '#fef9c3' },
  { value: 'pink', label: '분홍', bg: '#fce7f3' },
  { value: 'blue', label: '파랑', bg: '#dbeafe' },
  { value: 'green', label: '초록', bg: '#dcfce7' },
  { value: 'purple', label: '보라', bg: '#f3e8ff' },
]

export function useMemo() {
  const memos = ref<MemoEntry[]>([])
  const loading = ref(false)

  const pinnedMemos = computed(() => memos.value.filter(m => m.pinned))
  const unpinnedMemos = computed(() => memos.value.filter(m => !m.pinned))

  async function fetchMemos(q?: string) {
    loading.value = true
    try {
      const params: Record<string, string> = {}
      if (q) params.q = q
      const { data } = await api.get('/memos', { params })
      memos.value = data.data
    } catch {
      memos.value = []
      throw new Error('메모를 불러올 수 없습니다.')
    } finally {
      loading.value = false
    }
  }

  async function addMemo(entry: { title: string; content?: string; color?: string }) {
    const { data } = await api.post('/memos', entry)
    memos.value.unshift(data.data)
    return data.data
  }

  async function updateMemo(id: string, entry: Partial<MemoEntry>) {
    const { data } = await api.put(`/memos/${id}`, entry)
    const idx = memos.value.findIndex(m => m.id === id)
    if (idx >= 0) memos.value[idx] = data.data
    return data.data
  }

  async function togglePin(id: string) {
    const { data } = await api.patch(`/memos/${id}/pin`)
    const idx = memos.value.findIndex(m => m.id === id)
    if (idx >= 0) memos.value[idx] = data.data
    // 핀 변경 후 다시 정렬
    memos.value.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return data.data
  }

  async function deleteMemo(id: string) {
    await api.delete(`/memos/${id}`)
    memos.value = memos.value.filter(m => m.id !== id)
  }

  return {
    memos, loading, pinnedMemos, unpinnedMemos,
    fetchMemos, addMemo, updateMemo, togglePin, deleteMemo,
  }
}
