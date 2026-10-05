import { kisGet, rows, apiNumber } from '../kisFlow'
import { parseQuotes } from '../spikeCloudRules'
import { MarketQuote } from './engine'

export async function fetchQuotes(codes: string[]): Promise<Record<string, MarketQuote>> {
  const out: Record<string, MarketQuote> = {}
  const size = Number(process.env.SURGE_QUOTE_BATCH_SIZE || 50)
  for (let offset = 0; offset < codes.length; offset += size) {
    const batch = codes.slice(offset, offset + size)
    try {
      const r = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${batch.join(',')}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com' }, signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) continue
      Object.assign(out, parseQuotes(await r.json(), Date.now()))
    } catch { /* Missing batches are explicitly rejected by completeness checks. */ }
  }
  return out
}
export async function turnoverRanking() {
  const result = new Map<string, { ticker: string; name: string; rank: number }>()
  let continuation = ''
  const target = Number(process.env.SURGE_RANK_TARGET || 200), maxCalls = Number(process.env.SURGE_RANK_MAX_CALLS || 7)
  for (let page = 0; page < maxCalls; page++) {
    const response = await kisGet('/uapi/domestic-stock/v1/quotations/volume-rank', 'FHPST01710000', {
      FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20171', FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '1',
      FID_BLNG_CLS_CODE: '3', FID_TRGT_CLS_CODE: '111111111', FID_TRGT_EXLS_CLS_CODE: '0110111101',
      FID_INPUT_PRICE_1: '', FID_INPUT_PRICE_2: '', FID_VOL_CNT: '', FID_INPUT_DATE_1: '',
    }, continuation)
    const before = result.size
    for (const r of rows(response.output)) {
      const ticker = String(r.mksc_shrn_iscd || ''), name = String(r.hts_kor_isnm || '')
      if (/^\d{6}$/.test(ticker) && !result.has(ticker)) result.set(ticker, { ticker, name, rank: result.size + 1 })
    }
    if (result.size >= target || result.size === before || response.continuation !== 'M') break
    continuation = 'N'
  }
  // Never manufacture 200 rows if the provider ends pagination early.
  return { rows: [...result.values()].slice(0, target), target, complete: result.size >= target }
}
export async function securityStatus(ticker: string) {
  const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-price', 'FHKST01010100', { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: ticker })
  const r = rows(data.output)[0]
  if (!r) throw new Error('SECURITY_STATUS_MISSING')
  const status = String(r.iscd_stat_cls_code || '')
  // 51: management, 52: suspended, 55: liquidation. Missing status is not permission.
  const excluded = !status || ['51', '52', '55'].includes(status) || r.trht_yn === 'Y' || r.mang_issu_cls_code === 'Y'
  return { excluded, vi: r.vi_cls_code != null ? !['0', '00', 'N', ''].includes(String(r.vi_cls_code)) : undefined,
    limitUp: apiNumber(r.stck_prpr) !== null && apiNumber(r.stck_mxpr) !== null && apiNumber(r.stck_prpr)! >= apiNumber(r.stck_mxpr)! }
}
export async function intradayHigh(ticker: string, at: number) {
  const hour = new Date(at + 9 * 3600000).toISOString().slice(11, 19).replace(/:/g, '')
  const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice', 'FHKST03010200', {
    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: ticker, FID_INPUT_HOUR_1: hour, FID_PW_DATA_INCU_YN: 'Y', FID_ETC_CLS_CODE: '',
  })
  // output1's session high includes the period before the returned minute window.
  const high = apiNumber(rows(data.output1)[0]?.stck_hgpr)
  if (high === null || high <= 0 || rows(data.output2).length === 0) throw new Error('INTRADAY_HIGH_MISSING')
  return high
}

export async function executionStatus(ticker: string, date: string) {
  const security = await securityStatus(ticker)
  const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-vi-status', 'FHPST01390000', {
    FID_DIV_CLS_CODE: '0', FID_COND_SCR_DIV_CODE: '20139', FID_MRKT_CLS_CODE: '0', FID_INPUT_ISCD: ticker,
    FID_RANK_SORT_CLS_CODE: '0', FID_INPUT_DATE_1: date.replace(/-/g, ''), FID_TRGT_CLS_CODE: '0', FID_TRGT_EXLS_CLS_CODE: '',
  })
  if (!Array.isArray(data.output) || data.continuation === 'M') throw new Error('VI_STATUS_INCOMPLETE')
  const vi = rows(data.output).some(r => String(r.mksc_shrn_iscd) === ticker && String(r.bsop_date) === date.replace(/-/g, '') &&
    String(r.cntg_vi_hour || '').replace(/0/g, '').length > 0 && !String(r.vi_cncl_hour || '').replace(/0/g, '').trim())
  return { halted: security.excluded, vi, limitUp: security.limitUp, executionUnknown: false }
}
