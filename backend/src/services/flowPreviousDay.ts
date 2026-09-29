import type { RecordedFlow } from './flowCollector'
import { analyzeFlow, FlowKey, koreanClock } from './flowAnalysis'

// Background evidence only: use the last recorded session, never imply an official close.
export function buildPreviousDayContext(record:RecordedFlow,records:RecordedFlow[]) {
  const cutoff=Date.parse(record.sample.observedAt)
  const valid=records.filter(r=>{
    const at=Date.parse(r.sample.observedAt)
    if(!Number.isFinite(at)||at>=cutoff||r.sample.date>=record.sample.date)return false
    const k=koreanClock(new Date(at))
    return k.date===r.sample.date&&k.minute>=540&&k.minute<=930
  })
  const date=valid.map(r=>r.sample.date).sort().slice(-1)[0]
  if(!date)return null
  const rows=[...new Map(valid.filter(r=>r.sample.date===date).map(r=>[r.sample.observedAt,r])).values()].sort((a,b)=>a.sample.observedAt.localeCompare(b.sample.observedAt))
  const last=rows[rows.length-1],first=rows[0]
  const keys:FlowKey[]=['cash','futures','nonArb','totalNonArb','kospi']
  const finalValues=Object.fromEntries(keys.map(k=>[k,last.sample.sources[k]?.status==='ok'?last.sample.values[k]:null]))
  const reachedClose=koreanClock(new Date(last.sample.observedAt)).minute===930
  const analysis=analyzeFlow(last.sample,rows.map(r=>r.sample),30)
  const unitsStable=rows.filter(r=>analysis.baselineAt&&r.sample.observedAt>=analysis.baselineAt).every(r=>r.moneyUnits.cash===last.moneyUnits.cash&&r.moneyUnits.nonArb===last.moneyUnits.nonArb)
  const closing30m=reachedClose&&analysis.baselineAt&&unitsStable?{from:analysis.baselineAt,to:last.sample.observedAt,delta:analysis.delta}:null
  const indices=rows.filter(r=>r.sample.sources.kospi?.status==='ok'&&r.sample.values.kospi!==null).map(r=>r.sample.values.kospi!)
  const gaps=rows.slice(1).flatMap((r,i)=>Date.parse(r.sample.observedAt)-Date.parse(rows[i].sample.observedAt)>90000?[{from:rows[i].sample.observedAt,to:r.sample.observedAt}]:[])
  return {version:'previous-session-v1',date,calendarDaysBefore:(Date.parse(record.sample.date)-Date.parse(date))/86400000,
    observations:rows.length,firstAt:first.sample.observedAt,lastAt:last.sample.observedAt,reachedClose,
    finalObservedValues:finalValues,moneyUnits:last.moneyUnits,finalStatus:Object.fromEntries(keys.map(k=>[k,last.sample.sources[k]?.status||'missing'])),
    finalObservedKospiPct:last.sample.sources.kospi?.status==='ok'?last.sample.values.kospiPct:null,
    observedIndexRange:indices.length?{low:Math.min(...indices),high:Math.max(...indices)}:null,
    closing30m,gapCount:gaps.length,gaps:gaps.slice(-8),
    limitations:['가장 최근 기록이 있는 과거 거래일이며 직전 거래일임을 보장하지 않음','최종 수집값은 거래소 확정 종가·확정 수급이 아님',
      '전일은 배경 자료이며 오늘 가격·수급을 우선할 것','선물 순매수만으로 신규 매수·오버나잇 의도 또는 오늘 상승을 단정하지 말 것',
      'raw 금액의 임의 환산·현물과 비차익 합산 금지','수집 공백은 0이 아니며 미결제약정·베이시스·야간 뉴스는 미포함']}
}
export type PreviousDayContext=ReturnType<typeof buildPreviousDayContext>
