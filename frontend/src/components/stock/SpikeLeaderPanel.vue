<script setup>
import { computed, ref } from 'vue'
import { UiIcon, UiButton, UiBadge, UiTab, UiTable, UiEmpty, UiDrawer } from '@leechanyong/ispark-ui'

const props = defineProps({ rows: { type: Array, default: () => [] }, loading: Boolean, lastCapturedAt: String, fee: Number })
const emit = defineEmits(['detail'])
const filter = ref('all')
const showRules = ref(false)
const selectedKey = ref(null)
const tabs = [{ label: '전체', value: 'all' }, { label: '필터 통과', value: 'pass' }, { label: '제외', value: 'excluded' }, { label: '판단 불가', value: 'unknown' }]
// Historical peer universes and point-in-time turnover have not been verified yet.
// Never infer a leader from the alert list or from today's theme membership.
const signals = computed(() => props.rows.filter(r => !r.isAuto))
const status = row => row.leader?.status || 'unknown'
const statusText = row => ({pass:'통과',excluded:'제외',unknown:'판단 불가'})[status(row)]
const statusVariant = row => ({pass:'success',excluded:'default',unknown:'warning'})[status(row)]
const reason = row => row.leader?.reason || '순위 수집 시작 전 알림'
const visible = computed(() => signals.value.filter(r => filter.value === 'all' || status(r) === filter.value))
const selected = computed(() => visible.value.find(r => r.key === selectedKey.value))
const columns = [
  { key: 'date', label: '날짜', width: '100px' },
  { key: 'time', label: '시각', width: '70px' },
  { key: 'name', label: '종목 / 테마', width: '190px' },
  { key: 'price', label: '알림가', width: '100px', align: 'right' },
  { key: 'turnover', label: '테마 거래대금 순위', width: '160px' },
  { key: 'strength', label: '상승률 순위', width: '120px' },
  { key: 'status', label: '필터 판정', width: '110px' },
  { key: 'reason', label: '근거', width: '220px' },
]
const baseline = computed(() => {
  const values = signals.value.filter(r => r.graded && Number.isFinite(r.close)).map(r => r.close)
  return { n: values.length }
})
const confirmed = computed(() => signals.value.filter(r => ['pass','excluded'].includes(status(r))))
const passed = computed(() => confirmed.value.filter(r => status(r) === 'pass'))
const performance = rows => {
  const values = rows.filter(r => r.graded && Number.isFinite(r.close)).map(r => r.close-props.fee)
  if (!values.length || !Number.isFinite(props.fee)) return null
  return { n:values.length, win:(values.filter(v=>v>0).length/values.length*100).toFixed(1), net:(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2) }
}
const allPerf = computed(() => performance(confirmed.value))
const passPerf = computed(() => performance(passed.value))
const money = value => Number.isFinite(value) ? `${(value/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})}억` : '—'
</script>

