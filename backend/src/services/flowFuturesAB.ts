import type { RecordedFlow } from './flowCollector'
import { basicModel, judgmentSchema, modelJson } from './flowModels'
import { parseJudgment, evaluatePrediction, type StoredPrediction } from './flowAgent'
import type { FlowSample } from './flowAnalysis'

export const FUTURES_AB_VERSION = 'futures-ab-v1'
export const isFuturesABSlot = (slot: number) => slot >= 570 && slot <= 930 && slot % 30 === 0
const cashKeys = ['cash', 'institutionCash', 'individualCash', 'securitiesCash', 'fundCash', 'nonArb', 'totalNonArb', 'kospi', 'kospiPct']
const futuresKeys = ['futures', 'institutionFutures', 'individualFutures']
// Allowlist only numerical observations: no derived titles, PDF, past summaries or hidden futures features.
export function futuresABInput(record: RecordedFlow, arm: 'A' | 'B') {
  const keys = arm === 'B' ? [...cashKeys, ...futuresKeys] : cashKeys
  const pick = (values: object) => Object.fromEntries(keys.filter(k => k in values).map(k => [k, (values as Record<string, unknown>)[k]]))
  return { date: record.sample.date, observedAt: record.sample.observedAt, moneyUnits: record.moneyUnits,
    values: pick(record.sample.values), sources: Object.fromEntries(keys.filter(k => k in record.sample.sources).map(k => [k, {status: (record.sample.sources as any)[k]?.status}])),
    windows: Object.fromEntries(Object.entries(record.analyses).map(([window, a]) => [window, { baselineAt: a.baselineAt, delta: pick(a.delta) }])) }
}
export async function generateFuturesAB(record: RecordedFlow, arm: 'A' | 'B') {
  const config = basicModel()
  const input = futuresABInput(record, arm)
  const prompt = '코스피의 관측 이후 15분 방향을 판단한다. 제공된 수치만 사용한다. 누적값과 구간 변화는 다르며 겹친 구간을 합산하지 않는다. 현물 단위는 moneyUnits, 선물이 제공되면 계약 수다. 현물과 선물을 합산하지 않는다. 비차익·기관 세부 분류는 현물에 포함되므로 중복 합산하지 않는다. raw 단위를 억원으로 추정하지 않는다. 투자자 현물의 동행·충돌과 실제 가격 반응을 함께 확인한다. 선물 순매수만으로 상승이나 신규 매수를 단정하지 않는다. 제공되지 않은 자료는 추정하지 않는다. 약하거나 충돌하는 근거는 neutral 또는 wait로 보류한다. 필수 현물·가격 자료 부족은 wait다. summary 150자 이하, reasons/risks/invalidation 각각 1~2개 80자 이하, citations는 빈 배열. direction은 up/down/neutral/wait. 미래 정보와 외부 지식을 보충하지 않는다.'
  const judgment = parseJudgment(await modelJson('anthropic', config.model, prompt, {horizon:15, ...input}, judgmentSchema, 3072, 'disabled'), [])
  if (!record.analyses['15']?.baselineAt || ['cash','institutionCash','kospi'].some(k => (record.sample.sources as any)[k]?.status !== 'ok' || (record.sample.values as any)[k] == null || (record.analyses['15'].delta as any)[k] == null)) judgment.direction = 'wait'
  return judgment
}
export function evaluateFuturesPairs(predictions: (StoredPrediction & {snapshotId:number})[], samples: FlowSample[], now = new Date()) {
  return predictions.filter(p => p.variant === 'cash-a' && p.version === FUTURES_AB_VERSION).flatMap(a => {
    const b = predictions.find(p => p.variant === 'futures-b' && p.snapshotId === a.snapshotId && p.model === a.model && p.version === a.version)
    if (!b || a.mode !== 'live' || b.mode !== 'live') return []
    const ap = a.payload as any, bp = b.payload as any
    if (!ap.comparisonId || ap.comparisonId !== bp.comparisonId || ap.generatedAt !== bp.generatedAt) return []
    return [15,30].map(horizon => {
      const A = evaluatePrediction({...a,horizon}, samples, now), B = evaluatePrediction({...b,horizon}, samples, now)
      return {key: ap.comparisonId+'-'+horizon, observedAt:ap.record.sample.observedAt, horizon, A, B}
    })
  })
}
