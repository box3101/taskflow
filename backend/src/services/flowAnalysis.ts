// All amounts are cumulative API values. Deltas compare observations, never trading days.
export type InvestorFlowKey = 'institutionCash' | 'institutionFutures' | 'individualCash' | 'individualFutures'
export interface FlowValues {
  institutionCash?: number | null
  institutionFutures?: number | null
  individualCash?: number | null
  individualFutures?: number | null
  cash: number | null
  futures: number | null
  nonArb: number | null
  totalNonArb: number | null
  kospi: number | null
  kospiPct: number | null
}
export type FlowKey = 'cash' | 'futures' | 'nonArb' | 'totalNonArb' | 'kospi'
export interface FlowSource {
  status: 'ok' | 'error' | 'missing'
  fetchedAt: string
  // These REST endpoints do not guarantee an exchange timestamp for every field.
  sourceAt: string | null
  message: string | null
}
export interface FlowSample {
  date: string
  observedAt: string
  values: FlowValues
  sources: Record<FlowKey, FlowSource> & Partial<Record<InvestorFlowKey, FlowSource>>
}
export interface FlowAnalysis {
  code: string
  title: string
  hypotheses: string[]
  direction: 'up' | 'down' | 'neutral' | 'wait'
  checks: string[]
  delta: FlowValues
  baselineAt: string | null
}
export const FLOW_WINDOWS = [5, 15, 30] as const
export function emptyValues(): FlowValues {
  return { institutionCash: null, institutionFutures: null, individualCash: null, individualFutures: null, cash: null, futures: null, nonArb: null, totalNonArb: null, kospi: null, kospiPct: null }
}
export function koreanClock(now = new Date()) {
  const local = new Date(now.getTime() + 9 * 3600_000)
  return { date: local.toISOString().slice(0, 10), minute: local.getUTCHours() * 60 + local.getUTCMinutes(), day: local.getUTCDay() }
}
export function isCollectionTime(now = new Date()) {
  const k = koreanClock(now)
  return k.day > 0 && k.day < 6 && k.minute >= 540 && k.minute <= 930
}

