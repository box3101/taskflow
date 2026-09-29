import { expect,it } from 'vitest'
import { flowReading,flowTitle,flowChangeTone } from './flowReading'
it('colors changes in pressure rather than the sign alone',()=>{
 expect(flowChangeTone('현물 순매도 규모 감소')).toBe('buy')
 expect(flowChangeTone('선물 순매수 규모 감소')).toBe('sell')
 expect(flowChangeTone('선물 순매수 규모 증가')).toBe('buy')
 expect(flowChangeTone('비차익 순매도 규모 증가')).toBe('sell')
 expect(flowChangeTone('현물 순매도 동일')).toBe('neutral')
 expect(flowChangeTone('현물 비교 자료 부족')).toBe('neutral')
})
const row=(time:string,cash:number,futures:number)=>({sample:{date:'2026-09-29',observedAt:`2026-09-29T${time}:00+09:00`},analyses:{'5':{code:'futures-only',delta:{cash,futures,nonArb:-10,kospi:2},checks:[]}}}) as any
it('distinguishes positive net buying from growing buying',()=>{
 const before=row('14:48',-30,100),now=row('14:49',-20,45)
 expect(flowReading(now,[before,now],5).changes).toContain('선물 순매수 규모 감소')
 expect(flowReading(now,[before,now],5).changes).toContain('현물 순매도 규모 감소')
 expect(flowTitle(now,5)).toBe('선물 순매수 · 현물 순매도')
})
it('does not bridge missing observations or use future observations',()=>{
 const now=row('14:49',-20,45)
 expect(flowReading(now,[row('14:45',-30,100),row('14:50',1,2)],5).changes).toContain('비교 자료 부족')
})
