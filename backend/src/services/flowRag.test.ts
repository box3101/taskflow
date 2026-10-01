import { describe, expect, it } from 'vitest'
import { retrieveEvidence, retrieveHistoricalEvidence, historicalPolicy, type RagDocument } from './flowRag'
const date='2026-10-01', cutoff=new Date('2026-10-01T01:00:00Z')
const doc=(id:number,date:string,createdAt='2026-10-01T00:00:00Z'):RagDocument=>({id,date,createdAt:new Date(createdAt),filename:id+'.pdf',ragChunks:[{page:1,text:'코스피 외국인 현물 선물 수급'}]})
describe('same-day PDF evidence',()=>{
 it('excludes older, future and late-uploaded reports even when their text matches',()=>{
  const result=retrieveEvidence([doc(1,'2026-09-29'),doc(2,date),doc(3,date,'2026-10-01T01:00:01Z'),doc(4,'2026-10-02')],'코스피 외국인',date,cutoff)
  expect(result.map(e=>e.reportId)).toEqual([2])
 })
 it('does not fall back to an older report when today has none',()=>{
  expect(retrieveEvidence([doc(1,'2026-09-29')],'코스피',date,cutoff)).toEqual([])
 })
 it('uses the selected historical date rather than the execution date',()=>{
  expect(retrieveEvidence([doc(1,'2026-09-29','2026-09-29T00:00:00Z')],'코스피','2026-09-29',new Date('2026-09-29T01:00:00Z')).map(e=>e.reportId)).toEqual([1])
 })
})

describe('historical case references',()=>{
 const past=(id:number,d='2026-09-29',at='2026-09-29T00:00:00Z')=>({...doc(id,d,at),ragChunks:[{page:2,text:'외국인 매도가 반도체 종목에 집중됐던 사례다. 외국인 판별 순서는 현물과 비차익을 교차 확인한다. 외국인 누적 1000억원 이상이면 매수한다. 내일 고용보고서 발표 예정이다.'}]})
 it('keeps past qualitative references, omits thresholds and schedules, caps at two',()=>{
 const found=retrieveHistoricalEvidence([past(1),past(2),past(3),past(4,date),past(5,'2026-10-02'),past(6,'2026-09-29','2026-10-01T02:00:00Z')],'외국인',date,cutoff)
 expect(found).toHaveLength(2)
 for(const e of found){expect(e.date<date).toBe(true);expect(e.usage).toBe('historical-reference');expect(e.text).toContain('사례');expect(e.text).not.toMatch(/1000|고용보고서/)}
 expect(historicalPolicy(found)).toMatchObject({version:'historical-v1-on',enabled:true,count:2})
 expect(historicalPolicy([],false)).toMatchObject({version:'historical-v1-off',enabled:false,count:0})
 })
 it('does not leak later reports into historical replay',()=>{
 expect(retrieveHistoricalEvidence([past(1,'2026-09-29')],'외국인','2026-09-28',new Date('2026-09-28T03:00:00Z'))).toEqual([])
 })
})
