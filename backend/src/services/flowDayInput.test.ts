import { expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({snapshots:vi.fn(),json:vi.fn()}))
vi.mock('../prisma',()=>({default:{flowSnapshot:{findMany:mocks.snapshots}}}))
vi.mock('./flowModels',()=>({basicModel:()=>({configured:true,model:'fixture'}),judgmentSchema:{},modelJson:mocks.json}))
import { generateJudgment } from './flowAgent'
import type { RecordedFlow } from './flowCollector'
it('sends and retains the same cutoff-limited day evidence without another model call',async()=>{
 const make=(at:string):RecordedFlow=>({version:1,moneyUnits:{cash:'raw',nonArb:'raw'},analyses:{},sample:{date:'2026-09-29',observedAt:at,values:{cash:1,futures:2,nonArb:3,totalNonArb:4,kospi:6000,kospiPct:0},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:'ok',fetchedAt:at,sourceAt:null,message:null}])) as any}})
 const record=make('2026-09-29T01:00:00Z')
 mocks.snapshots.mockResolvedValue([{payload:make('2026-09-29T00:00:00Z')},{payload:make('2026-09-29T02:00:00Z')}])
 mocks.json.mockResolvedValue(JSON.stringify({direction:'wait',summary:'test',reasons:['data'],risks:['missing'],invalidation:['next'],citations:[]}))
 await generateJudgment(record,[],15)
 expect(mocks.json).toHaveBeenCalledTimes(1)
 expect(mocks.json.mock.calls[0][3].record.dayContext).toEqual(record.dayContext)
 expect(record.dayContext?.observations).toBe(2)
 expect(record.dayContext?.points.every(p=>p.at<=record.sample.observedAt)).toBe(true)
})