<template>
  <div class="leader-panel">
    <div class="filter-banner">
      <UiIcon name="shield-check" :size="22" />
      <div class="filter-copy"><strong>대장주 필터</strong><span>알림 당시 테마 내 누적 거래대금 1위</span><small>관찰 종목 기준 · 자료 부족 시 판단 불가</small></div>
      <UiButton variant="outline" size="sm" @click="showRules = true">필터 기준 보기</UiButton>
    </div>
    <p class="footnote">{{ lastCapturedAt ? `최근 순위 수집 ${new Date(lastCapturedAt).toLocaleString('ko-KR')} · 신호 당시 순위 고정 저장` : '순위 수집 대기 · 탐지기 실행 후 새 알림부터 판정됩니다.' }}</p>

    <div class="section-title"><h2>같은 조건으로 성적 비교</h2><span>선택한 날짜·라벨 기준 · 실매매 기록 제외</span></div>
    <div class="comparison">
      <article class="comparison-card">
        <div class="card-title"><h3>전체 알림 신호</h3><UiBadge size="sm">원본 기록</UiBadge></div>
        <dl class="metrics"><div><dt>순위 확인·채점 완료</dt><dd>{{ allPerf?.n ?? 0 }}<small>건</small></dd></div><div><dt>비용 후 승률</dt><dd>{{ allPerf ? `${allPerf.win}%` : '—' }}</dd></div><div><dt>평균 순수익</dt><dd>{{ allPerf ? `${allPerf.net}%` : '—' }}</dd></div></dl>
        <p>조회 {{ signals.length }}건 중 순위 확인 {{ confirmed.length }}건 · 알림가 → 종가 · 비용 {{ fee ?? '—' }}% 차감</p>
      </article>
      <article class="comparison-card accent">
        <div class="card-title"><h3>대장주 필터 통과</h3><UiBadge :variant="passPerf ? 'info' : 'warning'" size="sm">{{ passPerf ? '관찰 성적' : '채점 대기' }}</UiBadge></div>
        <dl class="metrics"><div><dt>분석 건수</dt><dd>{{ passPerf?.n ?? 0 }}<small>건</small></dd></div><div><dt>비용 후 승률</dt><dd>{{ passPerf ? `${passPerf.win}%` : '—' }}</dd></div><div><dt>평균 순수익</dt><dd>{{ passPerf ? `${passPerf.net}%` : '—' }}</dd></div></dl>
        <p>통과 {{ passed.length }}건 · 동일한 원본 종가 채점 기준 · 미채점 신호 제외</p>
      </article>
    </div>

    <section class="signals-card">
      <div class="signals-heading"><h2>점화 신호 <span>{{ visible.length }}건</span></h2><UiTab v-model="filter" :tabs="tabs" size="sm" aria-label="대장주 필터 판정" /></div>
      <div class="signal-filters"><slot name="filters" /></div>
      <UiTable v-if="visible.length" :columns="columns" :data="visible" row-key="key" size="sm" sticky-header max-height="440px" clickable @row-click="row => selectedKey = row.key">
        <template #cell-name="{ row }"><div class="stock-name">{{ row.name }}<small>{{ row.theme }} · {{ row.code }}</small></div></template>
        <template #cell-price="{ row }">{{ row.price?.toLocaleString('ko-KR') ?? '—' }}</template>
        <template #cell-turnover="{row}"><span>{{ row.leader?.rank ? `${row.leader.rank}위 / ${row.leader.total}종목${row.leader.tied ? ' (공동)' : ''}` : '—' }}</span></template>
        <template #cell-strength="{row}">{{ row.leader?.strengthRank ? `${row.leader.strengthRank}위` : '—' }}</template>
        <template #cell-status="{row}"><UiBadge :variant="statusVariant(row)" size="sm">{{ statusText(row) }}</UiBadge></template>
        <template #cell-reason="{row}"><span class="reason">{{ reason(row) }}</span></template>
      </UiTable>
      <UiEmpty v-else :title="loading ? '기록을 불러오는 중입니다' : filter === 'pass' ? '아직 검증된 통과 신호가 없습니다' : '조건에 맞는 신호가 없습니다'" :description="filter === 'pass' ? '거래대금 순위가 확인되면 통과한 신호를 여기에서 볼 수 있습니다.' : '날짜와 라벨을 확인해 주세요.'" />
      <div v-if="selected" class="selection-detail">
        <div><h3>{{ selected.name }} · 판정 근거</h3><p>{{ selected.date }} {{ selected.time }} 알림 시점 기준</p><UiBadge :variant="statusVariant(selected)" size="sm">{{ statusText(selected) }}</UiBadge><p>{{ reason(selected) }}</p><div v-for="peer in (selected.leader?.peers || []).slice(0,5)" :key="peer.code" class="peer"><span>{{ peer.name }}</span><meter min="0" :max="selected.leader.peers[0]?.turnoverWon || 1" :value="peer.turnoverWon" /><span>{{ money(peer.turnoverWon) }}</span></div><p v-if="selected.leader">확보 {{ selected.leader.available }} / {{ selected.leader.total }}종목 · {{ selected.leader.basis }}</p></div>
        <div><h3>판정에 사용하는 정보</h3><dl class="evidence"><dt>비교 테마</dt><dd>{{ selected.theme }}</dd><dt>거래대금</dt><dd>알림 당시 누적 기준</dd><dt>상승률 순위</dt><dd>참고용 · 필터 미반영</dd></dl><UiButton size="sm" variant="outline" @click="emit('detail', selected)">원본 알림 상세 보기</UiButton></div>
      </div>
      <p class="footnote"><UiIcon name="info" :size="14" />순위 미확인은 제외 판정과 다릅니다. 검증되지 않은 순위와 성적은 표시하지 않습니다.</p>
    </section>

    <UiDrawer :open="showRules" title="대장주 필터 기준" width="440px" :confirm-before-close="false" :show-fullscreen="false" @update:open="showRules = $event">
      <div class="rules"><UiBadge variant="info">관찰용 필터</UiBadge><h3>누적 거래대금 1위만 선별</h3><p>점화 알림 시점에 같은 테마의 관찰 종목을 비교합니다. 누적 거래대금 1위(공동 포함)는 통과, 2위 이하는 제외합니다. 당일 비교 종목은 첫 실행 때 고정 저장합니다.</p><h3>자료가 부족하면 판단 불가</h3><p>테마의 모든 비교 종목이 확보되어야 합니다. 수집 20초 초과, 원본 시세 90초 초과 지연, 누락, 미래 시각이면 판정하지 않습니다. 수집 시작 전 알림은 소급 추정하지 않습니다.</p><h3>같은 조건으로 비교</h3><p>순위가 확인된 신호와 그중 통과한 신호를 원본의 알림가→종가 수익률로 비교하고 동일한 비용을 차감합니다. 체결을 재현한 실매매 성적은 아닙니다.</p><p>상승률 순위는 참고 정보입니다. 시장 전체가 아닌 관찰 종목 안의 순위이며, 장 마감 후 순위를 과거 신호에 적용하지 않습니다.</p></div>
    </UiDrawer>
  </div>
