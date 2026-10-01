<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiEmpty, UiSelect } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { FlowRecord } from '../../types/marketFlow'

const props = defineProps<{ date: string; record?: FlowRecord; refreshKey: string }>()
type Provider = 'anthropic' | 'openai'
type Task = 'review' | 'close'
interface Model { provider: Provider; label: string; model: string; configured: boolean }
interface ExpertRow {
  id: number; task: Task; model: string; createdAt: string
  payload: {
    cutoff: string; coverage: { count: number; first: string; last: string }
    judgment: { summary: string; reasons: string[]; risks: string[]; invalidation: string[]; citations: string[] }
    evidence: { usage?: 'historical-reference'; id: string; filename: string; date: string; page: number; text: string }[]
  }
}
const state = ref<{ models: Model[]; rows: ExpertRow[]; closeAvailable: boolean } | null>(null)
const provider = ref<Provider>('anthropic')
const running = ref<Task | null>(null)
const loading = ref(false)
const error = ref('')
let version = 0
let disposed = false
let controller: AbortController | undefined
const selected = computed(() => state.value?.models.find(m => m.provider === provider.value))
const options = computed(() => (state.value?.models || []).map(m => ({ value: m.provider, label: `${m.label}${m.configured ? '' : ' · 키 설정 필요'}` })))
const conflicts = computed(() => {
  const d = props.record?.analyses['15']?.delta
  if (!d) return []
  return [['cash', 'futures', '현물·선물'], ['cash', 'nonArb', '현물·비차익'], ['cash', 'kospi', '현물·지수']].flatMap(([a, b, label]) => {
    const x = d[a as keyof typeof d], y = d[b as keyof typeof d]
    return x != null && y != null && x * y < 0 ? [`${label} 방향 불일치`] : []
  })
})
const time = (s: string) => new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
async function load() {
  const request = ++version
  controller?.abort(); controller = new AbortController(); loading.value = true
  try {
    const response = await api.get('/market-flow/expert', { params: { date: props.date }, signal: controller.signal })
    if (disposed || request !== version) return
    state.value = response.data.data; error.value = ''
  } catch (e: any) {
    if (!disposed && request === version && e.code !== 'ERR_CANCELED') error.value = e.response?.data?.message || '심층 분석 기록을 불러오지 못했습니다.'
  } finally { if (!disposed && request === version) loading.value = false }
}
async function run(task: Task) {
  if (running.value || !selected.value?.configured) return
  const date = props.date
  running.value = task; error.value = ''
  try {
    await api.post('/market-flow/expert', { date, task, provider: provider.value, snapshotId: props.record?.id }, { timeout: 125_000 })
    if (!disposed && date === props.date) await load()
  } catch (e: any) {
    if (!disposed && date === props.date) error.value = e.response?.data?.message || '분석 요청이 완료되지 않았습니다. 새로고침으로 저장 여부를 확인하세요.'
  } finally { running.value = null }
}
watch(() => props.date, () => { state.value = null; error.value = ''; void load() }, { immediate: true })
watch(() => props.refreshKey, () => { if (!running.value) void load() })
onUnmounted(() => { disposed = true; version++; controller?.abort() })
</script>

