export type MoneyUnit = 'raw' | 'won' | 'million' | 'eok'
export type FlowKey = 'cash' | 'futures' | 'nonArb' | 'totalNonArb' | 'kospi'
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
export interface FlowSample {
  date: string
  observedAt: string
  values: FlowValues
  sources: Record<FlowKey, { status: 'ok' | 'error' | 'missing'; fetchedAt: string; sourceAt: string | null; message: string | null }> & Partial<Record<InvestorFlowKey, { status: 'ok' | 'error' | 'missing'; fetchedAt: string; sourceAt: string | null; message: string | null }>>
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
