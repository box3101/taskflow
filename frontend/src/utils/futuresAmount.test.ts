import { expect, it } from 'vitest'
import { futuresAmountText } from './futuresAmount'
import type { FlowRecord } from '../types/marketFlow'
const make=(minute:string,buy:number|null,sell:number|null,unit='million')=>({sample:{date:'2026-10-01',observedAt:'2026-10-01T00:'+minute+':00Z',values:{kospi200:400},sources:{kospi200:{status:'ok'}},marketActivity:{futures:{amountUnit:unit,participants:{frgn:{buyAmount:buy,sellAmount:sell},orgn:{buyAmount:buy,sellAmount:sell},prsn:{buyAmount:buy,sellAmount:sell}}}}},analyses:{'5':{baselineAt:'2026-10-01T00:00:00Z'}}} as unknown as FlowRecord)
it('uses actual amount changes instead of contracts times price',()=>{
 const a=make('00',10000,9000),b=make('02',11000,9500),c=make('05',13000,10000)
 for(const who of ['frgn','orgn','prsn'] as const) expect(futuresAmountText(128,c,[a,b,c],5,who)).toMatchObject({text:'+20억',kind:'actual',value:20})
})
it('labels raw-unit fallback as approximate without contract counts',()=>{
 const c=make('05',13000,10000,'raw');expect(futuresAmountText(128,c,[],5)).toMatchObject({text:'약 +128억',kind:'estimated'})
})
it('does not invent an index for old records',()=>{
 const c=make('05',null,null);delete c.sample.values.kospi200
 expect(futuresAmountText(128,c,[],5).text).toBe('—')
})
it('rejects missing baselines, mixed units and collection gaps for actual changes',()=>{
 const a=make('00',10000,9000),c=make('05',13000,10000)
 expect(futuresAmountText(128,c,[a,c],5).kind).toBe('estimated')
 const b=make('02',11000,9500,'won');expect(futuresAmountText(128,c,[a,b,c],5).kind).toBe('estimated')
})
it('keeps a true zero and converts cumulative won amounts',()=>{
 const c=make('05',100000000,100000000,'won')
 expect(futuresAmountText(0,c,[],5,'frgn',true)).toMatchObject({text:'0억',kind:'actual'})
})
