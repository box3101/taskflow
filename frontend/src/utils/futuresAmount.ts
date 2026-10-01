import type { FlowRecord } from '../types/marketFlow'
type Investor = 'frgn' | 'orgn' | 'prsn'
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const signed=(v:number)=> (v>0?'+':'')+v.toLocaleString('ko-KR',{maximumFractionDigits:1})
export function futuresAmountText(value:number|null|undefined,row:FlowRecord,records:FlowRecord[],minutes:number,investor:Investor='frgn',cumulative=false) {
 const contracts=finite(value)?signed(value)+'계약':'—'
 const activity=row.sample.marketActivity?.futures
 const unit=activity?.amountUnit
 const baseline=row.analyses[String(minutes)]?.baselineAt
 const base=records.find(r=>r.sample.observedAt===baseline&&r.sample.date===row.sample.date)
 const net=(r:FlowRecord)=>{const p=r.sample.marketActivity?.futures?.participants[investor];return finite(p?.buyAmount)&&finite(p?.sellAmount)?p.buyAmount-p.sellAmount:null}
 const current=net(row),previous=base?net(base):null
 const interval=base?records.filter(r=>r.sample.date===row.sample.date&&r.sample.observedAt>=base.sample.observedAt&&r.sample.observedAt<=row.sample.observedAt).sort((a,b)=>a.sample.observedAt.localeCompare(b.sample.observedAt)):[]
 const valid=cumulative||Boolean(base&&interval.length>=2&&interval.every((r,i)=>r.sample.marketActivity?.futures?.amountUnit===unit&&finite(net(r))&&(i===0||Date.parse(r.sample.observedAt)-Date.parse(interval[i-1]!.sample.observedAt)<=180000)))
 if(unit&&unit!=='raw'&&finite(current)&&valid&&(cumulative||finite(previous))){
  const delta=cumulative?current:current-previous!
  const eok=delta/(unit==='won'?100000000:unit==='million'?100:1)
  return {text:signed(eok)+'억 ('+contracts+')',value:eok,kind:'actual' as const}
 }
 const index=row.sample.values.kospi200
 if(finite(value)&&finite(index)&&index>0&&row.sample.sources.kospi200?.status==='ok'){
  const eok=value*index*250000/100000000
  return {text:'약 '+signed(eok)+'억 ('+contracts+')',value:eok,kind:'estimated' as const}
 }
 return {text:finite(value)?contracts+' · 환산 불가':'—',value:finite(value)?value:null,kind:'unavailable' as const}
}
