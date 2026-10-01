import { describe, expect, it } from 'vitest'
import { analyzeFlow, emptyValues, FlowSample, isCollectionTime, koreanClock, reviewFlow } from './flowAnalysis'

function sample(minute: number, overrides: Partial<FlowSample['values']> = {}): FlowSample {
  const at = new Date(Date.UTC(2026, 8, 22, 0, minute)).toISOString()
  return { date: '2026-09-22', observedAt: at, values: { cash: minute * 100, futures: minute * 20, nonArb: minute * 30, totalNonArb: minute * 50, kospi: 3000 + minute, kospiPct: 0 }, sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(key => [key, { status: 'ok', fetchedAt: at, sourceAt: null, message: null }])) as FlowSample['sources'], ...{} }
}
function make(minute: number, values: Partial<FlowSample['values']> = {}) { const s = sample(minute); s.values = { ...s.values, ...values }; return s }
const history = () => Array.from({ length: 31 }, (_, i) => make(i))

describe('flow analysis observations', () => {
  it('uses changes rather than the cumulative sign', () => {
    const rows = history().map((s, i) => ({ ...s, values: { ...s.values, cash: -10000 + i * 100, futures: -2000 + i * 20, nonArb: -5000 + i * 30 } }))
    const result = analyzeFlow(rows[15], rows.slice(0, 15), 15)
    expect(result.code).toBe('aligned-buy')
    expect(result.delta.cash).toBe(1500)
    expect(result.baselineAt).toBe(rows[0].observedAt)
  })
  it('does not invent a baseline on first visit or borrow one from yesterday', () => {
    const s = make(15)
    expect(analyzeFlow(s, [], 15).delta).toEqual(emptyValues())
    const yesterday = make(0); yesterday.date = '2026-09-21'
    expect(analyzeFlow(s, [yesterday], 15).direction).toBe('wait')
  })
  it('refuses to bridge collection gaps', () => {
    const rows = history().filter((_, i) => i < 3 || i > 10)
    expect(analyzeFlow(make(15), rows.filter(r => r.observedAt < make(15).observedAt), 15).direction).toBe('wait')
  })
  it('does not turn a missing non-arbitrage value into zero or market-wide flow', () => {
    const rows = history()
    const s = make(15, { nonArb: null, totalNonArb: 999999 })
    s.sources.nonArb.status = 'missing'
    const result = analyzeFlow(s, rows.slice(0, 15), 15)
    expect(result.code).toBe('incomplete')
    expect(result.delta.nonArb).toBeNull()
    expect(result.direction).toBe('wait')
  })
  it('requires valid observations throughout the comparison window', () => {
    const rows = history()
    rows[5].sources.cash.status = 'error'
    expect(analyzeFlow(rows[15], rows.slice(0, 15), 15).code).toBe('incomplete')
  })
  it('keeps futures-only buying ambiguous', () => {
    expect(analyzeFlow(make(15, { cash: -300 }), history().slice(0, 15), 15).code).toBe('futures-only')
    expect(analyzeFlow(make(15, { cash: -300 }), history().slice(0, 15), 15).direction).toBe('wait')
  })
  it('treats true zero change as mixed, not missing or directional', () => {
    const rows = history().map(s => ({ ...s, values: { ...s.values, cash: 0, futures: 0, nonArb: 0 } }))
    expect(analyzeFlow(rows[15], rows.slice(0, 15), 15).code).toBe('mixed')
  })
})

describe('point-in-time outcome review', () => {
  it('never reads a future outcome before its observation time', () => {
    const rows = history(), a = analyzeFlow(rows[15], rows.slice(0, 15), 15)
    expect(reviewFlow(rows[15], a, rows, 15, new Date(rows[29].observedAt)).state).toBe('pending')
    expect(reviewFlow(rows[15], a, rows, 15, new Date(rows[30].observedAt)).matched).toBe(true)
  })
  it('does not use an observation before the horizon or far after it', () => {
    const rows = history(), a = analyzeFlow(rows[15], rows.slice(0, 15), 15)
    expect(reviewFlow(rows[15], a, rows.slice(0, 30), 15, new Date(make(34).observedAt)).state).toBe('missing')
    expect(reviewFlow(rows[15], a, [make(35)], 15, new Date(make(36).observedAt)).state).toBe('missing')
  })
  it('does not score a wait hypothesis as a successful forecast', () => {
    const rows = history(), a = analyzeFlow(make(15, { cash: -300 }), rows.slice(0, 15), 15)
    const r = reviewFlow(rows[15], a, rows, 15, new Date(rows[30].observedAt))
    expect(r.state).toBe('observed'); expect(r.matched).toBeNull()
  })
  it('marks horizons after the close as unavailable', () => {
    const s = make(385), a = analyzeFlow(s, [], 15)
    expect(reviewFlow(s, a, [], 15, new Date(make(420).observedAt)).state).toBe('closed')
  })
})

describe('Korean session clock', () => {
  it('uses Seoul dates and regular session boundaries, excluding weekends', () => {
    expect(koreanClock(new Date('2026-09-21T16:00:00Z')).date).toBe('2026-09-22')
    expect(isCollectionTime(new Date('2026-09-22T00:00:00Z'))).toBe(true)
    expect(isCollectionTime(new Date('2026-09-22T06:31:00Z'))).toBe(false)
    expect(isCollectionTime(new Date('2026-09-26T00:30:00Z'))).toBe(false)
  })
})

describe('investor comparison fields',()=>{
 it('uses the same baseline for all participants and preserves real zero',()=>{
  const rows=history();for(const [i,r] of rows.entries()){
   Object.assign(r.values,{institutionCash:i*10,individualCash:-i*20,institutionFutures:i*2,individualFutures:0})
   for(const k of ['institutionCash','individualCash','institutionFutures','individualFutures'] as const)r.sources[k]={...r.sources.cash}
  }
  const result=analyzeFlow(rows[15],rows.slice(0,15),15)
  expect(result.delta).toMatchObject({institutionCash:150,individualCash:-300,institutionFutures:30,individualFutures:0})
  rows[7].sources.institutionCash!.status='missing'
  expect(analyzeFlow(rows[15],rows.slice(0,15),15).delta.institutionCash).toBeNull()
 })
 it('keeps legacy fields missing and never produces NaN',()=>{
  const rows=history(),r=analyzeFlow(rows[15],rows.slice(0,15),15)
  expect(r.delta.institutionCash).toBeNull();expect(r.delta.individualFutures).toBeNull();expect(r.code).toBe('aligned-buy')
 })
})

it('compares securities and funds on the same window without adding them to institutions',()=>{
 const rows=history();for(const [i,r] of rows.entries()){
  Object.assign(r.values,{institutionCash:i*10,securitiesCash:-i*30,fundCash:i*40})
  for(const k of ['institutionCash','securitiesCash','fundCash'] as const)r.sources[k]={...r.sources.cash}
 }
 const d=analyzeFlow(rows[15],rows.slice(0,15),15).delta
 expect(d).toMatchObject({institutionCash:150,securitiesCash:-450,fundCash:600})
 delete rows[7].values.fundCash
 expect(analyzeFlow(rows[15],rows.slice(0,15),15).delta.fundCash).toBeNull()
 expect(analyzeFlow(make(15),history().slice(0,15),15).delta.securitiesCash).toBeNull()
})
