import { ref } from 'vue'
import api from '../api/client'

export interface WorkoutEntry {
  id: string
  date: string
  name: string
  weight?: number
  sets?: number
  reps?: number
  duration?: number
  memo?: string
}

export function useWorkout() {
  const workouts = ref<WorkoutEntry[]>([])
  const recentWorkouts = ref<WorkoutEntry[]>([])
  const monthHints = ref<{ date: string; title: string; count: number }[]>([])
  const loading = ref(false)

  async function fetchByDate(date: string) {
    loading.value = true
    try {
      const { data } = await api.get('/workouts', { params: { date } })
      workouts.value = data.data
    } catch {
      workouts.value = []
      throw new Error('운동 데이터를 불러올 수 없습니다.')
    } finally {
      loading.value = false
    }
  }

  async function fetchMonthHints(month: string) {
    try {
      const { data } = await api.get('/workouts', { params: { month } })
      monthHints.value = data.data
    } catch {
      hintDates.value = []
    }
  }

  async function fetchRecent() {
    try {
      const { data } = await api.get('/workouts/recent')
      recentWorkouts.value = data.data
    } catch {
      recentWorkouts.value = []
    }
  }

  async function addWorkout(entry: Omit<WorkoutEntry, 'id'>) {
    const { data } = await api.post('/workouts', entry)
    workouts.value.push(data.data)
    return data.data
  }

  async function updateWorkout(id: string, entry: Partial<WorkoutEntry>) {
    const { data } = await api.put(`/workouts/${id}`, entry)
    const idx = workouts.value.findIndex(w => w.id === id)
    if (idx >= 0) workouts.value[idx] = data.data
    return data.data
  }

  async function deleteWorkout(id: string) {
    await api.delete(`/workouts/${id}`)
    workouts.value = workouts.value.filter(w => w.id !== id)
  }

  return { workouts, recentWorkouts, monthHints, loading, fetchByDate, fetchMonthHints, fetchRecent, addWorkout, updateWorkout, deleteWorkout }
}