<template>
  <section class="expert-panel">
    <div class="heading"><div><h3>심층 검토 · 장 마감 복기</h3><p>Claude Sonnet 또는 GPT Astra로 충돌하는 신호와 반대 시나리오를 검토합니다.</p></div><UiBadge>기본 예측 성적과 별도 저장</UiBadge></div>
    <UiAlert v-if="conflicts.length" variant="info" title="심층 검토할 신호가 있습니다" :description="conflicts.join(' · ')" />
    <div class="actions">
      <div class="model-select"><UiSelect v-model="provider" :options="options" label="심층 분석 모델" size="sm" :disabled="!!running" /></div>
      <UiButton size="sm" :loading="running === 'review'" :disabled="!selected?.configured || !record || !!running || loading" @click="run('review')">심층 검토</UiButton>
      <UiButton size="sm" variant="outline" :loading="running === 'close'" :disabled="!selected?.configured || !state?.closeAvailable || !!running || loading" @click="run('close')">장 마감 복기</UiButton>
      <UiButton size="sm" variant="ghost" :loading="loading" @click="load">새로고침</UiButton>
    </div>
    <p v-if="selected" class="note">선택 모델: {{ selected.model }}</p>
    <UiAlert v-if="selected && !selected.configured" variant="info" :description="`${selected.label} API 키를 서버에 설정하면 사용할 수 있습니다.`" />
    <UiAlert v-if="error" variant="error" :description="error" />
    <p class="note">버튼을 누르면 수급·당일 PDF 근거·최대 2개의 과거 참고 사례가 선택한 모델 제공사에 전달됩니다. 심층 검토는 선택 관측까지의 자료만 사용합니다. 장 마감 복기는 15:40 이후 실행하며, 이후 업로드한 PDF도 참고하는 사후 분석입니다. 자동 실행하지 않습니다.</p>
    <UiEmpty v-if="state && !state.rows.length" description="저장된 심층 검토·복기가 없습니다." />
    <article v-for="row in state?.rows" :key="row.id" class="review">
      <div class="heading"><UiBadge>{{ row.task === 'close' ? '장 마감 복기' : '심층 검토' }}</UiBadge><span class="note">{{ row.model }} · {{ time(row.createdAt) }}</span></div>
      <h4>{{ row.payload.judgment.summary }}</h4>
      <ul><li v-for="reason in row.payload.judgment.reasons" :key="reason">{{ reason }}</li></ul>
      <h4>반대 시나리오 · 한계</h4><ul><li v-for="risk in row.payload.judgment.risks" :key="risk">{{ risk }}</li></ul>
      <h4>추가 확인 조건</h4><ul><li v-for="condition in row.payload.judgment.invalidation" :key="condition">{{ condition }}</li></ul>
      <p class="note">관측 {{ row.payload.coverage.count }}건 · {{ time(row.payload.coverage.first) }} ~ {{ time(row.payload.coverage.last) }} · 예측 적중률에 포함하지 않음</p>
      <details v-if="row.payload.evidence.some(e => e.usage !== 'historical-reference')"><summary>당일 PDF 근거 {{ row.payload.evidence.filter(e => e.usage !== 'historical-reference').length }}개</summary><blockquote v-for="e in row.payload.evidence.filter(e => e.usage !== 'historical-reference')" :key="e.id"><strong>{{ e.filename }} · {{ e.page }}쪽 · 자료 기준일 {{ e.date }}{{ row.payload.judgment.citations.includes(e.id) ? ' · AI 인용' : '' }}</strong><p>{{ e.text }}</p></blockquote></details>
      <p v-else class="note">당일 PDF 근거 없음 · 과거 사례는 당일 근거를 대체하지 않습니다.</p>
      <details v-if="row.payload.evidence.some(e => e.usage === 'historical-reference')"><summary>과거 참고 사례 · 오늘 신호 아님</summary><blockquote v-for="e in row.payload.evidence.filter(e => e.usage === 'historical-reference')" :key="e.id"><strong>{{ e.date }} · {{ e.filename }} · {{ e.page }}쪽</strong><p>{{ e.text }}</p></blockquote></details>
    </article>
  </section>
</template>

<style scoped>
.expert-panel { display: grid; gap: 14px; border: 1px solid #dddff1; border-radius: 12px; padding: 18px; background: #fafaff; min-width: 0; }
.heading, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.heading { justify-content: space-between; }.actions { align-items: end; }.model-select { width: 230px; max-width: 100%; flex-shrink: 0; }
.model-select :deep(.ui-select-outer), .model-select :deep(.ui-select-trigger) { width: 100%; }
h3,h4,p,ul { margin: 0; }h3 { font-size: 15px; }h4 { font-size: 13px; }p,li,summary { font-size: 12px; line-height: 1.8; }
.note,.heading p { color: #737e94; font-size: 12px; }.review { display: grid; gap: 10px; padding: 16px; background: white; border: 1px solid #e5e8f2; border-radius: 10px; overflow-wrap: anywhere; }
ul { padding-left: 18px; }blockquote { margin: 10px 0 0; padding: 12px; border-left: 3px solid #b8c3f0; font-size: 12px; }summary { cursor: pointer; }
@media(max-width:700px) { .expert-panel { padding: 12px; }.model-select { width: 100%; } }
</style>
