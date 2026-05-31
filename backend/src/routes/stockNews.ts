import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'
import { analyzeNews } from '../services/newsAnalyzer'

const router = Router()
router.use(authenticate)

const CACHE_TTL_MS = 3 * 60 * 60 * 1000 // 3시간

// 종목별 연관 검색 키워드
const RELATED_KEYWORDS: Record<string, string[]> = {
  '000660': ['SK하이닉스', 'HBM', '엔비디아 반도체', '젠슨황'],
  '005930': ['삼성전자', '삼성 반도체', '파운드리'],
}

// 네이버 뉴스 URL에서 og:title 추출
async function fetchOgTitle(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await res.text()
    const match = html.match(/property="og:title"[^>]*content="([^"]*)"/)
    return match?.[1] || ''
  } catch { return '' }
}

// 네이버 모바일 뉴스 검색 → URL 추출 → og:title로 정확한 제목 매핑
async function fetchNewsFromNaver(query: string): Promise<{ title: string; url: string; time: string }[]> {
  try {
    const searchUrl = `https://m.search.naver.com/search.naver?where=m_news&query=${encodeURIComponent(query)}&sort=1`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
    })
    const html = await res.text()
    const seenUrls = new Set<string>()

    // .title 링크에서 URL 추출
    const urlRegex = /href="(https:\/\/n\.news\.naver\.com\/article\/[^"]+)"[^>]*data-heatmap-target="\.title"/g
    const urls: string[] = []
    let match
    while ((match = urlRegex.exec(html)) !== null) {
      if (!seenUrls.has(match[1])) { seenUrls.add(match[1]); urls.push(match[1]) }
    }

    // 각 URL에서 og:title 추출 (병렬, 최대 10개)
    const limited = urls.slice(0, 10)
    const titles = await Promise.all(limited.map(u => fetchOgTitle(u)))

    return limited
      .map((url, i) => ({ title: titles[i], url, time: '' }))
      .filter(n => n.title.length > 0)
  } catch (e) {
    console.warn(`[stockNews] 네이버 검색 실패 (${query}):`, e)
    return []
  }
}

// 종목코드 + 연관 키워드로 뉴스 통합 수집
async function fetchAllNews(code: string, name: string): Promise<{ title: string; url: string; time: string }[]> {
  const keywords = RELATED_KEYWORDS[code] || [name]
  const allNews: { title: string; url: string; time: string }[] = []
  const seenUrls = new Set<string>()

  for (const keyword of keywords) {
    const news = await fetchNewsFromNaver(keyword)
    for (const n of news) {
      if (!seenUrls.has(n.url)) {
        seenUrls.add(n.url)
        allNews.push(n)
      }
    }
  }

  return allNews.slice(0, 20) // 최대 20건
}

// 뉴스 시간 파싱 (절대시간 + 상대시간 지원)
function parseNewsTime(timeStr: string): Date {
  // 절대시간: "2026.05.30 09:30"
  if (/^\d{4}\./.test(timeStr)) {
    return new Date(timeStr.replace(/\./g, '-').replace(' ', 'T') + ':00+09:00')
  }
  // 상대시간: "N분 전", "N시간 전", "N일 전"
  const now = new Date()
  const minMatch = timeStr.match(/(\d+)분\s*전/)
  if (minMatch) return new Date(now.getTime() - parseInt(minMatch[1]) * 60 * 1000)
  const hourMatch = timeStr.match(/(\d+)시간\s*전/)
  if (hourMatch) return new Date(now.getTime() - parseInt(hourMatch[1]) * 60 * 60 * 1000)
  const dayMatch = timeStr.match(/(\d+)일\s*전/)
  if (dayMatch) return new Date(now.getTime() - parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000)

  console.warn(`[stockNews] 파싱 불가 시간: "${timeStr}"`)
  return now
}

