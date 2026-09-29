<script setup>
import { computed, ref } from 'vue'
import { UiIcon, UiButton, UiBadge, UiTab, UiTable, UiEmpty, UiDrawer } from '@leechanyong/ispark-ui'

const props = defineProps({ rows: { type: Array, default: () => [] }, board: { type: Array, default: () => [] }, loading: Boolean, lastCapturedAt: String, fee: Number })
const boardTheme = ref('')
const boardThemes = computed(() => [...new Set(props.board.map(r=>r.theme))].sort())
const boardRows = computed(() => props.board.filter(r=>r.theme===(boardTheme.value || boardThemes.value[0]) && (r.rank===null || r.rank<=3)).sort((a,b)=>(a.rank??999)-(b.rank??999)))
const boardColumns = [{key:'name',label:'후보 종목'},{key:'rank',label:'누적 순위'},{key:'turnover5m',label:'최근 5분 거래대금'},{key:'turnoverRatio',label:'직전 5분 대비'},{key:'relative5m',label:'테마 대비 5분 강도'}]
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
  { key: 'recent', label: '최근 5분 거래대금', width: '140px' },
  { key: 'acceleration', label: '직전 5분 대비', width: '120px' },
  { key: 'relative', label: '테마 대비 5분 강도', width: '150px' },
  { key: 'status', label: '필터 판정', width: '110px' },
  { key: 'reason', label: '근거', width: '220px' },
]
const baseline = computed(() => {
  const values = signals.value.filter(r => r.graded && Number.isFinite(r.close)).map(r => r.close)
  return { n: values.length }
})
const confirmed = computed(() => signals.value.filter(r => r.leader?.version === 'leader-v2' && ['pass','excluded'].includes(status(r))))
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
      <div class="filter-copy"><strong>대장주 후보 비교</strong><span>세부 테마 거래대금 상위 3위 · 5분 거래대금·가격 강도</span><small>관찰용 · 비교 지표는 추가 탈락 조건이 아닙니다</small></div>
      <UiButton variant="outline" size="sm" @click="showRules = true">필터 기준 보기</UiButton>
    </div>
    <p class="footnote">{{ lastCapturedAt ? `최근 순위 수집 ${new Date(lastCapturedAt).toLocaleString('ko-KR')} · 신호 당시 순위 고정 저장` : '순위 수집 대기 · 탐지기 실행 후 새 알림부터 판정됩니다.' }}</p>
    <section class="signals-card">
      <div class="signals-heading"><h2>최근 수집 기준 · 테마별 후보</h2><label>세부 테마 <select v-model="boardTheme" aria-label="후보 비교 테마"><option value="">{{ boardThemes[0] || '수집 대기' }}</option><option v-for="theme in boardThemes" :key="theme" :value="theme">{{ theme }}</option></select></label></div>
      <UiTable v-if="boardRows.length" :columns="boardColumns" :data="boardRows" row-key="code" size="sm">
        <template #cell-rank="{row}">{{ row.rank ? `${row.rank}위 / ${row.total}` : '판단 불가' }}</template>
        <template #cell-turnover5m="{row}">{{ money(row.turnover5m) }}</template>
        <template #cell-turnoverRatio="{row}">{{ Number.isFinite(row.turnoverRatio) ? `${row.turnoverRatio.toFixed(2)}배` : '—' }}</template>
        <template #cell-relative5m="{row}">{{ Number.isFinite(row.relative5m) ? `${row.relative5m>0?'+':''}${row.relative5m.toFixed(2)}%p` : '—' }}</template>
      </UiTable>
      <UiEmpty v-else title="새 비교 데이터 수집 대기" />
      <p class="footnote">최근 저장 시각 기준입니다. 날짜·라벨 필터는 아래 알림 기록에만 적용됩니다. 5분 강도는 테마 중앙값 대비이며, 배수는 최소 10분 관측 후 표시됩니다.</p>
    </section>

    <div class="section-title"><h2>같은 조건으로 성적 비교</h2><span>새 상위 3위 기준만 비교 · 이전 1위 필터 성적 제외</span></div>
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
      <div class="signals-heading"><h2>점화 신호 <span>{{ visible.length }}건</span></h2></div>
      <div class="signal-toolbar"><UiTab v-model="filter" :tabs="tabs" size="sm" align="left" aria-label="대장주 필터 판정" /><div class="signal-dropdowns"><slot name="filters" /></div></div>
      <UiTable v-if="visible.length" :columns="columns" :data="visible" row-key="key" size="sm" sticky-header max-height="440px" clickable @row-click="row => selectedKey = row.key">
        <template #cell-name="{ row }"><div class="stock-name">{{ row.name }}<small>{{ row.leader?.theme || row.theme }} · {{ row.code }}</small><small v-if="row.leader && row.leader.version !== 'leader-v2'">이전 1위 기준</small></div></template>
        <template #cell-price="{ row }">{{ row.price?.toLocaleString('ko-KR') ?? '—' }}</template>
        <template #cell-turnover="{row}"><span>{{ row.leader?.rank ? `${row.leader.rank}위 / ${row.leader.total}종목${row.leader.tied ? ' (공동)' : ''}` : '—' }}</span></template>
        <template #cell-strength="{row}">{{ row.leader?.strengthRank ? `${row.leader.strengthRank}위` : '—' }}</template>
        <template #cell-recent="{row}">{{ money(row.leader?.turnover5m) }}</template>
        <template #cell-acceleration="{row}">{{ Number.isFinite(row.leader?.turnoverRatio) ? `${row.leader.turnoverRatio.toFixed(2)}배` : '—' }}</template>
        <template #cell-relative="{row}">{{ Number.isFinite(row.leader?.relative5m) ? `${row.leader.relative5m > 0 ? '+' : ''}${row.leader.relative5m.toFixed(2)}%p` : '—' }}</template>
        <template #cell-status="{row}"><UiBadge :variant="statusVariant(row)" size="sm">{{ statusText(row) }}</UiBadge></template>
        <template #cell-reason="{row}"><span class="reason">{{ reason(row) }}</span></template>
      </UiTable>
      <UiEmpty v-else :title="loading ? '기록을 불러오는 중입니다' : filter === 'pass' ? '아직 검증된 통과 신호가 없습니다' : '조건에 맞는 신호가 없습니다'" :description="filter === 'pass' ? '거래대금 순위가 확인되면 통과한 신호를 여기에서 볼 수 있습니다.' : '날짜와 라벨을 확인해 주세요.'" />
      <div v-if="selected" class="selection-detail">
        <div><h3>{{ selected.name }} · 판정 근거</h3><p>{{ selected.date }} {{ selected.time }} 알림 시점 기준</p><UiBadge :variant="statusVariant(selected)" size="sm">{{ statusText(selected) }}</UiBadge><p>{{ reason(selected) }}</p><div v-for="peer in (selected.leader?.peers || []).slice(0,5)" :key="peer.code" class="peer"><span>{{ peer.name }}</span><meter min="0" :max="selected.leader.peers[0]?.turnoverWon || 1" :value="peer.turnoverWon" /><span>{{ money(peer.turnoverWon) }}</span></div><p v-if="selected.leader">확보 {{ selected.leader.available }} / {{ selected.leader.total }}종목 · {{ selected.leader.basis }}</p></div>
        <div><h3>판정에 사용하는 정보</h3><dl class="evidence"><dt>비교 테마</dt><dd>{{ selected.leader?.theme || selected.theme }}</dd><dt>거래대금</dt><dd>알림 당시 누적 상위 3위 · 공동 포함</dd><dt>5분 강도</dt><dd>종목 5분 수익률 − 테마 중앙값</dd><dt>비교 상태</dt><dd>{{ selected.leader?.comparisonNote || '이전 기준 · 비교 자료 없음' }}</dd></dl><UiButton size="sm" variant="outline" @click="emit('detail', selected)">원본 알림 상세 보기</UiButton></div>
      </div>
      <p class="footnote"><UiIcon name="info" :size="14" />순위 미확인은 제외 판정과 다릅니다. 검증되지 않은 순위와 성적은 표시하지 않습니다.</p>
    </section>

    <UiDrawer :open="showRules" title="대장주 필터 기준" width="440px" :confirm-before-close="false" :show-fullscreen="false" @update:open="showRules = $event">
      <div class="rules"><UiBadge variant="info">관찰용 필터 · v2</UiBadge><h3>세부 테마 거래대금 상위 3위</h3><p>알림 당시 누적 거래대금 순위로 후보를 고릅니다. 공동 순위를 포함하므로 3종목을 넘을 수 있습니다. 비교 종목이 2~3개인 테마는 모두 후보가 될 수 있고, 1개뿐이면 판단 불가입니다. 당일 비교 목록을 고정하며 기존 점화 신호 조건은 유지합니다.</p><h3>5분 흐름을 함께 비교</h3><p>최근 5분 거래대금은 누적값의 차이입니다. 직전 5분 대비 배수는 최근 5분 거래대금 ÷ 그 이전 5분 거래대금입니다. 가격 강도는 종목의 5분 수익률에서 같은 테마 종목의 5분 수익률 중앙값을 뺀 값(%p)입니다. 이 지표로 추가 탈락시키거나 매수를 지시하지 않습니다.</p><h3>자료 부족은 빈 값으로 표시</h3><p>배수에는 최소 10분 관측이 필요합니다. 직전 거래대금이 0이거나 30초 넘는 수집 공백, 누적값 감소가 있으면 비교값을 만들지 않습니다. 순위는 테마 전체 시세가 확보되어야 합니다. 과거 알림을 현재 순위로 다시 판정하지 않습니다.</p><h3>새 기준 성적만 비교</h3><p>v2 순위가 확인된 전체 신호와 상위 3위 후보를 알림가→종가 수익률로 비교하고 같은 비용을 차감합니다. 이전 1위 기준은 성적에서 제외합니다. 실제 체결을 재현한 실매매 성적은 아닙니다.</p></div>
    </UiDrawer>
  </div>
