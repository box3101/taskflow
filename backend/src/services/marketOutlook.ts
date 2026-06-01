import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '../prisma'

const API_KEY = process.env.GEMINI_API_KEY
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

interface MarketData {
  nasdaq: { price: number; changePct: number }
  sp500: { price: number; changePct: number }
  sox: { price: number; changePct: number }
  vix: { price: number }
  nasdaqFutures: { price: number; changePct: number }
  usdkrw: { price: number; changePct: number }
  nvda: { price: number; changePct: number }
  mu: { price: number; changePct: number }
}

interface OutlookResult {
  signal: 'buy' | 'hold' | 'sell'
  confidence: number
  summary: string
  detail: string
  risks: string
  marketData: MarketData
  foreignTrend: string
  newsSummary: string
  fearGreed: number | null
  generatedAt: string
}

// Yahoo Finance에서 미국 지수 가져오기
async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePct: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) return { price: 0, changePct: 0 }

    const closes = result.indicators?.quote?.[0]?.close || []
    const prev = closes[closes.length - 2] || 0
    const current = closes[closes.length - 1] || result.meta?.regularMarketPrice || 0
    const changePct = prev > 0 ? ((current - prev) / prev) * 100 : 0

    return { price: Math.round(current * 100) / 100, changePct: Math.round(changePct * 100) / 100 }
  } catch (e) {
    console.warn(`[marketOutlook] Yahoo ${symbol} 실패:`, e)
    return { price: 0, changePct: 0 }
  }
}

// 미국 시장 데이터 수집
async function fetchMarketData(): Promise<MarketData> {
  const [nasdaq, sp500, sox, vix, kospi200, usdkrw, nvda, mu] = await Promise.all([
    fetchYahooQuote('^IXIC'),
    fetchYahooQuote('^GSPC'),
    fetchYahooQuote('^SOX'),
    fetchYahooQuote('^VIX'),
    fetchYahooQuote('^KS200'),  // 코스피200 지수 (야간선물 대체)
    fetchYahooQuote('KRW=X'),
    fetchYahooQuote('NVDA'),    // 엔비디아
    fetchYahooQuote('MU'),      // 마이크론
  ])
  return { nasdaq, sp500, sox, vix, nasdaqFutures: kospi200, usdkrw, nvda, mu }
}

// 외국인/기관 동향 요약
function summarizeForeignTrend(trends: any[]): string {
  if (!trends || trends.length === 0) return '데이터 없음'
  const recent5 = trends.slice(0, 5)
  const foreignTotal = recent5.reduce((sum: number, t: any) => sum + (t.foreign || 0), 0)
  const instTotal = recent5.reduce((sum: number, t: any) => sum + (t.institution || 0), 0)
  const foreignDir = foreignTotal > 0 ? '순매수' : '순매도'
  const instDir = instTotal > 0 ? '순매수' : '순매도'
  const consecutiveBuy = recent5.filter((t: any) => t.foreign > 0).length
  return `외국인 5일 ${foreignDir}(${Math.abs(foreignTotal).toLocaleString()}주), 기관 ${instDir}(${Math.abs(instTotal).toLocaleString()}주), 외국인 ${consecutiveBuy}일 매수`
}

