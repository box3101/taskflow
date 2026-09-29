import { describe,it,expect } from 'vitest'
import { parseQuotes,rankLeader,signalsForTick,Quote } from './spikeCloudRules'
const at=Date.parse('2026-09-30T09:05:00+09:00')
const pool={a:{name:'A',themes:['t']},b:{name:'B',themes:['t']}}
const q=(price=100,value=200):Quote=>({price,high:110,low:90,dayPct:1,value,sourceAt:at-1000,receivedAt:at,halted:false})
describe('cloud spike point-in-time rules',()=>{
 it('ranks full peers, requires complete fresh data',()=>{
  expect(rankLeader(pool,{a:q(),b:q(100,100)},'a','t',at).status).toBe('pass')
  expect(rankLeader(pool,{a:q(),b:q(100,300)},'a','t',at).status).toBe('excluded')
  expect(rankLeader(pool,{a:q()},'a','t',at).status).toBe('unknown')
  expect(rankLeader(pool,{a:q(),b:{...q(),sourceAt:at-91000}},'a','t',at).status).toBe('unknown')
  expect(rankLeader(pool,{a:q(),b:{...q(),sourceAt:at+4000}},'a','t',at).status).toBe('unknown')
 })
 it('parses raw won instead of formatted turnover',()=>{
  const data={datas:[{itemCode:'a',closePrice:'100',fluctuationsRatio:'1',localTradedAt:new Date(at).toISOString(),integratedPriceInfo:{highPrice:'110',lowPrice:'90',accumulatedTradingValue:'2조',accumulatedTradingValueRaw:'2000000000000'}}]}
  expect(parseQuotes(data,at).a.value).toBe(2000000000000)
 })
 it('detects a spike once and persists cooldown through state reuse',()=>{
  const state={pool,chg20:{a:25,b:5},history:{a:[[at-10000,98]]},lastAlert:{}}
  const first=signalsForTick(state,{a:q(),b:q()},at)
  expect(first).toHaveLength(1);expect(first[0].label).toBe('추세주 점화')
  expect(first[0].leader.rank).toBe(1)
  expect(signalsForTick(state,{a:q(),b:q()},at+1000)).toHaveLength(0)
 })
 it('does not bridge a stalled collection loop',()=>{
  expect(signalsForTick({pool,chg20:{},history:{a:[[at-40000,90]]},lastAlert:{}},{a:q(),b:q()},at)).toHaveLength(0)
 })
})
