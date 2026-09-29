import { Pool, Quote, fresh, clock, median, rankLeader } from './spikeCloudRules'

// Persisted in the daily state; no future observations or previous trading day.
export type LeaderHistory = Record<string, { at:number; value:number; price:number }[]>
export function recordLeaderQuotes(history:LeaderHistory, quotes:Record<string,Quote>, at:number) {
  for (const [code,q] of Object.entries(quotes)) {
    if (!fresh(q,at) || q.halted || q.value===null) continue
    let rows=history[code]||[]
    const last=rows[rows.length-1]
    if(last && (at-last.at>30000 || q.value<last.value || clock(last.at).slice(0,10)!==clock(at).slice(0,10))) rows=[]
    rows=rows.filter(r=>at-r.at<=620000)
    if(!rows.length || rows[rows.length-1]!.at<at)rows.push({at,value:q.value,price:q.price})
    history[code]=rows
  }
}
export function researchLeader(pool:Pool,quotes:Record<string,Quote>,history:LeaderHistory,code:string,at:number) {
  const theme=pool[code]?.themes[0]||''
  const base=rankLeader(pool,quotes,code,theme,at)
  const metrics=(c:string)=>{
    const q=quotes[c],rows=history[c]||[]
    const sample=(minutes:number)=>rows.filter(r=>r.at<=at-minutes*60000 && at-minutes*60000-r.at<=20000).slice(-1)[0]
    const five=sample(5),ten=sample(10)
    const continuous=(start:number)=>{
      const path=rows.filter(r=>r.at>=start&&r.at<=at)
      return path.length>1&&at-path[path.length-1]!.at<=20000&&path.every((r,i)=>i===0||r.at-path[i-1].at<=30000)
    }
    const valid=!!q&&fresh(q,at)&&!q.halted&&q.value!==null&&!!five&&continuous(five.at)&&q.value>=five.value
    const turnover5m=valid?q.value!-five!.value:null
    const prior5m=valid&&ten&&continuous(ten.at)&&five!.value>=ten.value?five!.value-ten.value:null
    return {turnover5m,turnoverRatio:turnover5m!==null&&prior5m!==null&&prior5m>0?turnover5m/prior5m:null,
      return5m:valid?(q.price/five!.price-1)*100:null,baselineAt:valid?new Date(five!.at).toISOString():null}
  }
  const peers=base.peers.map(p=>({...p,...metrics(p.code)}))
  const complete=peers.length===base.total&&peers.every(p=>p.return5m!==null)
  const themeReturn5m=complete?median(peers.map(p=>p.return5m!)):null
  const own=peers.find(p=>p.code===code)
  const relative5m=themeReturn5m!==null&&own?.return5m!=null?own.return5m-themeReturn5m:null
  const status=base.rank===null?'unknown':base.rank<=3?'pass':'excluded'
  return {...base,version:'leader-v2',status,reason:status==='unknown'?base.reason:status==='pass'?'세부 테마 거래대금 상위 3위':'세부 테마 거래대금 4위 이하',
    peers:peers.map(p=>({...p,relative5m:themeReturn5m!==null&&p.return5m!==null?p.return5m-themeReturn5m:null})),
    turnover5m:own?.turnover5m??null,turnoverRatio:own?.turnoverRatio??null,relative5m,themeReturn5m,
    baselineAt:own?.baselineAt??null,comparisonReady:relative5m!==null&&own?.turnoverRatio!=null,
    comparisonNote:relative5m===null?'5분 연속 관측·테마 비교 자료 부족':own?.turnoverRatio==null?'직전 5분 거래대금 부족 또는 0':'비교 가능'}
}
