<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiEmpty, UiSelect, UiTable } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { FlowRecord, FlowReview } from '../../types/marketFlow'
import FlowExpertPanel from './FlowExpertPanel.vue'

const props = defineProps<{ date: string; record?: FlowRecord; refreshKey: string }>()
type Direction = 'up' | 'down' | 'neutral' | 'wait'
interface Evidence { id: string; reportId: number; filename: string; date: string; page: number; text: string }
interface Prediction {
  id: number; horizon: number; variant: string; mode: string; model: string; version: string; generatedAt: string; eligible: boolean
  record: FlowRecord; judgment: { direction: Direction; summary: string; reasons: string[]; risks: string[]; invalidation: string[]; citations: string[] }
  evidence: Evidence[]; review: FlowReview; ruleReview: FlowReview; evaluationAt: string | null
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
const state = ref<{ configured: boolean; rows: Prediction[]; stats: Stats[]; flowStats: Stats[]; comparison: Comparison[]; reports: Report[] } | null>(null)
const automation = ref<{ enabled: boolean; configured?: boolean; hours?: string; maxCallsPerDay?: number; reservedCalls?: number; jobs?: { slot: number; status: string; message: string | null }[] } | null>(null)
const automationError = ref('')
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
const options = [{ value: 15, label: '15분 후' }, { value: 30, label: '30분 후' }]
const isReplay = computed(() => !props.record || props.date !== new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10) || Date.now() - Date.parse(props.record.sample.observedAt) > 90_000)
const formatTime = (s: string) => new Date(s).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
const percent = (v: number | null) => v === null ? '—' : `${v.toFixed(1)}%`
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
watch(() => props.date, () => { state.value = null; expanded.value = null; void load() }, { immediate: true })
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
    <p class="note">기본 판단 실행 시 수급과 검색된 PDF 발췌문이 Claude Sonnet에 전달됩니다. 관측 이후 업로드된 PDF는 사용하지 않습니다. 과거 분석은 실시간 예측 성적에 포함하지 않습니다.</p>
    <UiAlert v-if="error" variant="error" :description="error" role="alert" />
    <UiAlert v-if="automationError" variant="info" :description="automationError" />
    <div v-if="automation?.enabled" class="comparison-panel">
      <h3>서버 자동 분석 · 수급만</h3>
      <p>거래일 {{ automation.hours }} · 15분 간격 · 하루 최대 {{ automation.maxCallsPerDay }}회 · 노트북과 브라우저를 꺼도 실행</p>
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

    <FlowExpertPanel :date="date" :record="record" :refresh-key="refreshKey" />
    <h3>저장된 기본 판단과 근거</h3>
    <UiEmpty v-if="state && !state.rows.length" description="아직 저장된 AI 판단이 없습니다. 판단 생성 후 결과와 근거가 여기에 남습니다." />
    <article v-for="row in state?.rows" :key="row.id" class="prediction">
      <div class="heading">
        <div class="actions"><UiBadge>{{ row.variant === 'flow' ? '수급만' : '수급 + PDF' }}</UiBadge><UiBadge :variant="row.judgment.direction === 'up' ? 'success' : row.judgment.direction === 'down' ? 'warning' : 'default'">{{ labels[row.judgment.direction] }}</UiBadge><span>{{ formatTime(row.record.sample.observedAt) }} → {{ row.horizon }}분 후</span><UiBadge v-if="!row.eligible" size="xs">과거 분석 · 성적 제외</UiBadge></div>
        <span class="result">{{ outcome(row.review) }}</span>
      </div>
      <h4>{{ row.judgment.summary }}</h4>
      <ul><li v-for="reason in row.judgment.reasons" :key="reason">{{ reason }}</li></ul>
      <div class="conditions"><div><h4>반대 신호</h4><ul><li v-for="risk in row.judgment.risks" :key="risk">{{ risk }}</li></ul></div><div><h4>판단을 바꿀 조건</h4><ul><li v-for="condition in row.judgment.invalidation" :key="condition">{{ condition }}</li></ul></div></div>
      <p class="note">생성 {{ formatTime(row.generatedAt) }} · 평가 시작 {{ row.evaluationAt ? formatTime(row.evaluationAt) : '관측 대기' }} · {{ row.model }} · {{ row.version }} · 규칙 결과: {{ outcome(row.ruleReview) }}</p>
      <UiButton v-if="row.evidence.length" size="xs" variant="ghost" @click="expanded = expanded === row.id ? null : row.id">{{ expanded === row.id ? '근거 접기' : `검색 근거 ${row.evidence.length}개 보기` }}</UiButton>
      <p v-else class="note">{{ row.variant === 'flow' ? '비교 기준: PDF를 제공하지 않고 수급만 분석했습니다.' : '관측 시점에 사용할 수 있는 관련 PDF 근거가 없어 수급만 분석했습니다.' }}</p>
      <div v-if="expanded === row.id" class="evidence">
        <blockquote v-for="source in row.evidence" :key="source.id"><strong>{{ source.filename }} · {{ source.page }}쪽 · 자료 기준일 {{ source.date }} <span v-if="row.judgment.citations.includes(source.id)">· AI 인용</span></strong><p>{{ source.text }}</p></blockquote>
      </div>
    </article>
    <h3>PDF 검색 준비</h3>
    <p class="note">아래에 PDF를 첨부한 뒤 검색 준비를 실행하세요. 텍스트 PDF 최대 100페이지를 지원합니다. 준비된 최근 100개 자료 중 관련 문단을 찾습니다.</p>
    <div v-for="report in state?.reports" :key="report.id" class="report">
      <div><strong>{{ report.filename }}</strong><p>{{ report.date }} · {{ report.ragStatus === 'ready' ? '검색 준비 완료' : report.ragStatus === 'error' ? report.ragError : '검색 준비 필요' }}</p></div>
      <UiButton v-if="report.ragStatus !== 'ready'" variant="outline" size="sm" :disabled="indexing !== null" :loading="indexing === report.id" @click="index(report)">{{ report.ragStatus === 'error' ? '다시 준비' : '검색 준비' }}</UiButton>
    </div>
    <p v-if="state && !state.reports.length" class="note">조회일까지 첨부된 PDF가 없습니다.</p>
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
