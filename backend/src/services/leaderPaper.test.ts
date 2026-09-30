import {describe,it,expect} from 'vitest'
import {tickLeaderPaper,replayLeaderPaper,paperSummary,PaperState} from './leaderPaper'
import {Quote} from './spikeCloudRules'
const at=(t:string)=>Date.parse('2026-09-30T'+t+'+09:00')
const pool={A:{name:'A',themes:['theme']},B:{name:'B',themes:['theme']},C:{name:'C',themes:['theme']}}
const quotes=(t:number,price=100):Record<string,Quote>=>Object.fromEntries(Object.keys(pool).map((c,i)=>[c,{price:c==='A'?price:100,high:110,low:80,dayPct:5-i,value:300-i*100,sourceAt:t,receivedAt:t,halted:false}]))
const start=at('09:30:00')
function enter(){let s=tickLeaderPaper(undefined,pool,quotes(start),[],start);return tickLeaderPaper(s,pool,quotes(start+10000,101),[],start+10000)}
describe('session paper trading',()=>{
 it('enters the next new quote, once per stock, never at the signal price',()=>{
  const s=tickLeaderPaper(undefined,pool,quotes(start),[],start);expect(s.trades).toHaveLength(0)
  const next=tickLeaderPaper(s,pool,quotes(start+10000,101),[],start+10000);expect(next.trades[0].entry).toBe(101)
  expect(tickLeaderPaper(next,pool,quotes(start+20000),[],start+20000).trades).toHaveLength(1)
 })
 it('does not fill on a repeated source timestamp',()=>{
  const s=tickLeaderPaper(undefined,pool,quotes(start),[],start),q=quotes(start)
  Object.values(q).forEach(x=>x.receivedAt=start+10000)
  expect(tickLeaderPaper(s,pool,q,[],start+10000).trades).toHaveLength(0)
 })
 it('cancels pending when the candidate loses leadership',()=>{
  const s=tickLeaderPaper(undefined,pool,quotes(start),[],start),q=quotes(start+10000);q.B.value=999
  expect(tickLeaderPaper(s,pool,q,[],start+10000).trades).toHaveLength(0)
 })
 it('uses an observed overshoot stop price and deducts cost',()=>{
  const s=tickLeaderPaper(enter(),pool,quotes(start+20000,96),[],start+20000)
  expect(s.trades[0].exit).toBe(96);expect(s.trades[0].netPct).toBeCloseTo((96/101-1)*100-.21)
 })
 it('excludes interrupted collection and keeps unrealized trades out of win rate',()=>{
  const holding=enter();expect(paperSummary(holding,start+20000).completed).toBe(0)
  const s=tickLeaderPaper(holding,pool,quotes(start+60000,105),[],start+60000)
  expect(s.trades[0].invalid).toBe(true);expect(paperSummary(s,start+60000).mean).toBeNull()
 })
 it('excludes a missing stock quote while the collector continues',()=>{
  const s=enter()
  for(const offset of [20000,30000,40000,50000]){const q=quotes(start+offset);delete q.A;tickLeaderPaper(s,pool,q,[],start+offset)}
  expect(s.trades[0].invalid).toBe(true)
 })
 it('rejects same-day names in the previous-day lane and needs an uptick',()=>{
  const t=at('09:10:00'),prior=[{code:'A',name:'A',theme:'theme',sourceDate:'2026-09-29'}]
  let s=tickLeaderPaper(undefined,pool,quotes(t,100),prior,t);expect(s.pending).toEqual({})
  s=tickLeaderPaper(s,pool,quotes(t+10000,101),prior,t+10000);expect(s.pending.A).toBeDefined()
  s=tickLeaderPaper(s,pool,quotes(t+20000,102),prior,t+20000);expect(s.trades[0].lane).toBe('previous')
  const invalid=tickLeaderPaper(undefined,pool,quotes(t),[{...prior[0],sourceDate:'2026-09-30'}],t)
  expect(invalid.pending).toEqual({})
 })
 it('cancels early signals at 09:30 and creates a fresh same-day signal',()=>{
  const t=at('09:29:50'),prior=[{code:'A',name:'A',theme:'theme',sourceDate:'2026-09-29'}]
  let s=tickLeaderPaper(undefined,pool,quotes(t-10000,99),prior,t-10000)
  s=tickLeaderPaper(s,pool,quotes(t,100),prior,t)
  s=tickLeaderPaper(s,pool,quotes(t+10000,101),prior,t+10000)
  expect(s.trades).toHaveLength(0);expect(s.pending.A.lane).toBe('today')
 })
 it('stops new entries at 15:20',()=>{
  const t=at('15:19:50'),s=tickLeaderPaper(undefined,pool,quotes(t),[],t)
  expect(tickLeaderPaper(s,pool,quotes(t+10000),[],t+10000).trades).toHaveLength(0)
 })
 it('handles frozen auction quotes then exits on an actual closing quote',()=>{
  const s=enter();s.lastAt=at('15:20:00');s.trades[0].lastSourceAt=s.lastAt
  for(let t=at('15:20:10');t<at('15:30:00');t+=10000){const q=quotes(at('15:20:00'),102);Object.values(q).forEach(x=>x.receivedAt=t);tickLeaderPaper(s,pool,q,[],t)}
  tickLeaderPaper(s,pool,quotes(at('15:30:00'),103),[],at('15:30:00'))
  expect(s.trades[0].invalid).toBeUndefined();expect(s.trades[0].reason).toBe('장 마감 청산')
 })
 it('replays chronologically and ignores future prices',()=>{
  const snapshots=[{at:start+20000,quotes:quotes(start+20000,80)},{at:start,quotes:quotes(start)},{at:start+10000,quotes:quotes(start+10000,101)}]
  const s=replayLeaderPaper('2026-09-30',pool,[],snapshots,start+10000)!
  expect(s.trades[0].entry).toBe(101);expect(s.trades[0].exitAt).toBeUndefined()
 })
})
