<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { UiBadge, UiSelect, UiAlert, UiEmpty, UiButton } from '@leechanyong/ispark-ui'
import api from '../../api/client'
const data = ref(null), error = ref(''), loading = ref(false)
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const day = ref(today()), variant = ref('')
const dates = computed(() => [...new Set([today(), ...(data.value?.days || []).map(d => d.date)])].sort().reverse().map(value => ({ label: value, value })))
const record = computed(() => data.value?.days.find(d => d.date === day.value))
const arms = computed(() => record.value?.engine?.arms || [])
const variants = computed(() => arms.value.map(a => ({ label: `${Math.round(a.gate / 1e8)}억 · 대장 유지`, value: a.variant })))
const selected = computed(() => arms.value.find(a => a.variant === variant.value) || arms.value[0])
const stats = computed(() => record.value?.summary.find(s => s.variant === selected.value?.variant))
const config = computed(() => record.value?.engine?.config || data.value?.config)
const pct = n => Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'
const num = n => Number.isFinite(n) ? n.toLocaleString('ko-KR') : '—'
const time = n => n ? new Date(n).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '—'
const reasons = { STOP_LOSS: '손절', THEME_DROP: '테마 순위 이탈', LEADER_CHANGE: '대장 교체 확정', CLOSE: '마감' }
const blocked = { DAILY_LIMIT: '하루 진입 한도', HALTED: '거래정지', VI: 'VI', LIMIT_UP: '상한가 구간', STALE_QUOTE: '시세 지연', EXECUTION_STATUS_UNKNOWN: '체결 가능 상태 미확인', ALREADY_HELD: '이미 보유' }
const stale = computed(() => day.value === today() && record.value?.engine?.lastAt && Date.now() - record.value.engine.lastAt > 90000)
const missingReasons = { NO_QUOTE: '시세 없음', INVALID: '값 이상', STALE_RECEIVED: '수신 지연', NOT_TODAY: '당일 체결 없음' }
const missingText = computed(() => {
  const m = record.value?.engine?.missing
  return m?.count ? ` 누락 ${m.count}종목: ${m.sample.slice(0, 5).map(i => `${i.code}(${missingReasons[i.reason] || i.reason})`).join(', ')}` : ''
})
const runs = computed(() => (data.value?.runs || []).filter(r => r.date === day.value))
let timer, controller, disposed = false
async function refresh() {
  if (loading.value) return
  loading.value = true; controller = new AbortController()
  try {
    const response = await api.get('/spike-detector/rotation', { signal: controller.signal, timeout: 20000 })
    if (disposed) return
    data.value = response.data.data; error.value = ''
    if (!variant.value) variant.value = data.value.notifications.variant
  } catch (e) { if (!disposed && e.code !== 'ERR_CANCELED') error.value = e.response?.data?.message || '모의 기록을 불러오지 못했습니다.' }
  finally { if (!disposed) loading.value = false }
}
onMounted(() => { void refresh(); timer = setInterval(() => { if (!document.hidden) void refresh() }, 10000) })
onUnmounted(() => { disposed = true; clearInterval(timer); controller?.abort() })
</script>
<template>
<section class="rotation">
  <div class="heading"><div><UiBadge variant="primary">모의 관측 · 실제 주문 없음</UiBadge><h3>대장 유지 · 교체 전략</h3><p>당일 {{ num((config?.gateWon || 0) / 1e8) }}억 이상 · 대장 {{ (config?.stableMs || 0) / 60000 }}분 확인</p></div><UiButton size="sm" variant="outline" :loading="loading" @click="refresh">새로고침</UiButton></div>
  <UiAlert v-if="error" variant="error" :description="error" />
  <UiAlert v-if="data?.lastError" variant="warning" :description="data.lastError" />
  <UiAlert v-if="data && !data.batchConfigured" variant="warning" description="서버의 KRX 로그인 설정이 필요합니다. 과거 급등 이력·당일 모집단 배치는 아직 준비되지 않았습니다." />
  <div class="steps"><article><b>01 · 최초 대장 유지</b><p>거래대금 상위 {{ config?.topThemes }}개 테마에서 게이트 통과 종목 중 등락률 1위. 중앙값을 초과한 상태가 {{ (config?.stableMs || 0) / 60000 }}분 유지되면 모의 진입합니다.</p></article><article><b>02 · 교체 확인 후 이동</b><p>새 대장이 같은 시간 동안 유지되면 기존 종목을 청산합니다. 한도·VI·상한가 등을 확인한 뒤 새 대장 진입을 별도 기록합니다.</p></article><article><b>03 · 뉴스는 참고 자료</b><p>Sonnet은 수집된 당일 뉴스·공시 제목만 요약합니다. 대장 선정과 진입·청산은 코드가 계산합니다.</p></article></div>
  <p>{{ config?.start }} 이후 진입 · 하루 {{ config?.maxEntries }}회 · 손절 −{{ config?.stopPct }}% · 비용 {{ config?.costPct }}%p · 고점 돌파 대기 없음</p>
  <div class="status"><span>수집 {{ data?.enabled ? '켜짐' : '꺼짐 / 조회 전용' }}</span><span>텔레그램 {{ data?.notifications?.enabled ? (data.notifications.configured ? '켜짐' : '연결 설정 필요') : '꺼짐' }}</span><span>LLM {{ data?.llm?.enabled ? (data.llm.configured ? data.llm.model : 'API 키 필요') : '꺼짐' }}</span></div>
  <p v-if="data?.llm?.enabled">뉴스 {{ data.llm.newsConfigured ? '연결 설정됨' : '네이버 API 설정 필요' }} · 공시 {{ data.llm.dartConfigured ? '연결 설정됨' : 'DART API 설정 필요' }}</p>
  <div class="filters"><UiSelect v-model="day" :options="dates" label="관측 날짜" size="sm" /><UiSelect v-if="variants.length" v-model="variant" :options="variants" label="비교 전략" size="sm" /></div>
  <UiAlert v-if="stale" variant="warning" description="최근 관측이 지연됐습니다. 마지막 기록을 표시하며 현재 순위나 체결을 보장하지 않습니다." />
  <UiAlert v-if="record?.engine && !record.engine.complete" variant="warning" :description="`모집단 시세가 불완전합니다. 대장 유지 타이머와 테마 순위 청산을 보류합니다.${missingText}`" />
  <div class="stats"><article><b>{{ stats?.count || 0 }} / {{ config?.maxEntries || 3 }}</b><span>진입 횟수</span></article><article><b>{{ stats?.holding || 0 }}</b><span>보유</span></article><article><b>{{ pct(stats?.mean) }}</b><span>완료 거래 평균 순수익</span></article><article><b>{{ pct(stats?.win) }}</b><span>비용후 승률</span></article></div>
  <p>관측 {{ record?.count || 0 }}종목<template v-if="record?.inactive?.length"> (당일 체결 없음 제외 {{ record.inactive.length }})</template> · 마지막 관측 {{ time(record?.engine?.lastAt) }} · 성적 제외 {{ stats?.excluded || 0 }}건</p>
  <UiEmpty v-if="!record" title="당일 모의 관측 기록이 없습니다" description="모집단 배치와 서버 수집 설정이 준비되면 거래일에 기록을 시작합니다." />
  <div class="themes"><article v-for="t in record?.engine?.themes?.slice(0, config?.topThemes) || []" :key="t.id"><b>{{ t.rank }}위 · {{ t.name }}</b><p>거래대금 {{ num(Math.round(t.turnover / 1e8)) }}억 · 중앙값 {{ pct(t.median) }}</p><p v-if="selected?.timers[t.id]">대장 {{ selected.timers[t.id].code }} · {{ time(selected.timers[t.id].since) }}부터 관측</p><p v-if="selected?.blocked[t.id]">진입 차단: {{ blocked[selected.blocked[t.id]] || selected.blocked[t.id] }}</p></article></div>
  <article v-for="t in [...(selected?.trades || [])].reverse()" :key="t.id" class="trade"><div class="heading"><b>{{ t.name }} ({{ t.code }}) · {{ t.themeName }}</b><UiBadge>{{ t.status === 'holding' ? '모의 보유' : reasons[t.reason] }}</UiBadge></div><p>{{ time(t.entryAt) }} · {{ num(t.entry) }}원 → {{ t.exit ? `${num(t.exit)}원 · ${time(t.exitAt)}` : '보유 중' }}</p><p>진입 거래대금 {{ num(Math.round(t.turnover / 1e8)) }}억 · 순수익 {{ pct(t.netPct) }}<span v-if="t.excluded"> · 관측 공백 / 집계 제외</span></p></article>
  <details><summary>기존 09:30 돌파·재확인 대조군</summary><p>고정 모집단과 기존 규칙으로 별도 수집하며 새 전략과 성적을 합산하지 않습니다.</p><p>진입 {{ record?.legacy?.trades?.length || 0 }} · 평균 순수익 {{ pct(record?.legacy?.mean) }}</p><article v-for="t in record?.legacy?.trades || []" :key="t.code"><b>{{ t.name }}</b><p>{{ time(t.entryAt) }} · {{ num(t.entry) }}원 · {{ t.reason || t.status }}</p></article></details>
  <details open><summary>당일 뉴스·공시 요약 / 장 마감 자료 복기</summary><p v-if="!runs.length">아직 요약이 없습니다. 뉴스·공시와 LLM 연결이 필요합니다.</p><article v-for="r in runs" :key="r.id" class="trade"><b>{{ r.kind === 'CLOSE_REVIEW' ? '장 마감 자료 복기' : '종목 관련 재료' }}</b><p>{{ r.payload?.summary || (r.parsedOk ? '확인된 당일 재료 없음' : '요약 미완료') }}</p><p v-if="r.error">수집 상태: {{ r.error }}</p><ul><li v-for="e in r.payload?.evidence?.filter(e => r.payload.evidenceIds.includes(e.id)) || []" :key="e.id"><a :href="e.url" target="_blank" rel="noopener noreferrer">{{ e.title }}</a></li></ul></article></details>
  <details><summary>배치·알림 처리 상태</summary><p v-for="b in data?.batches || []" :key="b.date">{{ b.date }} · {{ b.status }} · {{ b.payload.count || 0 }}종목 <span v-if="b.payload.error">{{ b.payload.error }}</span></p><p v-for="n in data?.notifications?.recent || []" :key="n.id">{{ n.kind }} · {{ n.ok ? '발송 완료' : n.error || '발송 대기' }}</p></details>
</section>
</template>
<style scoped>
.rotation{display:grid;gap:16px;font-size:13px;min-width:0}.heading,.filters,.status{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.heading{justify-content:space-between}h3{font-size:20px;margin:12px 0 6px}p{font-size:12px;line-height:1.8;color:var(--muted,#687990);margin:6px 0}.steps,.themes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.steps article,.stats article{background:var(--surface-secondary,#f5f7ff);padding:16px;border-radius:12px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stats b{display:block;font-size:22px}.stats span{display:block;margin-top:8px;color:#687990}.themes article,.trade{border:1px solid var(--line,#e1e7f2);padding:16px;border-radius:12px;overflow-wrap:anywhere}.status span{background:var(--surface-secondary,#f5f7ff);padding:6px 10px;border-radius:20px}summary{cursor:pointer;font-weight:600}a{color:#375bc7}li{margin:8px 0}@media(max-width:760px){.steps,.themes{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