</template>

<style scoped>
.peer{display:grid;grid-template-columns:90px 1fr 70px;gap:8px;align-items:center;font-size:12px;margin-top:10px}.peer meter{width:100%;accent-color:#546bfa}
.leader-panel{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.filter-banner{display:flex;align-items:center;gap:14px;padding:18px 20px;background:#f0f4ff;border:1px solid #d3deff;border-radius:12px;color:#344cbd}.filter-copy{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;flex:1;font-size:13px}.filter-copy strong{font-size:15px}.filter-copy small{font-size:11px;color:#70809b}.section-title,.signals-heading,.card-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title{justify-content:flex-start;flex-wrap:wrap}.section-title h2,.signals-heading h2{font-size:16px;margin:0}.section-title>span,.signals-heading h2 span{font-size:12px;color:#7a879b;font-weight:400}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.comparison-card,.signals-card{background:#fff;border:1px solid #dfe6f1;border-radius:12px;overflow:hidden}.comparison-card{padding:20px}.comparison-card.accent{background:linear-gradient(115deg,#f3f6ff,#f9faff);border-color:#d1dcff}.card-title{justify-content:flex-start}.card-title h3,.selection-detail h3{font-size:15px;margin:0}.accent h3{color:#3658c4}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:24px 0 18px}.metrics>div{padding:0 14px;border-right:1px solid #e3e9f3}.metrics>div:first-child{padding-left:0}.metrics>div:last-child{border:0}.metrics dt{font-size:12px;color:#697a95}.metrics dd{margin:10px 0 0;font-size:25px;font-weight:700;color:#1d3052;font-variant-numeric:tabular-nums}.metrics dd small{font-size:12px;margin-left:4px;font-weight:400}.metrics .pending{font-size:17px;padding-top:5px;color:#8995aa}.comparison-card p,.selection-detail p,.footnote{font-size:12px;color:#7a899f;line-height:1.8;margin:0}.signals-heading{padding:18px 20px 8px;flex-wrap:wrap}.signal-filters{display:grid;gap:8px;padding:0 20px 14px;min-width:0}.stock-name{font-weight:600;font-size:13px}.stock-name small{display:block;font-size:11px;color:#7a899f;font-weight:400;margin-top:5px}.unavailable,.reason{color:#8895a7;font-size:12px}.selection-detail{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:16px;border:1px solid #e2e8f2;border-radius:10px;padding:20px}.selection-detail>div+div{border-left:1px solid #e2e8f2;padding-left:24px}.selection-detail p{margin:10px 0}.evidence{display:grid;grid-template-columns:100px 1fr;gap:10px;font-size:12px}.evidence dt{color:#7a899f}.evidence dd{margin:0}.footnote{display:flex;align-items:center;gap:8px;padding:12px 20px}.rules{font-size:13px;line-height:1.9;color:#596c86}.rules h3{font-size:15px;color:#213657;margin-top:24px}.signals-card :deep(table){min-width:1070px}
@media(max-width:700px){.comparison,.selection-detail{grid-template-columns:1fr}.filter-banner{align-items:flex-start;flex-wrap:wrap}.filter-copy{min-width:200px}.selection-detail>div+div{padding:16px 0 0;border-left:0;border-top:1px solid #e2e8f2}.comparison-card{padding:16px}.metrics>div{padding:0 8px}.metrics dd{font-size:22px}.metrics .pending{font-size:15px}.signals-heading{padding:16px}.signal-filters{padding:0 12px 12px}.footnote{align-items:flex-start}.metrics dt{font-size:11px}}
</style>
