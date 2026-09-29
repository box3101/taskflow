import { expect, it } from 'vitest'
import { analyzeFlow, FlowSample } from './flowAnalysis'
const make=(minute:number,ms=0):FlowSample=>({date:'2026-09-29',observedAt:new Date(Date.UTC(2026,8,29,6,minute,3,ms)).toISOString(),values:{cash:minute,futures:minute,nonArb:minute,totalNonArb:minute,kospi:6000+minute,kospiPct:0},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:'ok',fetchedAt:'',sourceAt:null,message:null}])) as FlowSample['sources']})
it('accepts the intended five-minute baseline despite 164ms completion jitter',()=>{
 const base=make(6,637),current=make(11,473)
 const result=analyzeFlow(current,[make(4,300),base,make(8),make(9),make(10)],5)
 expect(result.baselineAt).toBe(base.observedAt)
 expect(result.delta.futures).toBe(5)
})
it('preserves gap and baseline age limits',()=>{
 expect(analyzeFlow(make(11),[make(6,164)],5).delta.cash).toBeNull()
 expect(analyzeFlow(make(11),[make(6,6000),make(8),make(9),make(10)],5).baselineAt).toBeNull()
 expect(analyzeFlow(make(11),[make(4),make(8),make(9),make(10)],5).baselineAt).toBeNull()
})
