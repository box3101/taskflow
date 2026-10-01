import { describe, expect, it } from 'vitest'
import { retrieveEvidence, type RagDocument } from './flowRag'
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
