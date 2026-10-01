import {beforeEach,expect,it,vi} from 'vitest'
const m=vi.hoisted(()=>({findUnique:vi.fn(),findMany:vi.fn(),create:vi.fn(),update:vi.fn(),predictions:vi.fn(),snapshots:vi.fn(),model:vi.fn()}))
vi.mock('../prisma',()=>({default:{flowExpertReview:{findUnique:m.findUnique,findMany:m.findMany,create:m.create,update:m.update},flowPrediction:{findMany:m.predictions},flowSnapshot:{findMany:m.snapshots}}}))
vi.mock('./flowModels',()=>({basicModel:()=>({configured:true,model:'fixture'}),modelJson:m.model}))
vi.mock('./flowAgent',()=>({evaluatePrediction:(p:any)=>({...p,eligible:true,judgment:{direction:'up'},review:{state:'observed',matched:true},retrospective:{inputReaction:'aligned'}})}))
import {priorReviewContext,summarizeCloseRows,canRunCloseReview,type CloseReviewPayload} from './flowCloseReview'
beforeEach(()=>{vi.resetAllMocks();vi.resetModules();vi.stubEnv('FLOW_AUTO_ENABLED','true');vi.stubEnv('FLOW_AUTO_USER_ID','41');m.findUnique.mockResolvedValue(null);m.create.mockResolvedValue({id:1});m.update.mockResolvedValue({});m.predictions.mockResolvedValue([{id:1,snapshotId:1,horizon:15,model:'fixture',version:'v1',variant:'rag'}]);m.snapshots.mockResolvedValue([]);m.model.mockResolvedValue(JSON.stringify({summary:'표본이 적어 판단 개선 여부는 알 수 없습니다.'}))})
it('runs only after 15:40 on weekdays',()=>{expect(canRunCloseReview(new Date('2026-10-01T06:39:00Z'))).toBe(false);expect(canRunCloseReview(new Date('2026-10-01T06:40:00Z'))).toBe(true);expect(canRunCloseReview(new Date('2026-10-03T06:40:00Z'))).toBe(false)})
it('does not pool versions or score held, missing, and replay rows',()=>{
 const a={eligible:true,model:'m',version:'v1',variant:'rag',horizon:15,judgment:{direction:'up'},review:{state:'observed',matched:true},retrospective:{inputReaction:'conflict'}}
 const g=summarizeCloseRows([a,{...a,judgment:{direction:'wait'},review:{state:'observed',matched:null}},{...a,review:{state:'missing',matched:null}},{...a,eligible:false},{...a,version:'v2',review:{state:'observed',matched:false}}])
 expect(g).toHaveLength(2);expect(g[0]).toMatchObject({count:3,scored:1,matched:1,held:1,missing:1});expect(g[1]).toMatchObject({scored:1,matched:0})
})
it('blocks same-day, future, and unfinished summaries from replay input',()=>{
 const p:CloseReviewPayload={status:'completed',date:'2026-09-30',version:'v1',generatedAt:'2026-09-30T06:41:00Z',metrics:[],summary:'참고',limitations:[]}
 expect(priorReviewContext(p,'2026-10-01','2026-10-01T00:15:00Z')).toMatchObject({calendarDaysBefore:1})
 expect(priorReviewContext(p,'2026-09-30','2026-09-30T07:00:00Z')).toBeNull()
 expect(priorReviewContext({...p,generatedAt:'2026-10-01T01:00:00Z'},'2026-10-01','2026-10-01T00:15:00Z')).toBeNull()
 expect(priorReviewContext({...p,status:'running'},'2026-10-01','2026-10-01T00:15:00Z')).toBeNull()
})
it('reserves before a single paid summary and persists counts',async()=>{
 const {runCloseReview}=await import('./flowCloseReview');await runCloseReview(new Date('2026-10-01T06:40:00Z'));await runCloseReview(new Date('2026-10-01T06:41:00Z'))
 expect(m.model).toHaveBeenCalledOnce();expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(m.model.mock.invocationCallOrder[0]);expect(m.update.mock.calls[0][0].data.payload).toMatchObject({status:'completed',metrics:[{horizon:15,scored:1},{horizon:30,scored:1}]})
})
it('does not retry after a failed call or a persisted reservation on restart',async()=>{
 m.model.mockRejectedValue(new Error('timeout'));let {runCloseReview}=await import('./flowCloseReview');await runCloseReview(new Date('2026-10-01T06:40:00Z'));expect(m.update.mock.calls[0][0].data.payload.status).toBe('failed');vi.resetModules();m.findUnique.mockResolvedValue({id:1,payload:{status:'failed'}});({runCloseReview}=await import('./flowCloseReview'));await runCloseReview(new Date('2026-10-01T06:45:00Z'));expect(m.model).toHaveBeenCalledOnce()
})
it('does not call the model without scored predictions',async()=>{m.predictions.mockResolvedValue([]);const {runCloseReview}=await import('./flowCloseReview');await runCloseReview(new Date('2026-10-01T06:40:00Z'));expect(m.model).not.toHaveBeenCalled();expect(m.create.mock.calls[0][0].data.payload.status).toBe('skipped')})

it('loads only the same owner prior-date completed-before-cutoff summary',async()=>{const p={status:'completed',date:'2026-09-30',version:'v1',generatedAt:'2026-09-30T06:41:00Z',metrics:[],summary:'참고',limitations:[]};m.findMany.mockResolvedValue([{payload:{...p,generatedAt:'2026-10-01T01:00:00Z'}},{payload:p}]);const {attachPriorReview}=await import('./flowCloseReview');const record:any={sample:{date:'2026-10-01',observedAt:'2026-10-01T00:15:00Z'}};await attachPriorReview(record,41);expect(m.findMany.mock.calls[0][0].where).toMatchObject({userId:41,date:{lt:'2026-10-01'},createdAt:{lte:new Date(record.sample.observedAt)}});expect(record.priorAiReview).toMatchObject({summary:'참고',generatedAt:p.generatedAt})})
