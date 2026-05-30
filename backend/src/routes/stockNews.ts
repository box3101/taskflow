import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'
import { analyzeNews } from '../services/newsAnalyzer'

const router = Router()
router.use(authenticate)

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwhUT0rUyUwZdjCqGP9dYCjfn2JBT7isV5m9KWxU6PPZappVe4fwz9QqQru0k8npvi0jQ/exec'
const SCRIPT_PW = 'average2026'
const CACHE_TTL_MS = 30 * 60 * 1000

async function fetchNewsFromGAS(code: string) {
  const url = `${GOOGLE_SCRIPT_URL}?action=news&code=${code}&pw=${SCRIPT_PW}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.news || []) as { title: string; url: string; time: string }[]
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

      const newsList = await fetchNewsFromGAS(code)
      if (newsList.length === 0) continue

      const analyzed = await analyzeNews(name, code, newsList)

      for (const item of analyzed) {
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
              reason: item.reason,
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
        reason: n.reason,
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

export default router
