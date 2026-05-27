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

    // 네이버 integration API 응답 파싱
    // dealTrendInfos 또는 최상위 배열 형태
    const rawTrends = data?.dealTrendInfos || (Array.isArray(data) ? data : [])

    // 파싱 헬퍼: "+529,897" → 529897, "-18,203" → -18203
    const parseNum = (v: string | number) => {
      if (typeof v === 'number') return v
      if (!v) return 0
      return Number(String(v).replace(/,/g, '').replace(/\+/g, '')) || 0
    }

    const trends = rawTrends.map((day: any) => ({
      date: day.bizdate || day.date || '',
      foreign: parseNum(day.foreignerPureBuyQuant || day.foreignNetBuyVolume),
      institution: parseNum(day.organPureBuyQuant || day.institutionNetBuyVolume),
      individual: parseNum(day.individualPureBuyQuant || day.individualNetBuyVolume),
      foreignAmt: parseNum(day.foreignNetBuyAmount || 0),
      institutionAmt: parseNum(day.institutionNetBuyAmount || 0),
    }))

    // 종목 기본 정보 추출
    const totalInfos = data?.totalInfos || []
    const per = data?.per || totalInfos.find((i: any) => i.key === 'PER')?.value || '-'
    const pbr = data?.pbr || totalInfos.find((i: any) => i.key === 'PBR')?.value || '-'
    const marketCap = data?.marketCap || totalInfos.find((i: any) => i.key === '시가총액')?.value || '-'

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
