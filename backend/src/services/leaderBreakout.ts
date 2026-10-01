import {clock,fresh,Pool,Quote} from './spikeCloudRules'
import {sessionCandidates} from './leaderSession'
export const BREAKOUT_RULE={version:'leader-breakout-proxy-v1',start:'09:30:00',end:'15:20:00',maxTrades:3,stopPct:3,feePct:0.21,exit:'15:30:00'}
type Candidate=ReturnType<typeof sessionCandidates>[number]
type Pending={at:number;sourceAt:number;breakout:number;candidate:Candidate}
export type BreakoutTrade={code:string;name:string;theme:string;signalAt:number;breakout:number;candidate:Candidate;entryAt:number;entry:number;stop:number;lastAt:number;lastPrice:number;status:'holding'|'closed'|'excluded';exit?:number;exitAt?:number;netPct?:number;reason?:string}
export type BreakoutState={version:string;date:string;lastAt:number;previous:Record<string,Quote>;pending:Record<string,Pending>;trades:BreakoutTrade[]}
const time=(at:number)=>clock(at).slice(11,19)
const good=(q:Quote|undefined,at:number):q is Quote=>fresh(q,at)&&!q!.halted&&at-q!.sourceAt<=20000&&q!.sourceAt<=at&&q!.price>0
export function tickLeaderBreakout(prior:BreakoutState|undefined,pool:Pool,quotes:Record<string,Quote>,at:number):BreakoutState{
 const date=clock(at).slice(0,10),tm=time(at)
 const s:BreakoutState=prior?.date===date&&prior.version===BREAKOUT_RULE.version?prior:{version:BREAKOUT_RULE.version,date,lastAt:0,previous:{},pending:{},trades:[]}
 if(at<=s.lastAt)return s
 const gap=!!s.lastAt&&at-s.lastAt>30000
 if(gap)s.pending={}
 for(const t of s.trades){
  if(t.status!=='holding')continue
  const q=quotes[t.code],auction=time(t.lastAt)>='15:19:30'&&tm<='15:32:00'
  if(gap||(at-t.lastAt>30000&&!auction)){t.status='excluded';t.reason='수집·시세 공백 · 성적 제외';continue}
  if(!good(q,at)||q.sourceAt<=t.lastAt)continue
  t.lastAt=q.sourceAt;t.lastPrice=q.price
  if(q.price<=t.stop||time(q.sourceAt)>=BREAKOUT_RULE.exit){
   t.status='closed';t.exit=q.price;t.exitAt=at;t.netPct=(q.price/t.entry-1)*100-BREAKOUT_RULE.feePct;t.reason=q.price<=t.stop?'손절선 이탈':'장 마감 청산'
  }
 }
 const active=tm>=BREAKOUT_RULE.start&&tm<BREAKOUT_RULE.end
 const candidates=active?sessionCandidates({date,payload:{strategyPool:pool,leaderQuotes:quotes,lastAt:at}},false,false).slice(0,3):[]
 const eligible=new Map(candidates.filter(c=>!c.tied&&c.dayPct>c.themePct).map(c=>[c.code,c]))
 for(const [code,p] of Object.entries(s.pending)){
  const q=quotes[code]
  if(!active||at-p.at>30000||!eligible.has(code)||s.trades.length>=BREAKOUT_RULE.maxTrades){delete s.pending[code];continue}
  if(!good(q,at)||q.sourceAt<=p.sourceAt)continue
  delete s.pending[code]
  if(q.price<=p.breakout||s.trades.some(t=>t.code===code))continue
  s.trades.push({code,name:p.candidate.name,theme:p.candidate.theme,signalAt:p.at,breakout:p.breakout,candidate:p.candidate,entryAt:at,entry:q.price,stop:q.price*.97,lastAt:q.sourceAt,lastPrice:q.price,status:'holding'})
 }
 if(s.lastAt&&!gap&&active&&s.trades.length<BREAKOUT_RULE.maxTrades){
  for(const [code,candidate] of eligible){
   const q=quotes[code],old=s.previous[code]
   if(s.trades.some(t=>t.code===code)||s.pending[code]||!good(q,at)||!good(old,s.lastAt)||q.sourceAt<=old.sourceAt)continue
   if(q.price>old.high)s.pending[code]={at,sourceAt:q.sourceAt,breakout:old.high,candidate}
  }
 }
 s.previous=quotes;s.lastAt=at
 return s
}
export function breakoutSummary(s:BreakoutState,now=Date.now()){
 const trades=s.trades.map(t=>t.status==='holding'&&now-s.lastAt>90000?{...t,status:'excluded',reason:'후속 수집 없음 · 성적 제외'}:t)
 const done=trades.filter(t=>t.status==='closed'&&Number.isFinite(t.netPct))
 return {date:s.date,version:s.version,lastAt:s.lastAt,trades,completed:done.length,holding:trades.filter(t=>t.status==='holding').length,excluded:trades.filter(t=>t.status==='excluded').length,mean:done.length?done.reduce((a,t)=>a+t.netPct!,0)/done.length:null,win:done.length?100*done.filter(t=>t.netPct!>0).length/done.length:null}
}
