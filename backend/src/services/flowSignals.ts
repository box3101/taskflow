import type {RecordedFlow} from './flowCollector'
import {analyzeFlow,koreanClock} from './flowAnalysis'
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
const metrics=['cash','futures','nonArb'] as const
const median=(a:number[])=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null}
const percentile=(v:number,a:number[])=>100*(a.filter(x=>x<v).length+a.filter(x=>x===v).length/2)/a.length
const unit=(r:RecordedFlow,k:typeof metrics[number])=>k==='futures'?'contracts':k==='cash'?r.moneyUnits.cash:r.moneyUnits.nonArb
export function buildFlowSignals(record:RecordedFlow,history:RecordedFlow[]){
 const current=record.sample,cutoff=Date.parse(current.observedAt),minute=koreanClock(new Date(cutoff)).minute
 const past=history.filter(r=>r.sample.date<current.date&&Date.parse(r.sample.observedAt)<cutoff&&Date.parse(r.sample.observedAt)>=cutoff-60*86400000)
 const same=[...new Map([...history,record].filter(r=>r.sample.date===current.date&&Date.parse(r.sample.observedAt)<=cutoff).map(r=>[r.sample.observedAt,r])).values()]
 const windows=[5,15,30].map(minutes=>{
  const a=analyzeFlow(current,same.map(r=>r.sample),minutes)
  const interval=same.filter(r=>a.baselineAt&&r.sample.observedAt>=a.baselineAt)
  for(const k of ['cash','nonArb'] as const)if(interval.some(r=>unit(r,k)!==unit(record,k)))a.delta[k]=null
  const c=a.delta.cash,price=a.delta.kospiPct
  const reaction=!finite(c)||!finite(price)?'missing':c<0&&price>0?'selling-price-up':c>0&&price<0?'buying-price-down':c>0&&price>0?'buying-price-up':c<0&&price<0?'selling-price-down':'flat-or-mixed'
  return {minutes,baselineAt:a.baselineAt,cash:c,futures:a.delta.futures,nonArb:a.delta.nonArb,kospiPoints:a.delta.kospi,kospiPct:price,reaction}
 })
 const dates=[...new Set(past.map(r=>r.sample.date))].sort().reverse().slice(0,20)
 const fifteen=windows.find(w=>w.minutes===15)!
 const strength=metrics.map(key=>{
  const value=fifteen[key],samples:{date:string;value:number}[]=[]
  for(const date of dates){
   const target=Date.parse(date+'T'+new Date(cutoff+9*3600000).toISOString().slice(11,23)+'+09:00')
   const r=past.filter(r=>r.sample.date===date&&Date.parse(r.sample.observedAt)<=target&&Date.parse(r.sample.observedAt)>=target-90000&&unit(r,key)===unit(record,key)&&koreanClock(new Date(r.sample.observedAt)).date===date).sort((a,b)=>b.sample.observedAt.localeCompare(a.sample.observedAt))[0]
   const analysis=r?.analyses['15'],delta=analysis?.delta[key]
   if(r&&r.sample.sources[key].status==='ok'&&finite(delta)&&analysis.baselineAt){
    const span=Date.parse(r.sample.observedAt)-Date.parse(analysis.baselineAt)
    if(span>=895000&&span<=990000&&koreanClock(new Date(analysis.baselineAt)).date===date)samples.push({date,value:delta})
   }
  }
  const ready=finite(value)&&!!fifteen.baselineAt&&samples.length>=10&&minute>=555&&minute<=930
  const signedPercentile=ready?percentile(value!,samples.map(s=>s.value)):null
  const magnitudePercentile=ready?percentile(Math.abs(value!),samples.map(s=>Math.abs(s.value))):null
  return {key,unit:unit(record,key),windowMinutes:15,value,sampleCount:samples.length,sampleDates:samples.map(s=>s.date),status:ready?'ready':'insufficient',signedPercentile,magnitudePercentile,median:ready?median(samples.map(s=>s.value)):null,
   band:signedPercentile===null?null:signedPercentile>=80?'upper':signedPercentile<=20?'lower':'middle'}
 })
 return {version:'flow-signals-v1',asOf:current.observedAt,priceReaction:windows,strength,
  limitations:['관측까지의 동시 움직임이며 인과관계·미래 방향을 증명하지 않음','높은 signedPercentile은 순매수 변화가 상대적으로 큼을 뜻하며 양수·상승 확률과 다름','magnitudePercentile은 절댓값 강도이며 매수·매도 방향은 value로 구분','최근 60일 중 최대 20기록일, 같은 시각 이전 90초 이내, 최소 10일','비차익은 현물에 포함됨 · raw 단위 임의 환산 금지']}
}
export type FlowSignals=ReturnType<typeof buildFlowSignals>
