import prisma from '../prisma'
import { koreanClock } from './flowAnalysis'
import { basicModel, modelJson } from './flowModels'
import type { RecordedFlow } from './flowCollector'
export const CLOSE_REVIEW_VERSION='close-review-v1'
export const CLOSE_REVIEW_TASK='auto-recap'
export interface ReviewMetric {key:string;model:string;version:string;variant:string;horizon:number;reaction:string;timeBand:string;count:number;scored:number;matched:number;held:number;missing:number;pending:number;closed:number}
export interface CloseReviewPayload {status:'running'|'completed'|'failed'|'skipped';date:string;version:string;generatedAt?:string;metrics:ReviewMetric[];summary:string|null;limitations:string[]}
export const reviewLimitations=['하루 표본은 작고 15·30분 결과가 겹치므로 독립 검증이나 매매 승률이 아님','실패 원인은 입증되지 않음. 관측된 연관성만 참고','모델·규칙·PDF 구성별 성적을 섞지 않음','오늘 가격·수급을 우선하며 과거 성적만으로 방향·임계값을 바꾸지 않음']
export function canRunCloseReview(now:Date){const k=koreanClock(now);return k.day>0&&k.day<6&&k.minute>=940}
export function summarizeCloseRows(rows:{eligible:boolean;model:string;version:string;variant:string;horizon:number;judgment:{direction:string};review:{state:string;matched:boolean|null};record?:{sample:{observedAt:string}};retrospective?:{inputReaction:string|null}}[]):ReviewMetric[]{
 const groups=new Map<string,ReviewMetric>()
 for(const r of rows){if(!r.eligible)continue;const reaction=r.retrospective?.inputReaction||'unrecorded';const minute=r.record?koreanClock(new Date(r.record.sample.observedAt)).minute:null;const timeBand=minute===null?'unknown':minute<600?'09:00–10:00':minute<720?'10:00–12:00':minute<840?'12:00–14:00':'14:00–15:30';const key=[r.model,r.version,r.variant,r.horizon,reaction,timeBand].join('|');let g=groups.get(key)
 if(!g){g={key,model:r.model,version:r.version,variant:r.variant,horizon:r.horizon,reaction,timeBand,count:0,scored:0,matched:0,held:0,missing:0,pending:0,closed:0};groups.set(key,g)}
 g.count++;if(['wait','neutral'].includes(r.judgment.direction))g.held++
 if(r.review.state==='observed'&&['up','down'].includes(r.judgment.direction)&&r.review.matched!==null){g.scored++;if(r.review.matched)g.matched++}
 if(r.review.state==='missing')g.missing++;if(r.review.state==='pending')g.pending++;if(r.review.state==='closed')g.closed++
 }
 return [...groups.values()]
}
const schema={type:'object',additionalProperties:false,properties:{summary:{type:'string'}},required:['summary']}
let running=false,finishedDate=''
export async function runCloseReview(now=new Date()){
 const userId=Number(process.env.FLOW_AUTO_USER_ID),config=basicModel(),date=koreanClock(now).date
 if(running||finishedDate===date||process.env.FLOW_AUTO_ENABLED!=='true'||!Number.isSafeInteger(userId)||userId<=0||!config.configured||!canRunCloseReview(now))return
 running=true;let id:number|undefined;let payload:CloseReviewPayload={status:'running',date,version:CLOSE_REVIEW_VERSION,metrics:[],summary:null,limitations:reviewLimitations}
 try{
  const unique={userId,date,task:CLOSE_REVIEW_TASK,snapshotId:0,provider:'anthropic'}
  if(await prisma.flowExpertReview.findUnique({where:{userId_date_task_snapshotId_provider:unique}})){finishedDate=date;return}
  const [predictions,snapshots]=await Promise.all([prisma.flowPrediction.findMany({where:{userId,date,mode:'live'},orderBy:{createdAt:'asc'}}),prisma.flowSnapshot.findMany({where:{date},orderBy:{observedAt:'asc'}})])
  const {evaluatePrediction}=await import('./flowAgent')
  const samples=snapshots.map(s=>(s.payload as unknown as RecordedFlow).sample).filter(Boolean)
  const rows=predictions.flatMap(p=>{const own=evaluatePrediction(p,samples,now);if(p.horizon!==15||predictions.some(x=>x.snapshotId===p.snapshotId&&x.variant===p.variant&&x.horizon===30))return[own];const continuation=evaluatePrediction({...p,horizon:30},samples,now);continuation.eligible=own.eligible;return[own,continuation]})
  payload.metrics=summarizeCloseRows(rows)
  if(!payload.metrics.some(g=>g.scored>0))payload.status='skipped'
  // Durable unique reservation BEFORE the paid call; no automatic retries after restart.
  const saved=await prisma.flowExpertReview.create({data:{...unique,model:config.model,version:CLOSE_REVIEW_VERSION,payload:JSON.parse(JSON.stringify(payload))}});id=saved.id;finishedDate=date
  if(payload.status==='skipped')return
  const text=await modelJson('anthropic',config.model,'장 마감 복기 참고 요약을 한국어 500자 이내로 작성한다. 입력은 코드가 집계한 실시간 AI 방향 적중 기록이다. 모델·버전·구성·예측 구간·가격반응별 분모를 보존한다. 30분에는 원래 15분 판단의 지속 평가가 포함된다. 관측 건수와 맞은 건수를 구분한다. 작은 표본에서 잘한다/못한다/개선됐다 단정하지 않는다. 원인·매매 수익·다음날 방향을 추정하지 않는다. 내일 확인할 관측 포인트만 제시하고 임계값이나 규칙을 새로 만들지 않는다. summary 한 필드만 출력한다.',{date,metrics:payload.metrics,limitations:reviewLimitations},schema,1200,'disabled')
  const result=JSON.parse(text);if(typeof result.summary!=='string'||!result.summary.trim()||result.summary.length>700)throw Error('invalid recap')
  payload={...payload,status:'completed',summary:result.summary,generatedAt:new Date().toISOString()}
  await prisma.flowExpertReview.update({where:{id},data:{payload:JSON.parse(JSON.stringify(payload))}})
 }catch(error){
  if((error as {code?:string}).code==='P2002'){finishedDate=date;return}
  if(id){payload={...payload,status:'failed',generatedAt:new Date().toISOString()};await prisma.flowExpertReview.update({where:{id},data:{payload:JSON.parse(JSON.stringify(payload))}}).catch(()=>{})}
  console.warn('[flow-close-review] failed; no automatic paid retry')
 }finally{running=false}
}
export function priorReviewContext(payload:CloseReviewPayload,date:string,cutoff:string){
 if(!Number.isFinite(Date.parse(cutoff))||!Number.isFinite(Date.parse(date))||!payload||!['completed','failed'].includes(payload.status)||payload.date>=date||!payload.generatedAt||Date.parse(payload.generatedAt)>Date.parse(cutoff)||!Number.isFinite(Date.parse(payload.generatedAt)))return null
 return {...payload,calendarDaysBefore:(Date.parse(date)-Date.parse(payload.date))/86400000,summary:payload.status==='completed'?payload.summary:null}
}
export async function attachPriorReview(record:RecordedFlow,userId:number){
 try{
  const rows=await prisma.flowExpertReview.findMany({where:{userId,task:CLOSE_REVIEW_TASK,date:{lt:record.sample.date},createdAt:{lte:new Date(record.sample.observedAt)}},orderBy:{date:'desc'},take:10})
  record.priorAiReview=rows.map(r=>priorReviewContext(r.payload as unknown as CloseReviewPayload,record.sample.date,record.sample.observedAt)).find(Boolean)||null
 }catch{record.priorAiReview=null}
}
