import { ref } from 'vue'
import api from '../api/client'

export interface UserPreferences {
  menuVisibility?: Record<string, boolean>
}

// 모듈 레벨 상태 (싱글턴)
const preferences = ref<UserPreferences>({})
let loaded = false

export function usePreferences() {
  async function load() {
    if (loaded) return
    try {
      const { data } = await api.get('/preferences')
      preferences.value = data.data || {}
      loaded = true
    } catch {
      // 테이블 없어도 기본값으로 동작
    }
  }

  async function save(prefs: UserPreferences) {
    preferences.value = prefs
    try {
      await api.put('/preferences', { preferences: prefs })
    } catch {
      // 실패해도 로컬 상태는 유지
    }
  }

  function isMenuVisible(key: string): boolean {
    const vis = preferences.value.menuVisibility
    if (!vis) return true // 기본: 전부 보임
    return vis[key] !== false
  }

  async function toggleMenu(key: string, visible: boolean) {
    const vis = { ...preferences.value.menuVisibility, [key]: visible }
    await save({ ...preferences.value, menuVisibility: vis })
  }

  return { preferences, load, save, isMenuVisible, toggleMenu }
}
