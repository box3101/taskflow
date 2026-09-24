<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { UiAlert, UiBadge, UiButton, UiEmpty, UiTable } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import FlowMiniChart from './FlowMiniChart.vue'

const props = defineProps<{ date: string }>()
interface Review {
  date: string; previous: number; friday: number; open: number; close: number
  gapPct: number; closeVsPreviousPct: number; closeVsOpenPct: number
  high: { time: string; value: number }; low: { time: string; value: number }
  source: string; retrievedAt: string; repositoryCommit: string; barCount: number
  points: { time: string; value: number }[]
  snapshots: { localDateTime: string; currentPrice: number }[]
}
const review = ref<Review | null>(null)
const loading = ref(false)
const error = ref('')
let request = 0
let controller: AbortController | undefined
async function load() {
  const id = ++request
  controller?.abort(); controller = new AbortController()
  review.value = null; error.value = ''; loading.value = true
  try {
    const response = await api.get<{ data: Review | null }>('/market-flow/retrospective', { params: { date: props.date }, signal: controller.signal, timeout: 10000 })
    if (id === request) review.value = response.data.data
  } catch (err: any) {
    if (id === request && err.code !== 'ERR_CANCELED') error.value = '리포트 비교를 불러오지 못했습니다.'
  } finally { if (id === request) loading.value = false }
}
watch(() => props.date, load, { immediate: true })
onUnmounted(() => { request++; controller?.abort() })
const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
const columns: TableColumn[] = [
  { key: 'time', label: '시각' }, { key: 'price', label: '코스피', align: 'right' },
  { key: 'previous', label: '전일 대비', align: 'right' }, { key: 'open', label: '시가 대비', align: 'right' },
]
const rows = computed(() => review.value?.snapshots.map(r => ({
  time: `${r.localDateTime.slice(8, 10)}:${r.localDateTime.slice(10, 12)}`, price: fmt(r.currentPrice),
  previous: pct((r.currentPrice / review.value!.previous - 1) * 100), open: pct((r.currentPrice / review.value!.open - 1) * 100),
})) || [])
const checkpoints = [
  ['장전', '야간선물·환율 등 당시 자료가 없어 장전 시나리오 선택은 검증하지 못했습니다.'],
  ['09:00~10:00', '갭상승 출발 후 09:10에는 시가 아래로 내려왔고, 10:00에도 시가를 회복하지 못했습니다.'],
  ['10:00~11:30', '11:30 지수는 10:00보다 낮았습니다. 가격 흐름은 추세 상승 시나리오를 뒷받침하지 못했습니다.'],
  ['13:00~14:30', '오후 되돌림이 커졌고 14:30에는 전 거래일 마지막 값 아래로 내려왔습니다.'],
  ['14:30~마감', '15:00 반등 후 재하락했습니다. 비차익 매도나 외국인 헤지가 원인인지는 확인할 수 없습니다.'],
]
</script>

