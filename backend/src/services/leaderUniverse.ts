import original from '../data/spike-pool.json'
import legacy from '../data/spike-leader-pool.json'
import additions from '../data/leader-strategy-additions.json'
import { Pool } from './spikeCloudRules'

export const STRATEGY_UNIVERSE_VERSION='leader-universe-2026-09-30'
export const strategyPool:Pool={...legacy,...additions}
// Apply only to the new strategy: the legacy ranking universe stays unchanged.
for(const code of ['015760','036460','071320'])strategyPool[code]={...strategyPool[code],themes:['유틸리티']}
export function freezeStrategyUniverse(state:any) {
  state.strategyPool ||= JSON.parse(JSON.stringify(strategyPool))
  state.strategyUniverseVersion ||= STRATEGY_UNIVERSE_VERSION
}
export function collectionCodes(state?:any) {
  return [...new Set([...Object.keys(state?.pool||original),...Object.keys(state?.leaderPool||legacy),...Object.keys(state?.strategyPool||strategyPool)])]
}
export function universeSummary(pool:Pool=strategyPool,version=STRATEGY_UNIVERSE_VERSION) {
  const groups=new Map<string,{code:string;name:string;added:boolean}[]>()
  for(const [code,p] of Object.entries(pool)) {
    const rows=groups.get(p.themes[0])||[]
    rows.push({code,name:p.name,added:!(code in original)});groups.set(p.themes[0],rows)
  }
  return {version,count:Object.keys(pool).length,addedCount:Object.keys(pool).filter(c=>!(c in original)).length,
    themes:[...groups].map(([name,stocks])=>({name,stocks,eligible:stocks.length>=3})).sort((a,b)=>a.name.localeCompare(b.name,'ko'))}
}
