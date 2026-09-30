import { describe,it,expect } from 'vitest'
import { leaderPhase,leaderSessionDashboard } from './leaderSession'
const at=(date:string,time:string)=>Date.parse(date+'T'+time+'+09:00')
const pool={A:{name:'A',themes:['theme']},B:{name:'B',themes:['theme']},C:{name:'C',themes:['theme']}}
function day(date:string,time='15:30:00',values=[30,20,10]) {
 const t=at(date,time)
 return {date,payload:{strategyPool:pool,lastAt:t,leaderHistory:{},leaderQuotes:Object.fromEntries(Object.keys(pool).map((code,i)=>[code,{price:100,high:105,low:90,dayPct:5-i,value:values[i],sourceAt:t,receivedAt:t,halted:false}]))}}
}
describe('leader session observation',()=>{
 it('uses KST boundaries at 09:00, 09:30 and 15:30',()=>{
  expect(['08:59:59','09:00:00','09:29:59','09:30:00','15:29:59','15:30:00'].map(t=>leaderPhase(at('2026-09-30',t)))).toEqual(['prepare','previous','previous','today','today','closed'])
 })
 it('uses only previous dates for the early lane and never same-day final leaders',()=>{
  const d=day('2026-09-30','09:20:00',[10,20,30]);const before=day('2026-09-29');const future=day('2026-10-01')
  const s=leaderSessionDashboard([future,d,before],at(d.date,'09:20:00')).sessions.at(-1)!
  expect(s.previous.map(c=>c.code)).toEqual(['A']);expect(s.current).toEqual([]);expect(s.automaticEntries).toBe(false)
 })
 it('shows current candidates after 09:30, with no old ratio threshold',()=>{
  const d=day('2026-09-30','09:30:00',[10,20,30]);const s=leaderSessionDashboard([d],at(d.date,'09:30:00')).sessions.at(-1)!
  expect(s.current.map(c=>c.code)).toEqual(['C']);expect(s.current[0].turnoverRatio).toBeNull()
 })
 it('does not replace incomplete preceding dates with older closing records',()=>{
  const s=leaderSessionDashboard([day('2026-09-25'),day('2026-09-28','14:00:00'),day('2026-09-29')],at('2026-09-30','08:55:00')).sessions.at(-1)!
  expect(s.previousDates).toEqual(['2026-09-29']);expect(s.missingPreviousDays).toBe(1)
 })
 it('accepts same-day closing quotes even if last collection was two minutes later',()=>{
  const d=day('2026-09-29');d.payload.lastAt+=120000
  expect(leaderSessionDashboard([d],at('2026-09-30','09:05:00')).sessions.at(-1)!.previous).toHaveLength(1)
 })
 it('rejects incomplete peers and marks stale saved data',()=>{
  const d=day('2026-09-30','10:00:00');delete (d.payload.leaderQuotes as any).B
  const s=leaderSessionDashboard([d],at(d.date,'10:05:00')).sessions.at(-1)!
  expect(s.current).toEqual([]);expect(s.stale).toBe(true)
 })
})
