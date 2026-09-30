import {describe,it,expect} from 'vitest'
import {flowAiContinuation,selectFlowAi,flowAiOutcome,flowAiStats,flowAiTitle,type FlowAiPrediction} from './flowAiReview'
function row(overrides:Partial<FlowAiPrediction>={}):FlowAiPrediction{return {id:1,horizon:15,variant:'rag',mode:'live',eligible:true,generatedAt:'2026-09-30T04:00:10Z',evaluationAt:'2026-09-30T04:01:02Z',record:{sample:{observedAt:'2026-09-30T04:00:02Z'}},judgment:{direction:'wait',summary:'매도에도 지수 상승'},review:{horizon:15,state:'observed',returnPct:.17,matched:null,outcomeAt:'2026-09-30T04:16:02Z'},...overrides}}
describe('AI final judgments',()=>{
 it('keeps 13:00 abstention out of accuracy despite a positive outcome',()=>{const r=row();expect(flowAiOutcome(r)).toBe('판단 보류 · 채점 제외');expect(flowAiStats([r])).toEqual({count:0,matched:0,held:1});expect(flowAiTitle(r)).toContain('판단 보류')})
 it('prefers PDF AI to the flow-only comparison arm independent of results',()=>{const a=row({variant:'flow',id:2,judgment:{direction:'down',summary:'매도'}}),b=row();expect(selectFlowAi([a,b],b.record.sample.observedAt)).toBe(b)})
 it('does not use replay, adjacent observations or a 15-minute forecast for 30 minutes',()=>{const r=row();expect(selectFlowAi([row({mode:'replay'})],r.record.sample.observedAt)).toBeUndefined();expect(selectFlowAi([r],'2026-09-30T04:01:02Z')).toBeUndefined();expect(selectFlowAi([r],r.record.sample.observedAt,30)).toBeUndefined();expect(flowAiTitle()).toBe('AI 미실행')})
 it('excludes delayed and pending predictions from accuracy',()=>{const up=row({judgment:{direction:'up',summary:'상승'},review:{...row().review,matched:true}});expect(flowAiStats([up,row({eligible:false}),row({review:{...up.review,state:'pending'}})])).toEqual({count:1,matched:1,held:1})})
})

function observed(at:string,price:number){return {sample:{date:'2026-09-30',observedAt:at,values:{kospi:price},sources:{kospi:{status:'ok'}}}} as any}
it('scores the original direction at 30 minutes using the post-response anchor',()=>{
 const r=row({judgment:{direction:'up',summary:'상승'}})
 const records=[observed(r.record.sample.observedAt,110),observed(r.evaluationAt!,100),observed('2026-09-30T04:31:02Z',102)]
 const result=flowAiContinuation(r,records,Date.parse('2026-09-30T04:32:00Z'))!
 expect(result.evaluationKind).toBe('continuation');expect(result.review.returnPct).toBeCloseTo(2);expect(result.review.matched).toBe(true)
 expect(flowAiContinuation(row({judgment:{direction:'down',summary:'하락'}}),records,Date.parse('2026-09-30T04:32:00Z'))!.review.matched).toBe(false)
 expect(flowAiContinuation(row(),records,Date.parse('2026-09-30T04:32:00Z'))!.review.matched).toBeNull()
})
it('never fills a future, missing or overnight outcome',()=>{
 const r=row();const records=[observed(r.evaluationAt!,100),observed('2026-09-30T04:31:02Z',102)]
 expect(flowAiContinuation(r,records,Date.parse('2026-09-30T04:30:00Z'))!.review.state).toBe('pending')
 expect(flowAiContinuation(r,records.slice(0,1),Date.parse('2026-09-30T04:33:00Z'))!.review.state).toBe('missing')
 const late=row({evaluationAt:'2026-09-30T06:01:02Z'})
 expect(flowAiContinuation(late,[observed(late.evaluationAt!,100)],Date.parse('2026-09-30T07:00:00Z'))!.review.state).toBe('closed')
 expect(flowAiContinuation(row({mode:'replay'}),records)).toBeUndefined()
})