// POST /stock-news/analyze
router.post('/analyze', async (req, res) => {
  const { codes } = req.body as { codes: { code: string; name: string }[] }
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'codes 필요' })
  }

  try {
    for (const { code, name } of codes) {
      const cacheLog = await prisma.stockNewsCacheLog.findUnique({ where: { stockCode: code } })
      if (cacheLog && Date.now() - cacheLog.fetchedAt.getTime() < CACHE_TTL_MS) continue

      const newsList = await fetchAllNews(code, name)
      console.log(`[stock-news] ${name}: ${newsList.length}건 뉴스 수집`)
      if (newsList.length === 0) continue

      const analyzed = await analyzeNews(name, code, newsList)
      console.log(`[stock-news] ${name}: AI 분석 ${analyzed.length}건 반환`)

      for (const item of analyzed) {
        if (item.importance === 'low') continue // low는 버림, high+medium만 저장
        const news = newsList[item.index]
        if (!news) continue

        // AI가 추출한 이벤트 날짜 우선, 없으면 뉴스 발행일
        let publishedAt: Date
        if (item.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate)) {
          publishedAt = new Date(item.eventDate + 'T09:00:00+09:00')
        } else {
          publishedAt = parseNewsTime(news.time || '')
        }

        const existing = await prisma.stockNews.findFirst({
          where: { stockCode: code, url: news.url },
        })
        if (!existing) {
          await prisma.stockNews.create({
            data: {
              stockCode: code,
              stockName: name,
              title: news.title,
              summary: item.summary,
              importance: item.importance,
              sentiment: item.sentiment || 'neutral',
              reason: item.reason,
              explain: item.explain || '',
              url: news.url,
              publishedAt,
            },
          })
        }
      }

      await prisma.stockNewsCacheLog.upsert({
        where: { stockCode: code },
        update: { fetchedAt: new Date() },
        create: { stockCode: code, fetchedAt: new Date() },
      })
    }
    res.json({ success: true })
  } catch (err: any) {
    console.error('[stock-news] analyze 에러:', err?.message || err)
    res.status(500).json({ error: '뉴스 분석 실패', detail: err?.message || String(err) })
  }
})

// GET /stock-news/calendar
router.get('/calendar', async (req, res) => {
  const { codes, year, month } = req.query as { codes: string; year: string; month: string }
  if (!codes || !year || !month) {
    return res.status(400).json({ error: 'codes, year, month 필요' })
  }

  const codeList = codes.split(',')
  const y = parseInt(year)
  const m = parseInt(month)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  try {
    const news = await prisma.stockNews.findMany({
      where: {
        stockCode: { in: codeList },
        publishedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { publishedAt: 'desc' },
    })

    const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const sorted = news.sort(
      (a, b) => (importanceOrder[a.importance] ?? 2) - (importanceOrder[b.importance] ?? 2)
    )

    const grouped: Record<string, any[]> = {}
    for (const n of sorted) {
      const dateStr = n.publishedAt.toISOString().split('T')[0]
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push({
        id: n.id,
        stockCode: n.stockCode,
        stockName: n.stockName,
        title: n.title,
        summary: n.summary,
        importance: n.importance,
        sentiment: n.sentiment,
        reason: n.reason,
        explain: n.explain,
        url: n.url,
        source: 'news',
      })
    }

    const latestCache = await prisma.stockNewsCacheLog.findFirst({
      where: { stockCode: { in: codeList } },
      orderBy: { fetchedAt: 'desc' },
    })

    res.json({ data: grouped, lastFetched: latestCache?.fetchedAt || null })
  } catch (err) {
    console.error('[stock-news] calendar 에러:', err)
    res.status(500).json({ error: '캘린더 데이터 조회 실패' })
  }
})

// GET /stock-news/outlook — 내일 장 전망
import { generateOutlook } from '../services/marketOutlook'

let outlookCache: { data: any; fetchedAt: number } | null = null

router.get('/outlook', async (req, res) => {
  const { code, name } = req.query as { code: string; name: string }
  if (!code || !name) return res.status(400).json({ error: 'code, name 필요' })

  // 3시간 캐시
  if (outlookCache && Date.now() - outlookCache.fetchedAt < CACHE_TTL_MS) {
    return res.json(outlookCache.data)
  }

  try {
    // 네이버 금융에서 직접 외국인/기관 동향 가져오기
    const naverRes = await fetch(`https://finance.naver.com/item/frgn.naver?code=${code}&page=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await naverRes.text()
    const parseNum = (v: string) => Number(v.replace(/,/g, '').replace(/\+/g, '').trim()) || 0
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const trends: any[] = []
    let rowMatch
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1]
      const tds: string[] = []
      let tdMatch
      const localTdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
      while ((tdMatch = localTdRegex.exec(row)) !== null) {
        tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
      }
      if (tds.length >= 9 && /^\d{4}\.\d{2}\.\d{2}$/.test(tds[0])) {
        trends.push({
          date: tds[0].replace(/\./g, ''),
          foreign: parseNum(tds[6]),
          institution: parseNum(tds[5]),
        })
      }
      if (trends.length >= 5) break
    }

    const outlook = await generateOutlook(name, code, trends)
    outlookCache = { data: outlook, fetchedAt: Date.now() }
    res.json(outlook)
  } catch (err: any) {
    console.error('[stock-news] outlook 에러:', err?.message || err)
    res.status(500).json({ error: '전망 생성 실패' })
  }
})

// DELETE /stock-news/cache — 캐시 초기화 (재분석 트리거용)
router.delete('/cache', async (_req, res) => {
  try {
    await prisma.stockNews.deleteMany({})
    await prisma.stockNewsCacheLog.deleteMany({})
    res.json({ success: true, message: '캐시 초기화 완료' })
  } catch (err) {
    res.status(500).json({ error: '캐시 초기화 실패' })
  }
})

export default router
