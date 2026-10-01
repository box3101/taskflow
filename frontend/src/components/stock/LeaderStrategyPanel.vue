<script setup>
import {computed,ref} from 'vue'
import {UiBadge,UiSelect,UiAlert,UiEmpty} from '@leechanyong/ispark-ui'
const props=defineProps({data:Object})
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())
const day=ref(today())
const dates=computed(()=>[...new Set([today(),...(props.data?.breakout?.days||[]).map(s=>s.date)])].sort().reverse().map(value=>({label:value,value})))
const record=computed(()=>props.data?.breakout?.days?.find(s=>s.date===day.value))
const session=computed(()=>props.data?.observation?.sessions?.find(s=>s.date===day.value))
const candidates=computed(()=>session.value?.current?.slice(0,3)||[])
const pct=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'—'
const num=n=>Number.isFinite(n)?n.toLocaleString('ko-KR'):'—'
const time=n=>n?new Date(n).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—'
const labels={holding:'모의 보유',closed:'청산 완료',excluded:'성적 제외'}
</script>
<template>
<section class="strategy">
 <div class="heading"><div><UiBadge variant="primary">서버 자동 모의 · 실제 주문 없음</UiBadge><h3>주도 테마 대장주 · 고점 돌파</h3><p>홍인기 공개 원칙 참고 · 거래일 09:30–15:20 신규 진입 · 하루 최대 3종목</p></div><UiSelect v-model="day" :options="dates" label="전략 날짜" size="sm" /></div>
 <UiAlert :variant="data?.breakout?.enabled?'info':'warning'" :description="data?.breakout?.enabled?'서버 자동 수집에 연결되어 있습니다. 브라우저와 노트북을 꺼도 거래일에 모의 기록을 만듭니다.':'서버 자동 수집이 꺼져 있습니다. 이 환경에서는 자동 모의 기록이 생성되지 않습니다.'" />
 <div class="steps"><article><b>01 · 주도 테마와 대장주</b><p>등록 비교군 중 누적 거래대금 상위 3개 테마. 테마 중앙값이 양수이고, 거래대금 단독 1위 종목의 당일 등락률이 테마 중앙값보다 높아야 합니다.</p></article><article><b>02 · 당일 고점 돌파</b><p>09:30 이후 새 관측가가 직전 관측의 당일 고점을 넘으면 신호. 다음 새 시세에서도 돌파 가격 위이며 후보 조건을 유지할 때 진입합니다.</p></article><article><b>03 · 자동 모의 채점</b><p>하루 최대 3종목 · 종목당 1회. 진입가 대비 −3% 손절, 나머지는 당일 마감 시세로 청산. 왕복 비용 0.21% 가정.</p></article></div>
 <p>관찰 {{ data?.universe?.count||0 }}종목 · 등록 목록 내 비교입니다. 시장 전체 대장주 순위와 다를 수 있습니다. 호가·뉴스·일봉에 따른 홍인기 본인의 재량 판단을 복제하지 않습니다.</p>
 <div class="stats"><article><b>{{ record?.trades?.length||0 }} / {{ record?.holding||0 }}</b><span>진입 / 보유</span></article><article><b>{{ record?.completed||0 }} / {{ record?.excluded||0 }}</b><span>청산 완료 / 제외</span></article><article><b>{{ pct(record?.mean) }}</b><span>완료 거래 평균 순수익</span></article><article><b>{{ pct(record?.win) }}</b><span>비용 후 승률</span></article></div>
 <p>마지막 전략 관측 {{ time(record?.lastAt) }} · 배포 이후 실시간 모의 기록만 집계합니다. 오늘 수행한 과거 가정 실험과 기존 전략 성적은 합산하지 않습니다.</p>
 <UiEmpty v-if="!record?.trades?.length" title="아직 모의 진입이 없습니다" description="09:30이 되어도 일괄 매수하지 않습니다. 고점 돌파와 다음 시세 확인 조건을 충족할 때 기록됩니다." />
 <article v-for="t in record?.trades||[]" :key="t.code" class="trade"><div class="heading"><b>{{ t.name }} · {{ t.theme }}</b><UiBadge>{{ labels[t.status] }}</UiBadge></div><p>신호 {{ time(t.signalAt) }} · 진입 {{ time(t.entryAt) }} / {{ num(t.entry) }}원</p><p>돌파 기준 {{ num(t.breakout) }}원 · 손절선 {{ num(t.stop) }}원 · 청산 {{ num(t.exit) }}원 · 순수익 {{ pct(t.netPct) }}</p><p>{{ time(t.exitAt) }} · {{ t.reason||'후속 시세 관측 중' }}</p></article>
 <details><summary>최근 관찰 후보 · 진입 확정 아님</summary><p>최근 관측 {{ time(session?.observedAt) }}</p><div class="candidates"><article v-for="c in candidates" :key="c.code"><b>{{ c.name }} · {{ c.theme }}</b><p>거래대금 {{ num(Math.round(c.turnover/100000000)) }}억 · 등락 {{ pct(c.dayPct) }} · 테마 중앙값 {{ pct(c.themePct) }}</p></article></div></details>
 <p>고점 돌파·종목 수·손절·마감 청산은 앱의 검증용 수치 조건이며 공식 매매 규칙이 아닙니다. <a href="https://m.yes24.com/goods/detail/124112599" target="_blank" rel="noopener noreferrer">참고한 저서 발췌</a>. 10초 관측 시세로 계산하므로 실제 체결과 다르며, 수집 공백은 성적에서 제외합니다.</p>
</section>
</template>
<style scoped>
.strategy{display:grid;gap:16px;font-size:13px;min-width:0}.heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h3{font-size:18px;margin:10px 0}p{font-size:12px;color:#687990;line-height:1.8;margin:6px 0}.steps,.candidates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.steps article,.stats article{background:#f5f7ff;padding:16px;border-radius:12px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stats b{display:block;font-size:20px}.stats span{display:block;margin-top:8px;color:#687990}.candidates article,.trade{border:1px solid #e1e7f2;padding:16px;border-radius:12px;min-width:0;overflow-wrap:anywhere}summary{cursor:pointer}@media(max-width:760px){.steps,.candidates{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
