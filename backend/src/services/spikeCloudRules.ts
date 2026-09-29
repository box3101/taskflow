export type Pool = Record<string,{name:string;themes:string[]}>
export interface Quote { price:number; high:number; low:number; dayPct:number; value:number|null; sourceAt:number; receivedAt:number; halted:boolean }
export const clock = (at:number) => new Date(at+9*3600000).toISOString()
export function parseQuotes(data:any, at:number):Record<string,Quote> {
  const out:Record<string,Quote>={}
  const n=(v:any) => v===null || v===undefined || v==='' ? NaN : Number(String(v).replace(/,/g,''))
  for(const x of data?.datas||[]) {
    const info=x.integratedPriceInfo||x, price=n(x.closePrice), high=n(info.highPrice),low=n(info.lowPrice),dayPct=n(x.fluctuationsRatio)
    if(!x.itemCode || ![price,high,low,dayPct].every(Number.isFinite) || !(low>0&&price>=low&&price<=high))continue
    const raw=n(info.accumulatedTradingValueRaw)
    out[x.itemCode]={price,high,low,dayPct,value:Number.isFinite(raw)&&raw>=0?raw:null,sourceAt:Date.parse(x.localTradedAt),receivedAt:at,halted:!!x.tradeStopType?.code&&x.tradeStopType.code!=='1'}
  }
  return out
}
export function fresh(q:Quote|undefined,at:number) {
  return !!q && Number.isFinite(q.sourceAt) && at-q.sourceAt>=-3000 && at-q.sourceAt<=90000 && at-q.receivedAt>=0 && at-q.receivedAt<=20000 && clock(q.sourceAt).slice(0,10)===clock(at).slice(0,10)
}
export function rankLeader(pool:Pool,quotes:Record<string,Quote>,code:string,theme:string,at:number) {
  const codes=Object.keys(pool).filter(c=>pool[c].themes.includes(theme))
  const peers=codes.filter(c=>fresh(quotes[c],at)&&quotes[c].value!==null).map(c=>({code:c,name:pool[c].name,turnoverWon:quotes[c].value!,dayPct:quotes[c].dayPct,sourceAt:new Date(quotes[c].sourceAt).toISOString()})).sort((a,b)=>b.turnoverWon-a.turnoverWon)
  const own=peers.find(p=>p.code===code),valid=peers.length===codes.length&&codes.length>=2&&!!own&&own.turnoverWon>0
  const rank=valid?1+peers.filter(p=>p.turnoverWon>own!.turnoverWon).length:null
  return {status:rank===null?'unknown':rank===1?'pass':'excluded',rank,total:codes.length,available:peers.length,peers,theme,
    strengthRank:valid?1+peers.filter(p=>p.dayPct>own!.dayPct).length:null,
    reason:rank===null?'비교 종목 시세 누락·지연':rank===1?'테마 내 거래대금 1위':'거래대금 1위 아님',
    tied:!!own&&peers.filter(p=>p.turnoverWon===own.turnoverWon).length>1,
    basis:'Naver 통합시장 누적 거래대금 · 원',observedAt:new Date(at).toISOString()}
}
export const median=(xs:number[])=>{const a=[...xs].sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:0}
export const label=(v:number|null)=>v===null?'chg20 불명':v>=20?'추세주 점화':v>=0?'중립':v>=-10?'약보합/횡보':'낙폭과대 반등 주의'
export function signalsForTick(state:any,quotes:Record<string,Quote>,at:number) {
  const pool:Pool=state.pool, active=Object.keys(quotes).filter(c=>pool[c]&&fresh(quotes[c],at)&&!quotes[c].halted)
  const overall=median(active.map(c=>quotes[c].dayPct)), themeMedian:Record<string,number>={}
  for(const theme of new Set(Object.values(pool).flatMap(p=>p.themes))) {
    const values=active.filter(c=>pool[c].themes.includes(theme)).map(c=>quotes[c].dayPct)
    themeMedian[theme]=values.length>=8?median(values):overall
  }
  const date=clock(at).slice(0,10),time=clock(at).slice(11,19), alerts:any[]=[]
  for(const c of active){
    const q=quotes[c];let h:(number[])[]=state.history[c]||[]
    if(h.length&&at-h[h.length-1][0]>30000)h=[]
    h.push([at,q.price]);h=h.filter(p=>at-p[0]<=180000);state.history[c]=h
    if(h.length<2)continue
    const spike=(q.price/h[0][1]-1)*100, threshold=time<'10:00:00'?1.2:1.5
    if(spike<threshold||q.dayPct>Math.min(5,...pool[c].themes.map(t=>themeMedian[t]??overall))||at-(state.lastAlert[c]||0)<600000)continue
    state.lastAlert[c]=at
    const theme=pool[c].themes[0]
    alerts.push({date,time:time.slice(0,5),observedAt:new Date(at).toISOString(),code:c,name:pool[c].name,theme,label:label(state.chg20[c]??null),price:q.price,dayPct:q.dayPct,chg20:state.chg20[c]??null,coh:q.high>q.low?Math.round((q.price-q.low)/(q.high-q.low)*100):100,graded:false,leader:rankLeader(pool,quotes,c,theme,at),cloud:true})
  }
  return alerts
}
