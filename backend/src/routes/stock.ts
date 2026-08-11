import { Router } from 'express'
import { getInvestorRows, detectShareDiscontinuity } from '../services/investorData'

const router = Router()

// 네이버 주식 API 프록시 (CORS 우회)

const MAX_DAYS = 260   // 약 1년치 거래일

// 외인/기관 일별 동향 (기본 20일, ?days=260 까지 확장 / ?refresh=1 강제 재수집)
router.get('/investor/:code', async (req, res) => {
  try {
    const { code } = req.params
    const days = Math.min(MAX_DAYS, Math.max(1, Number(req.query.days) || 20))
    const refresh = req.query.refresh === '1'

    const rows = await getInvestorRows(code, days, { refresh })

    // 기존 응답 계약 유지 (foreign/institution/foreignAmt/institutionAmt/changePct)
    const trends = rows.map(r => ({
      date: r.date,
      foreign: r.foreignVol,
      institution: r.instVol,
      individual: 0,
      foreignAmt: Math.round(r.foreignVol * r.close / 1_000_000),      // 백만원 단위
      institutionAmt: Math.round(r.instVol * r.close / 1_000_000),
      changePct: r.changePct,
      // 과거 재현 백테스트용 추가 필드
      close: r.close,
      volume: r.volume,
      listedShares: r.listedShares,
      marketCapAt: r.listedShares > 0
        ? Math.round(r.listedShares * r.close / 1_000_000)             // 해당일 시총 (백만원)
        : 0,
    }))

    // 액면분할·감자 의심 구간 (해당 날짜 이전은 가격 연속성 없음)
    const splitDates = detectShareDiscontinuity(rows)

    // 기본 정보는 모바일 API에서 가져오기
    let per = '-', pbr = '-', marketCap = '-'
    try {
      const mobileRes = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const mobileData = await mobileRes.json()
      const totalInfos: any[] = mobileData?.totalInfos || []
      const findInfo = (key: string) => totalInfos.find((i: any) => i.key === key)?.value || '-'
      // PER/PBR: "23.04배" → "23.04" (숫자만 추출)
      const stripUnit = (v: string) => v.replace(/[^0-9.\-]/g, '') || '-'
      per = stripUnit(findInfo('PER'))
      pbr = stripUnit(findInfo('PBR'))
      // 시총: "1,666조 1,894억" → 백만원 단위로 변환
      const rawCap = findInfo('시총')
      if (rawCap !== '-') {
        let capMillion = 0
        const joMatch = rawCap.match(/([\d,]+)조/)
        const eokMatch = rawCap.match(/([\d,]+)억/)
        if (joMatch) capMillion += parseFloat(joMatch[1].replace(/,/g, '')) * 1_000_000  // 1조 = 100만 백만원
        if (eokMatch) capMillion += parseFloat(eokMatch[1].replace(/,/g, '')) * 100      // 1억 = 100 백만원
        marketCap = String(capMillion)
      }
    } catch { /* 기본값 유지 */ }

    res.json({ trends, per, pbr, marketCap, splitDates })
  } catch (e) {
    console.error('[stock/investor] 실패:', e)
    res.json({ trends: [], per: '-', pbr: '-', marketCap: '-', splitDates: [] })
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
