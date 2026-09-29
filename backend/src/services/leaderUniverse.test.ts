import { describe,it,expect,vi,afterEach } from 'vitest'
import original from '../data/spike-pool.json'
import legacy from '../data/spike-leader-pool.json'
import additions from '../data/leader-strategy-additions.json'
import { collectionCodes,freezeStrategyUniverse,strategyPool,universeSummary } from './leaderUniverse'
import { fetchCloudQuotes } from './spikeCloud'
afterEach(()=>vi.unstubAllGlobals())
describe('expanded strategy universe',()=>{
  it('adds unique codes without changing either legacy universe',()=>{
    expect(Object.keys(original)).toHaveLength(122)
    expect(Object.keys(legacy)).toHaveLength(122)
    expect(Object.keys(additions).filter(c=>c in original)).toEqual([])
    expect(Object.keys(strategyPool)).toHaveLength(179)
    expect(collectionCodes()).toHaveLength(179)
    expect(Object.keys(strategyPool).every(c=>/^\d{6}$/.test(c))).toBe(true)
    expect(Object.values(strategyPool).every(p=>p.themes.length===1&&p.name.length>0)).toBe(true)
    expect(universeSummary().themes.find(g=>g.name==='로봇')?.stocks).toHaveLength(7)
  })
  it('freezes membership on first use and retains saved codes across config changes',()=>{
    const state:any={pool:original,leaderPool:legacy}
    freezeStrategyUniverse(state)
    expect(state.strategyPool).not.toBe(strategyPool)
    state.strategyPool={'999999':{name:'saved',themes:['saved']}}
    state.strategyUniverseVersion='saved-v1'
    freezeStrategyUniverse(state)
    expect(Object.keys(state.strategyPool)).toEqual(['999999'])
    expect(state.strategyUniverseVersion).toBe('saved-v1')
    expect(collectionCodes(state)).toContain('999999')
    expect(collectionCodes(state)).not.toContain('108490')
  })
  it('collects the full union in bounded requests',async()=>{
    const fetcher=vi.fn(async (url:string)=>({ok:true,text:async()=>JSON.stringify({datas:url.split('/').pop()!.split(',').map(itemCode=>({itemCode,closePrice:'100',highPrice:'110',lowPrice:'90',fluctuationsRatio:'1',accumulatedTradingValueRaw:'1000',localTradedAt:new Date().toISOString()}))})}))
    vi.stubGlobal('fetch',fetcher)
    const result=await fetchCloudQuotes()
    expect(Object.keys(result)).toHaveLength(179)
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(fetcher.mock.calls.every(([url])=>url.split('/').pop()!.split(',').length<=50)).toBe(true)
    expect(result['108490'].value).toBe(1000)
  })
  it('fails a tick if one batch fails instead of returning partial rankings',async()=>{
    let calls=0
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:++calls!==2,text:async()=>JSON.stringify({datas:[]})})))
    await expect(fetchCloudQuotes()).rejects.toThrow('SPIKE_SOURCE_UNAVAILABLE')
  })
})
