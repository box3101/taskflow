import type { StockPrice, StockQuote, TopValueStock, NewsItem } from '../types/stock'

// Average Apps Script 프록시
const API_URL = 'https://script.google.com/macros/s/AKfycbwhUT0rUyUwZdjCqGP9dYCjfn2JBT7isV5m9KWxU6PPZappVe4fwz9QqQru0k8npvi0jQ/exec'
const PW = 'average2026'

function buildUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({ pw: PW, ...params })
  return `${API_URL}?${query}`
}

// 실시간 현재가
export async function fetchPrice(codes: string[]): Promise<Record<string, StockPrice>> {
  try {
    const url = buildUrl({ action: 'price', codes: codes.join(',') })
    const res = await fetch(url)
    const data = await res.json()
    const result: Record<string, StockPrice> = {}
    for (const [code, q] of Object.entries(data.quotes || {})) {
      const v = q as any
      result[code] = {
        price: Number(v.price) || 0,
        changePctToday: Number(v.changePctToday) || 0,
        changeAmount: Number(v.changeAmount) || 0,
        open: Number(v.open) || 0,
        high: Number(v.high) || 0,
        low: Number(v.low) || 0,
        prevClose: Number(v.prevClose) || 0,
        marketCap: Number(v.marketCap) || 0,
        accumulatedValue: Number(v.accumulatedValue) || 0,
      }
    }
    return result
  } catch (e) {
    console.warn('[stockApi] fetchPrice 실패:', e)
    return {}
  }
}

// 5일/20일 등락률
export async function fetchQuotes(codes: string[]): Promise<Record<string, StockQuote>> {
  try {
    const url = buildUrl({ action: 'quotes', codes: codes.join(',') })
    const res = await fetch(url)
    const data = await res.json()
    const result: Record<string, StockQuote> = {}
    for (const [code, q] of Object.entries(data.quotes || {})) {
      const v = q as any
      result[code] = {
        price: Number(v.price) || 0,
        changePct5: Number(v.changePct5) || 0,
        changePct20: Number(v.changePct20) || 0,
      }
    }
    return result
  } catch (e) {
    console.warn('[stockApi] fetchQuotes 실패:', e)
    return {}
  }
}

// 거래대금 TOP
export async function fetchTopValue(
  market: 'KOSPI' | 'KOSDAQ',
  count = 30,
): Promise<TopValueStock[]> {
  try {
    const url = buildUrl({ action: 'topValue', market, count: String(count) })
    const res = await fetch(url)
    const data = await res.json()
    const stocks = data.stocks || data.data || []
    return stocks.map((s: any, i: number) => ({
      rank: s.rank || i + 1,
      code: s.code,
      name: s.name,
      currentPrice: Number(s.currentPrice) || 0,
      changePctToday: Number(s.changePctToday ?? s.changePct) || 0,
      accumulatedValue: Number(s.accumulatedValue) / (s.accumulatedValue > 1_000_000_000 ? 100_000_000 : 1) || 0,
    }))
  } catch (e) {
    console.warn('[stockApi] fetchTopValue 실패:', e)
    return []
  }
}

// ── TaskFlow 백엔드 프록시 (네이버 CORS 우회) ──
import api from './client'

// 외인/기관 5거래일 동향
export interface InvestorTrend {
  date: string
  foreign: number       // 외국인 순매수량
  institution: number   // 기관 순매수량
  individual: number    // 개인 순매수량
  foreignAmt: number    // 외국인 순매수금액 (백만원)
  institutionAmt: number
}

export interface InvestorData {
  trends: InvestorTrend[]
  per: string
  pbr: string
  marketCap: string
}

export async function fetchInvestor(code: string): Promise<InvestorData> {
  try {
    const { data } = await api.get(`/stock/investor/${code}`)
    return data
  } catch (e) {
    console.warn('[stockApi] fetchInvestor 실패:', e)
    return { trends: [], per: '-', pbr: '-', marketCap: '-' }
  }
}

// 공포탐욕지수
export interface FearGreedData {
  value: number | null
  text: string
  previous_close: number | null
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  try {
    // FearGreedChart.com은 CORS OK → 직접 호출
    const res = await fetch('https://feargreedchart.com/api/?action=all')
    const data = await res.json()
    return {
      value: data.fear_greed?.value ?? data.value ?? null,
      text: data.fear_greed?.text ?? data.text ?? 'N/A',
      previous_close: data.fear_greed?.previous_close ?? null,
    }
  } catch {
    // 폴백: 백엔드 프록시
    try {
      const { data } = await api.get('/stock/fear-greed')
      return { value: data.value, text: data.text || 'N/A', previous_close: null }
    } catch {
      return { value: null, text: 'N/A', previous_close: null }
    }
  }
}

