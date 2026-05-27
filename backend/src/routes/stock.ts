import { Router } from 'express'

const router = Router()

// 네이버 주식 API 프록시 (CORS 우회)

// 외인/기관 5거래일 동향
router.get('/investor/:code', async (req, res) => {
  try {
    const { code } = req.params
    const url = `https://m.stock.naver.com/api/stock/${code}/integration`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const data = await response.json()

    // dealTrendInfos에서 외인/기관/개인 5거래일 데이터 추출
    const trends = data?.dealTrendInfos || []
    const result = trends.map((day: any) => ({
      date: day.date,
      foreign: Number(day.foreignNetBuyVolume) || 0,
      institution: Number(day.institutionNetBuyVolume) || 0,
      individual: Number(day.individualNetBuyVolume) || 0,
      foreignAmt: Number(day.foreignNetBuyAmount) || 0,
      institutionAmt: Number(day.institutionNetBuyAmount) || 0,
    }))

    // 종목 기본 정보도 추출
    const totalInfos = data?.totalInfos || []
    const per = totalInfos.find((i: any) => i.key === 'PER')?.value || '-'
    const pbr = totalInfos.find((i: any) => i.key === 'PBR')?.value || '-'
    const marketCap = totalInfos.find((i: any) => i.key === '시가총액')?.value || '-'

    res.json({ trends, per, pbr, marketCap })
  } catch (e) {
    console.error('[stock/investor] 실패:', e)
    res.json({ trends: [], per: '-', pbr: '-', marketCap: '-' })
  }
})

// 공포탐욕지수 프록시 (FearGreedChart.com은 CORS OK이지만 백업용)
router.get('/fear-greed', async (_req, res) => {
  try {
    const response = await fetch('https://feargreedchart.com/api/?action=all')
    const data = await response.json()
    res.json(data)
  } catch (e) {
    console.error('[stock/fear-greed] 실패:', e)
    res.json({ value: null, text: 'N/A' })
  }
})

export default router
