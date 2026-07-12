import { Router } from 'express'

const router = Router()

// 네이버 주식 API 프록시 (CORS 우회)

// 외인/기관 20거래일 동향
router.get('/investor/:code', async (req, res) => {
  try {
    const { code } = req.params

    // 네이버 PC 외국인 매매 페이지에서 20일치 크롤링
    const url = `https://finance.naver.com/item/frgn.naver?code=${code}&page=1`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await response.text()

    const parseNum = (v: string) => {
      if (!v) return 0
      return Number(v.replace(/,/g, '').replace(/\+/g, '').trim()) || 0
    }

    // 테이블 행에서 데이터 추출 (6개 이상 td를 가진 행)
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const trends: any[] = []
    let match

    while ((match = rowRegex.exec(html)) !== null) {
      const row = match[1]
      const tds: string[] = []
      let tdMatch
      while ((tdMatch = tdRegex.exec(row)) !== null) {
        tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
      }
      // 날짜 형식 확인 (2026.05.29)
      // 컬럼: 날짜(0), 종가(1), 전일비(2), 등락률(3), 거래량(4), 기관(5), 외국인(6), 보유주수(7), 보유율(8)
      if (tds.length >= 9 && /^\d{4}\.\d{2}\.\d{2}$/.test(tds[0])) {
        const price = parseNum(tds[1])
        const foreignVol = parseNum(tds[6])
        const instVol = parseNum(tds[5])
        trends.push({
          date: tds[0].replace(/\./g, ''),
          foreign: foreignVol,
          institution: instVol,
          individual: 0,
          foreignAmt: Math.round(foreignVol * price / 1_000_000), // 백만원 단위
          institutionAmt: Math.round(instVol * price / 1_000_000),
        })
      }
      if (trends.length >= 20) break
    }

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
