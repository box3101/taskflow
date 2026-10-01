import { expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({snapshots:vi.fn(),previous:vi.fn().mockResolvedValue(null),json:vi.fn()}))
vi.mock('../prisma',()=>({default:{flowSnapshot:{findMany:mocks.snapshots,findFirst:mocks.previous}}}))
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
 expect(record.previousDayContext).toBeNull()
})
it('passes prior-session summary in the same paid request and keeps it in the stored record',async()=>{
 mocks.json.mockClear()
 const make=(date:string,at:string):RecordedFlow=>({version:1,moneyUnits:{cash:'raw',nonArb:'raw'},analyses:{},sample:{date,observedAt:at,values:{cash:1,futures:2,nonArb:3,totalNonArb:4,kospi:6000,kospiPct:-1},sources:Object.fromEntries(['cash','futures','nonArb','totalNonArb','kospi'].map(k=>[k,{status:'ok',fetchedAt:at,sourceAt:null,message:null}])) as any}})
 const record=make('2026-09-30','2026-09-30T00:15:00Z')
 mocks.previous.mockResolvedValue({date:'2026-09-29'})
 mocks.snapshots.mockImplementation(async({where}:any)=>where.date==='2026-09-29'?[{payload:make('2026-09-29','2026-09-29T06:30:00Z')}]:[])
 await generateJudgment(record,[],15)
 expect(mocks.previous).toHaveBeenLastCalledWith({where:{date:{lt:'2026-09-30'}},orderBy:{date:'desc'},select:{date:true}})
 expect(record.previousDayContext?.date).toBe('2026-09-29')
 expect(mocks.json).toHaveBeenCalledTimes(1)
 expect(mocks.json.mock.calls[0][3].record.previousDayContext).toEqual(record.previousDayContext)
})

it('includes investor deltas in the same request, with explicit missing-data and unit guidance',async()=>{
 mocks.json.mockClear();mocks.json.mockResolvedValue(JSON.stringify({direction:'wait',summary:'test',reasons:['data'],risks:['missing'],invalidation:['next'],citations:[]}))
 const record:RecordedFlow={version:1,moneyUnits:{cash:'raw',nonArb:'raw'},dayContext:{} as any,previousDayContext:null,signals:{} as any,sample:{date:'2026-10-01',observedAt:'2026-10-01T01:48:00Z',values:{cash:-500,futures:10,nonArb:2,totalNonArb:3,kospi:6800,kospiPct:0,institutionCash:-1000,institutionFutures:50,individualCash:300,individualFutures:-10},sources:{} as any},analyses:{'5':{baselineAt:'2026-10-01T01:43:00Z',delta:{cash:-899,futures:-41,nonArb:1843,institutionCash:-22949,institutionFutures:-17,individualCash:3482,individualFutures:47,securitiesCash:-20000,fundCash:0}} as any,'15':{baselineAt:null,delta:{institutionCash:null}} as any}}
 await generateJudgment(record,[],15)
 expect(mocks.json).toHaveBeenCalledTimes(1)
 const call=mocks.json.mock.calls[0]
 expect(call[2]).toContain('institutionCash/institutionFutures')
 expect(call[2]).toContain('기관 합계에 더하지 않는다')
 expect(call[3].record.analyses['5'].delta).toMatchObject({securitiesCash:-20000,fundCash:0})
 expect(call[2]).toContain('개인 매수를 무조건 하락 신호로 보지 않는다')
 expect(call[3].record.analyses['5'].delta).toMatchObject({institutionCash:-22949,individualFutures:47})
 expect(call[3].record.analyses['15'].delta.institutionCash).toBeNull()
})
