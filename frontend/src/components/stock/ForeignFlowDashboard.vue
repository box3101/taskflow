<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { UiIcon, UiTab, UiButton, UiBadge, UiDatePicker, UiSelect, UiInput, UiTable, UiEmpty, UiFileUpload, UiAlert, openConfirm, openToast } from '@leechanyong/ispark-ui'
import type { TabItem, TableColumn } from '@leechanyong/ispark-ui'
import { CalendarDate, type DateValue } from '@internationalized/date'
import api from '../../api/client'
import type { FlowKey, FlowRecord, FlowReport, FlowResponse, FlowStatus, MoneyUnit } from '../../types/marketFlow'
import FlowMiniChart from './FlowMiniChart.vue'
import HistoricalMarketReview from './HistoricalMarketReview.vue'
import FlowCalendarDashboard from './FlowCalendarDashboard.vue'
import FlowAgentPanel from './FlowAgentPanel.vue'
import { flowReading, flowTitle } from '../../utils/flowReading'

function today() { return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10) }
function time(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
}
const initialDate = new URLSearchParams(window.location.search).get('date')
const initialView = new URLSearchParams(window.location.search).get('view')
const selectedDate = ref(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && Number.isFinite(Date.parse(initialDate)) && initialDate <= today() ? initialDate : today())
const pendingDate = ref(selectedDate.value)
const windowMinutes = ref(15)
const activeTab = ref(initialView && ['calendar', 'live', 'agent', 'history', 'review', 'retrospective'].includes(initialView) ? initialView : !initialDate ? 'calendar' : selectedDate.value === '2026-09-22' ? 'retrospective' : 'live')
const selectedId = ref<number | null>(null)
const data = ref<FlowResponse | null>(null)
const status = ref<FlowStatus | null>(null)
const busy = ref(false)
const error = ref('')
const showConnection = ref(false)
const uploading = ref(false)
const uploadNote = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let requestVersion = 0
let controller: AbortController | undefined
let disposed = false
const tabs: TabItem[] = [{ value: 'calendar', label: '월간 대시보드' }, { value: 'live', label: '수급 해석' }, { value: 'agent', label: 'AI 판단·검증' }, { value: 'history', label: '시간대별 기록' }, { value: 'review', label: '패턴 복기' }, { value: 'retrospective', label: '장전 리포트 비교' }]
const windowOptions = [5, 15, 30].map(value => ({ value, label: `최근 ${value}분` }))
const dateModel = computed({
  get: (): DateValue => { const [y, m, d] = pendingDate.value.split('-').map(Number); return new CalendarDate(y!, m!, d!) },
  set: (value: DateValue | undefined) => { if (value) pendingDate.value = `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}` },
})
const maxDate = computed(() => { const [y, m, d] = today().split('-').map(Number); return new CalendarDate(y!, m!, d!) })
const historyColumns = computed<TableColumn[]>(() => [
  { key: 'time', label: '수집 시각', width: '100px' },
  { key: 'cash', label: `현물 (${unitLabel('cash')})`, align: 'right' },
  { key: 'futures', label: '선물 (계약)', align: 'right' },
  { key: 'nonArb', label: `비차익 (${unitLabel('nonArb')})`, align: 'right' },
  { key: 'title', label: `당시 해석 (${windowMinutes.value}분)` },
])
const historyRows = computed(() => [...records.value].reverse().map(row => ({ id: row.id, time: time(row.sample.observedAt), cash: fmt(row.analyses[String(windowMinutes.value)]?.delta.cash, 'cash', row), futures: fmt(row.analyses[String(windowMinutes.value)]?.delta.futures, 'futures', row), nonArb: fmt(row.analyses[String(windowMinutes.value)]?.delta.nonArb, 'nonArb', row), title: row.analyses[String(windowMinutes.value)]?.title, record: row })))
const reviewColumns: TableColumn[] = [{ key: 'time', label: '기록 시각', width: '100px' }, { key: 'title', label: '당시 해석' }, { key: 'after15', label: '15분 후' }, { key: 'after30', label: '30분 후' }]
const records = computed(() => data.value?.records || [])
const current = computed(() => records.value.find(r => r.id === selectedId.value) || records.value.at(-1))
const analysis = computed(() => current.value?.analyses[String(windowMinutes.value)])
const reading = computed(() => flowReading(current.value, records.value, windowMinutes.value))
const latest = computed(() => records.value.at(-1))
const historical = computed(() => selectedDate.value !== today() || selectedId.value !== null)
const stale = computed(() => !historical.value && !!latest.value && now.value - Date.parse(latest.value.sample.observedAt) > 180_000)
const connectionText = computed(() => {
  if (error.value) return '연결 확인 필요'
  if (!status.value) return '연결 확인 중'
  if (!status.value.configured) return 'API 설정 필요'
  if (status.value.session === 'holiday') return '휴장일'
  if (status.value.session === 'outside') return '정규장 외 · 최근 기록'
  if (stale.value) return '갱신 지연'
  if (status.value.lastError) return '일부 조회 확인 필요'
  return latest.value ? '1분 간격 수집 중' : '첫 관측 대기'
})
const connectionOk = computed(() => !error.value && !stale.value && status.value?.configured && !status.value.lastError && status.value.session === 'collecting')
const metricCards = [
  { key: 'cash' as const, label: '외국인 현물', market: '코스피', icon: 'layers', color: '#4f6af6', caption: '시장 전체 외국인 순매수 대금' },
  { key: 'futures' as const, label: '외국인 선물', market: '코스피200', icon: 'activity', color: '#8b5cf6', caption: '외국인 순매수 계약 수' },
  { key: 'nonArb' as const, label: '외국인 비차익', market: '코스피', icon: 'chart-no-axes-combined', color: '#0d9488', caption: '현물에 포함되는 거래 · 별도 합산 안 함' },
  { key: 'totalNonArb' as const, label: '전체 비차익', market: '코스피', icon: 'chart-no-axes-combined', color: '#d97706', caption: '전체 투자자 비차익 · 외국인 비차익과 구분' },
]
function unit(key: FlowKey, row = current.value): MoneyUnit | 'contracts' | 'points' {
  if (key === 'futures') return 'contracts'
  if (key === 'kospi') return 'points'
  return (row?.moneyUnits || status.value?.moneyUnits)?.[key === 'cash' ? 'cash' : 'nonArb'] || 'raw'
}
function converted(value: number | null | undefined, key: FlowKey, row = current.value) {
  if (value === null || value === undefined) return null
  const u = unit(key, row)
  return u === 'million' ? value / 100 : u === 'won' ? value / 100_000_000 : value
}
function unitLabel(key: FlowKey) { const u = unit(key); return u === 'contracts' ? '계약' : u === 'points' ? 'pt' : u === 'raw' ? 'API 원단위' : '억원' }
function fmt(value: number | null | undefined, key: FlowKey, row = current.value) {
  const v = converted(value, key, row)
  return v === null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('ko-KR', { maximumFractionDigits: key === 'futures' || unit(key, row) === 'raw' ? 0 : 2 })}`
}
function pct(value: number | null | undefined) { return value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%` }
function tone(value: number | null | undefined) { return value === null || value === undefined || value === 0 ? '' : value > 0 ? 'positive' : 'negative' }
function points(key: FlowKey) {
  return records.value.filter(r => !current.value || r.sample.observedAt <= current.value.sample.observedAt).map(r => ({ time: r.sample.observedAt, value: converted(r.sample.values[key], key, r) }))
}
const timeline = computed(() => {
  const slots = new Map<string, FlowRecord>()
  for (const row of records.value) {
    const local = new Date(Date.parse(row.sample.observedAt) + 9 * 3600_000)
    const slot = `${local.getUTCHours()}:${Math.floor(local.getUTCMinutes() / 15)}`
    if (!slots.has(slot)) slots.set(slot, row)
  }
  return [...slots.values()]
})
const reviewRows = computed(() => timeline.value.map(row => ({ row, analysis: row.analyses['15'], reviews: row.reviews })))
const reviewStats = computed(() => {
  const evaluated = reviewRows.value.map(r => r.reviews.find(v => v.horizon === 15)).filter(r => r?.state === 'observed' && r.matched !== null)
  return { count: evaluated.length, matched: evaluated.filter(r => r?.matched).length, held: reviewRows.value.filter(r => ['wait', 'neutral'].includes(r.analysis?.direction || 'wait')).length }
})
const reviewTableRows = computed(() => reviewRows.value.map(item => ({ id: item.row.id, time: time(item.row.sample.observedAt), title: item.analysis?.title, record: item.row, after15: item.reviews.find(r => r.horizon === 15), after30: item.reviews.find(r => r.horizon === 30) })))
const nextCheckAt = computed(() => current.value ? new Date(Date.parse(current.value.sample.observedAt) + 15 * 60_000).toISOString() : null)

