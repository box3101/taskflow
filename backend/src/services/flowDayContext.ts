import type { RecordedFlow } from './flowCollector'

// Compact chronological evidence. Never aggregate overlapping rolling deltas.
export function buildDayContext(record:RecordedFlow, records:RecordedFlow[]) {
  const cutoff=Date.parse(record.sample.observedAt)
  const rows=[...new Map([...records,record].filter(r=>r.sample.date===record.sample.date&&Number.isFinite(Date.parse(r.sample.observedAt))&&Date.parse(r.sample.observedAt)<=cutoff).map(r=>[r.sample.observedAt,r])).values()].sort((a,b)=>a.sample.observedAt.localeCompare(b.sample.observedAt))
  const gaps=rows.slice(1).flatMap((r,i)=>Date.parse(r.sample.observedAt)-Date.parse(rows[i].sample.observedAt)>90000?[{from:rows[i].sample.observedAt,to:r.sample.observedAt}]:[])
  // First observation per 15-minute bucket plus every observation in the last 15 minutes.
  const selected=new Map<string,RecordedFlow>()
  for(const r of rows){const bucket=String(Math.floor(Date.parse(r.sample.observedAt)/900000));if(!selected.has(bucket))selected.set(bucket,r)}
  const points=[...new Map([...selected.values(),...rows.filter(r=>cutoff-Date.parse(r.sample.observedAt)<=900000)].map(r=>[r.sample.observedAt,r])).values()].sort((a,b)=>a.sample.observedAt.localeCompare(b.sample.observedAt)).map(r=>({at:r.sample.observedAt,values:r.sample.values,moneyUnits:r.moneyUnits,status:Object.fromEntries(Object.entries(r.sample.sources).map(([k,v])=>[k,v.status]))}))
  const index=rows.filter(r=>r.sample.sources.kospi.status==='ok'&&r.sample.values.kospi!==null).map(r=>r.sample.values.kospi!)
  return {version:'day-context-v1',date:record.sample.date,cutoff:record.sample.observedAt,observations:rows.length,firstAt:rows[0]?.sample.observedAt,
    observedIndexRange:index.length?{low:Math.min(...index),high:Math.max(...index)}:null,gaps,points,
    limitations:['관측 시각은 수집 완료 시각이며 거래소 체결 시각이 아님', '표본 고저는 공식 일중 고저가 아님', 'raw 금액은 원·억원으로 임의 환산 금지', '비차익은 현물에 포함되므로 합산 금지', '누락·수집 공백은 0이 아님', '미결제약정·베이시스·개별 종목 외국인 수급은 미포함']}
}
export type DayContext=ReturnType<typeof buildDayContext>
