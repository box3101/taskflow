import { ref, computed } from 'vue'
import api from '../api/client'

export interface MoodEntry {
  id: string
  date: string
  mood: 1 | 2 | 3 | 4 | 5
}

export const MOOD_EMOJIS: Record<number, string> = {
  5: '😄',
  4: '🙂',
  3: '😐',
  2: '😞',
  1: '😫',
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

  async function saveMood(mood: 1 | 2 | 3 | 4 | 5) {
    try {
      const { data } = await api.post('/moods', { date: today, mood })
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

  return { moods, loading, todayMood, monthStats, currentMonth, fetchMonth, saveMood }
}