</template>

<style scoped>
.signal-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 20px;padding:0 20px 12px;min-width:0}.signal-toolbar>:first-child{flex:1 1 310px;width:auto;min-width:0;max-width:100%}.signal-dropdowns{display:flex;align-items:center;gap:8px;flex:0 1 288px;min-width:0;max-width:100%;margin-left:auto}.signal-dropdowns :deep(.spike-label-select){width:160px;min-width:0;flex:1 1 160px}.signal-dropdowns :deep(.spike-date-select){width:120px;min-width:0;flex:1 1 120px}@media(max-width:700px){.signal-toolbar{padding:0 12px 12px;gap:8px 12px}}
.peer{display:grid;grid-template-columns:90px 1fr 70px;gap:8px;align-items:center;font-size:12px;margin-top:10px}.peer meter{width:100%;accent-color:#546bfa}
.leader-panel{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.filter-banner{display:flex;align-items:center;gap:14px;padding:18px 20px;background:#f0f4ff;border:1px solid #d3deff;border-radius:12px;color:#344cbd}.filter-copy{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;flex:1;font-size:13px}.filter-copy strong{font-size:15px}.filter-copy small{font-size:11px;color:#70809b}.section-title,.signals-heading,.card-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title{justify-content:flex-start;flex-wrap:wrap}.section-title h2,.signals-heading h2{font-size:16px;margin:0}.section-title>span,.signals-heading h2 span{font-size:12px;color:#7a879b;font-weight:400}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.comparison-card,.signals-card{background:#fff;border:1px solid #dfe6f1;border-radius:12px;overflow:hidden}.comparison-card{padding:20px}.comparison-card.accent{background:linear-gradient(115deg,#f3f6ff,#f9faff);border-color:#d1dcff}.card-title{justify-content:flex-start}.card-title h3,.selection-detail h3{font-size:15px;margin:0}.accent h3{color:#3658c4}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:24px 0 18px}.metrics>div{padding:0 14px;border-right:1px solid #e3e9f3}.metrics>div:first-child{padding-left:0}.metrics>div:last-child{border:0}.metrics dt{font-size:12px;color:#697a95}.metrics dd{margin:10px 0 0;font-size:25px;font-weight:700;color:#1d3052;font-variant-numeric:tabular-nums}.metrics dd small{font-size:12px;margin-left:4px;font-weight:400}.metrics .pending{font-size:17px;padding-top:5px;color:#8995aa}.comparison-card p,.selection-detail p,.footnote{font-size:12px;color:#7a899f;line-height:1.8;margin:0}.signals-heading{padding:18px 20px 8px;flex-wrap:wrap}.signal-filters{display:grid;gap:8px;padding:0 20px 14px;min-width:0}.stock-name{font-weight:600;font-size:13px}.stock-name small{display:block;font-size:11px;color:#7a899f;font-weight:400;margin-top:5px}.unavailable,.reason{color:#8895a7;font-size:12px}.selection-detail{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:16px;border:1px solid #e2e8f2;border-radius:10px;padding:20px}.selection-detail>div+div{border-left:1px solid #e2e8f2;padding-left:24px}.selection-detail p{margin:10px 0}.evidence{display:grid;grid-template-columns:100px 1fr;gap:10px;font-size:12px}.evidence dt{color:#7a899f}.evidence dd{margin:0}.footnote{display:flex;align-items:center;gap:8px;padding:12px 20px}.rules{font-size:13px;line-height:1.9;color:#596c86}.rules h3{font-size:15px;color:#213657;margin-top:24px}.signals-card :deep(table){min-width:1070px}
@media(max-width:700px){.comparison,.selection-detail{grid-template-columns:1fr}.filter-banner{align-items:flex-start;flex-wrap:wrap}.filter-copy{min-width:200px}.selection-detail>div+div{padding:16px 0 0;border-left:0;border-top:1px solid #e2e8f2}.comparison-card{padding:16px}.metrics>div{padding:0 8px}.metrics dd{font-size:22px}.metrics .pending{font-size:15px}.signals-heading{padding:16px}.signal-filters{padding:0 12px 12px}.footnote{align-items:flex-start}.metrics dt{font-size:11px}}
</style>
