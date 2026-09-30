import {describe,it,expect} from 'vitest'
import {buildFlowSignals} from './flowSignals'
import {analyzeFlow,FlowSample} from './flowAnalysis'
import type {RecordedFlow} from './flowCollector'
function records(date:string,negative=false):RecordedFlow[]{
 const history:FlowSample[]=[]
 return Array.from({length:46},(_,i)=>{
  const at=new Date(Date.parse(date+'T09:00:00+09:00')+i*60000).toISOString()
  const sample:FlowSample={date,observedAt:at,values:{cash:i*(negative?-100:100),futures:i*10,nonArb:i*30,totalNonArb:i*40,kospi:3000+i,kospiPct:0},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:'ok',sourceAt:null,fetchedAt:at,message:null}])) as FlowSample['sources']}
  const r:RecordedFlow={version:1,sample,analyses:{'15':analyzeFlow(sample,history,15)},moneyUnits:{cash:'raw',nonArb:'raw'}};history.push(sample);return r
 })
}
const today=records('2026-09-30',true)
const past=Array.from({length:10},(_,i)=>records('2026-09-'+String(10+i).padStart(2,'0')))
describe('point-in-time price and flow strength',()=>{
 it('measures selling with a rising index for each complete window',()=>{
  const s=buildFlowSignals(today[30],today)
  expect(s.priceReaction.map(x=>x.reaction)).toEqual(['selling-price-up','selling-price-up','selling-price-up'])
  expect(s.priceReaction[1].cash).toBe(-1500)
  expect(s.priceReaction[1].kospiPoints).toBe(15)
 })
 it('ignores later intraday samples and future dates',()=>{
  const base=buildFlowSignals(today[30],[...today.slice(0,31),...past.flat()])
  const after=records('2026-10-01');after.forEach(r=>r.sample.values.cash=999999)
  expect(buildFlowSignals(today[30],[...today,...past.flat(),...after])).toEqual(base)
 })
 it('requires 10 separate prior days and excludes the current day',()=>{
  const few=buildFlowSignals(today[30],[...today,...past.slice(0,9).flat()]).strength[0]
  expect(few.status).toBe('insufficient');expect(few.signedPercentile).toBeNull()
  const enough=buildFlowSignals(today[30],[...today,...past.flat()]).strength[0]
  expect(enough.sampleCount).toBe(10);expect(enough.status).toBe('ready')
  expect(enough.signedPercentile).toBe(0);expect(enough.magnitudePercentile).toBe(50)
 })
 it('does not compare cash values across different amount units',()=>{
  const history=past.flat().map(r=>({...r,moneyUnits:{cash:'eok' as const,nonArb:'raw' as const}}))
  const s=buildFlowSignals(today[30],[...today,...history])
  expect(s.strength[0].sampleCount).toBe(0);expect(s.strength[1].sampleCount).toBe(10)
 })
 it('does not turn missing source values or an intraday gap into zero',()=>{
  const modified=structuredClone(today);modified[30].sample.sources.cash.status='error'
  expect(buildFlowSignals(modified[30],modified).priceReaction[1].cash).toBeNull()
  expect(buildFlowSignals(today[30],[today[15],today[30]]).priceReaction[1].reaction).toBe('missing')
 })
 it('uses one observation per day and never a later same-clock sample',()=>{
  const later=past.map(rows=>rows[31])
  const s=buildFlowSignals(today[30],[...today,...later])
  expect(s.strength[0].sampleCount).toBe(0)
  const duplicated=past.flatMap(rows=>[rows[30],rows[30]])
  expect(buildFlowSignals(today[30],[...today,...duplicated]).strength[0].sampleCount).toBe(10)
 })
})