async function load() {
  const version = ++requestVersion
  controller?.abort()
  controller = new AbortController()
  busy.value = true
  try {
    const res = await api.get<{ data: FlowResponse }>('/market-flow', { params: { date: selectedDate.value }, signal: controller.signal, timeout: 10000 })
    if (disposed || version !== requestVersion) return
    data.value = res.data.data
    status.value = data.value.status
    error.value = ''
  } catch (err: any) {
    if (disposed || version !== requestVersion || err.code === 'ERR_CANCELED') return
    error.value = err.response?.data?.message || '수급 데이터를 불러오지 못했습니다. 다시 시도해주세요.'
    status.value = err.response?.data?.status || status.value
  } finally { if (version === requestVersion && !disposed) { busy.value = false; now.value = Date.now() } }
}
watch(selectedDate, () => {
  pendingDate.value = selectedDate.value
  data.value = null; selectedId.value = null
  if (selectedDate.value === '2026-09-22' && activeTab.value !== 'calendar') activeTab.value = 'retrospective'
  const url = new URL(window.location.href); url.searchParams.set('date', selectedDate.value)
  url.searchParams.set('view', activeTab.value)
  window.history.replaceState(window.history.state, '', url)
  void load()
})
function openSeptemberReview() { selectedDate.value = '2026-09-22'; activeTab.value = 'retrospective' }
watch(activeTab, tab => {
  const url = new URL(window.location.href); url.searchParams.set('view', tab)
  window.history.replaceState(window.history.state, '', url)
})
async function openCalendarDay(date: string, tab: string) {
  selectedDate.value = date
  await nextTick()
  activeTab.value = tab === 'pdf' ? 'live' : tab
  await nextTick()
  if (tab === 'pdf') document.querySelector('.reports-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function visibilityChanged() { if (!document.hidden && selectedDate.value === today()) void load() }
onMounted(() => {
  void load()
  timer = setInterval(() => { now.value = Date.now(); if (!document.hidden && selectedDate.value === today() && !busy.value) void load() }, 60_000)
  document.addEventListener('visibilitychange', visibilityChanged)
})
onUnmounted(() => { disposed = true; requestVersion++; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visibilityChanged) })

function selectRecord(row: FlowRecord) { selectedId.value = row.id; activeTab.value = 'live' }
async function uploadPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024) {
    openToast({ message: '10MB 이하의 PDF를 선택하세요.', type: 'error' }); return
  }
  const date = selectedDate.value
  const form = new FormData()
  form.append('file', file); form.append('date', date); form.append('note', uploadNote.value)
  uploading.value = true
  try {
    await api.post('/market-flow/reports', form, { timeout: 30000 })
    uploadNote.value = ''
    openToast({ message: `${date} 참고 PDF를 저장했습니다.`, type: 'success' })
    await load()
  } catch (err: any) { openToast({ message: err.response?.data?.message || 'PDF 저장에 실패했습니다.', type: 'error' }) }
  finally { uploading.value = false }
}
async function downloadReport(report: FlowReport) {
  try {
    const response = await api.get(`/market-flow/reports/${report.id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = report.filename; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { openToast({ message: 'PDF를 불러오지 못했습니다.', type: 'error' }) }
}
async function removeReport(report: FlowReport) {
  if (!await openConfirm({ title: '참고 PDF 삭제', message: '이 참고 자료를 삭제할까요?', confirmText: '삭제' })) return
  try { await api.delete(`/market-flow/reports/${report.id}`); await load() }
  catch { openToast({ message: '삭제에 실패했습니다.', type: 'error' }) }
}
const reviewLabels = { pending: '관측 대기', missing: '결과 데이터 없음', closed: '장 종료 이후', observed: '' }
</script>

<template>
  <div class="flow-page">
    <header class="flow-header">
      <div><span class="eyebrow">MARKET FLOW</span><h1>외국인 수급 해석</h1><p>현물·선물·비차익의 변화로 포지션 의도를 추정합니다.</p></div>
      <div class="flow-header-actions">
        <div v-if="activeTab !== 'calendar'" class="flow-date-control">
          <span class="flow-date-label">조회 날짜</span>
          <UiDatePicker v-model="dateModel" :max-value="maxDate" :clearable="false" size="sm" trigger-label="거래일 선택" class="flow-date" />
          <UiButton size="sm" :disabled="pendingDate === selectedDate" @click="selectedDate = pendingDate">확인</UiButton>
          <span v-if="pendingDate !== selectedDate" class="flow-date-label" role="status">현재 조회: {{ selectedDate }}</span>
        </div>
        <UiButton variant="outline" size="sm" @click="showConnection = !showConnection" :aria-expanded="showConnection">
        <template #icon-left><span class="status-dot" :class="{ 'status-dot--live': connectionOk }" /></template>
        {{ connectionText }}
        <template #icon-right><UiIcon name="settings-2" :size="14" /></template>
        </UiButton>
      </div>
    </header>
    <section v-if="showConnection" class="panel connection-panel">
      <h2>한국투자증권 연결</h2>
      <p>서버의 실전 API 키로 시장 데이터를 1분마다 조회합니다. 계좌 주문은 실행하지 않습니다.</p>
      <dl><div><dt>API 키</dt><dd>{{ status?.configured ? '설정됨' : '설정 필요' }}</dd></div><div><dt>기록 저장소</dt><dd>{{ status?.storageReady ? '연결됨' : '연결 확인 필요' }}</dd></div><div><dt>수급 기준</dt><dd>장중 집계 · 거래소 갱신 시각 미제공</dd></div></dl>
      <p class="muted">초기 연결은 서버의 KIS_APP_KEY / KIS_APP_SECRET 설정이 필요합니다. 금액 단위를 확인하기 전에는 API 원단위로 표시합니다.</p>
    </section>
    <div class="flow-toolbar">
      <UiTab v-model="activeTab" :tabs="tabs" align="left" size="sm" aria-label="수급 화면" class="flow-tabs" />
      <div class="flow-controls">
        <UiButton v-if="activeTab !== 'calendar'" variant="outline" size="sm" @click="activeTab = 'calendar'">달력으로</UiButton>
        <UiButton v-if="activeTab !== 'calendar'" variant="outline" size="sm" @click="openSeptemberReview">9/22 복기 보기</UiButton>
        <UiSelect v-if="!['calendar', 'retrospective', 'agent'].includes(activeTab)" v-model="windowMinutes" :options="windowOptions" label="비교 구간" label-hidden size="sm" class="flow-window" />
        <UiButton variant="outline" size="sm" icon-only :loading="busy" @click="load" aria-label="새로고침"><template #icon-left><UiIcon name="refresh-cw" :size="16" /></template></UiButton>
      </div>
    </div>
    <FlowCalendarDashboard v-if="activeTab === 'calendar'" :date="selectedDate" :refresh-key="data?.serverTime || ''" @select="selectedDate = $event" @open="openCalendarDay" />
    <HistoricalMarketReview v-if="activeTab === 'retrospective'" :date="selectedDate" />
    <FlowAgentPanel v-if="activeTab === 'agent'" :date="selectedDate" :record="current" :refresh-key="data?.serverTime || ''" />
    <template v-if="!['calendar', 'retrospective'].includes(activeTab)">
    <UiAlert v-if="error" variant="error" role="alert" title="연결 확인 필요" :description="error" />
    <UiAlert v-else-if="status && !status.configured" variant="info" title="한국투자 API 연결을 기다리고 있어요" description="연결 후 정규장에 수급이 쌓이면 해석과 복기가 시작됩니다. 상단 연결 안내에서 설정 상태를 확인하세요." />
    <UiAlert v-else-if="status?.lastError" variant="warning" :description="status.lastError" />
    <UiAlert v-if="stale" variant="warning" :description="`최근 관측 ${time(latest?.sample.observedAt)} · 표시 중인 기록은 현재 수급이 아닐 수 있습니다.`" />
    <div v-if="historical && current" class="history-notice"><UiIcon name="history" :size="14" />{{ selectedDate }} {{ time(current.sample.observedAt) }}에 저장한 해석 <UiButton v-if="selectedId !== null" variant="ghost" size="xs" @click="selectedId = null">최신 기록으로</UiButton></div>
    </template>
    <template v-if="activeTab === 'live'">
      <section class="metrics" aria-label="수급 요약">
        <article v-for="card in metricCards" :key="card.key" class="panel metric">
          <div class="metric-heading"><span class="metric-icon" :style="{ color: card.color }"><UiIcon :name="card.icon" :size="20" /></span><div><h2>{{ card.label }}</h2><small>{{ card.market }}</small></div><UiBadge v-if="current?.sample.sources[card.key].status !== 'ok'" size="xs">{{ current ? '조회 확인' : '수집 대기' }}</UiBadge></div>
          <div class="metric-number" :class="tone(analysis?.delta[card.key])">{{ fmt(analysis?.delta[card.key], card.key) }}<span>{{ unitLabel(card.key) }}</span></div>
          <p class="metric-summary">최근 {{ windowMinutes }}분 변화 <span>· 누적 {{ fmt(current?.sample.values[card.key], card.key) }}</span></p>
          <p class="metric-summary">{{ analysis?.baselineAt ? `${time(analysis.baselineAt)} → ${time(current?.sample.observedAt)} 비교 · 1분마다 갱신` : `${windowMinutes}분 비교 데이터 수집 중` }}</p>
          <div class="metric-caption">{{ current?.sample.sources[card.key].message || card.caption }}</div>
        </article>
      </section>
      <section class="insight">
        <div class="section-heading"><h2><UiIcon name="lightbulb" :size="22" />{{ flowTitle(current, windowMinutes) }}</h2><UiBadge variant="primary" size="xs">관측 요약</UiBadge></div>
        <dl class="reading-grid"><dt>현재 상태</dt><dd>{{ reading.state }}</dd><dt>직전 관측 대비</dt><dd>{{ reading.changes }}</dd><dt>가격 반응</dt><dd>{{ reading.price }}</dd><dt>다음 확인 조건</dt><dd>{{ reading.checks.join(' · ') }}</dd></dl>
        <p class="chart-footnote">직전 관측과 현재의 최근 {{ windowMinutes }}분 값을 비교합니다. 구간이 겹치므로 행을 합산하지 않습니다. 외국인 비차익은 현물에 포함됩니다.</p>
        <div class="hypotheses"><article v-for="(hypothesis, i) in (analysis?.hypotheses || ['외국인 현물과 선물의 방향이 일치하는지 확인합니다.', '외국인 비차익 동참 여부와 실제 지수 반응을 비교합니다.'])" :key="i"><UiBadge variant="info" size="xs">가설 {{ i + 1 }}</UiBadge><p>{{ hypothesis }}</p></article></div>
        <div class="insight-footer"><UiIcon name="info" :size="14" /><span>미결제약정·베이시스는 미연결 · 신규 포지션과 기존 포지션 청산을 단정하지 않습니다.</span></div>
      </section>
      <div class="analysis-grid">
        <section class="panel charts-panel">
          <div class="section-heading"><h2><UiIcon name="chart-no-axes-combined" :size="18" />수급과 코스피 반응</h2><span class="muted">당일 누적 · 수집 시각 기준</span></div>
          <FlowMiniChart v-for="card in metricCards" :key="card.key" :points="points(card.key)" :label="card.label" :unit="unitLabel(card.key)" :color="card.color" />
          <FlowMiniChart :points="points('kospi')" label="코스피" unit="pt" color="#475569" />
          <p class="chart-footnote">단위별 축을 분리했습니다. 외국인 비차익은 현물에 포함되며, 누락 구간은 연결하지 않습니다.</p>
        </section>
        <aside class="flow-side">
          <section class="panel checks-panel">
            <h2><UiIcon name="list-checks" :size="18" />다음 15분 확인 조건</h2>
            <ol><li v-for="(check, i) in (analysis?.checks || ['외국인 현물 매수·매도 방향', '외국인 선물과 비차익 동참', '수급 변화에 대한 코스피 반응'])" :key="check"><span class="check-num">{{ i + 1 }}</span><span>{{ check }}</span><UiIcon name="circle" :size="17" /></li></ol>
            <div class="next-check"><UiIcon name="clock-3" :size="16" />{{ nextCheckAt ? `${time(nextCheckAt)} 결과 비교` : '관측 시작 후 결과 비교' }}</div>
            <p>확인 조건은 다음 관측에서 검토할 항목입니다. 현재 충족됐다는 의미가 아닙니다.</p>
          </section>
          <section class="panel index-panel"><span class="muted">코스피 · 최근 관측</span><strong>{{ current?.sample.values.kospi?.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) || '—' }}</strong><span :class="tone(current?.sample.values.kospiPct)">{{ pct(current?.sample.values.kospiPct) }} <small>전일 대비</small></span><div class="index-time">조회 {{ time(current?.sample.sources.kospi.fetchedAt) }} · 원천 시각 미제공</div></section>
          <section class="panel principle-panel"><UiIcon name="scan-eye" :size="20" /><h3>생각보다, 관측 가능한 변화</h3><p>서로 다른 외국인 투자자의 거래가 섞인 집계입니다. 가능한 해석을 기록하고 이후 가격 움직임으로 검증합니다.</p></section>
        </aside>
      </div>
      <section class="panel timeline-panel">
        <div class="section-heading"><h2><UiIcon name="history" :size="18" />해석 타임라인</h2><UiButton variant="ghost" size="xs" @click="activeTab = 'history'">전체 기록<template #icon-right><UiIcon name="arrow-right" :size="14" /></template></UiButton></div>
        <UiEmpty v-if="!timeline.length" description="장중 기록이 쌓이면 시간대별 해석을 다시 볼 수 있어요." class="empty-inline" />
        <div v-else class="timeline"><article v-for="row in timeline" :key="row.id" class="timeline-item"><UiButton :variant="current?.id === row.id ? 'secondary' : 'outline'" @click="selectRecord(row)">{{ time(row.sample.observedAt) }}</UiButton><p>{{ row.analyses['15']?.title }}</p></article></div>
      </section>
    </template>
    <section v-else-if="activeTab === 'history'" class="panel history-panel">
      <div class="section-heading"><h2>시간대별 관측과 해석</h2><span class="muted">{{ records.length }}건 · 원래 기록 보존</span></div>
      <UiEmpty v-if="!records.length" title="이 날짜에는 수집 기록이 없어요" description="연결 이후 장중 관측부터 저장합니다. 과거 수급을 예측 기록으로 소급하지 않습니다." />
      <UiTable v-else :columns="historyColumns" :data="historyRows" size="sm">
        <template #cell-time="{ row }"><UiButton variant="ghost" size="xs" @click="selectRecord(row.record)">{{ row.time }}<template #icon-right><UiIcon name="arrow-up-right" :size="12" /></template></UiButton></template>
      </UiTable>
    </section>
    <template v-else-if="activeTab === 'review'">
      <section class="review-summary"><article class="panel"><span>방향 예측 평가</span><strong>{{ reviewStats.count }}<small>건</small></strong><p>15분 간격 표본 · 15분 후 결과</p></article><article class="panel"><span>방향 일치</span><strong>{{ reviewStats.matched }}<small>/ {{ reviewStats.count }}건</small></strong><p>기록한 방향과 실제 지수 변화 비교</p></article><article class="panel"><span>판단 보류·혼재</span><strong>{{ reviewStats.held }}<small>건</small></strong><p>방향 적중률 계산에서 제외</p></article></section>
      <section class="panel history-panel">
        <div class="section-heading"><h2>가설 이후, 실제로 어떻게 움직였을까?</h2><UiBadge size="xs">15분 수급 해석 기준</UiBadge></div>
        <UiEmpty v-if="!reviewRows.length" title="첫 복기를 기다리고 있어요" description="해석 시점 이후 15분·30분의 코스피 변화를 비교합니다." />
        <UiTable v-else :columns="reviewColumns" :data="reviewTableRows" size="sm">
          <template #cell-time="{ row }"><UiButton variant="ghost" size="xs" @click="selectRecord(row.record)">{{ row.time }}</UiButton></template>
          <template v-for="key in (['after15', 'after30'] as const)" #[`cell-${key}`]="{ row }">
            <template v-if="row[key]"><span v-if="row[key].state === 'observed'" :class="tone(row[key].returnPct)">{{ pct(row[key].returnPct) }}</span><span v-else class="muted">{{ reviewLabels[row[key].state] }}</span><UiBadge v-if="row[key].matched !== null" :variant="row[key].matched ? 'success' : 'warning'" size="xs" class="review-match">{{ row[key].matched ? '방향 일치' : '방향 불일치' }}</UiBadge></template>
          </template>
        </UiTable>
        <p class="chart-footnote">겹치는 구간과 작은 표본은 독립적인 검증 결과가 아닙니다. 가설의 인과관계나 수익을 보장하는 점수가 아닙니다.</p>
      </section>
    </template>
    <section v-if="activeTab !== 'calendar'" class="panel reports-panel">
      <div class="section-heading"><div><h2><UiIcon name="file-text" :size="18" />{{ selectedDate }} 참고 PDF</h2><p class="muted">선택한 조회 날짜에 원문과 메모를 저장합니다. 파일 제목의 날짜는 자동 적용하지 않습니다. AI 판단·검증 탭에서 검색 준비를 완료하면 이후 관측의 분석 근거로 사용됩니다.</p></div><UiFileUpload v-if="status?.storageReady" accept=".pdf,application/pdf" :max-size="10 * 1024 * 1024" label="PDF 추가" :loading="uploading" @upload="uploadPdf" /><UiButton v-else size="sm" disabled>PDF 추가</UiButton></div>
      <UiInput v-model="uploadNote" label="첨부할 PDF 참고 메모" label-hidden :maxlength="4000" placeholder="첨부할 리포트에서 오늘 확인할 조건을 메모하세요 (선택)" size="sm" />
      <div v-if="busy && !data" class="report-empty" role="status">저장된 PDF를 확인하고 있습니다.</div>
      <div v-else-if="error" class="report-empty" role="alert">PDF 목록을 갱신하지 못했습니다. <UiButton variant="ghost" size="sm" @click="load">다시 조회</UiButton></div>
      <div v-else-if="data && !data.reports.length" class="report-empty">{{ selectedDate }}에 저장된 PDF가 없습니다. 다른 날짜에 추가한 파일은 해당 날짜를 조회해 주세요. · PDF 최대 10MB</div>
      <div v-else-if="data?.reports.length" class="report-empty">{{ selectedDate }}에 저장된 PDF {{ data.reports.length }}개</div>
      <div v-for="report in data?.reports" :key="report.id" class="report-row"><UiIcon name="file-text" :size="21" /><div><UiButton variant="ghost" size="sm" class="report-name" @click="downloadReport(report)">{{ report.filename }}</UiButton><small>{{ time(report.createdAt) }} 등록{{ report.note ? ` · ${report.note}` : '' }}</small></div><UiButton variant="ghost" size="sm" icon-only @click="downloadReport(report)" aria-label="PDF 다운로드"><template #icon-left><UiIcon name="download" :size="16" /></template></UiButton><UiButton variant="ghost" size="sm" icon-only @click="removeReport(report)" aria-label="PDF 삭제"><template #icon-left><UiIcon name="trash-2" :size="16" /></template></UiButton></div>
    </section>
    <footer class="flow-footer"><UiIcon name="info" :size="14" />한국투자증권 장중 집계 · 1분 간격 조회 · 표시 시각은 서버 수집 시각이며 원천 데이터 갱신 시각과 다를 수 있습니다.</footer>
  </div>
</template>


<style scoped>
.reading-grid{display:grid;grid-template-columns:120px 1fr;gap:12px;font-size:13px;line-height:1.7;margin:18px 0}.reading-grid dt{color:#64748b}.reading-grid dd{margin:0;font-weight:500}@media(max-width:600px){.reading-grid{grid-template-columns:1fr;gap:5px}.reading-grid dd{margin-bottom:10px}}
.flow-page { --accent: #4f6af6; color: #19253b; display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; }
.flow-page * { box-sizing: border-box; }
.flow-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.flow-header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; }
.flow-date-control { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.flow-date-label { color: #6c7890; font-size: 12px; white-space: nowrap; }
.eyebrow { color: #7582a5; font-size: 10px; font-weight: 700; letter-spacing: .15em; }
h1 { font-size: 27px; line-height: 1.3; letter-spacing: -.8px; margin: 5px 0 8px; }
.flow-header p { font-size: 13px; color: #7d889f; margin: 0; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #9da8bb; }
.status-dot--live { background: #18a47a; }
.panel { background: #fff; border: 1px solid #e6ebf3; border-radius: 14px; padding: 21px; min-width: 0; }
h2 { font-size: 14px; font-weight: 650; margin: 0; display: flex; align-items: center; gap: 8px; }
h2 :deep(svg) { color: var(--accent); }
.muted { color: #8a95a8; font-size: 11px; }
.flow-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e8edf5; padding: 6px 0 0; }
.flow-tabs { flex: 1; min-width: 0; max-width: 100%; overflow-x: auto; }
.flow-controls { display: flex; gap: 8px; padding-bottom: 6px; }
.flow-date { width: 170px; min-width: 0; }
.flow-window { width: 120px; min-width: 0; }
.icon-button { display: inline-flex; justify-content: center; align-items: center; width: 32px; height: 32px; flex-shrink: 0; border: 1px solid #e4e9f2; border-radius: 7px; background: #fff; color: #8190a5; }
.notice { display: flex; align-items: center; gap: 10px; padding: 13px 16px; font-size: 12px; line-height: 1.6; background: #f2f5ff; color: #6576a3; border: 1px solid #e1e8ff; border-radius: 10px; }
.notice strong { color: #445da1; font-weight: 600; }
.notice > :deep(svg) { flex-shrink: 0; }
.notice button, .history-notice button { margin-left: auto; background: none; border: 0; color: #4f6af6; white-space: nowrap; font-size: 12px; }
.notice--error { background: #fff8f5; color: #ad6555; border-color: #f4e2dc; }
.history-notice { display: flex; align-items: center; gap: 8px; color: #6f7c98; font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-heading { display: flex; align-items: center; gap: 10px; }
.metric-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #f1f4fc; border-radius: 12px; }
.metric-heading h2 { font-size: 13px; }
.metric-heading small { font-size: 10px; color: #9aa4b5; }
.metric-heading :deep(.ui-badge) { margin-left: auto; }
.metric-number { font-size: 31px; font-weight: 700; letter-spacing: -.8px; margin: 20px 0 8px; font-variant-numeric: tabular-nums; color: #8e99ac; }
.metric-number span { font-size: 12px; font-weight: 450; margin-left: 7px; letter-spacing: 0; }
.positive { color: #e55764 !important; }
.negative { color: #4f6af6 !important; }
.metric-summary { font-size: 11px; color: #6c7890; margin: 0; line-height: 1.7; }
.metric-summary span { color: #8994a8; }
.metric-caption { border-top: 1px solid #f0f3f8; margin-top: 14px; padding-top: 10px; color: #929db0; font-size: 10px; line-height: 1.6; }
.small-badge { display: inline-block; padding: 4px 8px; border-radius: 5px; font-size: 10px; font-weight: 500; background: #f3f5f9; color: #8a95a9; white-space: nowrap; }
.small-badge.purple { color: #6b70cc; background: #e9ebff; }
.insight { padding: 20px 22px 14px; border: 1px solid #d9e0ff; background: linear-gradient(110deg, #f0f3ff, #f7f8ff); border-radius: 14px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 17px; }
.insight h2 { color: #364b9a; font-size: 17px; }
.hypotheses { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.hypotheses article { display: flex; align-items: flex-start; gap: 10px; background: #ffffffbf; border-radius: 8px; padding: 14px; }
.hypotheses p { font-size: 12px; line-height: 1.7; margin: 0; color: #687590; }
.insight-footer { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #8390ad; margin-top: 12px; line-height: 1.6; }
.analysis-grid { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr); gap: 14px; align-items: start; }
.charts-panel { display: flex; flex-direction: column; gap: 12px; }
.charts-panel .section-heading { margin-bottom: 5px; }
.chart-footnote { color: #919caf; font-size: 10px; line-height: 1.7; margin: 4px 0 0; }
.flow-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.checks-panel ol { list-style: none; padding: 0; margin: 18px 0 13px; }
.checks-panel li { display: flex; align-items: center; gap: 10px; padding: 15px 0; border-bottom: 1px solid #edf0f6; font-size: 12px; line-height: 1.6; }
.checks-panel li > :deep(svg) { color: #b5bdcc; flex-shrink: 0; margin-left: auto; }
.check-num { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 50%; background: #f1f4fa; color: #8796b2; font-size: 10px; flex-shrink: 0; }
.next-check { padding: 11px 12px; background: #f0f3ff; border-radius: 7px; display: flex; align-items: center; gap: 8px; color: var(--accent); font-size: 12px; }
.checks-panel > p { font-size: 10px; color: #929db0; line-height: 1.7; margin-bottom: 0; }
.index-panel { display: flex; flex-direction: column; gap: 9px; }
.index-panel strong { font-size: 28px; letter-spacing: -.6px; font-variant-numeric: tabular-nums; }
.index-panel > span { font-size: 13px; }
.index-panel small { color: #9ca5b5; font-size: 10px; margin-left: 5px; }
.index-time { color: #9ca5b5; font-size: 10px; padding-top: 6px; }
.principle-panel { background: #fafbfe; border-style: dashed; color: #8794af; }
.principle-panel h3 { font-size: 12px; color: #6c7b99; margin: 10px 0 8px; }
.principle-panel p { font-size: 11px; line-height: 1.8; margin: 0; }
.text-button { border: 0; background: none; display: inline-flex; align-items: center; gap: 5px; color: var(--accent); font-size: 11px !important; padding: 0; }
.empty-inline { text-align: center; padding: 18px; color: #9ba5b7; font-size: 12px; }
.timeline { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px; }
.timeline-item { min-width: 170px; max-width: 200px; padding: 13px; border: 1px solid #e9edf5; border-radius: 10px; }
.timeline-item p { margin: 8px 0 0; font-size: 11px; line-height: 1.6; }
.timeline strong { font-size: 12px; color: #4e6094; }
.timeline-dot { position: absolute; left: 11px; top: 17px; width: 6px; height: 6px; border-radius: 50%; background: #b7c2db; }
.selected .timeline-dot { background: var(--accent); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 65px 20px; text-align: center; color: #a2abc0; }
.empty-state h3 { font-size: 16px; font-weight: 550; color: #73829e; margin: 20px 0 5px; }
.empty-state p { font-size: 12px; line-height: 1.8; }
.table-wrap { overflow-x: auto; }
.history-panel :deep(.ui-table-wrapper) { max-width: 100%; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 12px; white-space: nowrap; text-align: left; }
th { background: #f6f8fc; padding: 12px; color: #7b88a1; font-weight: 500; }
td { padding: 13px 12px; border-bottom: 1px solid #edf0f6; color: #56647f; }
.review-match { display: block; font-size: 10px; color: #93a0b4; margin-top: 5px; }
.review-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.review-summary article > span { color: #7f8ca3; font-size: 12px; }
.review-summary strong { display: block; font-size: 29px; margin-top: 15px; }
.review-summary small { font-size: 12px; color: #a1aabe; font-weight: 400; margin-left: 6px; }
.review-summary p { font-size: 10px; color: #96a1b4; }
.primary-button { display: inline-flex; gap: 6px; align-items: center; border: none; border-radius: 7px; background: var(--accent); color: white; padding: 9px 12px; font-size: 12px !important; white-space: nowrap; }
.reports-panel .muted { margin: 8px 0 0; line-height: 1.6; }
.report-note input { width: 100%; background: #fafbfe; border: 1px solid #e8edf4; border-radius: 7px; padding: 11px 13px; color: #65748e; font-size: 12px; }
.report-note input::placeholder { color: #a3aec0; }
.report-empty { margin-top: 12px; color: #9ba6b9; font-size: 11px; }
.report-row { display: flex; align-items: center; gap: 12px; padding: 15px 0 0; color: #8c9abd; }
.report-row > div { flex: 1; min-width: 0; }
.report-name { border: 0; background: none; padding: 0; color: #536a9d; font-size: 12px !important; text-align: left; overflow-wrap: anywhere; }
.report-name { height: auto; white-space: normal; max-width: 100%; }
.report-row small { display: block; color: #9aa5b7; font-size: 10px; line-height: 1.7; margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
.flow-footer { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #97a3b8; line-height: 1.7; }
.connection-panel p { font-size: 12px; line-height: 1.8; color: #8190a9; }
.connection-panel dl { display: flex; flex-wrap: wrap; gap: 24px; font-size: 12px; }
.connection-panel dt { color: #929eb3; font-size: 10px; margin-bottom: 6px; }
.connection-panel dd { margin: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.spinning { animation: rotate 1s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 1000px) { .analysis-grid { grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr); } .panel { padding: 17px; } .metric-number { font-size: 25px; } .metric-summary span { display: block; } .flow-toolbar { flex-wrap: wrap; } }
@media (max-width: 700px) { .flow-header { align-items: flex-start; flex-direction: column; gap: 12px; } h1 { font-size: 24px; } .flow-toolbar { gap: 8px; } .flow-toolbar nav { width: 100%; gap: 22px; } .flow-controls { width: 100%; } .flow-controls input { width: 145px; } .metrics { grid-template-columns: 1fr; gap: 10px; } .metric { padding: 15px 17px; } .metric-number { margin: 13px 0 5px; } .metric-summary span { display: inline; } .metric-caption { margin-top: 8px; padding-top: 8px; } .hypotheses { grid-template-columns: 1fr; } .insight { padding: 17px; } .insight h2 { font-size: 15px; } .insight .section-heading { align-items: flex-start; flex-wrap: wrap; } .analysis-grid { grid-template-columns: 1fr; } .flow-side { display: grid; grid-template-columns: 1fr; } .review-summary { gap: 8px; } .review-summary .panel { padding: 12px; } .review-summary article > span { font-size: 10px; } .review-summary strong { font-size: 24px; } .notice { flex-wrap: wrap; } .section-heading .muted { font-size: 10px; } .reports-panel .section-heading { align-items: flex-start; } .flow-footer { align-items: flex-start; } }
@media (prefers-reduced-motion: reduce) { .spinning { animation: none; } }
@media (max-width: 700px) { .flow-header-actions { width: 100%; justify-content: flex-start; } .flow-tabs { flex-basis: 100%; } .flow-window { width: 116px; flex-shrink: 0; } }
</style>
