import { clock, fresh, Pool, Quote } from './spikeCloudRules'
import { LeaderHistory, researchLeader } from './spikeLeaderResearch'
import { universeSummary } from './leaderUniverse'

export const LEADER_RULE = { version:'leader-pullback-v1', start:'09:10:00', end:'10:00:00', feePct:0.21,
  turnoverRatio:1.2, relative5m:0.1, pullbackPct:0.3, minRiskPct:0.3, maxRiskPct:2, rewardR:2, holdMinutes:30 }
type Metrics = ReturnType<typeof researchLeader>
export type LeaderTrade = { version:string; universeVersion?:string; code:string; name:string; theme:string; date:string; signalAt:number; entryAt:number;
  entry:number; stop:number; target:number; lastAt:number; lastSourceAt:number; metrics:Metrics;
  exitAt?:number; exit?:number; reason?:string; netPct?:number; invalid?:boolean }
type Setup = { level:number; peak:number; low:number; at:number; lastAt:number; lastSourceAt:number;
  stage:'breakout'|'pullback'|'pending'; signalAt?:number; metrics:Metrics }
export type LeaderState = { date:string; universeVersion?:string; rule:typeof LEADER_RULE; setups:Record<string,Setup>; trades:LeaderTrade[] }
const quoteOk=(q:Quote|undefined,at:number)=>fresh(q,at)&&!q!.halted&&at-q!.sourceAt<=20000
export function eligibleLeader(m:Metrics, q:Quote) {
  return m.total>=3 && m.rank!==null && m.rank<=3 && m.comparisonReady && q.dayPct>0
    && m.turnoverRatio!>=LEADER_RULE.turnoverRatio && m.relative5m!>=LEADER_RULE.relative5m
    && m.themeReturn5m!>0
}

// Independent paper strategy. Never calls the original spike detector or an order API.
export function tickLeaderStrategy(previous:LeaderState|undefined,pool:Pool,quotes:Record<string,Quote>,history:LeaderHistory,at:number):LeaderState {
  const date=clock(at).slice(0,10),time=clock(at).slice(11,19)
  const state:LeaderState=previous?.date===date?previous:{date,rule:{...LEADER_RULE},setups:{},trades:[]}
  for(const t of state.trades) {
    if(t.exitAt)continue
    const q=quotes[t.code]
    if(at-t.lastAt>30000) { t.invalid=true;t.exitAt=at;t.reason='수집 공백 · 성적 제외';continue }
    if(!quoteOk(q,at)||q.sourceAt<=t.lastSourceAt)continue
    if(q.sourceAt-t.lastSourceAt>30000) {t.invalid=true;t.exitAt=at;t.reason='시세 공백 · 성적 제외';continue}
    t.lastAt=at;t.lastSourceAt=q.sourceAt
    const reason=q.price<=t.stop?'눌림 저점 이탈':q.price>=t.target?'2R 목표 도달':at-t.entryAt>=LEADER_RULE.holdMinutes*60000?'30분 종료':null
    if(reason) { t.exit=q.price;t.exitAt=at;t.reason=reason;t.netPct=(q.price/t.entry-1)*100-LEADER_RULE.feePct }
  }
  if(time<LEADER_RULE.start||time>=LEADER_RULE.end) {state.setups={};return state}
  for(const code of Object.keys(pool)) {
    if(state.trades.some(t=>t.code===code))continue // One entry per stock per trading day.
    const q=quotes[code],s=state.setups[code]
    if(s&&(at-s.lastAt>30000||at-s.at>600000))delete state.setups[code]
    if(!quoteOk(q,at))continue
    const m=researchLeader(pool,quotes,history,code,at)
    const setup=state.setups[code]
    if(!eligibleLeader(m,q)||m.peers.some(p=>!quoteOk(quotes[p.code],at))) {delete state.setups[code];continue}
    if(setup) {
      if(q.sourceAt<=setup.lastSourceAt)continue
      if(q.sourceAt-setup.lastSourceAt>30000) {delete state.setups[code];continue}
      setup.lastAt=at;setup.lastSourceAt=q.sourceAt
      if(setup.stage==='pending') {
        const risk=(q.price-setup.low)/q.price*100
        if(q.price>=setup.level && risk>=LEADER_RULE.minRiskPct && risk<=LEADER_RULE.maxRiskPct) {
          state.trades.push({version:LEADER_RULE.version,universeVersion:state.universeVersion,code,name:pool[code].name,theme:m.theme,date,signalAt:setup.signalAt!,entryAt:at,
            entry:q.price,stop:setup.low,target:q.price+LEADER_RULE.rewardR*(q.price-setup.low),lastAt:at,lastSourceAt:q.sourceAt,metrics:setup.metrics})
        }
        delete state.setups[code];continue
      }
      setup.peak=Math.max(setup.peak,q.price)
      if(setup.stage==='breakout') {
        if(q.price<=setup.peak*(1-LEADER_RULE.pullbackPct/100)) {setup.stage='pullback';setup.low=q.price}
      } else {
        const previousLow=setup.low
        setup.low=Math.min(setup.low,q.price)
        if(q.price>=setup.level && q.price>=previousLow*(1+LEADER_RULE.pullbackPct/100)) {
          setup.stage='pending';setup.signalAt=at;setup.metrics=m
        }
      }
      continue
    }
    // Break above the PREVIOUS five-minute observed high; current tick is excluded.
    const path=(history[code]||[]).filter(p=>p.at<at&&p.at>=at-320000)
    if(!path.length||path[0].at>at-300000||at-path[path.length-1].at>30000)continue
    const level=Math.max(...path.filter(p=>p.at>=at-300000).map(p=>p.price))
    if(q.price>level)state.setups[code]={level,peak:q.price,low:q.price,at,lastAt:at,lastSourceAt:q.sourceAt,stage:'breakout',metrics:m}
  }
  return state
}

export function leaderStrategyDashboard(days:{date:string;payload:any}[],now=Date.now()) {
  const trades:LeaderTrade[]=days.flatMap(d=>d.payload.leaderStrategy?.trades||[]).map(t=>
    !t.exitAt&&now-t.lastAt>30000?{...t,invalid:true,reason:'수집 공백 · 성적 제외'}:t)
  const latest=days[days.length-1]?.payload
  return {rule:LEADER_RULE,universe:universeSummary(latest?.strategyPool,latest?.strategyUniverseVersion),trades:trades.sort((a,b)=>b.entryAt-a.entryAt),
    setups:latest?.leaderStrategy?.setups||{},lastCapturedAt:latest?.lastAt?new Date(latest.lastAt).toISOString():null}
}