// 뉴스 sentiment 요약
async function summarizeNewsSentiment(stockCode: string): Promise<string> {
  const news = await prisma.stockNews.findMany({
    where: { stockCode },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const pos = news.filter(n => n.sentiment === 'positive').length
  const neg = news.filter(n => n.sentiment === 'negative').length
  const neu = news.filter(n => n.sentiment === 'neutral').length
  const topNews = news.slice(0, 3).map(n => n.summary).join(', ')
  return `호재 ${pos}건, 악재 ${neg}건, 중립 ${neu}건. 주요: ${topNews || '없음'}`
}

// 공포탐욕지수
async function fetchFearGreed(): Promise<number | null> {
  try {
    const res = await fetch('https://feargreedchart.com/api/?action=all')
    const data = await res.json()
    return data?.value ?? null
  } catch {
    return null
  }
}

// Claude로 전망 생성
export async function generateOutlook(
  stockName: string,
  stockCode: string,
  investorTrends: any[]
): Promise<OutlookResult> {
  if (!genAI) {
    throw new Error('AI_UNAVAILABLE')
  }

  const [marketData, foreignTrend, newsSummary, fearGreed] = await Promise.all([
    fetchMarketData(),
    Promise.resolve(summarizeForeignTrend(investorTrends)),
    summarizeNewsSentiment(stockCode),
    fetchFearGreed(),
  ])

  const fearText = fearGreed !== null
    ? `${fearGreed} (${fearGreed >= 75 ? '극단적 탐욕' : fearGreed >= 55 ? '탐욕' : fearGreed >= 45 ? '중립' : fearGreed >= 25 ? '공포' : '극단적 공포'})`
    : '데이터 없음'

  const prompt = `당신은 한국 주식 시장 전문 애널리스트입니다. 다음 데이터를 기반으로 내일 ${stockName}(${stockCode}) 주가 전망을 분석해주세요.

[미국장 마감]
- 나스닥: ${marketData.nasdaq.price.toLocaleString()} (${marketData.nasdaq.changePct >= 0 ? '+' : ''}${marketData.nasdaq.changePct}%)
- S&P500: ${marketData.sp500.price.toLocaleString()} (${marketData.sp500.changePct >= 0 ? '+' : ''}${marketData.sp500.changePct}%)
- 필라델피아 반도체(SOX): ${marketData.sox.price.toLocaleString()} (${marketData.sox.changePct >= 0 ? '+' : ''}${marketData.sox.changePct}%)
- VIX(공포지수): ${marketData.vix.price}
- 코스피200: ${marketData.nasdaqFutures.price.toLocaleString()} (${marketData.nasdaqFutures.changePct >= 0 ? '+' : ''}${marketData.nasdaqFutures.changePct}%)
- 원/달러 환율: ${marketData.usdkrw.price.toFixed(1)}원 (${marketData.usdkrw.changePct >= 0 ? '+' : ''}${marketData.usdkrw.changePct}%)

[핵심 관련주]
- 엔비디아(NVDA): $${marketData.nvda.price.toLocaleString()} (${marketData.nvda.changePct >= 0 ? '+' : ''}${marketData.nvda.changePct}%) — HBM 최대 고객사, 물량 70%
- 마이크론(MU): $${marketData.mu.price.toLocaleString()} (${marketData.mu.changePct >= 0 ? '+' : ''}${marketData.mu.changePct}%) — HBM 경쟁사, 업종 동반 움직임

[한국 수급]
${foreignTrend}

[뉴스 분석]
${newsSummary}

[공포탐욕지수]
${fearText}

JSON으로만 응답 (다른 텍스트 없이):
{"signal":"buy","confidence":7,"summary":"한줄요약 30자이내","detail":"초보자도 이해할 수 있는 3~4문장 설명. 왜 이런 판단인지, 어떤 데이터가 근거인지 쉽게.","risks":"주의할 점 1~2문장"}

signal: buy(매수유리) / hold(관망) / sell(매도유리)
confidence: 1~10 (10이 가장 확신)

confidence 가이드라인:
- 호재 비율 80% 이상 + 미국장 상승 → 최소 7
- 호재 비율 60% 이상 → 최소 6
- 외국인 매도가 있어도 호재가 압도적이면 confidence를 낮추지 마
- 주말(미국장 0%)이면 뉴스와 수급 비중을 더 높여서 판단

detail: "쉽게 말해..." 스타일로 초보자 친화적`

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  let parsed = { signal: 'hold' as const, confidence: 5, summary: '분석 중', detail: '', risks: '' }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.warn('[marketOutlook] 파싱 실패:', text.slice(0, 200))
  }

  return {
    ...parsed,
    marketData,
    foreignTrend,
    newsSummary,
    fearGreed,
    generatedAt: new Date().toISOString(),
  }
}
