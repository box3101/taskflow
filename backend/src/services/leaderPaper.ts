import { clock, fresh, Pool, Quote } from './spikeCloudRules'
import { sessionCandidates } from './leaderSession'

export const PAPER_RULE={version:'leader-session-paper-v1',stopPct:3,feePct:0.21,entryEnd:'15:20:00',exitTime:'15:30:00'}
export type PaperCandidate={code:string;name:string;theme:string;sourceDate:string}
type Pending=PaperCandidate & {lane:'previous'|'today';signalAt:number;sourceAt:number}
export type PaperTrade=Pending & {date:string;entryAt:number;entry:number;stop:number;lastPrice:number;lastSourceAt:number;exitAt?:number;exit?:number;reason?:string;netPct?:number;invalid?:boolean}
export type PaperState={date:string;version:string;lastAt:number;pending:Record<string,Pending>;seen:Record<string,{price:number;sourceAt:number;at:number}>;trades:PaperTrade[]}
const time=(at:number)=>clock(at).slice(11,19)
const good=(q:Quote|undefined,at:number)=>fresh(q,at)&&!q!.halted&&at-q!.sourceAt<=20000
// Quotes may stop updating during the closing auction. Collection itself must remain continuous.
const auctionBridge=(before:number,after:number)=>clock(before).slice(0,10)===clock(after).slice(0,10)&&time(before)>='15:19:30'&&time(after)<='15:32:00'
export function tickLeaderPaper(previous:PaperState|undefined,pool:Pool,quotes:Record<string,Quote>,prior:PaperCandidate[],at:number):PaperState {
 const date=clock(at).slice(0,10),tm=time(at)
 const state=previous?.date===date?previous:{date,version:PAPER_RULE.version,lastAt:at,pending:{},seen:{},trades:[]}
 if(at<state.lastAt)return state
 const collectionGap=at-state.lastAt>30000
 for(const t of state.trades){
  if(t.exitAt||t.invalid)continue
  const q=quotes[t.code]
  if(collectionGap){t.invalid=true;t.reason='수집 공백 · 성적 제외';continue}
  if(at-t.lastSourceAt>30000&&!auctionBridge(t.lastSourceAt,at)){t.invalid=true;t.reason='시세 누락·지연 · 성적 제외';continue}
  if(!good(q,at)||q.sourceAt<=t.lastSourceAt)continue
  if(q.sourceAt-t.lastSourceAt>30000&&!auctionBridge(t.lastSourceAt,q.sourceAt)){t.invalid=true;t.reason='시세 공백 · 성적 제외';continue}
  t.lastPrice=q.price;t.lastSourceAt=q.sourceAt
  const reason=q.price<=t.stop?'손절 −3% 도달':time(q.sourceAt)>=PAPER_RULE.exitTime?'장 마감 청산':null
  if(reason){t.exit=q.price;t.exitAt=at;t.reason=reason;t.netPct=(q.price/t.entry-1)*100-PAPER_RULE.feePct}
 }
 if(collectionGap){state.pending={};state.seen={}}
 const active=tm>='09:00:00'&&tm<PAPER_RULE.entryEnd
 const lane:Pending['lane']=tm<'09:30:00'?'previous':'today'
 const candidates:PaperCandidate[]=!active?[]:lane==='today'?sessionCandidates({date,payload:{strategyPool:pool,leaderQuotes:quotes,lastAt:at}},false,false):prior.filter(c=>c.sourceDate<date&&pool[c.code])
 const eligible=new Map(candidates.filter(c=>good(quotes[c.code],at)).map(c=>[c.code,c]))
 for(const [code,p] of Object.entries(state.pending)){
  const q=quotes[code]
  if(!active||p.lane!==lane||at-p.signalAt>30000||!eligible.has(code)){delete state.pending[code];continue}
  if(q.sourceAt<=p.sourceAt)continue
  if(q.sourceAt-p.sourceAt>30000){delete state.pending[code];continue}
  if(state.trades.some(t=>t.code===code)){delete state.pending[code];continue}
  state.trades.push({...p,date,entryAt:at,entry:q.price,stop:q.price*(1-PAPER_RULE.stopPct/100),lastPrice:q.price,lastSourceAt:q.sourceAt})
  delete state.pending[code]
 }
 for(const [code,c] of eligible){
  if(state.trades.some(t=>t.code===code)||state.pending[code])continue
  const q=quotes[code],old=state.seen[code]
  // Early-session approximation: prior leader below today's high, turning up on a new quote.
  const pullback=old&&at-old.at<=30000&&q.sourceAt>old.sourceAt&&q.sourceAt-old.sourceAt<=30000&&q.price>old.price&&q.price<q.high&&q.dayPct>0
  if(lane==='today'||pullback)state.pending[code]={...c,lane,signalAt:at,sourceAt:q.sourceAt}
 }
 for(const c of candidates){const q=quotes[c.code];if(good(q,at)&&(!state.seen[c.code]||q.sourceAt>state.seen[c.code].sourceAt))state.seen[c.code]={price:q.price,sourceAt:q.sourceAt,at}}
 state.lastAt=at
 return state
}
export function paperSummary(state:PaperState|undefined,now:number,mode:'live'|'replay'='live') {
 const trades=(state?.trades||[]).map(t=>!t.exitAt&&!t.invalid&&state&&now-state.lastAt>90000?{...t,invalid:true,reason:'후속 수집 없음 · 성적 제외'}:t)
 const done=trades.filter(t=>!t.invalid&&Number.isFinite(t.netPct))
 return {date:state?.date||clock(now).slice(0,10),rule:PAPER_RULE,mode,lastAt:state?.lastAt||null,trades,
  completed:done.length,excluded:trades.filter(t=>t.invalid).length,holding:trades.filter(t=>!t.invalid&&!t.exitAt).length,
  mean:done.length?done.reduce((sum,t)=>sum+t.netPct!,0)/done.length:null,
  win:done.length?done.filter(t=>t.netPct!>0).length/done.length*100:null}
}
export function replayLeaderPaper(date:string,pool:Pool,prior:PaperCandidate[],snapshots:{at:number;quotes:Record<string,Quote>}[],cutoff:number){
 let state:PaperState|undefined
 for(const s of snapshots.slice().sort((a,b)=>a.at-b.at)){
  if(s.at>cutoff||clock(s.at).slice(0,10)!==date)continue
  state=tickLeaderPaper(state,pool,s.quotes,prior,s.at)
 }
 return state
}
