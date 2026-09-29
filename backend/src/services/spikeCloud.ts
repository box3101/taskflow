import cron from 'node-cron'
import prisma from '../prisma'
import poolConfig from '../data/spike-pool.json'
import leaderPoolConfig from '../data/spike-leader-pool.json'
import { recordLeaderQuotes, researchLeader } from './spikeLeaderResearch'
import archive from '../data/spike-archive.json'
import { clock, fresh, parseQuotes, signalsForTick } from './spikeCloudRules'
import { isKisTradingDay, kisConfigured } from './kisFlow'

let busy=false
let lastError:string|null=null
export const cloudEnabled=()=>process.env.SPIKE_CLOUD_ENABLED==='true'||(process.env.SPIKE_CLOUD_ENABLED!=='false'&&!!process.env.RAILWAY_ENVIRONMENT_ID)
export const cloudMode=()=>cloudEnabled()||process.env.SPIKE_SOURCE==='cloud'
const headers={'User-Agent':'Mozilla/5.0',Referer:'https://m.stock.naver.com'}
async function fetchText(url:string){const r=await fetch(url,{headers,signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('SPIKE_SOURCE_UNAVAILABLE');return r.text()}
export async function fetchCloudQuotes(){return parseQuotes(JSON.parse(await fetchText(`https://polling.finance.naver.com/api/realtime/domestic/stock/${Object.keys(poolConfig).join(',')}`)),Date.now())}
async function prepare(date:string){
  const codes=Object.keys(poolConfig),chg20:Record<string,number|null>={}
  const start=new Date(Date.parse(date)-60*86400000).toISOString().slice(0,10).replace(/-/g,'')
  let i=0
  await Promise.all(Array.from({length:6},async()=>{while(i<codes.length){const c=codes[i++];try{
    const text=await fetchText(`https://api.finance.naver.com/siseJson.naver?symbol=${c}&requestType=1&startTime=${start}&endTime=${date.replace(/-/g,'')}&timeframe=day`)
    const closes=[...text.matchAll(/\["\d{8}",\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)/g)].map(m=>Number(m[1]))
    chg20[c]=closes.length>=21&&closes[closes.length-21]>0?(closes[closes.length-1]/closes[closes.length-21]-1)*100:null
  }catch{chg20[c]=null}}}))
  return {version:1,pool:poolConfig,chg20,history:{},lastAlert:{},lastAt:0,alerts:[] as any[]}
}
function updateOutcomes(alerts:any[],quotes:ReturnType<typeof parseQuotes>,at:number){
  for(const a of alerts){
    const q=quotes[a.code];if(!fresh(q,at)||a.graded)continue
    const ret=(q.price/a.price-1)*100
    a.high=Math.max(a.high??0,ret)
    a.peak=Math.max(a.peak??a.price,q.price)
    if(a.fixed==null && (ret<=-3||ret>=1.2))a.fixed=ret
    for(const [key,width] of [['trail',1.5],['trail3',3]] as const)if(a[key]==null&&(ret<=-3||(a.peak>a.price&&q.price<=a.peak*(1-width/100))))a[key]=ret
    if(at-(a.lastPriceAt??Date.parse(a.observedAt))>30000)a.outcomeGap=true
    a.lastPriceAt=at
    for(const n of [5,15,30])if(a[`m${n}`]==null && at-Date.parse(a.observedAt)>=n*60000 && at-Date.parse(a.observedAt)<n*60000+20000)a[`m${n}`]=ret
    // Only finalise on an actual same-day closing quote, never yesterday's close.
    if(clock(q.sourceAt).slice(11,16)>='15:30'){
      a.close=ret;a.graded=true
      for(const key of ['fixed','trail','trail3'])a[key]=a.outcomeGap?null:(a[key]??ret)
    }
  }
}
export async function collectSpikeCloud(now=new Date()){
  if(!cloudEnabled()||busy)return
  const local=clock(now.getTime()),date=local.slice(0,10),time=local.slice(11,19),day=new Date(local).getUTCDay()
  if(day===0||day===6||time<'08:55:00'||time>'15:32:00')return
  busy=true
  try{
    if(!kisConfigured())throw new Error('거래일 확인용 KIS 연결 필요')
    if(!await isKisTradingDay(date))return
    await prisma.$transaction(async tx=>{
      const locks=await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(9283017) AS locked`
      if(!locks[0]?.locked)return
      const rows=await tx.$queryRaw<{payload:any}[]>`SELECT payload FROM spike_cloud_days WHERE date=${date}`
      const state=rows[0]?.payload||await prepare(date)
      if(time<'09:00:00'){
        if(!rows.length)await tx.$executeRaw`INSERT INTO spike_cloud_days(date,payload) VALUES (${date},${JSON.stringify(state)}::jsonb)`
        return
      }
      if(Date.now()-state.lastAt<8000)return
      const quotes=await fetchCloudQuotes(),at=Date.now()
      if(clock(at).slice(0,10)!==date)return
      if(!Object.values(quotes).some(q=>fresh(q,at)))throw new Error('시세 수집 지연')
      updateOutcomes(state.alerts,quotes,at)
      // Freeze the research universe independently of the original detector universe.
      state.leaderPool ||= leaderPoolConfig
      state.leaderHistory ||= {}
      recordLeaderQuotes(state.leaderHistory,quotes,at)
      state.leaderQuotes=quotes
      const alerts=time<'15:30:00'?signalsForTick(state,quotes,at):[]
      for(const alert of alerts) alert.leader=researchLeader(state.leaderPool,quotes,state.leaderHistory,alert.code,at) as any
      state.alerts.push(...alerts);state.lastAt=at
      await tx.$executeRaw`INSERT INTO spike_cloud_snapshots(date,captured_at,payload) VALUES (${date},${new Date(at)},${JSON.stringify(quotes)}::jsonb)`
      for(const a of state.alerts){const key=date+a.time+a.code
        await tx.$executeRaw`INSERT INTO spike_cloud_signals(key,date,payload) VALUES (${key},${date},${JSON.stringify(a)}::jsonb) ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload`
      }
      await tx.$executeRaw`INSERT INTO spike_cloud_days(date,payload) VALUES (${date},${JSON.stringify(state)}::jsonb) ON CONFLICT(date) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`
    },{timeout:180000,maxWait:5000})
    lastError=null
  }catch(e){lastError='서버 수집 지연 · 시세·거래일·DB 연결 확인 필요';console.warn('[spike-cloud]',e instanceof Error?e.message:'failed')}
  finally{busy=false}
}
export function startSpikeCloud(){
  if(!cloudEnabled())return
  cron.schedule('*/10 * * * * *',()=>{void collectSpikeCloud()},{timezone:'Asia/Seoul'})
  void collectSpikeCloud()
}
export async function cloudSpikeDashboard(){
  const days=await prisma.$queryRaw<{date:string;payload:any}[]>`SELECT date,payload FROM spike_cloud_days ORDER BY date`
  const merged=new Map<string,any>((archive.days as any[]).map(d=>[d.date,d]))
  const records:Record<string,any>={}
  for(const {date,payload} of days){
    const old=merged.get(date)?.alerts||[],alerts=[...old,...payload.alerts]
    merged.set(date,{date,alerts})
    for(const a of payload.alerts)records[date+a.time+a.code]=a.leader
  }
  const lastAt=Math.max(0,...days.map(d=>d.payload.lastAt||0))
  const latest=days[days.length-1]?.payload
  const board=latest?.leaderPool&&latest?.leaderQuotes?Object.keys(latest.leaderPool).map(code=>({code,name:latest.leaderPool[code].name,...researchLeader(latest.leaderPool,latest.leaderQuotes,latest.leaderHistory||{},code,latest.lastAt)})):[]
  return {spike:{...archive,days:[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date))},leader:{records,board,lastCapturedAt:lastAt?new Date(lastAt).toISOString():null},
    market:null,live:null,auto:null,fills:{},themes:Object.fromEntries(Object.entries(poolConfig).map(([c,p])=>[c,p.themes[0]])),
    loadedAt:new Date().toISOString(),collector:{mode:'cloud',enabled:cloudEnabled(),lastError,intervalSeconds:10,source:'Naver REST',missingChg20:days[days.length-1]?Object.values(days[days.length-1].payload.chg20).filter(v=>v===null).length:null}}
}
