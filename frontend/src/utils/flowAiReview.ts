import type { FlowAnalysis, FlowReview, FlowRecord } from '../types/marketFlow'
export interface FlowAiPrediction {
 evaluationKind?:'continuation';
 id:number; horizon:number; variant:string; mode:string; eligible:boolean; generatedAt:string; evaluationAt:string|null
 record:{sample:{observedAt:string}}; judgment:{direction:FlowAnalysis['direction'];summary:string}; review:FlowReview
}
export const aiLabels={up:'상승',down:'하락',neutral:'중립',wait:'판단 보류'}
// Exact observation matching: never borrow another minute's judgment or use a replay as live evidence.
export function selectFlowAi(rows:FlowAiPrediction[], observedAt:string, horizon=15) {
 return rows.filter(r=>r.record.sample.observedAt===observedAt&&r.horizon===horizon&&r.mode==='live')
  .sort((a,b)=>Number(b.variant==='rag')-Number(a.variant==='rag')||a.generatedAt.localeCompare(b.generatedAt)||a.id-b.id)[0]
}
export function flowAiTitle(row?:FlowAiPrediction) { return row ? aiLabels[row.judgment.direction]+' · '+row.judgment.summary : 'AI 미실행' }
export function flowAiOutcome(row:FlowAiPrediction) {
 if(!row.eligible)return '실시간 성적 제외'
 if(['wait','neutral'].includes(row.judgment.direction))return aiLabels[row.judgment.direction]+' · 채점 제외'
 if(row.review.state!=='observed')return {pending:'결과 관측 대기',missing:'결과 데이터 없음',closed:'장 종료 이후'}[row.review.state]
 return row.review.matched===null?'채점 제외':row.review.matched?'AI 방향 일치':'AI 방향 불일치'
}
export function flowAiStats(rows:FlowAiPrediction[]) {
 const live=rows.filter(r=>r.eligible)
 const scored=live.filter(r=>['up','down'].includes(r.judgment.direction)&&r.review.state==='observed'&&r.review.matched!==null)
 return {count:scored.length,matched:scored.filter(r=>r.review.matched).length,held:live.filter(r=>['wait','neutral'].includes(r.judgment.direction)).length}
}

// Reuse the original post-response price anchor; this is a duration check, not a new prediction.
export function flowAiContinuation(row:FlowAiPrediction|undefined, records:FlowRecord[], now=Date.now()):FlowAiPrediction|undefined {
 if(!row||row.mode!=='live')return undefined
 const review:FlowReview={horizon:30,state:'pending',returnPct:null,matched:null,outcomeAt:null}
 const result={...row,horizon:30,evaluationKind:'continuation' as const,review}
 if(!row.evaluationAt){review.state=now<Date.parse(row.generatedAt)+90000?'pending':'missing';return result}
 const anchor=records.find(r=>r.sample.observedAt===row.evaluationAt)?.sample
 if(!anchor||!anchor.values.kospi||anchor.sources.kospi.status!=='ok'){review.state='missing';return result}
 const target=Date.parse(anchor.observedAt)+30*60000
 const k=new Date(target+9*3600000)
 if(k.toISOString().slice(0,10)!==anchor.date||k.getUTCHours()*60+k.getUTCMinutes()>930){review.state='closed';return result}
 if(now<target)return result
 const next=records.map(r=>r.sample).filter(s=>s.date===anchor.date&&Date.parse(s.observedAt)>=target&&Date.parse(s.observedAt)<=Math.min(now,target+90000)&&s.sources.kospi.status==='ok'&&s.values.kospi!==null&&Number.isFinite(s.values.kospi)).sort((a,b)=>a.observedAt.localeCompare(b.observedAt))[0]
 if(!next){review.state=now<target+90000?'pending':'missing';return result}
 review.state='observed';review.outcomeAt=next.observedAt
 review.returnPct=(next.values.kospi!/anchor.values.kospi-1)*100
 review.matched=row.eligible?(row.judgment.direction==='up'?review.returnPct>0:row.judgment.direction==='down'?review.returnPct<0:null):null
 return result
}
