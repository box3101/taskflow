import { clock, fresh, median, Pool, Quote } from './spikeCloudRules'
import { researchLeader } from './spikeLeaderResearch'

type Day = { date:string; payload:any }
export function leaderPhase(at:number) {
  const time=clock(at).slice(11,19)
  return time<'09:00:00'?'prepare':time<'09:30:00'?'previous':time<'15:30:00'?'today':'closed'
}

// Reference candidates within the saved universe, not confirmed market-wide leaders.
export function sessionCandidates(day:Day,closing=false,withMetrics=true) {
  const p=day.payload, pool:Pool=p.strategyPool||{}, quotes:Record<string,Quote>=p.leaderQuotes||{}
  const at=p.lastAt
  if(!Number.isFinite(at)||clock(at).slice(0,10)!==day.date)return []
  const themes=[...new Set(Object.values(pool).map(s=>s.themes[0]))].filter(Boolean)
  return themes.flatMap(theme=>{
    const codes=Object.keys(pool).filter(c=>pool[c].themes[0]===theme)
    const usableQuote=(q:Quote|undefined)=>!!q&&(closing
      ? Number.isFinite(q.sourceAt)&&clock(q.sourceAt).slice(0,10)===day.date&&clock(q.sourceAt).slice(11,19)>='15:30:00'&&q.sourceAt<=at+3000
      : fresh(q,at))&&!q.halted&&Number.isFinite(q.value)
    if(codes.length<3||codes.some(c=>!usableQuote(quotes[c])))return []
    const themePct=median(codes.map(c=>quotes[c].dayPct))
    const top=Math.max(...codes.map(c=>quotes[c].value!))
    if(themePct<=0||top<=0)return []
    const themeTurnover=codes.reduce((sum,c)=>sum+quotes[c].value!,0)
    return codes.filter(c=>quotes[c].value===top&&quotes[c].dayPct>0).map(code=>{
      const q=quotes[code],m=withMetrics?researchLeader(pool,quotes,p.leaderHistory||{},code,at):null
      return {code,name:pool[code].name,theme,sourceDate:day.date,observedAt:at,
        price:q.price,dayPct:q.dayPct,turnover:q.value,themePct,themeTurnover,
        rank:1,tied:codes.filter(c=>quotes[c].value===top).length>1,
        turnoverRatio:m?.turnoverRatio??null,relative5m:m?.relative5m??null,
        fromHighPct:q.high>0?(q.price/q.high-1)*100:null}
    })
  }).sort((a,b)=>b.themeTurnover-a.themeTurnover||(b.turnover||0)-(a.turnover||0))
}

export function leaderSessionDashboard(days:Day[],now=Date.now()) {
  const today=clock(now).slice(0,10)
  const ordered=days.filter(d=>d.date<=today).slice().sort((a,b)=>a.date.localeCompare(b.date))
  const dates=[...new Set([...ordered.map(d=>d.date),today])]
  return {version:'leader-session-v1',mode:'observation',sessions:dates.map(date=>{
    const day=ordered.find(d=>d.date===date)
    // Take the preceding two recorded trading dates before checking completeness.
    // Missing closing data must not silently substitute a much older session.
    const prior=ordered.filter(d=>d.date<date).slice(-2).reverse()
    const usable=prior.filter(d=>d.payload.lastAt&&clock(d.payload.lastAt).slice(0,10)===d.date&&clock(d.payload.lastAt).slice(11,19)>='15:30:00')
    const previous=usable.flatMap((d)=>sessionCandidates(d,true).map(c=>({...c,daysAgo:prior.indexOf(d)+1})))
    const rawAt=day?.payload.lastAt
    const at=Number.isFinite(rawAt)&&clock(rawAt).slice(0,10)===date&&rawAt<=now?rawAt:null
    const phase=date===today?leaderPhase(now):(at?leaderPhase(at):'prepare')
    // No same-day final rankings in the morning lane, even on historical views.
    const current=at&&clock(at).slice(11,19)>='09:30:00'?sessionCandidates(day!,clock(at).slice(11,19)>='15:30:00'):[]
    const currentQuotes:Record<string,Quote>=day?.payload.leaderQuotes||{}
    return {date,phase,observedAt:at,stale:!at||(date===today&&now-at>90000),
      previousDates:usable.map(d=>d.date),missingPreviousDays:2-usable.length,
      previous:previous.map(c=>{
        const q=currentQuotes[c.code],valid=at&&fresh(q,at)&&!q.halted
        return {...c,currentPrice:valid?q.price:null,currentFromHighPct:valid&&q.high>0?(q.price/q.high-1)*100:null}
      }),current,earlyEntry:'manual-only',automaticEntries:false}
  })}
}
