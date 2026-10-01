export type MoneyUnit = 'raw' | 'won' | 'million' | 'eok'
export type FlowKey = 'cash' | 'futures' | 'nonArb' | 'totalNonArb' | 'kospi'
export type InvestorFlowKey = 'securitiesCash' | 'fundCash' | 'institutionCash' | 'institutionFutures' | 'individualCash' | 'individualFutures'
export interface FlowValues {
  securitiesCash?: number | null
  fundCash?: number | null
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
  kospi200?: number | null
}
export interface FlowSample {
  // Raw, same-market cumulative activity retained for future normalization.
  marketActivity?: {
    cash?: { market: 'KSP/0001'; turnover: number | null; unit: 'raw'; fetchedAt: string; source: string }
    futures?: { market: 'K2I/F001'; amountUnit?: 'raw' | 'won' | 'million' | 'eok'; participants: Record<string, { buy: number | null; sell: number | null; buyAmount?: number | null; sellAmount?: number | null; netAmount?: number | null }>; fetchedAt: string; source: string; denominatorStatus: 'unverified' }
  }
  date: string
  observedAt: string
  values: FlowValues
  sources: Record<FlowKey, { status: 'ok' | 'error' | 'missing'; fetchedAt: string; sourceAt: string | null; message: string | null }> & Partial<Record<InvestorFlowKey | 'kospi200', { status: 'ok' | 'error' | 'missing'; fetchedAt: string; sourceAt: string | null; message: string | null }>>
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
export interface FlowReview {
  horizon: number
  state: 'pending' | 'missing' | 'closed' | 'observed'
  returnPct: number | null
  matched: boolean | null
  outcomeAt: string | null
}
export interface FlowRecord {
  priorAiReview?: {date:string;status:string;summary:string|null;generatedAt?:string;calendarDaysBefore:number;limitations:string[]} | null

  signals?: {version:string;asOf:string;priceReaction:{minutes:number;reaction:string;cash:number|null;futures:number|null;nonArb:number|null;kospiPoints:number|null;kospiPct:number|null}[];strength:{key:string;unit:string;value:number|null;status:string;sampleCount:number;signedPercentile:number|null;magnitudePercentile:number|null;band:string|null}[]}
  signalsError?: string
  id: number
  sample: FlowSample
  analyses: Record<string, FlowAnalysis>
  moneyUnits: { cash: MoneyUnit; nonArb: MoneyUnit }
  reviews: FlowReview[]
}
export interface FlowReport { id: number; date: string; filename: string; note: string; createdAt: string }
export interface FlowStatus { configured: boolean; intervalSeconds: number; session: string; lastError: string | null; storageReady: boolean; moneyUnits: { cash: MoneyUnit; nonArb: MoneyUnit } }
export interface FlowResponse {
  date: string
  serverTime: string
  status: FlowStatus
  records: FlowRecord[]
  reports: FlowReport[]
}
