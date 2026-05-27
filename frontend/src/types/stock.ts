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
