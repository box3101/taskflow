import { ref, computed } from 'vue'
import api from '../api/client'

export interface MoodEntry {
  id: string
  date: string
  mood: 1 | 2 | 3 | 4 | 5
  memo?: string | null
}

export const MOOD_EMOJIS: Record<number, string> = {
  5: '😄',
  4: '🙂',
  3: '😐',
  2: '😞',
  1: '😫',
}

export const MOOD_LABELS: Record<number, string> = {
  5: '최고',
  4: '좋음',
  3: '보통',
  2: '별로',
  1: '최악',
}

export function useMood() {
  const moods = ref<MoodEntry[]>([])
  const loading = ref(false)
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)

  const todayMood = computed(() =>
    moods.value.find(m => m.date === today) ?? null
  )

  const monthStats = computed(() => {
    const stats: Record<number, number> = {}
    for (const m of moods.value) {
      stats[m.mood] = (stats[m.mood] || 0) + 1
    }
    return stats
  })

  // 전체 기록 일수
  const totalDays = computed(() => moods.value.length)

  // 최근 기록 (오늘 제외, 최신순 5개)
  const recentMoods = computed(() =>
    [...moods.value]
      .filter(m => m.date !== today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  )

  async function fetchMonth(month?: string) {
    loading.value = true
    try {
      const { data } = await api.get('/moods', {
        params: { month: month || currentMonth },
      })
      moods.value = data.data
    } catch {
      moods.value = []
      throw new Error('기분 데이터를 불러올 수 없습니다.')
    } finally {
      loading.value = false
    }
  }

  async function saveMood(mood: 1 | 2 | 3 | 4 | 5, memo?: string) {
    try {
      const body: Record<string, unknown> = { date: today, mood }
      if (memo && memo.trim()) body.memo = memo.trim()
      const { data } = await api.post('/moods', body)
      const idx = moods.value.findIndex(m => m.date === today)
      if (idx >= 0) {
        moods.value[idx] = data.data
      } else {
        moods.value.push(data.data)
      }
    } catch {
      throw new Error('기분을 저장할 수 없습니다.')
    }
  }

  return { moods, loading, todayMood, recentMoods, monthStats, totalDays, currentMonth, fetchMonth, saveMood }
}
