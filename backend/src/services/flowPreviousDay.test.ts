import { expect,it } from 'vitest'
import { buildPreviousDayContext } from './flowPreviousDay'
import type { RecordedFlow } from './flowCollector'
function row(date:string,minute:number):RecordedFlow {
 const at=new Date(Date.parse(date+'T00:00:00+09:00')+minute*60000).toISOString()
 return {version:1,moneyUnits:{cash:'raw',nonArb:'raw'},analyses:{},sample:{date,observedAt:at,
  values:{cash:minute,futures:minute*2,nonArb:minute,totalNonArb:minute,kospi:6000+minute,kospiPct:-1},
  sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:'ok',fetchedAt:at,sourceAt:null,message:null}])) as any}}
}
const next=row('2026-09-30',555)
const session=()=>Array.from({length:31},(_,i)=>row('2026-09-29',900+i))
it('summarises the prior recorded session with observed close and non-overlapping final 30 minutes',()=>{
 const r=buildPreviousDayContext(next,[row('2026-09-28',930),...session(),next,row('2026-10-01',930)])!
 expect(r.date).toBe('2026-09-29');expect(r.observations).toBe(31)
 expect(r.finalObservedValues.cash).toBe(930);expect(r.closing30m?.delta.cash).toBe(30)
 expect(r.closing30m?.delta.futures).toBe(60);expect(r.reachedClose).toBe(true)
 expect(r.calendarDaysBefore).toBe(1)
})
it('does not claim an incomplete session is the closing 30 minutes',()=>{
 const r=buildPreviousDayContext(next,session().slice(0,20))!
 expect(r.reachedClose).toBe(false);expect(r.closing30m).toBeNull()
})
it('retains missing final fields, gaps and rejects changed money units',()=>{
 const rows=session();rows[30].sample.sources.cash.status='error'
 const r=buildPreviousDayContext(next,rows.filter((_,i)=>i<5||i>10))!
 expect(r.finalObservedValues.cash).toBeNull();expect(r.closing30m).toBeNull();expect(r.gapCount).toBe(1)
 const mixed=session();mixed[0].moneyUnits.cash='won'
 expect(buildPreviousDayContext(next,mixed)?.closing30m).toBeNull()
})
it('reports calendar age over weekends, returns null without past data, and ignores after-hours',()=>{
 const monday=row('2026-10-05',555)
 const r=buildPreviousDayContext(monday,[row('2026-10-02',930),row('2026-10-02',1000)])!
 expect(r.calendarDaysBefore).toBe(3);expect(r.observations).toBe(1)
 expect(buildPreviousDayContext(next,[next])).toBeNull()
})
