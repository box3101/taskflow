import { ref, computed } from 'vue'
import type { StockHolding, StockPrice, StockQuote, ThemeDef, TopValueStock, MindsetEntry } from '../types/stock'
import { fetchPrice, fetchQuotes, fetchTopValue } from '../api/stockApi'

const STORAGE_HOLDINGS = 'stock-holdings-v2'
const STORAGE_MINDSET = 'stock-mindsets'

// 장중 여부 (KST 09:00~15:30, 평일)
function isMarketOpen(): boolean {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay()
  if (day === 0 || day === 6) return false
  const h = kst.getUTCHours()
  const m = kst.getUTCMinutes()
  const t = h * 60 + m
  return t >= 540 && t <= 930 // 09:00 ~ 15:30
}

export function useStockData() {
  // 상태
  const holdings = ref<StockHolding[]>([])
  const prices = ref<Record<string, StockPrice>>({})
  const quotes = ref<Record<string, StockQuote>>({})
  const themes = ref<ThemeDef[]>([])
  const themeQuotes = ref<Record<string, StockQuote>>({})
  const kospiTop = ref<TopValueStock[]>([])
  const kosdaqTop = ref<TopValueStock[]>([])
  const mindsetHistory = ref<MindsetEntry[]>([])
  const loading = ref(false)
  const lastUpdated = ref('')
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  // localStorage 로드
  function loadHoldings() {
    const raw = localStorage.getItem(STORAGE_HOLDINGS)
    holdings.value = raw ? JSON.parse(raw) : [
      { code: '000660', name: 'SK하이닉스', buyPrice: 0, targetPrice: 0, buyDate: new Date().toISOString().split('T')[0], qty: 1 },
    ]
  }

  function saveHoldings() {
    localStorage.setItem(STORAGE_HOLDINGS, JSON.stringify(holdings.value))
  }

  function addHolding() {
    holdings.value.push({
      code: '', name: '', buyPrice: 0, targetPrice: 0,
      buyDate: new Date().toISOString().split('T')[0], qty: 1,
    })
    saveHoldings()
  }

  function removeHolding(idx: number) {
    holdings.value.splice(idx, 1)
    saveHoldings()
  }

  // 마음가짐
  function loadMindsets() {
    const raw = localStorage.getItem(STORAGE_MINDSET)
    mindsetHistory.value = raw
      ? (JSON.parse(raw) as MindsetEntry[]).sort((a, b) => b.date.localeCompare(a.date))
      : []
  }

  function saveMindset(text: string) {
    const today = new Date().toISOString().split('T')[0]
    const entries: MindsetEntry[] = JSON.parse(localStorage.getItem(STORAGE_MINDSET) || '[]')
    const idx = entries.findIndex(e => e.date === today)
    if (idx >= 0) entries[idx].text = text
    else entries.push({ date: today, text })
    localStorage.setItem(STORAGE_MINDSET, JSON.stringify(entries))
    mindsetHistory.value = entries.sort((a, b) => b.date.localeCompare(a.date))
  }

  const streak = computed(() => {
    let count = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      if (mindsetHistory.value.some(m => m.date === key)) count++
      else break
    }
    return count
  })

  // 시세 로드
  async function refreshPrices() {
    const codes = holdings.value.map(h => h.code).filter(Boolean)
    if (codes.length === 0) return
    const [p, q] = await Promise.all([fetchPrice(codes), fetchQuotes(codes)])
    prices.value = { ...prices.value, ...p }
    quotes.value = { ...quotes.value, ...q }
    lastUpdated.value = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  // 테마 로드
  async function loadThemes() {
    try {
      const res = await fetch('/data/themes.json')
      const data = await res.json()
      themes.value = data.themes || []
    } catch (e) {
      console.warn('[useStockData] themes.json 로드 실패:', e)
    }
  }

  // 테마 종목 등락률 로드
  async function loadThemeQuotes() {
    const allCodes = new Set<string>()
    themes.value.forEach(t => t.stocks.forEach(s => allCodes.add(s.code)))
    if (allCodes.size === 0) return
    const codes = Array.from(allCodes)
    // Apps Script는 한번에 ~50종목 처리 가능, 2배치로 분리
    const mid = Math.ceil(codes.length / 2)
    const [q1, q2] = await Promise.all([
      fetchQuotes(codes.slice(0, mid)),
      fetchQuotes(codes.slice(mid)),
    ])
    themeQuotes.value = { ...q1, ...q2 }
  }

  // 거래대금 TOP 로드
  async function loadTopValue() {
    const [k, d] = await Promise.all([
      fetchTopValue('KOSPI', 20),
      fetchTopValue('KOSDAQ', 20),
    ])
    kospiTop.value = k
    kosdaqTop.value = d
  }

  // 주식 추천 (테마 등락률 기반)
  const recommendations = computed(() => {
    if (Object.keys(themeQuotes.value).length === 0) return []
    const recs: { code: string; name: string; theme: string; chg20: number; chg5: number; score: number }[] = []
    for (const theme of themes.value) {
      for (const stock of theme.stocks) {
        const q = themeQuotes.value[stock.code]
        if (!q) continue
        // 점수: 20일 모멘텀 + 5일 가속도
        const chg20 = q.changePct20 || 0
        const chg5 = q.changePct5 || 0
        // 20일 +10%↑ & 5일 양수 = 상승 모멘텀
        if (chg20 >= 10 && chg5 > 0) {
          recs.push({
            code: stock.code,
            name: stock.name,
            theme: theme.label,
            chg20,
            chg5,
            score: chg20 * 0.6 + chg5 * 0.4,
          })
        }
      }
    }
    // 점수 높은 순 TOP 10
    return recs.sort((a, b) => b.score - a.score).slice(0, 10)
  })

  // 전체 로드
  async function loadAll() {
    loading.value = true
    loadHoldings()
    loadMindsets()
    await Promise.all([refreshPrices(), loadThemes()])
    loading.value = false
  }

  // 자동 갱신
  function startAutoRefresh() {
    stopAutoRefresh()
    refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && isMarketOpen()) {
        refreshPrices()
      }
    }, 60_000)
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  return {
    holdings, prices, quotes, themes, themeQuotes,
    kospiTop, kosdaqTop, mindsetHistory,
    loading, lastUpdated, streak,
    recommendations,
    loadAll, refreshPrices, loadThemes, loadThemeQuotes, loadTopValue,
    saveHoldings, addHolding, removeHolding,
    saveMindset,
    startAutoRefresh, stopAutoRefresh,
  }
}
