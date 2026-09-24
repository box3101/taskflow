<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiCalendarMonth, UiIcon } from '@leechanyong/ispark-ui'
import type { CalendarMonthEvent } from '@leechanyong/ispark-ui'
import api from '../../api/client'

const props = defineProps<{ date: string; refreshKey: string }>()
const emit = defineEmits<{ select: [date: string]; open: [date: string, tab: string] }>()
interface Day { date: string; records: number; pdf: number; pdfReady: number; ai: number; flowAi: number; ragAi: number; deepReviews: number; closingReviews: number; retrospective: boolean }
const year = ref(Number(props.date.slice(0, 4))), month = ref(Number(props.date.slice(5, 7)))
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const monthKey = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)
const days = ref<Day[]>([])
const loading = ref(false), error = ref('')
let controller: AbortController | undefined, version = 0, disposed = false
const selected = computed(() => days.value.find(d => d.date === props.date))
const totals = computed(() => ({ records: days.value.filter(d => d.records).length, pdf: days.value.reduce((n,d) => n+d.pdf,0), ai: days.value.reduce((n,d) => n+d.ai,0), reviews: days.value.filter(d => d.closingReviews).length }))
const events = computed<CalendarMonthEvent[]>(() => days.value.flatMap(d => {
  const entries: [string, string, string][] = []
  if (d.records) entries.push(['records', `수급 ${d.records}`, '#4f6af6'])
  if (d.pdf) entries.push(['pdf', `PDF ${d.pdf}`, '#0891b2'])
  if (d.ai) entries.push(['ai', `AI ${d.ai}`, '#8b5cf6'])
  if (d.closingReviews) entries.push(['close', '마감 복기', '#059669'])
  else if (d.deepReviews) entries.push(['review', '심층 검토', '#059669'])
  if (d.retrospective) entries.push(['retrospective', '장전 비교', '#d97706'])
  return entries.map(([key,title,color]) => ({ id: `${d.date}-${key}`, start: d.date, title, color, allDay: true }))
}))
function select(date: string) {
  if (date > today()) return
  const [y, m] = date.split('-').map(Number)
  year.value = y!; month.value = m!; emit('select', date)
}
function move(offset: number) {
  const d = new Date(Date.UTC(year.value, month.value - 1 + offset, 1))
  year.value = d.getUTCFullYear(); month.value = d.getUTCMonth() + 1
}
function open(tab: string) { if (selected.value) emit('open', selected.value.date, tab) }
async function load() {
  const request = ++version
  controller?.abort(); controller = new AbortController(); loading.value = true; error.value = ''
  try {
    const res = await api.get('/market-flow/calendar', { params: { month: monthKey.value }, signal: controller.signal })
    if (!disposed && request === version) days.value = res.data.data.days
  } catch (e: any) {
    if (!disposed && request === version && e.code !== 'ERR_CANCELED') { days.value = []; error.value = e.response?.data?.message || '달력 기록을 불러오지 못했습니다.' }
  } finally { if (!disposed && request === version) loading.value = false }
}
watch(monthKey, () => { days.value = []; void load() }, { immediate: true })
watch(() => props.refreshKey, () => { if (!loading.value) void load() })
watch(() => props.date, date => { year.value = Number(date.slice(0,4)); month.value = Number(date.slice(5,7)) })
onUnmounted(() => { disposed = true; version++; controller?.abort() })
</script>

