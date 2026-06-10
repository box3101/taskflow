// 보유 종목
export interface StockHolding {
  code: string        // 종목코드 (000660)
  name: string        // 종목명
  buyPrice: number    // 매수가
  targetPrice: number // 목표가
  buyDate: string     // YYYY-MM-DD
  qty: number         // 수량
}

// Apps Script action=price 응답
export interface StockPrice {
  price: number
  changePctToday: number
  changeAmount: number
  open: number
  high: number
  low: number
  prevClose: number
  marketCap: number        // 억원
  accumulatedValue: number // 억원
}

// Apps Script action=quotes 응답
export interface StockQuote {
  price: number
  changePct5: number
  changePct20: number
}

// 테마 정의 (themes.json)
export interface ThemeDef {
  key: string
  label: string
  icon: string
  desc: string
  stocks: { code: string; name: string }[]
}

// 거래대금 TOP 종목
export interface TopValueStock {
  rank: number
  code: string
  name: string
  currentPrice: number
  changePctToday: number
  accumulatedValue: number // 억원
}

// 뉴스
export interface NewsItem {
  title: string
  url: string
  time: string
}

// 마음가짐
export interface MindsetEntry {
  date: string
  text: string
}

// 시황 이벤트
export interface MarketEvent {
  id: string
  date: string              // "2026-06-11"
  time?: string             // "21:30" (한국시간)
  category: 'us-econ' | 'us-earnings' | 'foreign-flow' | 'global' | 'kr-schedule' | 'sentiment'
  title: string
  subtitle?: string
  importance: 1 | 2 | 3    // 🔴 개수
  expected?: string
  previous?: string
  actual?: string
  impact?: string
  country: 'US' | 'KR' | 'EU' | 'JP' | 'CN' | 'GLOBAL'
}
