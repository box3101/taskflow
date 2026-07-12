import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET / — 포트폴리오 설정 + 매매 기록 + 잔고 계산
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id

    let portfolio = await prisma.scorePortfolio.findUnique({
      where: { userId },
      include: { trades: { orderBy: { date: 'desc' } } },
    })

    // 없으면 기본값으로 생성
    if (!portfolio) {
      portfolio = await prisma.scorePortfolio.create({
        data: { userId },
        include: { trades: { orderBy: { date: 'desc' } } },
      })
    }

    // 잔고 계산 (초기자금 - 매수총액 + 매도총액)
    const trades = portfolio.trades
    let cash = portfolio.initialCash
    const holdings: Record<string, { code: string; name: string; qty: number; avgPrice: number; scoreAtBuy: number | null }> = {}

    // 시간순으로 계산
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    for (const t of sorted) {
      if (t.action === 'buy') {
        cash -= t.price * t.quantity
        if (!holdings[t.stockCode]) {
          holdings[t.stockCode] = { code: t.stockCode, name: t.stockName, qty: 0, avgPrice: 0, scoreAtBuy: t.scoreAtBuy }
        }
        const h = holdings[t.stockCode]
        const totalCost = h.avgPrice * h.qty + t.price * t.quantity
        h.qty += t.quantity
        h.avgPrice = Math.round(totalCost / h.qty)
      } else {
        cash += t.price * t.quantity
        if (holdings[t.stockCode]) {
          holdings[t.stockCode].qty -= t.quantity
          if (holdings[t.stockCode].qty <= 0) delete holdings[t.stockCode]
        }
      }
    }

    res.json({
      data: {
        ...portfolio,
        cash,
        holdings: Object.values(holdings),
      },
    })
  } catch (err) {
    console.error('GET /score-portfolio error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PATCH / — 포트폴리오 설정 변경
router.patch('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { initialCash, maxStocks, maxHoldDays, rules } = req.body

    const portfolio = await prisma.scorePortfolio.upsert({
      where: { userId },
      create: { userId, initialCash, maxStocks, maxHoldDays, rules },
      update: { initialCash, maxStocks, maxHoldDays, rules },
    })

    res.json({ data: portfolio })
  } catch (err) {
    console.error('PATCH /score-portfolio error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST /trades — 매매 기록 추가
router.post('/trades', async (req, res) => {
  try {
    const userId = req.user!.id
    const { stockCode, stockName, action, price, quantity, scoreAtBuy, reason, date } = req.body

    if (!stockCode || !action || !price || !quantity || !date) {
      return res.status(400).json({ message: '필수 필드 누락' })
    }

    let portfolio = await prisma.scorePortfolio.findUnique({ where: { userId } })
    if (!portfolio) {
      portfolio = await prisma.scorePortfolio.create({ data: { userId } })
    }

    const trade = await prisma.scoreTrade.create({
      data: {
        portfolioId: portfolio.id,
        stockCode,
        stockName,
        action,
        price,
        quantity,
        scoreAtBuy,
        reason,
        date,
      },
    })

    res.json({ data: trade })
  } catch (err) {
    console.error('POST /score-portfolio/trades error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /trades/:id — 매매 기록 삭제
router.delete('/trades/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.scoreTrade.delete({ where: { id } })
    res.json({ message: '삭제 완료' })
  } catch (err) {
    console.error('DELETE /score-portfolio/trades error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
