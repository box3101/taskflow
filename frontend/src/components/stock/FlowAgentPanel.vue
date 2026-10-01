<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiEmpty, UiSelect, UiTable } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { FlowRecord, FlowReview } from '../../types/marketFlow'
import FlowExpertPanel from './FlowExpertPanel.vue'
import FlowSignalReview from './FlowSignalReview.vue'

const props = defineProps<{ date: string; record?: FlowRecord; refreshKey: string }>()
type Direction = 'up' | 'down' | 'neutral' | 'wait'
interface Evidence { usage?: 'historical-reference'; id: string; reportId: number; filename: string; date: string; page: number; text: string }
interface Prediction {
  referencePolicy?: {version:string;enabled:boolean;count:number}
  retrospective?: {status:string;actualDirection:string|null;note:string}
  id: number; horizon: number; variant: string; mode: string; model: string; version: string; generatedAt: string; eligible: boolean
  record: FlowRecord; judgment: { direction: Direction; summary: string; reasons: string[]; risks: string[]; invalidation: string[]; citations: string[] }
  evidence: Evidence[]; review: FlowReview; ruleReview: FlowReview; evaluationAt: string | null
  validationContext?: { status: 'ready' | 'insufficient' | 'unavailable'; percentile: number | null; band: 'upper' | 'middle' | 'lower' | null; samples: { date: string }[] }
}
interface Stats {
  horizon: number; total: number; live: number; replay: number; evaluated: number; observed: number; abstained: number
  pending: number; missing: number; closed: number; accuracy: number | null; coverage: number | null
  paired: number; pairedAiAccuracy: number | null; ruleAccuracy: number | null
}
interface Report { id: number; date: string; filename: string; ragStatus: string; ragError: string | null }
interface Comparison {
  horizon: number; totalPairs: number; observedPairs: number; noPdfPairs: number; commonDirectional: number
  commonAccuracy: { rule: number | null; flow: number | null; rag: number | null }
  methods: { key: string; label: string; observed: number; evaluated: number; accuracy: number | null; coverage: number | null; abstentionRate: number | null }[]
}
interface AutoReview {key:string;model:string;version:string;variant:string;horizon:number;live:number;replay:number;observed:number;evaluated:number;abstained:number;accuracy:number|null;coverage:number|null;paired:number;pairedAiAccuracy:number|null;pairedRuleAccuracy:number|null}
const reviewColumns=[{key:'method',label:'모델·버전 / 구성'},{key:'horizon',label:'분 후'},{key:'evaluated',label:'방향 평가'},{key:'accuracyText',label:'적중률'},{key:'coverageText',label:'판단 비율'},{key:'pairedText',label:'공통 AI / 규칙'}]
const reviewRows=computed(()=>(state.value?.autoReview||[]).map(r=>({...r,method:r.model+' · '+r.version+' · '+variantLabel(r.variant),accuracyText:percent(r.accuracy),coverageText:percent(r.coverage),pairedText:r.paired+'건 · '+percent(r.pairedAiAccuracy)+' / '+percent(r.pairedRuleAccuracy)})))
const state = ref<{ futuresPairs?: {key:string;observedAt:string;horizon:number;A:Prediction;B:Prediction}[]; autoReview?: AutoReview[]; configured: boolean; rows: Prediction[]; stats: Stats[]; flowStats: Stats[]; comparison: Comparison[]; reports: Report[] } | null>(null)
const automation = ref<{ enabled: boolean; configured?: boolean; hours?: string; maxCallsPerDay?: number; reservedCalls?: number; jobs?: { slot: number; status: string; message: string | null }[] } | null>(null)
const automationError = ref('')
const closeReview = ref<{payload:{status:string;date:string;summary:string|null;generatedAt?:string;metrics:{key:string;version:string;variant:string;horizon:number;reaction:string;timeBand:string;scored:number;matched:number;held:number;missing:number;closed:number}[];limitations:string[]};createdAt:string}|null>(null)
const closeReviewError=ref('')
const comparisonColumns = [{ key: 'label', label: '구성' }, { key: 'accuracyText', label: '적중률' }, { key: 'coverageText', label: '판단 비율' }, { key: 'abstentionText', label: '보류·중립 비율' }, { key: 'evaluated', label: '방향 평가 건수' }]
function comparisonRows(c: Comparison) { return c.methods.map(m => ({ ...m, accuracyText: percent(m.accuracy), coverageText: percent(m.coverage), abstentionText: percent(m.abstentionRate) })) }
const horizon = ref(15)
const loading = ref(false)
const running = ref(false)
const indexing = ref<number | null>(null)
const error = ref('')
const expanded = ref<number | null>(null)
let version = 0
let disposed = false
let controller: AbortController | undefined
const labels: Record<Direction, string> = { up: '상승', down: '하락', neutral: '중립', wait: '판단 보류' }
function variantLabel(v:string) { return ({'cash-a':'A · 현물+가격','futures-b':'B · 현물+가격+선물',flow:'수급만',rag:'수급+PDF'} as Record<string,string>)[v] || v }
const abColumns=[{key:'time',label:'관측 / 평가'},{key:'a',label:'A 현물·가격'},{key:'b',label:'B +선물'},{key:'outcome',label:'지수 결과'}]
const abSummaries=computed(()=>[15,30].map(h=>{
 const pairs=(state.value?.futuresPairs||[]).filter(p=>p.horizon===h&&p.A.eligible&&p.B.eligible&&p.A.review.state==='observed'&&p.B.review.state==='observed')
 const metric=(rows:Prediction[])=>{const judged=rows.filter(r=>r.review.matched!==null);return judged.filter(r=>r.review.matched).length+'/'+judged.length+'건 일치 · 보류 '+(rows.length-judged.length)+'/'+rows.length}
 const common=pairs.filter(p=>p.A.review.matched!==null&&p.B.review.matched!==null)
 const extra=pairs.filter(p=>p.A.review.matched===null&&p.B.review.matched!==null)
 return {h,text:'완료 '+pairs.length+'쌍 · A '+metric(pairs.map(p=>p.A))+' · B '+metric(pairs.map(p=>p.B)),common:'둘 다 방향 판단 '+common.length+'쌍: A '+metric(common.map(p=>p.A))+' · B '+metric(common.map(p=>p.B)),extra:'A 보류 / B 방향 '+metric(extra.map(p=>p.B))}
}))
const abRows=computed(()=>(state.value?.futuresPairs||[]).map(p=>({key:p.key,time:formatTime(p.observedAt)+' / '+p.horizon+'분',a:labels[p.A.judgment.direction]+' · '+abResult(p.A),b:labels[p.B.judgment.direction]+' · '+abResult(p.B),outcome:percent(p.A.review.returnPct)})))
function abResult(p:Prediction){return p.review.state!=='observed'?'평가 대기·자료 부족':p.review.matched===null?'채점 제외':p.review.matched?'일치':'불일치'}
const options = [{ value: 15, label: '15분 후' }, { value: 30, label: '30분 후' }]
const isReplay = computed(() => !props.record || props.date !== new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10) || Date.now() - Date.parse(props.record.sample.observedAt) > 90_000)
const formatTime = (s: string) => new Date(s).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
const percent = (v: number | null) => v === null ? '—' : `${v.toFixed(1)}%`
const distributionLabels = { upper: '상위권 (80백분위 이상)', middle: '중간권', lower: '하위권 (20백분위 이하)' }
const distributionColumns = [{ key: 'method', label: '판단' }, { key: 'horizon', label: '분 후' }, { key: 'band', label: '현물 누적 순매수 수준' }, { key: 'evaluated', label: '방향 평가' }, { key: 'accuracy', label: '적중률' }, { key: 'abstained', label: '중립·보류' }]
const distributionRows = computed(() => {
  const rows = state.value?.rows || []
  return ['flow', 'rag'].flatMap(variant => [15, 30].flatMap(horizon => (['upper', 'middle', 'lower'] as const).map(band => {
    const observed = rows.filter(r => r.variant === variant && r.horizon === horizon && r.eligible && r.review.state === 'observed' && r.validationContext?.status === 'ready' && r.validationContext.band === band)
    const scored = observed.filter(r => r.review.matched !== null)
    return { key: `${variant}-${horizon}-${band}`, method: variant === 'flow' ? '수급만' : '수급 + PDF', horizon, band: distributionLabels[band], evaluated: scored.length,
      accuracy: percent(scored.length ? scored.filter(r => r.review.matched).length / scored.length * 100 : null), abstained: observed.length - scored.length, observed: observed.length }
  }))).filter(r => r.observed > 0)
})
function distributionText(row: Prediction) {
  const context = row.validationContext
  if (!context) return '동시간대 비교: 저장 전 기록'
  if (context.status === 'unavailable') return '동시간대 비교: 자료 조회 실패'
  if (context.status !== 'ready' || !context.band) return `동시간대 비교: 자료 부족 (${context.samples.length}/최소 10일)`
  return `외국인 현물 누적 순매수: ${distributionLabels[context.band]} · ${context.percentile!.toFixed(1)}백분위 · 비교 ${context.samples.length}일`
}
function outcome(review: FlowReview) {
  if (review.state !== 'observed') return { pending: '관측 대기', missing: '결과 누락', closed: '장 종료' }[review.state]
  return `${review.returnPct!.toFixed(2)}% · ${review.matched === null ? '방향 평가 제외' : review.matched ? '일치' : '불일치'}`
}
async function load() {
  const request = ++version
  controller?.abort(); controller = new AbortController()
  loading.value = true
  try {
    const response = await api.get('/market-flow/agent', { params: { date: props.date }, signal: controller.signal })
    if (request !== version || disposed) return
    state.value = response.data.data
    try { const recap=await api.get('/market-flow/agent/close-review',{params:{date:props.date},signal:controller.signal});if(request===version&&!disposed){closeReview.value=recap.data.data;closeReviewError.value=''} } catch {if(request===version&&!disposed)closeReviewError.value='장 마감 복기를 불러오지 못했습니다.'}
    error.value = ''
    try {
      const auto = await api.get('/market-flow/agent/automation', { params: { date: props.date }, signal: controller.signal })
      if (request === version && !disposed) { automation.value = auto.data.data; automationError.value = '' }
    } catch {
      if (request === version && !disposed) { automation.value = null; automationError.value = '자동 실행 상태를 확인하지 못했습니다.' }
    }
  } catch (e: any) {
    if (request === version && !disposed && e.code !== 'ERR_CANCELED') { state.value = null; error.value = e.response?.data?.message || 'AI 기록을 불러오지 못했습니다.' }
  } finally { if (request === version && !disposed) loading.value = false }
}
async function run() {
  if (!props.record || running.value) return
  running.value = true; error.value = ''
  const date = props.date
  try {
    await api.post('/market-flow/agent/compare', { snapshotId: props.record.id, horizon: horizon.value }, { timeout: 125_000 })
    if (!disposed && props.date === date) await load()
  } catch (e: any) { if (!disposed && props.date === date) error.value = e.response?.data?.message || 'AI 판단 요청에 실패했습니다. 새로고침하여 저장 여부를 확인하세요.' }
  finally { running.value = false }
}
async function index(report: Report) {
  indexing.value = report.id; error.value = ''
  const date = props.date
  try {
    await api.post(`/market-flow/reports/${report.id}/index`, {}, { timeout: 30_000 })
    if (!disposed && date === props.date) await load()
  } catch (e: any) { if (!disposed && date === props.date) error.value = e.response?.data?.message || 'PDF 검색 준비에 실패했습니다.' }
  finally { indexing.value = null }
}
watch(() => props.date, () => { state.value = null; closeReview.value = null; closeReviewError.value = ''; expanded.value = null; void load() }, { immediate: true })
watch(() => props.refreshKey, () => { void load() })
onUnmounted(() => { disposed = true; version++; controller?.abort() })
</script>

