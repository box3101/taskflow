import { describe,it,expect,vi,beforeEach } from 'vitest'
import { tickLeaderStrategy, eligibleLeader, leaderStrategyDashboard, LeaderState } from './leaderStrategy'
import { researchLeader } from './spikeLeaderResearch'
import { Quote } from './spikeCloudRules'
vi.mock('./spikeLeaderResearch',()=>({researchLeader:vi.fn()}))
const start=Date.parse('2026-09-30T09:10:00+09:00')
const pool={A:{name:'A',themes:['theme']}}
const metric={total:8,rank:1,comparisonReady:true,turnoverRatio:2,relative5m:0.5,themeReturn5m:0.3,theme:'theme',peers:[]}
const quote=(price:number,at:number):Quote=>({price,high:120,low:80,dayPct:8,value:10000000,sourceAt:at,receivedAt:at,halted:false})
const history={A:Array.from({length:31},(_,i)=>({at:start-300000+i*10000,price:100,value:i*1000}))}
beforeEach(()=>vi.mocked(researchLeader).mockReturnValue(metric as any))
function step(s:LeaderState|undefined,price:number,offset:number) {const at=start+offset;return tickLeaderStrategy(s,pool,{A:quote(price,at)},history,at)}
function enter() {
  let s=step(undefined,101,0) // independently accepts +8% daily rise
  s=step(s,100.5,10000)
  s=step(s,101,20000) // reclaim signal
  return step(s,101.1,30000) // next observation entry
}
describe('independent leader pullback strategy',()=>{
  it('waits for breakout, pullback, reclaim and a later quote; no same-tick fill',()=>{
    let s=step(undefined,101,0)
    expect(s.trades).toHaveLength(0)
    expect(s.setups.A.stage).toBe('breakout')
    s=step(s,100.5,10000);expect(s.setups.A.stage).toBe('pullback')
    s=step(s,101,20000);expect(s.trades).toHaveLength(0)
    s=step(s,101.1,30000)
    expect(s.trades[0]).toMatchObject({entry:101.1,stop:100.5,signalAt:start+20000,entryAt:start+30000})
    expect(s.trades[0].target).toBeCloseTo(102.3)
  })
  it('does not fill again on repeated exchange timestamp',()=>{
    let s=step(undefined,101,0);s=step(s,100.5,10000);s=step(s,101,20000)
    const q=quote(101, start+30000);q.sourceAt=start+20000
    s=tickLeaderStrategy(s,pool,{A:q},history,start+30000)
    expect(s.trades).toHaveLength(0)
  })
  it('uses observed stop price including overshoot and deducts costs',()=>{
    const s=step(enter(),100,40000),t=s.trades[0]
    expect(t.exit).toBe(100);expect(t.reason).toBe('눌림 저점 이탈')
    expect(t.netPct).toBeCloseTo((100/101.1-1)*100-0.21)
    expect(step(s,105,50000).trades).toHaveLength(1)
  })
  it('excludes interrupted trades instead of fabricating a fill',()=>{
    const s=step(enter(),110,70000)
    expect(s.trades[0].invalid).toBe(true);expect(s.trades[0].netPct).toBeUndefined()
  })
  it('does not enter before 09:10, after 10:00 or with an excessive gap on entry',()=>{
    expect(step(undefined,101,-10000).setups).toEqual({})
    expect(step(undefined,101,50*60000).setups).toEqual({})
    let s=step(undefined,101,0);s=step(s,100.5,10000);s=step(s,101,20000)
    expect(step(s,105,30000).trades).toHaveLength(0)
  })
  it('rejects missing comparisons and insufficient theme strength',()=>{
    for(const change of [{rank:null},{total:2},{turnoverRatio:1.1},{relative5m:0.05},{themeReturn5m:-1},{comparisonReady:false}])
      expect(eligibleLeader({...metric,...change} as any,quote(101,start))).toBe(false)
  })
  it('does not use a future high to detect breakout',()=>{
    const h={A:[...history.A,{at:start+10000,price:999,value:99999}]}
    expect(tickLeaderStrategy(undefined,pool,{A:quote(101,start)},h,start).setups.A).toBeDefined()
  })
  it('marks abandoned positions excluded in dashboard and resets on the next date',()=>{
    const s=enter()
    expect(leaderStrategyDashboard([{date:s.date,payload:{leaderStrategy:s}}],start+120000).trades[0].invalid).toBe(true)
    expect(tickLeaderStrategy(s,pool,{}, {},start+86400000).trades).toHaveLength(0)
  })
  it('exits at 2R observed price and at 30 minutes without a data gap',()=>{
    expect(step(enter(),102.4,40000).trades[0].reason).toBe('2R 목표 도달')
    let s=enter()
    for(let offset=40000;offset<=1830000;offset+=10000)s=step(s,101.1,offset)
    expect(s.trades[0].reason).toBe('30분 종료')
  })
})
