import {describe,it,expect,vi} from 'vitest'
vi.mock('../prisma',()=>({default:{}}))
import {futuresABInput,isFuturesABSlot,evaluateFuturesPairs,FUTURES_AB_VERSION} from './flowFuturesAB'
import {analyzeFlow,type FlowSample} from './flowAnalysis'
const at='2026-10-01T00:30:00Z'
const sample:FlowSample={date:'2026-10-01',observedAt:at,values:{cash:10,futures:808,nonArb:2,totalNonArb:3,kospi:3000,kospiPct:0,institutionCash:4},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi','institutionCash'].map(k=>[k,{status:'ok',fetchedAt:at,sourceAt:null,message:'선물 비밀'}])) as any}
const record:any={version:1,sample,analyses:{'15':{...analyzeFlow(sample,[],15),baselineAt:'2026-10-01T00:15:00Z',delta:{cash:10,futures:808,kospi:1,institutionCash:4},title:'선물 808',hypotheses:['선물 매수']}},moneyUnits:{cash:'million',nonArb:'million'},priorAiReview:{summary:'선물 808'},dayContext:{futures:808},signals:{title:'선물 808',priceReaction:[],strength:[]}}
describe('independent futures experiment',()=>{
 it('has 13 extra calls on half-hour slots',()=>{expect(Array.from({length:26},(_,i)=>555+i*15).filter(isFuturesABSlot)).toHaveLength(13);expect(isFuturesABSlot(555)).toBe(false)})
 it('allows only numeric fields and does not leak narratives or futures into A',()=>{const a=JSON.stringify(futuresABInput(record,'A'));expect(a).not.toMatch(/futures|선물|808|priorAiReview|hypotheses/);expect(a).toContain('institutionCash');const b=futuresABInput(record,'B');expect(b.values.futures).toBe(808);const {futures,...values}=b.values;expect(values).toEqual(futuresABInput(record,'A').values)})
 it('only scores completed same-anchor live pairs, preserves abstention and 30m continuation',()=>{
  const payload={record,judgment:{direction:'wait'},evidence:[],generatedAt:'2026-10-01T00:31:00Z',comparisonId:'pair'}
  const a:any={id:1,snapshotId:7,horizon:15,variant:'cash-a',mode:'live',model:'same',version:FUTURES_AB_VERSION,payload,createdAt:new Date(at)}
  const b:any={...a,id:2,variant:'futures-b',payload:{...payload,judgment:{direction:'up'}}}
  const samples=[1,16,31].map((m,i)=>({...sample,observedAt:new Date(Date.parse(at)+m*60000).toISOString(),values:{...sample.values,kospi:3000+i}}))
  const pairs=evaluateFuturesPairs([a,b],samples,new Date('2026-10-01T01:10:00Z'))
  expect(pairs).toHaveLength(2);expect(pairs[0].A.review.matched).toBeNull();expect(pairs[0].B.review.matched).toBe(true);expect(pairs[0].A.evaluationAt).toBe(pairs[0].B.evaluationAt)
  expect(evaluateFuturesPairs([a,{...b,mode:'replay'}],samples)).toEqual([])
  expect(evaluateFuturesPairs([a,{...b,payload:{...b.payload,comparisonId:undefined}}],samples)).toEqual([])
 })
})
