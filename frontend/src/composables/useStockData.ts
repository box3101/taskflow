import { ref, computed } from 'vue'
import type { StockHolding, StockPrice, StockQuote, ThemeDef, TopValueStock, MindsetEntry } from '../types/stock'
import { fetchPrice, fetchQuotes, fetchTopValue, fetchInvestor, fetchFearGreed } from '../api/stockApi'
import type { InvestorData, FearGreedData } from '../api/stockApi'

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
  const investorData = ref<Record<string, InvestorData>>({})
  const fearGreed = ref<FearGreedData>({ value: null, text: 'N/A', previous_close: null })
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

  // 외인/기관 동향 로드
  async function loadInvestor() {
    const codes = holdings.value.map(h => h.code).filter(Boolean)
    const results: Record<string, InvestorData> = {}
    await Promise.all(codes.map(async (code) => {
      results[code] = await fetchInvestor(code)
    }))
    investorData.value = results
  }

  // 공포탐욕지수 로드
  async function loadFearGreed() {
    fearGreed.value = await fetchFearGreed()
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

  // 종목 데이터 헬퍼
  type RecItem = { code: string; name: string; theme: string; chg20: number; chg5: number; score: number; reason: string }

  function allStocksWithQuotes() {
    const items: { code: string; name: string; theme: string; chg20: number; chg5: number }[] = []
    for (const theme of themes.value) {
      for (const stock of theme.stocks) {
        const q = themeQuotes.value[stock.code]
        if (!q) continue
        items.push({ code: stock.code, name: stock.name, theme: theme.label, chg20: q.changePct20 || 0, chg5: q.changePct5 || 0 })
      }
    }
    return items
  }

  // 테마별 평균 20일 등락률
  function themeAvgChg20(themeLabel: string) {
    const items = allStocksWithQuotes().filter(s => s.theme === themeLabel)
    if (items.length === 0) return 0
    return items.reduce((sum, s) => sum + s.chg20, 0) / items.length
  }

  // ── 탭 1: 모멘텀 초기 (가속 시작 종목) ──
  // 20일 +10~50% & 5일 양수 & 가속도 적정 → 과열 전 진입 기회
  const recMomentum = computed<RecItem[]>(() => {
    if (Object.keys(themeQuotes.value).length === 0) return []
    return allStocksWithQuotes()
      .filter(s => s.chg20 >= 10 && s.chg20 <= 50 && s.chg5 > 0)
      .map(s => {
        // 종형 점수: 30% 지점이 최적, 멀어질수록 감점
        const optimalDist = Math.abs(s.chg20 - 30)
        const momentumScore = Math.max(0, 100 - optimalDist * 2)
        // 가속도: 5일이 20일의 20~40%면 건강한 가속
        const accelRatio = s.chg5 / Math.max(s.chg20, 1)
        const accelScore = accelRatio >= 0.15 && accelRatio <= 0.5 ? 30 : accelRatio > 0.5 ? 10 : 15
        const score = momentumScore * 0.7 + accelScore
        return { ...s, score, reason: `가속 ${(accelRatio * 100).toFixed(0)}%` }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  })

  // ── 탭 2: 테마 낙오주 (저평가 기회) ──
  // 같은 테마 평균 대비 덜 오른 종목 → 후발주자 기회
  const recLaggard = computed<RecItem[]>(() => {
    if (Object.keys(themeQuotes.value).length === 0) return []
    return allStocksWithQuotes()
      .filter(s => s.chg20 >= 0) // 최소 하락하지 않는 종목
      .map(s => {
        const avg = themeAvgChg20(s.theme)
        const gap = avg - s.chg20 // 양수면 테마 평균보다 덜 오름
        if (gap <= 0) return null // 테마 평균보다 더 올랐으면 제외
        const gapScore = Math.min(gap * 2, 80) // 괴리 클수록 점수, 최대 80
        const safetyScore = s.chg20 >= 5 ? 20 : s.chg20 >= 0 ? 10 : 0 // 최소 상승 확인
        const score = gapScore + safetyScore
        return { ...s, score, reason: `테마 평균 대비 -${gap.toFixed(1)}%p` }
      })
      .filter((s): s is RecItem => s !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  })

  // ── 탭 3: 급등주 추천 (강한 모멘텀) ──
  // 20일 +80%↑ → 강한 상승 추세, 추세 추종 매매 기회
  const recOverheat = computed<RecItem[]>(() => {
    if (Object.keys(themeQuotes.value).length === 0) return []
    return allStocksWithQuotes()
      .filter(s => s.chg20 >= 80)
      .map(s => {
        // 상승 강도: 높을수록 강한 추세
        const heatScore = s.chg20
        // 5일 가속이 강하면 추세 지속 가능성 높음
        const accelRatio = s.chg5 / Math.max(s.chg20, 1)
        const accelBonus = accelRatio > 0.5 ? 20 : 0
        const score = heatScore + accelBonus
        const strength = s.chg20 >= 100 ? '초강세' : s.chg20 >= 90 ? '강세' : '상승세'
        return { ...s, score, reason: strength }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  })

  // 전체 로드
  async function loadAll() {
    loading.value = true
    loadHoldings()
    loadMindsets()
    await Promise.all([refreshPrices(), loadThemes(), loadFearGreed()])
    // 테마 종목 quotes + 외인/기관은 별도 (약간 느림)
    loadThemeQuotes()
    loadInvestor()
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
    recMomentum, recLaggard, recOverheat,
    investorData, fearGreed,
    loadAll, refreshPrices, loadThemes, loadThemeQuotes, loadTopValue, loadInvestor, loadFearGreed,
    saveHoldings, addHolding, removeHolding,
    saveMindset,
    startAutoRefresh, stopAutoRefresh,
  }
}
