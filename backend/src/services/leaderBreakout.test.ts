import {describe,it,expect} from 'vitest'
import {tickLeaderBreakout,breakoutSummary} from './leaderBreakout'
import type {Quote,Pool} from './spikeCloudRules'
const at=(s:string)=>Date.parse('2026-09-30T'+s+'+09:00')
const pool:Pool={A:{name:'A',themes:['one']},B:{name:'B',themes:['one']},C:{name:'C',themes:['one']}}
const quotes=(t:number,price=100,high=100):Record<string,Quote>=>Object.fromEntries(Object.keys(pool).map((c,i)=>[c,{price:c==='A'?price:90,high:c==='A'?high:100,low:80,dayPct:5-i,value:300-i*100,sourceAt:t,receivedAt:t,halted:false}]))
const start=at('09:30:00')
function signal(){let s=tickLeaderBreakout(undefined,pool,quotes(start),start);return tickLeaderBreakout(s,pool,quotes(start+10000,101,101),start+10000)}
function enter(){return tickLeaderBreakout(signal(),pool,quotes(start+20000,102,102),start+20000)}
describe('public principles breakout proxy',()=>{
 it('requires a breakout after 09:30 then a next fresh quote; not a scheduled buy',()=>{
  let s=tickLeaderBreakout(undefined,pool,quotes(start-20000),start-20000)
  s=tickLeaderBreakout(s,pool,quotes(start-10000,101,101),start-10000)
  expect(Object.keys(s.pending)).toHaveLength(0)
  s=tickLeaderBreakout(s,pool,quotes(start,101,101),start);expect(s.trades).toHaveLength(0)
  const sign=signal();expect(sign.trades).toHaveLength(0);expect(sign.pending.A).toBeDefined()
  expect(enter().trades[0].entry).toBe(102)
 })
 it('rejects repeated source, failed breakout and lost leadership',()=>{
  const q=quotes(start+10000,101,101);Object.values(q).forEach(x=>x.receivedAt=start+20000)
  expect(tickLeaderBreakout(signal(),pool,q,start+20000).trades).toHaveLength(0)
  expect(tickLeaderBreakout(signal(),pool,quotes(start+20000,100,101),start+20000).trades).toHaveLength(0)
  const lost=quotes(start+20000,102,102);lost.B.value=999
  expect(tickLeaderBreakout(signal(),pool,lost,start+20000).trades).toHaveLength(0)
 })
 it('requires above theme median, unique turnover leader and complete themes',()=>{
  for(const mutate of [(q:Record<string,Quote>)=>{q.A.dayPct=1},(q:Record<string,Quote>)=>{q.B.value=q.A.value},(q:Record<string,Quote>)=>{delete q.C}]){
   let s=tickLeaderBreakout(undefined,pool,quotes(start),start);const q=quotes(start+10000,101,101);mutate(q)
   s=tickLeaderBreakout(s,pool,q,start+10000);expect(Object.keys(s.pending)).toHaveLength(0)
  }
 })
 it('uses observed stop overshoot with costs and prevents repeat entry',()=>{
  let s=tickLeaderBreakout(enter(),pool,quotes(start+30000,97,102),start+30000)
  expect(s.trades[0].netPct).toBeCloseTo((97/102-1)*100-.21)
  s=tickLeaderBreakout(s,pool,quotes(start+40000,103,103),start+40000)
  s=tickLeaderBreakout(s,pool,quotes(start+50000,104,104),start+50000);expect(s.trades).toHaveLength(1)
 })
 it('limits to three daily entries even when all are closed',()=>{
  const s=signal();s.trades=[0,1,2].map(i=>({...enter().trades[0],code:'done'+i,status:'closed' as const}))
  expect(tickLeaderBreakout(s,pool,quotes(start+20000,102,102),start+20000).trades).toHaveLength(3)
 })
 it('excludes gaps and reports interrupted holdings as excluded',()=>{
  const s=enter();expect(breakoutSummary(s,start+120000).excluded).toBe(1)
  tickLeaderBreakout(s,pool,quotes(start+60000,103,103),start+60000)
  expect(s.trades[0].status).toBe('excluded');expect(breakoutSummary(s,start+60000).mean).toBeNull()
 })
 it('waits across closing auction and exits on actual closing quote',()=>{
  const s=enter();s.lastAt=at('15:20:00');s.trades[0].lastAt=s.lastAt
  for(let t=at('15:20:10');t<at('15:30:00');t+=10000){const q=quotes(at('15:20:00'),102,102);Object.values(q).forEach(x=>x.receivedAt=t);tickLeaderBreakout(s,pool,q,t)}
  tickLeaderBreakout(s,pool,quotes(at('15:30:00'),103,103),at('15:30:00'))
  expect(s.trades[0].status).toBe('closed');expect(s.trades[0].exit).toBe(103)
 })
 it('stops pending entries at 15:20 and isolates a new day',()=>{
  const s=signal();s.lastAt=at('15:19:50');s.pending.A.at=s.lastAt;s.pending.A.sourceAt=s.lastAt
  expect(tickLeaderBreakout(s,pool,quotes(at('15:20:00'),102,102),at('15:20:00')).trades).toHaveLength(0)
  const next=start+86400000;expect(tickLeaderBreakout(enter(),pool,quotes(next),next).trades).toHaveLength(0)
 })
})
