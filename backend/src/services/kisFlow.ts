import { emptyValues, FlowSample, FlowSource, FlowKey, InvestorFlowKey, koreanClock } from './flowAnalysis'

const ORIGIN = 'https://openapi.koreainvestment.com:9443'
type Row = Record<string, unknown>
type Body = { rt_cd?: string; msg_cd?: string; output?: unknown; output1?: unknown }
let token: { value: string; expiresAt: number } | null = null
let tokenPending: Promise<string> | null = null
let lastAuthAttempt = 0
let holiday: { date: string; open: boolean } | null = null

export function kisConfigured() {
  return Boolean(process.env.KIS_APP_KEY?.trim() && process.env.KIS_APP_SECRET?.trim())
}
export function apiNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const text = String(value).replace(/,/g, '').trim()
  if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
export function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter(v => v && typeof v === 'object') as Row[]
  return value && typeof value === 'object' ? [value as Row] : []
}
export function foreignProgramRow(value: unknown): Row | undefined {
  // Do not use the total row, or accidentally match 기타외국인.
  return rows(value).find(r => /^외국인(?:계)?$/.test(String(r.invr_cls_name ?? '').trim()) || (!String(r.invr_cls_name ?? '').trim() && String(r.invr_cls_code) === '9100'))
}

async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value
  if (tokenPending) return tokenPending
  if (!kisConfigured()) throw new Error('KIS_NOT_CONFIGURED')
  if (Date.now() - lastAuthAttempt < 65_000) throw new Error('KIS_AUTH_COOLDOWN')
  lastAuthAttempt = Date.now()
  tokenPending = (async () => {
    const response = await fetch(`${ORIGIN}/oauth2/tokenP`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: process.env.KIS_APP_KEY, appsecret: process.env.KIS_APP_SECRET }),
    })
    const data = await response.json() as { access_token?: string; expires_in?: number }
    if (!response.ok || !data.access_token) throw new Error('KIS_AUTH_FAILED')
    token = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 86400) * 1000 }
    return token.value
  })()
  try { return await tokenPending } finally { tokenPending = null }
}

export async function kisGet(path: string, tr: string, params: Record<string, string>): Promise<Body> {
  const accessToken = await getToken()
  const response = await fetch(`${ORIGIN}${path}?${new URLSearchParams(params)}`, {
    headers: { authorization: `Bearer ${accessToken}`, appkey: process.env.KIS_APP_KEY!, appsecret: process.env.KIS_APP_SECRET!, tr_id: tr, custtype: 'P', 'content-type': 'application/json; charset=utf-8' },
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 401) token = null
  const body = await response.json() as Body
  // Never log/return response bodies or request headers containing credentials.
  if (!response.ok || body.rt_cd !== '0') {
    if (body.msg_cd === 'EGW00123' || body.msg_cd === 'EGW00121') token = null
    throw new Error('KIS_QUERY_FAILED')
  }
  return body
}

export async function isKisTradingDay(date: string): Promise<boolean> {
  if (holiday?.date === date) return holiday.open
  const data = await kisGet('/uapi/domestic-stock/v1/quotations/chk-holiday', 'CTCA0903R', { BASS_DT: date.replace(/-/g, ''), CTX_AREA_NK: '', CTX_AREA_FK: '' })
  const row = rows(data.output).find(r => r.bass_dt === date.replace(/-/g, ''))
  if (!row || !['Y', 'N'].includes(String(row.opnd_yn))) throw new Error('KIS_CALENDAR_UNAVAILABLE')
  holiday = { date, open: row.opnd_yn === 'Y' }
  return holiday.open
}

export async function fetchKisFlow(now = new Date()): Promise<FlowSample> {
  const observedAt = now.toISOString()
  const values = emptyValues()
  const sources = {} as FlowSample['sources']
  const jobs: { keys: (FlowKey | InvestorFlowKey)[]; fetch: () => Promise<void> }[] = [
    { keys: ['cash', 'institutionCash', 'individualCash'], fetch: async () => {
      const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-investor-time-by-market', 'FHPTJ04030000', { FID_INPUT_ISCD: 'KSP', FID_INPUT_ISCD_2: '0001' })
      const row = rows(data.output)[0]
      values.cash = apiNumber(row?.frgn_ntby_tr_pbmn)
      values.institutionCash = apiNumber(row?.orgn_ntby_tr_pbmn)
      values.individualCash = apiNumber(row?.prsn_ntby_tr_pbmn)
    } },
    { keys: ['futures', 'institutionFutures', 'individualFutures'], fetch: async () => {
      const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-investor-time-by-market', 'FHPTJ04030000', { FID_INPUT_ISCD: 'K2I', FID_INPUT_ISCD_2: 'F001' })
      const row = rows(data.output)[0]
      values.futures = apiNumber(row?.frgn_ntby_qty)
      values.institutionFutures = apiNumber(row?.orgn_ntby_qty)
      values.individualFutures = apiNumber(row?.prsn_ntby_qty)
    } },
    { keys: ['nonArb'], fetch: async () => {
      const data = await kisGet('/uapi/domestic-stock/v1/quotations/investor-program-trade-today', 'HHPPG046600C1', { MRKT_DIV_CLS_CODE: '1', EXCH_DIV_CLS_CODE: 'J' })
      values.nonArb = apiNumber(foreignProgramRow(data.output1)?.nabt_ntby_amt)
    } },
    { keys: ['totalNonArb'], fetch: async () => {
      // Investor breakdown has no total row and includes overlapping institution subtotals.
      // Read the market total from the dedicated endpoint; never sum those rows.
      const data = await kisGet('/uapi/domestic-stock/v1/quotations/comp-program-trade-today', 'FHPPG04600101', {
        FID_COND_MRKT_DIV_CODE: 'J', FID_MRKT_CLS_CODE: 'K', FID_SCTN_CLS_CODE: '',
        FID_INPUT_ISCD: '', FID_COND_MRKT_DIV_CODE1: '', FID_INPUT_HOUR_1: '',
      })
      const latest = rows(data.output).filter(r => /^\d{6}$/.test(String(r.bsop_hour ?? '')))
        .sort((a, b) => String(b.bsop_hour).localeCompare(String(a.bsop_hour)))[0]
      values.totalNonArb = apiNumber(latest?.nabt_smtn_ntby_tr_pbmn)
    } },
    { keys: ['kospi'], fetch: async () => {
      const data = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-index-price', 'FHPUP02100000', { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '0001' })
      const row = rows(data.output)[0]
      values.kospi = apiNumber(row?.bstp_nmix_prpr)
      values.kospiPct = apiNumber(row?.bstp_nmix_prdy_ctrt)
      if (values.kospi !== null && values.kospi <= 0) values.kospi = null
    } },
  ]
  // Small sequential batch: no burst per browser/user, no write/order endpoints.
  for (const job of jobs) {
    try {
      await job.fetch()
      for (const key of job.keys) sources[key] = { status: values[key] === null ? 'missing' : 'ok', fetchedAt: new Date().toISOString(), sourceAt: null, message: values[key] === null ? '응답에 해당 항목이 없습니다.' : null }
    } catch {
      for (const key of job.keys) sources[key] = { status: 'error', fetchedAt: new Date().toISOString(), sourceAt: null, message: '한국투자 조회 실패 · 권한 및 연결 상태를 확인하세요.' }
    }
  }
  return { date: koreanClock(now).date, observedAt, values, sources }
}
