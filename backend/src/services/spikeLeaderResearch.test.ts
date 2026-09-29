import { expect,it } from 'vitest'
import { recordLeaderQuotes,researchLeader,LeaderHistory } from './spikeLeaderResearch'
import { Quote } from './spikeCloudRules'
import pool from '../data/spike-pool.json'
import researchPool from '../data/spike-leader-pool.json'
const at=Date.parse('2026-09-30T09:10:00+09:00')
const universe=Object.fromEntries(['a','b','c','d'].map(c=>[c,{name:c,themes:['t']}]))
const quotes=(time:number)=>Object.fromEntries(['a','b','c','d'].map((c,i)=>[c,{price:100+(time-at+600000)/60000*(i+1),high:200,low:90,dayPct:1,value:10000*(4-i)+(time-at+600000)/1000*10,sourceAt:time,receivedAt:time,halted:false} as Quote]))
it('preserves universe membership and uses valid fine themes',()=>{
 expect(Object.keys(researchPool).sort()).toEqual(Object.keys(pool).sort())
 expect(Object.values(researchPool).every(p=>p.themes.length===1&&!p.themes[0].includes('?'))).toBe(true)
 expect(researchPool['005930'].themes).toEqual(['반도체 제조'])
})
it('selects top three and computes non-overlapping turnover and relative strength',()=>{
 const history:LeaderHistory={}
 for(let t=at-600000;t<=at;t+=10000)recordLeaderQuotes(history,quotes(t),t)
 const result=researchLeader(universe,quotes(at),history,'c',at)
 expect(result.status).toBe('pass');expect(result.rank).toBe(3)
 expect(result.turnover5m).toBe(3000);expect(result.turnoverRatio).toBe(1)
 expect(result.relative5m).toBeGreaterThan(0)
 expect(researchLeader(universe,quotes(at),history,'d',at).status).toBe('excluded')
 expect(researchLeader(universe,{a:quotes(at).a},history,'a',at).status).toBe('unknown')
})
it('does not fabricate metrics during warmup, gaps or counter resets',()=>{
 const history:LeaderHistory={}
 recordLeaderQuotes(history,quotes(at-600000),at-600000)
 recordLeaderQuotes(history,quotes(at),at)
 expect(researchLeader(universe,quotes(at),history,'a',at).turnover5m).toBeNull()
 for(let t=at-600000;t<=at;t+=10000)recordLeaderQuotes(history,quotes(t),t)
 const reset=quotes(at+10000);reset.a.value=1
 recordLeaderQuotes(history,reset,at+10000)
 expect(researchLeader(universe,reset,history,'a',at+10000).turnover5m).toBeNull()
})