export function analyzeFlow(current: FlowSample, history: FlowSample[], minutes: number): FlowAnalysis {
  const delta = emptyValues()
  const waiting: FlowAnalysis = { code: 'waiting', title: `${minutes}분 비교 데이터 수집 중`, hypotheses: ['같은 거래일의 연속 관측이 쌓이면 수급 변화를 해석합니다.'], direction: 'wait', checks: ['현물·선물·외국인 비차익의 다음 관측 확인'], delta, baselineAt: null }
  const end = Date.parse(current.observedAt)
  const target = end - minutes * 60_000
  // HTTP completion jitter must not drop the intended baseline for sub-second drift.
  // All candidates still precede the current observation; never use future data.
  const candidates = history.filter(s => s.date === current.date && Date.parse(s.observedAt) < end && Date.parse(s.observedAt) <= target + 5_000 && target - Date.parse(s.observedAt) <= 90_000)
  const base = candidates.sort((a, b) => Math.abs(Date.parse(a.observedAt) - target) - Math.abs(Date.parse(b.observedAt) - target) || a.observedAt.localeCompare(b.observedAt))[0]
  if (!base) return waiting
  const interval = [...history.filter(s => s.date === current.date && s.observedAt >= base.observedAt && s.observedAt < current.observedAt), current].sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  if (interval.some((s, i) => i > 0 && Date.parse(s.observedAt) - Date.parse(interval[i - 1].observedAt) > 180_000)) return { ...waiting, title: '수집 공백 · 연속 데이터 대기' }
  for (const key of ['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi', 'institutionCash', 'institutionFutures', 'individualCash', 'individualFutures'] as const) {
    const a = base.values[key], b = current.values[key]
    if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) && interval.every(s => s.sources[key]?.status === 'ok' && Number.isFinite(s.values[key]))) delta[key] = b - a
  }
  if (delta.kospi !== null && base.values.kospi && current.values.kospi) delta.kospiPct = (current.values.kospi / base.values.kospi - 1) * 100
  const result = (code: string, title: string, hypotheses: string[], direction: FlowAnalysis['direction'], checks: string[]): FlowAnalysis => ({ code, title, hypotheses, direction, checks, delta, baselineAt: base.observedAt })
  const c = delta.cash, f = delta.futures, n = delta.nonArb
  if (c === null || f === null || n === null) return result('incomplete', '필수 수급 데이터 부족 · 판단 보류', ['조회 실패나 누락을 0으로 간주하지 않습니다. 전체 비차익을 외국인 비차익 대신 사용하지 않습니다.'], 'wait', ['누락된 수급 항목의 정상 조회 확인'])
  // Rules describe observable signs, not calibrated probabilities or causal attribution.
  if (c > 0 && f > 0 && n > 0) return result('aligned-buy', '현물·선물 동반 매수 · 비차익 유입', ['상승 방향의 포지션 확대 가능성', '서로 다른 투자자의 매수 또는 기존 헤지 청산 가능성'], 'up', ['외국인 현물 순매수 지속', '외국인 비차익 순매수 지속', '코스피의 상승 반응 확인'])
  if (c < 0 && f < 0 && n < 0) return result('aligned-sell', '현물·선물 동반 매도 · 비차익 유출', ['위험 노출 축소 가능성', '현물 매도와 선물 헤지가 동시에 집계됐을 가능성'], 'down', ['외국인 현물 순매도 지속', '외국인 비차익 순매도 지속', '코스피의 하락 반응 확인'])
  if (c < 0 && f > 0) return result('futures-only', '선물 순매수 · 현물 순매도', ['선물 중심의 상승 포지션 확대 가능성', '기존 선물 매도 포지션 청산 가능성'], 'wait', ['현물 순매도 둔화 또는 매수 전환', '외국인 비차익 매수 동참', '미결제약정·베이시스 추가 확인'])
  if (c > 0 && f < 0) return result('hedge', '현물 매수 · 선물 매도 엇갈림', ['현물 보유에 대한 선물 헤지 가능성', '차익거래 또는 서로 다른 투자 전략의 혼재 가능성'], 'wait', ['현물 매수 지속 여부', '미결제약정·베이시스 추가 확인', '비차익과 차익 거래 구분'])
  return result('mixed', '수급 방향 혼재 · 추가 관측 필요', ['순매수·순매도 부호만으로 뚜렷한 방향을 판단하기 어렵습니다.'], 'neutral', ['현물·선물 방향 일치 여부', '외국인 비차익 방향 전환', '지수 반응 확인'])
}

export interface FlowReview {
  horizon: number
  state: 'pending' | 'missing' | 'closed' | 'observed'
  returnPct: number | null
  matched: boolean | null
  outcomeAt: string | null
}
export function reviewFlow(sample: FlowSample, analysis: FlowAnalysis, history: FlowSample[], horizon: number, now = new Date()): FlowReview {
  const target = Date.parse(sample.observedAt) + horizon * 60_000
  const result: FlowReview = { horizon, state: 'pending', returnPct: null, matched: null, outcomeAt: null }
  if (koreanClock(new Date(target)).minute > 930 || koreanClock(new Date(target)).date !== sample.date) return { ...result, state: 'closed' }
  if (now.getTime() < target) return result
  const next = history.filter(s => s.date === sample.date && Date.parse(s.observedAt) >= target && Date.parse(s.observedAt) <= Math.min(target + 90_000, now.getTime()) && s.values.kospi !== null && s.sources.kospi.status === 'ok').sort((a,b) => a.observedAt.localeCompare(b.observedAt))[0]
  if (!next || !sample.values.kospi || sample.sources.kospi.status !== 'ok') return { ...result, state: now.getTime() < target + 90_000 ? 'pending' : 'missing' }
  const returnPct = (next.values.kospi! / sample.values.kospi - 1) * 100
  const matched = analysis.direction === 'up' ? returnPct > 0 : analysis.direction === 'down' ? returnPct < 0 : null
  return { horizon, state: 'observed', returnPct, matched, outcomeAt: next.observedAt }
}