<template>
  <section class="agent-panel">
    <div class="heading">
      <div><h2>기본 판단 · Claude Sonnet</h2><p>수급 변화와 PDF 근거를 함께 읽고, 이후 코스피 움직임으로 검증합니다.</p></div>
      <div class="actions">
        <UiSelect v-model="horizon" :options="options" label="예측 구간" label-hidden size="sm" class="horizon" />
        <UiButton size="sm" :loading="running" :disabled="!state?.configured || !record || loading || running" @click="run">{{ isReplay ? '과거 기록 비교' : '수급 / PDF 비교 실행' }}</UiButton>
        <UiButton size="sm" variant="outline" :loading="loading" @click="load">새로고침</UiButton>
      </div>
    </div>
    <p v-if="record" class="context">입력 관측: {{ date }} {{ formatTime(record.sample.observedAt) }} · 최근 15분 수급으로 {{ horizon }}분 후 방향 판단</p>
    <p class="note">기본 판단 실행 시 수급·당일 PDF 근거·최대 2개의 과거 참고 사례가 Claude Sonnet에 전달됩니다. 관측 이후 업로드된 PDF는 사용하지 않습니다. 과거 분석은 실시간 예측 성적에 포함하지 않습니다.</p>
    <UiAlert v-if="error" variant="error" :description="error" role="alert" />
    <UiAlert v-if="state && !state.reports.length" variant="info" title="오늘 장전 리포트 없음" :description="date + '에 등록된 PDF가 없습니다. 당일 근거로 대체하지 않으며, 과거 사례는 별도 참고용으로만 사용합니다.'" />
    <UiAlert v-if="automationError" variant="info" :description="automationError" />
    <div v-if="automation?.enabled" class="comparison-panel">
      <h3>서버 자동 분석 · 15분 판단 / 30분 A·B 비교</h3>
      <p>거래일 {{ automation.hours }} · 15분 간격 · 하루 최대 {{ automation.maxCallsPerDay }}회 · 노트북과 브라우저를 꺼도 실행</p>
      <p class="note">조회 날짜가 같고 관측 전에 업로드되어 검색 준비가 완료된 PDF에서 관련 발췌문을 최대 6개 참고합니다. PDF는 배경 자료이며 실제 가격·수급을 우선합니다. 당일 자료가 없으면 이를 표시하고, 과거 사례는 오늘 신호와 구분해 참고합니다.</p>
      <p>조회일 실행 예약 {{ automation.reservedCalls }}회(실패 포함) · 데이터 누락·수집 지연 시 생략 · Claude API 비용 별도</p>
      <p v-if="!automation.configured">API 연결 설정이 필요합니다.</p>
      <p v-if="automation.jobs?.length">최근 실행: {{ Math.floor(automation.jobs[0].slot / 60) }}:{{ String(automation.jobs[0].slot % 60).padStart(2, '0') }} · {{ ({ running: '생성 중', completed: '저장 완료', failed: '실패', skipped: '생략', interrupted: '중단 · 자동 재시도 없음' } as Record<string, string>)[automation.jobs[0].status] || automation.jobs[0].status }} {{ automation.jobs[0].message }}</p>
    </div>
    <UiAlert v-if="state && !state.configured" variant="info" title="AI 연결 설정이 필요합니다" description="서버에 Claude API 키를 설정하면 판단을 생성할 수 있습니다." />
    <UiEmpty v-if="!record" title="분석할 수급 기록이 없습니다" description="장중 수급 관측이 저장되면 AI 판단을 생성할 수 있습니다." />

    <section v-for="c in state?.comparison" :key="c.horizon" class="comparison-panel">
      <h3>{{ c.horizon }}분 후 · 같은 관측에서 PDF 효과 비교</h3>
      <UiTable :columns="comparisonColumns" :data="comparisonRows(c)" row-key="key" />
      <p class="note">실시간 비교 {{ c.totalPairs }}쌍 · 결과 관측 {{ c.observedPairs }}쌍 · PDF 근거 없음 {{ c.noPdfPairs }}쌍(효과 비교 제외)</p>
      <p class="note">세 방식 모두 방향을 제시한 {{ c.commonDirectional }}쌍: 규칙 {{ percent(c.commonAccuracy.rule) }} · 수급만 {{ percent(c.commonAccuracy.flow) }} · 수급+PDF {{ percent(c.commonAccuracy.rag) }}</p>
    </section>
    <p class="note">같은 Sonnet·관측·예측 구간으로 2회 분석하며 PDF 제공 여부만 바꿉니다. 두 응답이 모두 완료된 뒤의 동일 가격부터 평가합니다. 수급을 주된 근거로 쓰고, PDF는 배경·반대 근거로 사용합니다. 애매하면 보류하며 AI가 규칙보다 우수하다고 가정하지 않습니다.</p>

    <div class="stats">
      <article v-for="s in state?.flowStats" :key="`flow-${s.horizon}`">
        <h3>수급만 · {{ s.horizon }}분 후 · {{ date }}</h3>
        <strong>{{ percent(s.accuracy) }} <small>방향 적중률</small></strong>
        <p>평가 {{ s.evaluated }}건 · 판단 비율 {{ percent(s.coverage) }} · 중립/보류 {{ s.abstained }}건</p>
        <p>대기 {{ s.pending }} · 누락 {{ s.missing }} · 장 종료 {{ s.closed }}</p>
        <div class="comparison">공통 {{ s.paired }}건 비교: AI {{ percent(s.pairedAiAccuracy) }} / 규칙 {{ percent(s.ruleAccuracy) }}</div>
      </article>
      <article v-for="s in state?.stats" :key="s.horizon">
        <h3>수급 + PDF · {{ s.horizon }}분 후 · {{ date }}</h3>
        <strong>{{ percent(s.accuracy) }} <small>방향 적중률</small></strong>
        <p>평가 {{ s.evaluated }}건 · 판단 비율 {{ percent(s.coverage) }} · 중립/보류 {{ s.abstained }}건</p>
        <p>대기 {{ s.pending }} · 누락 {{ s.missing }} · 장 종료 {{ s.closed }} · 과거 분석 {{ s.replay }}</p>
        <div class="comparison">공통 {{ s.paired }}건 비교: AI {{ percent(s.pairedAiAccuracy) }} / 규칙 {{ percent(s.ruleAccuracy) }}</div>
      </article>
    </div>
    <p class="note">실시간 성적은 AI 생성 이후 첫 관측 가격부터 계산합니다. 중립·보류는 적중률에서 제외합니다. 표본이 겹칠 수 있으며, 표시된 지수 변화율은 매매 수익률이 아닙니다.</p>

    <section class="comparison-panel">
      <h3>동시간대 수급 수준별 검증 · {{ date }}</h3>
      <p class="note">외국인 현물 누적 순매수를 최근 기록일 최대 20일의 같은 시각과 비교합니다(최근 60일 이내, 시각 차이 최대 90초). 같은 단위의 유효 표본 10일 이상에서만 분류합니다. 높은 백분위는 상대적으로 큰 순매수 값이며, 순매수 여부나 상승 확률을 뜻하지 않습니다.</p>
      <UiTable v-if="distributionRows.length" :columns="distributionColumns" :data="distributionRows" row-key="key" />
      <UiEmpty v-else description="수급 수준이 저장된 실시간 판단과 이후 지수 관측이 쌓이면 비교 결과가 표시됩니다." />
      <p class="note">AI 입력에 사용하지 않는 검증용 기록입니다. 조회일의 결과만 집계하며 과거 재실행·자료 부족은 제외합니다. 중립·보류는 적중률에서 제외합니다. 표본이 적거나 구간이 겹치므로 차이를 예측력 개선의 증거로 단정하지 않습니다.</p>
    </section>
    <section class="comparison-panel">
      <h3>선물 포함 여부 · A/B 비교</h3>
      <p class="note">09:30부터 30분마다 A(현물·가격) / B(+선물)를 독립 호출합니다. 비교 시에는 양쪽 모두 PDF·과거 요약을 제외합니다. 사이 15분 판단은 기존 PDF·복기 참고 방식을 유지합니다. 하루 최대 39회 + 마감 요약 1회. 둘 다 완료된 뒤 같은 가격부터 15·30분을 채점합니다.</p>
      <p class="note">관망·보류는 오답이 아닙니다. 겹치는 결과 구간과 작은 표본으로 선물의 효과를 단정하지 않습니다.</p>
      <p v-for="s in abSummaries" :key="s.h" class="note">{{ s.h }}분: {{ s.text }}<br />{{ s.common }}<br />{{ s.extra }}</p>
      <UiTable :columns="abColumns" :rows="abRows" empty-text="완료된 실시간 A/B 쌍이 아직 없습니다." />
      <h3>자동 복기 · 모델 버전별 검증</h3>
      <UiTable v-if="reviewRows.length" :columns="reviewColumns" :data="reviewRows" row-key="key" />
      <UiEmpty v-else description="저장된 판단과 이후 관측으로 자동 계산합니다. 추가 AI 호출은 없습니다." />
      <p class="note">AI 응답 후 첫 관측부터 평가합니다. 중립·보류·과거 재생은 방향 적중률에서 제외하며, 규칙 비교는 둘 다 방향을 제시한 같은 관측만 사용합니다. 버전별 날짜·장세가 달라 단순 적중률 차이는 개선의 증거가 아닙니다. 입력 자료 저장은 다음 새 판단부터 적용됩니다.</p>
    </section>
    <FlowExpertPanel :date="date" :record="record" :refresh-key="refreshKey" />
    <section class="comparison-panel">
      <h3>장 마감 자동 복기 → 다음 거래일 참고</h3>
      <p class="note">서버 자동 분석이 켜져 있으면 15:40 이후 하루 한 번 집계하고 Sonnet이 요약합니다. 최대 추가 1회 호출 · 실패 시 자동 재호출 없음. 다음 거래일에는 관측 전에 완성된 과거 요약만 참고하며 규칙을 자동 변경하지 않습니다.</p>
      <p v-if="closeReviewError" role="alert">{{ closeReviewError }}</p>
      <template v-else-if="closeReview">
        <p>{{ ({completed:'복기 완료',failed:'AI 요약 실패 · 통계만 보존',skipped:'채점 가능한 기록 없음',running:'실행 중 · 중단된 실행은 자동 재시도하지 않음'} as Record<string,string>)[closeReview.payload.status] }}</p>
        <p v-if="closeReview.payload.summary">{{ closeReview.payload.summary }}</p>
        <details v-if="closeReview.payload.metrics.length"><summary>버전·구성·가격 반응별 집계 보기</summary><p v-for="m in closeReview.payload.metrics" :key="m.key" class="note">{{ m.version }} · {{ m.variant }} · {{ m.horizon }}분 · {{ m.timeBand }} · {{ m.reaction }}: {{ m.matched }}/{{ m.scored }}건 일치 · 보류 {{ m.held }} · 누락 {{ m.missing }} · 장 종료 {{ m.closed }}</p></details>
        <p class="note">15분 판단의 30분 지속 평가가 포함됩니다. 방향 적중률은 매매 승률이 아니며 작은 표본에서 실패 원인을 확정하지 않습니다.</p>
      </template>
      <p v-else class="note">선택 날짜의 장 마감 복기가 아직 없습니다.</p>
    </section>
    <h3>저장된 기본 판단과 근거</h3>
    <UiEmpty v-if="state && !state.rows.length" description="아직 저장된 AI 판단이 없습니다. 판단 생성 후 결과와 근거가 여기에 남습니다." />
    <article v-for="row in state?.rows" :key="row.id" class="prediction">
      <div class="heading">
        <div class="actions"><UiBadge>{{ variantLabel(row.variant) }}</UiBadge><UiBadge :variant="row.judgment.direction === 'up' ? 'success' : row.judgment.direction === 'down' ? 'warning' : 'default'">{{ labels[row.judgment.direction] }}</UiBadge><span>{{ formatTime(row.record.sample.observedAt) }} → {{ row.horizon }}분 후</span><UiBadge v-if="!row.eligible" size="xs">과거 분석 · 성적 제외</UiBadge></div>
        <span class="result">{{ outcome(row.review) }}</span>
      </div>
      <h4>{{ row.judgment.summary }}</h4>
      <FlowSignalReview :signals="row.record.signals" :error="row.record.signalsError" :retrospective="row.retrospective" />
      <p class="note">{{ distributionText(row) }} · 검증용 / AI 미제공</p>
      <ul><li v-for="reason in row.judgment.reasons" :key="reason">{{ reason }}</li></ul>
      <div class="conditions"><div><h4>반대 신호</h4><ul><li v-for="risk in row.judgment.risks" :key="risk">{{ risk }}</li></ul></div><div><h4>판단을 바꿀 조건</h4><ul><li v-for="condition in row.judgment.invalidation" :key="condition">{{ condition }}</li></ul></div></div>
      <p class="note">생성 {{ formatTime(row.generatedAt) }} · 평가 시작 {{ row.evaluationAt ? formatTime(row.evaluationAt) : '관측 대기' }} · {{ row.model }} · {{ row.version }} · 규칙 결과: {{ outcome(row.ruleReview) }}</p>
      <p v-if="row.evidence.some(source => source.date !== row.record.sample.date && source.usage !== 'historical-reference')" class="note">과거 리포트를 참고한 기존 판단입니다. 아래 자료 기준일을 확인하세요. 새 판단은 당일 근거와 과거 참고 사례를 구분합니다.</p>
      <UiButton v-if="row.evidence.some(e => e.usage !== 'historical-reference')" size="xs" variant="ghost" @click="expanded = expanded === row.id ? null : row.id">{{ expanded === row.id ? '근거 접기' : `당일 근거 ${row.evidence.filter(e => e.usage !== 'historical-reference').length}개 보기` }}</UiButton>
      <p v-else class="note">{{ ['cash-a','futures-b'].includes(row.variant) ? '선물 효과 비교: PDF·과거 요약 없이 동일 현물·가격 입력, B에만 선물을 추가했습니다.' : row.variant === 'flow' ? '비교 기준: PDF를 제공하지 않고 수급만 분석했습니다.' : '오늘 장전 리포트 근거 없음 · 과거 사례는 당일 근거를 대체하지 않습니다.' }}</p>
      <div v-if="expanded === row.id" class="evidence">
        <blockquote v-for="source in row.evidence.filter(e => e.usage !== 'historical-reference')" :key="source.id"><strong>{{ source.filename }} · {{ source.page }}쪽 · 자료 기준일 {{ source.date }} <span v-if="row.judgment.citations.includes(source.id)">· AI 인용</span></strong><p>{{ source.text }}</p></blockquote>
      </div>
      <details v-if="row.record.priorAiReview"><summary>이번 판단에 전달된 이전 복기 · {{ row.record.priorAiReview.date }}</summary><p>{{ row.record.priorAiReview.summary || 'AI 요약 없이 집계 통계만 참고했습니다.' }}</p><p class="note">{{ row.record.priorAiReview.limitations.join(' · ') }}</p></details>
      <p v-if="row.referencePolicy" class="note">사례 검색 {{ row.referencePolicy.enabled ? '켬' : '끔' }} · {{ row.referencePolicy.version }} · 제공 {{ row.referencePolicy.count }}개</p>
      <details v-if="row.evidence.some(e => e.usage === 'historical-reference')" class="evidence"><summary>과거 참고 사례 {{ row.evidence.filter(e => e.usage === 'historical-reference').length }}개 · 오늘 신호 아님</summary><blockquote v-for="source in row.evidence.filter(e => e.usage === 'historical-reference')" :key="source.id"><strong>{{ source.date }} · {{ source.filename }} · {{ source.page }}쪽</strong><p>{{ source.text }}</p></blockquote></details>
    </article>
    <h3>PDF 검색 준비</h3>
    <p class="note">아래에 PDF를 첨부한 뒤 검색 준비를 실행하세요. 텍스트 PDF 최대 100페이지를 지원합니다. 조회 날짜와 같은 날의 자료에서만 관련 문단을 찾습니다. 과거 자료는 사례·판단 틀로만 별도 검색합니다.</p>
    <div v-for="report in state?.reports" :key="report.id" class="report">
      <div><strong>{{ report.filename }}</strong><p>{{ report.date }} · {{ report.ragStatus === 'ready' ? '검색 준비 완료' : report.ragStatus === 'error' ? report.ragError : '검색 준비 필요' }}</p></div>
      <UiButton v-if="report.ragStatus !== 'ready'" variant="outline" size="sm" :disabled="indexing !== null" :loading="indexing === report.id" @click="index(report)">{{ report.ragStatus === 'error' ? '다시 준비' : '검색 준비' }}</UiButton>
    </div>
    <p v-if="state && !state.reports.length" class="note">오늘 장전 리포트 없음 · 조회 날짜에 등록된 PDF가 없습니다. 과거 사례는 별도로 표시합니다.</p>
  </section>