// 종목 뉴스
export async function fetchNews(code: string): Promise<NewsItem[]> {
  try {
    const url = buildUrl({ action: 'news', code })
    const res = await fetch(url)
    const data = await res.json()
    return (data.news || []).map((n: any) => ({
      title: n.title || '',
      url: n.url || '',
      time: n.time || '',
    }))
  } catch (e) {
    console.warn('[stockApi] fetchNews 실패:', e)
    return []
  }
}

// ── 주식 캘린더 ──

export interface StockNewsItem {
  id: number
  stockCode: string
  stockName: string
  title: string
  summary: string
  importance: 'high' | 'medium' | 'low'
  reason: string
  url: string
  source: 'news' | 'event'
}

export interface StockCalendarData {
  data: Record<string, StockNewsItem[]>
  lastFetched: string | null
}

export async function analyzeStockNews(codes: { code: string; name: string }[]): Promise<void> {
  await api.post('/stock-news/analyze', { codes })
}

export async function fetchStockCalendar(
  codes: string[],
  year: number,
  month: number
): Promise<StockCalendarData> {
  const { data } = await api.get('/stock-news/calendar', {
    params: { codes: codes.join(','), year, month },
  })
  return data
}

export async function fetchStockEvents(): Promise<any[]> {
  const res = await fetch('/data/stock-events.json')
  return res.json()
}

export interface MarketOutlook {
  signal: 'buy' | 'hold' | 'sell'
  confidence: number
  summary: string
  detail: string
  risks: string
  marketData: {
    nasdaq: { price: number; changePct: number }
    sp500: { price: number; changePct: number }
    sox: { price: number; changePct: number }
    vix: { price: number }
    nasdaqFutures: { price: number; changePct: number }
    usdkrw: { price: number; changePct: number }
  }
  foreignTrend: string
  newsSummary: string
  fearGreed: number | null
  generatedAt: string
}

export async function fetchMarketOutlook(code: string, name: string): Promise<MarketOutlook> {
  const { data } = await api.get('/stock-news/outlook', { params: { code, name } })
  return data
}

// ── Stock Guard ──

export interface GuardWindow {
  open: string
  close: string
}

export interface GuardStatus {
  enabled: boolean
  accessible: boolean
  currentWindow: number | null
  nextOpenTime: string | null
  nextOpenDay?: string
  windows: GuardWindow[]
}

export interface GuardSettings {
  enabled: boolean
  windows: GuardWindow[]
  kakaoLinked: boolean
  kakaoExpiresAt: string | null
}

export async function fetchGuardStatus(): Promise<GuardStatus> {
  const { data } = await api.get('/stock/guard/status')
  return data
}

export async function fetchGuardSettings(): Promise<GuardSettings> {
  const { data } = await api.get('/stock/guard/settings')
  return data
}

export async function updateGuardSettings(
  payload: { enabled?: boolean; windows?: GuardWindow[] }
): Promise<void> {
  await api.patch('/stock/guard/settings', payload)
}

// ── 시황 이벤트 결과 ──

export type EventResultMap = Record<string, { actual: string | null; memo: string | null; impact: string | null }>

export async function fetchEventResults(): Promise<EventResultMap> {
  try {
    const { data } = await api.get('/market-events')
    return data.data || {}
  } catch {
    return {}
  }
}

// ── 시황 일지 ──

export interface MarketJournalEntry {
  date: string
  content: string
  summary: string | null
  updatedAt: string
}

export async function fetchJournal(date: string): Promise<MarketJournalEntry | null> {
  try {
    const { data } = await api.get(`/market-journal/${date}`)
    return data.data || null
  } catch {
    return null
  }
}

export async function fetchJournalList(year: number, month: number): Promise<{ date: string; summary: string | null }[]> {
  try {
    const { data } = await api.get('/market-journal', { params: { year, month } })
    return data.data || []
  } catch {
    return []
  }
}

export async function saveJournal(date: string, content: string, summary?: string): Promise<void> {
  await api.put(`/market-journal/${date}`, { content, summary })
}

export async function deleteJournal(date: string): Promise<void> {
  await api.delete(`/market-journal/${date}`)
}

// ── 워치리스트 (상시 메모) ──

const WATCHLIST_KEY = '_watchlist'

export async function fetchWatchlist(): Promise<MarketJournalEntry | null> {
  return fetchJournal(WATCHLIST_KEY)
}

export async function saveWatchlist(content: string): Promise<void> {
  await saveJournal(WATCHLIST_KEY, content, '워치리스트')
}

export async function saveEventResult(
  eventId: string,
  payload: { actual?: string; memo?: string; impact?: string }
): Promise<void> {
  await api.put(`/market-events/${encodeURIComponent(eventId)}`, payload)
}

export async function unlinkKakao(): Promise<void> {
  await api.delete('/stock/guard/kakao')
}
