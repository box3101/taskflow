import { ref } from 'vue'
import api from '../api/client'

export interface MealEntry {
  id: string
  date: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'midnight'
  content: string
}

export const MEAL_LABELS: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
  midnight: '야식',
}

export const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
  midnight: '🍜',
}

export function useMeal() {
  const meals = ref<MealEntry[]>([])
  const monthHints = ref<{ date: string; title: string; count: number }[]>([])
  const loading = ref(false)

  async function fetchMonthHints(month: string) {
    try {
      const { data } = await api.get('/meals', { params: { month } })
      monthHints.value = data.data
    } catch {
      hintDates.value = []
    }
  }

  async function fetchByDate(date: string) {
    loading.value = true
    try {
      const { data } = await api.get('/meals', { params: { date } })
      meals.value = data.data
    } catch {
      meals.value = []
      throw new Error('식단 데이터를 불러올 수 없습니다.')
    } finally {
      loading.value = false
    }
  }

  async function addMeal(entry: Omit<MealEntry, 'id'>) {
    const { data } = await api.post('/meals', entry)
    meals.value.push(data.data)
    return data.data
  }

  async function updateMeal(id: string, entry: Partial<MealEntry>) {
    const { data } = await api.put(`/meals/${id}`, entry)
    const idx = meals.value.findIndex(m => m.id === id)
    if (idx >= 0) meals.value[idx] = data.data
    return data.data
  }

  async function deleteMeal(id: string) {
    await api.delete(`/meals/${id}`)
    meals.value = meals.value.filter(m => m.id !== id)
  }

  return { meals, monthHints, loading, fetchByDate, fetchMonthHints, addMeal, updateMeal, deleteMeal }
}