</template>

<style scoped>
.agent-panel { display: flex; flex-direction: column; gap: 16px; padding: 22px; border: 1px solid #e0e6f2; border-radius: 14px; background: #fff; min-width: 0; }
.heading, .actions, .report { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.actions { justify-content: flex-start; }
h2, h3, h4, p { margin: 0; }
h2 { font-size: 19px; } h3 { font-size: 14px; } h4 { font-size: 13px; line-height: 1.7; }
p, li, .context { font-size: 12px; line-height: 1.8; }
.heading p, .note, .report p { color: #7d889f; font-size: 12px; }
.horizon { width: 116px; }
.context { color: #4f6af6; }
.stats, .conditions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.stats article { border: 1px solid #e4e9f5; border-radius: 10px; padding: 16px; background: #f8faff; }
.stats strong { display: block; font-size: 28px; margin: 12px 0; }
.stats small { font-size: 11px; color: #7d889f; font-weight: 400; }
.comparison { margin-top: 10px; border-top: 1px solid #e4e9f5; padding-top: 10px; font-size: 12px; }
.comparison-panel { display: grid; gap: 10px; min-width: 0; overflow-x: auto; }
.comparison-panel :deep(table) { min-width: 600px; }
.prediction { border: 1px solid #e6ebf3; border-radius: 10px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.prediction span, .report strong { font-size: 12px; }
.prediction ul { margin: 0; padding-left: 18px; color: #56647f; }
.conditions { padding: 12px; border-radius: 8px; background: #fafbfe; }
.conditions h4 { margin-bottom: 6px; }
blockquote { margin: 8px 0 0; border-left: 3px solid #c5cff8; padding: 10px 14px; background: #f7f9fd; font-size: 12px; overflow-wrap: anywhere; }
.report { border-top: 1px solid #edf0f6; padding-top: 12px; overflow-wrap: anywhere; }
@media (max-width: 700px) { .agent-panel { padding: 16px; } .stats, .conditions { grid-template-columns: 1fr; } }
</style>