<template>
  <section class="market-calendar">
    <div class="month-heading"><div><h2>매일의 시장 기록</h2><p>수급부터 PDF, AI 판단, 장 마감 복기까지 날짜별로 확인하세요.</p></div><div class="month-controls"><UiButton size="sm" variant="outline" @click="select(today())">오늘</UiButton><UiButton size="sm" variant="ghost" :loading="loading" @click="load">새로고침</UiButton></div></div>
    <UiAlert v-if="error" variant="error" :description="error" />
    <div class="month-stats" :aria-busy="loading">
      <article><span>수급 기록일</span><strong>{{ loading || error ? '—' : totals.records }}<small>일</small></strong></article>
      <article><span>참고 PDF</span><strong>{{ loading || error ? '—' : totals.pdf }}<small>개</small></strong></article>
      <article><span>기본 AI 판단</span><strong>{{ loading || error ? '—' : totals.ai }}<small>건</small></strong></article>
      <article><span>마감 복기 완료</span><strong>{{ loading || error ? '—' : totals.reviews }}<small>일</small></strong></article>
    </div>
    <div class="calendar-layout">
      <div class="calendar-box">
        <div class="month-heading"><h3>{{ year }}년 {{ month }}월</h3><div class="month-controls"><UiButton variant="ghost" size="sm" icon-only aria-label="이전 달" :disabled="monthKey <= '2000-01'" @click="move(-1)"><template #icon-left><UiIcon name="chevron-left" :size="18" /></template></UiButton><UiButton variant="ghost" size="sm" icon-only aria-label="다음 달" :disabled="monthKey >= today().slice(0,7)" @click="move(1)"><template #icon-left><UiIcon name="chevron-right" :size="18" /></template></UiButton></div></div>
        <p v-if="loading" class="note" role="status">날짜별 기록을 불러오는 중입니다.</p>
        <UiCalendarMonth v-model:year="year" v-model:month="month" :events="events" :selected-date="date" :today="today()" :max-lanes="5" :swipeable="false" @select-date="select" @select-event="select($event.start.slice(0,10))" />
        <p class="note">표시가 없는 날은 저장된 자료가 없는 날입니다. 휴장 여부를 뜻하지 않습니다. AI 건수는 수급만·PDF 포함 판단을 각각 셉니다.</p>
      </div>
      <aside class="day-summary">
        <span class="eyebrow">선택한 날짜</span><h3>{{ date }}</h3>
        <p v-if="loading" class="note">기록 확인 중…</p>
        <template v-else-if="selected && !error">
          <UiBadge v-if="date === today()">오늘</UiBadge>
          <div class="day-item"><span>수급 관측</span><strong>{{ selected.records }}건</strong></div>
          <div class="day-item"><span>참고 PDF</span><strong>{{ selected.pdf }}개</strong></div><p v-if="selected.pdf" class="note">검색 준비 완료 {{ selected.pdfReady }}개</p>
          <div class="day-item"><span>수급만 AI / PDF AI</span><strong>{{ selected.flowAi }} / {{ selected.ragAi }}건</strong></div>
          <div class="day-item"><span>심층 검토</span><strong>{{ selected.deepReviews }}건</strong></div>
          <div class="day-item"><span>장 마감 복기</span><strong>{{ selected.closingReviews ? '완료' : '미작성' }}</strong></div>
          <UiButton size="sm" @click="open('live')">그날 수급 보기</UiButton>
          <UiButton size="sm" variant="outline" @click="open('agent')">AI 판단·복기 보기</UiButton>
          <UiButton size="sm" variant="ghost" @click="open('pdf')">참고 PDF 보기·추가</UiButton>
          <UiButton v-if="selected.retrospective" size="sm" variant="outline" @click="open('retrospective')">장전 리포트 비교</UiButton>
        </template>
        <p v-else class="note">달력에서 확인할 날짜를 선택하세요.</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.market-calendar { display: grid; gap: 18px; min-width: 0; }h2,h3,p { margin: 0; }h2 { font-size: 20px; }h3 { font-size: 17px; }.month-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }.month-heading p { color: #7c879c; font-size: 12px; margin-top: 6px; }.month-controls { display: flex; align-items: center; gap: 8px; }
.month-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }.month-stats article { padding: 18px; border: 1px solid #e5eaf4; border-radius: 12px; background: #fff; }.month-stats span { font-size: 12px; color: #6e7b91; }.month-stats strong { display: block; font-size: 27px; margin-top: 8px; }.month-stats small { font-size: 12px; margin-left: 5px; font-weight: 400; }
.calendar-layout { display: grid; grid-template-columns: minmax(0,1fr) 270px; align-items: start; gap: 18px; }.calendar-box,.day-summary { background: #fff; border: 1px solid #e5eaf4; border-radius: 14px; padding: 18px; min-width: 0; }.calendar-box>.month-heading { margin-bottom: 12px; }.day-summary { display: flex; flex-direction: column; gap: 14px; }.eyebrow { font-size: 11px; color: #8793aa; }.day-item { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }.day-item span { color: #748098; }.note { color: #8793a8; font-size: 11px; line-height: 1.8; margin-top: 8px; }
@media(max-width:1000px) { .calendar-layout { grid-template-columns: minmax(0,1fr); }.day-summary { display: grid; grid-template-columns: 1fr 1fr; }.day-summary>h3,.day-summary>.eyebrow,.day-summary>.note { grid-column: 1/-1; } }
@media(max-width:600px) { .month-stats { grid-template-columns: 1fr 1fr; gap: 8px; }.month-stats article { padding: 12px; }.calendar-box { padding: 8px; }.day-summary { display: flex; }.calendar-box :deep(.ui-calendar-month) { font-size: 10px; } }
</style>