<template>
  <section class="historical-review" aria-label="장전 리포트 비교">
    <UiEmpty v-if="loading" description="장전 리포트 비교를 불러오는 중입니다." />
    <div v-else-if="error"><UiAlert variant="error" :description="error" /><UiButton variant="outline" @click="load">다시 시도</UiButton></div>
    <template v-else-if="review">
      <div class="review-heading"><div><h2>{{ date }} 장전 리포트 비교</h2><p>장전 시나리오와 실제 가격 흐름을 나란히 확인합니다.</p></div><UiBadge variant="warning">사후 재구성</UiBadge></div>
      <UiAlert variant="info" title="가격 모양은 B: 갭업 후 되돌림과 가장 비슷합니다" description="외국인·프로그램 매도 전환 조건은 미확인입니다. 당시 확정 예측이나 적중률로 채점하지 않습니다." />
      <div class="review-metrics">
        <article><span>시가</span><strong>{{ fmt(review.open) }}</strong><small>전일 대비 {{ pct(review.gapPct) }}</small></article>
        <article><span>마지막 기록</span><strong>{{ fmt(review.close) }}</strong><small>전일 대비 {{ pct(review.closeVsPreviousPct) }}</small></article>
        <article><span>시가 대비 변화</span><strong>{{ pct(review.closeVsOpenPct) }}</strong><small>갭상승분 대부분 반납</small></article>
      </div>
      <div class="review-card"><FlowMiniChart :points="review.points" label="9월 22일 코스피 분봉" unit="pt" /><p>고가 {{ fmt(review.high.value) }} ({{ review.high.time }}) · 저가 {{ fmt(review.low.value) }} ({{ review.low.time }})</p><small>09:00~15:32 · {{ review.barCount }}개 분봉 · 선은 분봉 종가를 연결합니다.</small></div>
      <UiAlert variant="warning" title="PDF 기준일을 바로잡아야 합니다" :description="`PDF는 9월 18일 ${fmt(review.friday)}를 기준으로 썼지만, 22일의 직전 거래일은 21일이며 마지막 기록은 ${fmt(review.previous)}입니다. 위 등락률은 21일 기준으로 계산했습니다.`" />
      <div class="review-card"><h3>시간대별 실제 지수</h3><div class="review-table"><UiTable :columns="columns" :data="rows" /></div><small>09:00 표 값은 봉 종가이므로 시가와 다릅니다. 마지막 값은 원천 시세 기준이며 거래소 확정 일봉과 별도 대조하지 않았습니다.</small></div>
      <div class="review-card"><h3>PDF 체크리스트 복기</h3><article v-for="[time, text] in checkpoints" :key="time" class="checkpoint"><strong>{{ time }}</strong><p>{{ text }}</p></article></div>
      <UiAlert variant="warning" title="외국인 수급 검증은 보류" description="이 날짜의 현물·선물·비차익 장중 기록은 확보되지 않았습니다. 가격 하락을 외국인 매도로 바꿔 해석하거나 현재 수급 데이터로 채우지 않았습니다." />
      <p class="review-source">출처: Average {{ review.repositoryCommit }}의 18·21일 기록, 사용자 제공 22일 장전 PDF(p.1, 8~14), <a :href="review.source" target="_blank" rel="noopener noreferrer">네이버 22일 지수 분봉</a> · 조회 {{ new Date(review.retrievedAt).toLocaleString('ko-KR') }}</p>
    </template>
    <UiEmpty v-else :description="`${date}에 등록된 장전 리포트 비교가 없습니다. 2026년 9월 22일을 선택해 주세요.`" />
  </section>
</template>

<style scoped>
.historical-review { display: grid; gap: 16px; min-width: 0; }
.review-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
h2 { font-size: 20px; margin: 0; } h3 { font-size: 15px; margin: 0 0 14px; }
p { margin: 6px 0; color: #53617b; line-height: 1.7; font-size: 13px; }
small { font-size: 12px; color: #7b879c; line-height: 1.7; }
.review-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
.review-metrics article, .review-card { background: white; border: 1px solid #e5eaf3; border-radius: 14px; padding: 20px; min-width: 0; }
.review-metrics article { display: grid; gap: 8px; } .review-metrics span { font-size: 12px; color: #53617b; }
.review-metrics strong { font-size: 27px; } .review-table { overflow-x: auto; }
.review-card :deep(canvas) { max-width: 100%; }
.checkpoint { display: grid; grid-template-columns: 130px 1fr; padding: 10px 0; border-top: 1px solid #edf0f6; font-size: 13px; align-items: baseline; }
.checkpoint p { margin: 0; } .review-source { font-size: 11px; overflow-wrap: anywhere; }
.review-source a { color: #4f6af6; }
@media(max-width:640px) { .review-metrics { grid-template-columns: 1fr; } .review-heading { align-items: flex-start; } .checkpoint { grid-template-columns: 1fr; gap: 5px; } }
</style>
