import { ref, watch, onMounted } from 'vue'

const STORAGE_KEY = 'theme'
type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // localStorage 저장
  watch(theme, (t) => {
    applyTheme(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  })

  // 초기화: localStorage > 시스템 설정 > light
  onMounted(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (saved === 'dark' || saved === 'light') {
        theme.value = saved
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme.value = 'dark'
      }
    } catch {}
    applyTheme(theme.value)
  })

  return { theme, toggle }
}
