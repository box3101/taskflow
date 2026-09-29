import { expect,it } from 'vitest'
import { buildDayContext } from './flowDayContext'
import type { RecordedFlow } from './flowCollector'
const row=(minute:number,date='2026-09-29'):RecordedFlow=>({version:1,moneyUnits:{cash:'raw',nonArb:'raw'},analyses:{},sample:{date,observedAt:new Date(Date.UTC(2026,8,29,0,minute)).toISOString(),values:{cash:minute,futures:minute,nonArb:null,totalNonArb:minute,kospi:6000+minute,kospiPct:0},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:k==='nonArb'?'missing':'ok',fetchedAt:'',sourceAt:null,message:null}])) as any}})
it('uses only the same date through the selected cutoff, including its anchor',()=>{
 const context=buildDayContext(row(30),[row(0),row(15),row(60),row(5,'2026-09-28')])
 expect(context.observations).toBe(3)
 expect(context.points.map(p=>p.values.cash)).toEqual([0,15,30])
 expect(context.observedIndexRange).toEqual({low:6000,high:6030})
 expect(context.points[0].values.nonArb).toBeNull()
 expect(context.points[0].moneyUnits.cash).toBe('raw')
})
it('compresses long days while retaining recent detail and real gaps',()=>{
 const rows=Array.from({length:391},(_,i)=>row(i)).filter(r=>r.sample.values.cash!==200)
 const context=buildDayContext(row(390),rows)
 expect(context.points.length).toBeLessThan(50)
 expect(context.points.filter(p=>Date.parse(p.at)>=Date.parse(row(375).sample.observedAt))).toHaveLength(16)
 expect(context.gaps).toHaveLength(1)
 expect(context.observations).toBe(390)
})
