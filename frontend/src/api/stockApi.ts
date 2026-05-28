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
