import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const VALID_STATUS = ['holding', 'profit', 'stopped', 'watching']

// GET / — 매매일지 목록
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const status = req.query.status as string | undefined

    const where: Record<string, unknown> = { userId }
    if (status && VALID_STATUS.includes(status)) {
      where.status = status
    }

    const logs = await prisma.tradeLog.findMany({
      where,
      orderBy: [{ buyDate: 'desc' }, { createdAt: 'desc' }],
    })
    res.json({ data: logs })
  } catch (err) {
    console.error('GET /trade-logs error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// POST / — 매매 기록 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { stockName, stockCode, buyPrice, targetPrice, stopLoss, quantity, buyDate, status, memo, entryReason, exitReason } = req.body

    if (!stockName || !buyPrice || !buyDate) {
      res.status(400).json({ message: '종목명, 매수가, 매수일은 필수입니다.' })
      return
    }

    const log = await prisma.tradeLog.create({
      data: {
        userId,
        stockName: stockName.trim(),
        stockCode: stockCode?.trim() || '',
        buyPrice: Number(buyPrice),
        targetPrice: targetPrice ? Number(targetPrice) : null,
        stopLoss: stopLoss ? Number(stopLoss) : null,
        quantity: quantity ? Number(quantity) : 1,
        buyDate,
        status: status && VALID_STATUS.includes(status) ? status : 'holding',
        memo: memo?.trim() || null,
        realPnl: req.body.realPnl !== undefined && req.body.realPnl !== '' ? Number(req.body.realPnl) : null,
        entryReason: entryReason?.trim() || null,
        exitReason: exitReason?.trim() || null,
      },
    })
    res.status(201).json({ data: log })
  } catch (err) {
    console.error('POST /trade-logs error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// PUT /:id — 매매 기록 수정
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.tradeLog.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '매매 기록을 찾을 수 없습니다.' })
      return
    }

    const { stockName, stockCode, buyPrice, targetPrice, stopLoss, sellPrice, quantity, buyDate, sellDate, status, memo } = req.body
    const updateData: Record<string, unknown> = {}

    if (stockName !== undefined) updateData.stockName = stockName.trim()
    if (stockCode !== undefined) updateData.stockCode = stockCode.trim()
    if (buyPrice !== undefined) updateData.buyPrice = Number(buyPrice)
    if (targetPrice !== undefined) updateData.targetPrice = targetPrice ? Number(targetPrice) : null
    if (stopLoss !== undefined) updateData.stopLoss = stopLoss ? Number(stopLoss) : null
    if (sellPrice !== undefined) updateData.sellPrice = sellPrice ? Number(sellPrice) : null
    if (quantity !== undefined) updateData.quantity = Number(quantity)
    if (buyDate !== undefined) updateData.buyDate = buyDate
    if (sellDate !== undefined) updateData.sellDate = sellDate || null
    if (status !== undefined && VALID_STATUS.includes(status)) updateData.status = status
    if (memo !== undefined) updateData.memo = memo?.trim() || null
    if (req.body.realPnl !== undefined) updateData.realPnl = req.body.realPnl !== '' ? Number(req.body.realPnl) : null
    if (req.body.entryReason !== undefined) updateData.entryReason = req.body.entryReason?.trim() || null
    if (req.body.exitReason !== undefined) updateData.exitReason = req.body.exitReason?.trim() || null

    const log = await prisma.tradeLog.update({ where: { id }, data: updateData })
    res.json({ data: log })
  } catch (err) {
    console.error('PUT /trade-logs error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// DELETE /:id — 매매 기록 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const existing = await prisma.tradeLog.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ message: '매매 기록을 찾을 수 없습니다.' })
      return
    }

    await prisma.tradeLog.delete({ where: { id } })
    res.json({ message: '삭제되었습니다.' })
  } catch (err) {
    console.error('DELETE /trade-logs error:', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
