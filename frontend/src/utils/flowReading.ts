import type { FlowRecord } from '../types/marketFlow'

export function flowChangeTone(change: string) {
  if (/동일|자료 부족|균형/.test(change)) return 'neutral'
  if (/순매수 (규모 증가|전환)|순매도 규모 감소/.test(change)) return 'buy'
  if (/순매도 (규모 증가|전환)|순매수 규모 감소/.test(change)) return 'sell'
  return 'neutral'
}

export function flowTitle(row: FlowRecord | undefined, minutes: number) {
  const a = row?.analyses[String(minutes)]
  return a?.code === 'futures-only' ? '선물 순매수 · 현물 순매도' : a?.title || '비교 데이터 수집 중'
}
export function flowReading(row: FlowRecord | undefined, records: FlowRecord[], minutes: number) {
  const a = row?.analyses[String(minutes)]
  const end = Date.parse(row?.sample.observedAt || '')
  const previous = records.filter(r => r.sample.date === row?.sample.date && Date.parse(r.sample.observedAt) < end && end-Date.parse(r.sample.observedAt)<=90000).sort((x,y)=>x.sample.observedAt.localeCompare(y.sample.observedAt)).at(-1)
  const old = previous?.analyses[String(minutes)]
  const keys = ['cash','futures','nonArb'] as const
  const names = ['현물','선물','비차익']
  const changes = keys.map((key,i)=>{
    const now=a?.delta[key], before=old?.delta[key]
    if(now==null||before==null)return `${names[i]} 비교 자료 부족`
    if(now===0)return `${names[i]} 순매수·순매도 균형`
    if(before===0||Math.sign(now)!==Math.sign(before))return `${names[i]} ${now>0?'순매수':'순매도'} 전환`
    const trend=Math.abs(now)===Math.abs(before)?'동일':Math.abs(now)>Math.abs(before)?'규모 증가':'규모 감소'
    return `${names[i]} ${now>0?'순매수':'순매도'} ${trend}`
  })
  const state=keys.map((key,i)=>`${names[i]} ${a?.delta[key]==null?'확인 불가':a.delta[key]!>0?'순매수':a.delta[key]!<0?'순매도':'균형'}`).join(' · ')
  const delta=a?.delta.kospi
  const price=delta==null?'같은 구간 코스피 데이터 부족':`코스피 ${delta>0?'상승':delta<0?'하락':'보합'} ${delta>0?'+':''}${delta.toFixed(2)}pt`
  return {state,changes:changes.join(' · '),price,previousAt:previous?.sample.observedAt,
    checks:a?.checks || ['현물·비차익 방향과 같은 구간 코스피 반응 확인']}
}
