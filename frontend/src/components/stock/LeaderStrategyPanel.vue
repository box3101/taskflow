<script setup>
import { computed, ref } from 'vue'
import { UiBadge, UiEmpty, UiSelect } from '@leechanyong/ispark-ui'
const props=defineProps({data:Object})
const day=ref('all')
const trades=computed(()=>props.data?.trades||[])
const dates=computed(()=>[{label:'전체 기간',value:'all'},...[...new Set(trades.value.map(t=>t.date))].sort().reverse().map(value=>({label:value,value}))])
const rows=computed(()=>trades.value.filter(t=>day.value==='all'||t.date===day.value))
const completed=computed(()=>rows.value.filter(t=>!t.invalid&&Number.isFinite(t.netPct)))
const mean=computed(()=>completed.value.length?completed.value.reduce((s,t)=>s+t.netPct,0)/completed.value.length:null)
const win=computed(()=>completed.value.length?completed.value.filter(t=>t.netPct>0).length/completed.value.length*100:null)
const pct=n=>Number.isFinite(n)?`${n>0?'+':''}${n.toFixed(2)}%`:'—'
const number=n=>Number.isFinite(n)?Math.round(n).toLocaleString('ko-KR'):'—'
const time=n=>new Date(n).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})
</script>
<template>
  <section class="strategy">
    <div class="intro"><div><UiBadge variant="primary" size="sm">독립 전략 · 모의 관측</UiBadge><h3>주도주 돌파 후 눌림</h3><p>오전 9:10–10:00 · 종목당 하루 1회 · 실제 주문 없음</p></div><UiSelect v-model="day" :options="dates" label="전략 날짜" label-hidden size="sm" /></div>
    <div class="steps">
      <div><b>01 · 후보 선정</b><p>세부 테마 3종목 이상 · 거래대금 상위 3위<br>직전 5분 대비 거래대금 1.2배 이상<br>테마 대비 5분 수익률 +0.1%p 이상</p></div>
      <div><b>02 · 눌림 확인</b><p>당일 등락·테마 5분 수익률 모두 양수<br>직전 5분 관측 고점 돌파 → 0.3% 눌림<br>돌파 가격 회복·눌림 저점 대비 0.3% 반등</p></div>
      <div><b>03 · 모의 진입·청산</b><p>확인 후 다음 새 시세로 진입 · 위험폭 0.3–2%<br>눌림 저점 손절 / 위험폭의 2배 목표<br>최대 30분 보유 · 왕복 비용 가정 0.21%</p></div>
    </div>
    <div class="stats">
      <div><span>모의 진입</span><strong>{{ rows.length }}건</strong></div>
      <div><span>평가 완료 / 제외</span><strong>{{ completed.length }} / {{ rows.filter(t=>t.invalid).length }}</strong></div>
      <div><span>평균 순수익률</span><strong :class="mean>0?'up':'down'">{{ pct(mean) }}</strong></div>
      <div><span>비용 차감 후 승률</span><strong>{{ win===null?'—':win.toFixed(1)+'%' }}</strong></div>
    </div>
    <p class="caption">기존 점화 조건과 독립적으로 관측합니다. 10초 시세 기준 모의 결과이며 실제 체결과 다릅니다. 수집 공백은 성적에서 제외하고, 과거 기록은 소급 생성하지 않습니다.</p>
    <UiEmpty v-if="!rows.length" title="아직 주도주 전략 진입이 없습니다" :description="data?'서버에서 조건을 순서대로 확인한 뒤 기록합니다. 거래대금 비교를 위해 최소 10분의 연속 자료가 필요합니다.':'이 전략은 Railway 서버 수집 모드에서 제공됩니다.'" />
    <div v-else class="trades">
      <article v-for="t in rows" :key="t.date+t.code">
        <div class="trade-head"><b>{{ t.name }} <small>{{ t.theme }}</small></b><UiBadge size="sm" :variant="t.invalid?'warning':t.exitAt?'default':'primary'">{{ t.invalid?'평가 제외':t.exitAt?'청산 완료':'모의 보유' }}</UiBadge></div>
        <p>{{ t.date }} {{ time(t.entryAt) }} · 거래대금 {{ t.metrics.rank }}위 · 5분 거래대금 {{ t.metrics.turnoverRatio.toFixed(2) }}배 · 테마 대비 {{ t.metrics.relative5m.toFixed(2) }}%p</p>
        <div class="prices"><span>진입 <b>{{ number(t.entry) }}</b></span><span>손절 <b>{{ number(t.stop) }}</b></span><span>목표 <b>{{ number(t.target) }}</b></span><span>청산 <b>{{ number(t.exit) }}</b></span><span>순수익 <b :class="t.netPct>0?'up':'down'">{{ t.invalid?'—':pct(t.netPct) }}</b></span></div>
        <p v-if="t.reason">{{ t.exitAt?time(t.exitAt)+' · ':'' }}{{ t.reason }}</p>
      </article>
    </div>
  </section>
</template>
<style scoped>
.strategy{display:grid;gap:16px;min-width:0;font-size:13px}.intro{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.intro>:last-child{max-width:180px}h3{font-size:18px;margin:10px 0 4px}p{color:#687990;font-size:12px;line-height:1.8;margin:6px 0}.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.steps>div{background:#f5f7ff;border-radius:12px;padding:16px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stats>div{border:1px solid #e1e7f2;border-radius:12px;padding:16px}.stats span{display:block;color:#687990;font-size:12px}.stats strong{display:block;font-size:23px;margin-top:8px}.caption{margin:0}.trades{display:grid;gap:10px}.trades article{border:1px solid #e1e7f2;border-radius:12px;padding:16px;min-width:0}.trade-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}small{font-weight:400;color:#687990;margin-left:6px}.prices{display:flex;flex-wrap:wrap;gap:12px 24px;font-size:12px}.prices b{margin-left:6px;font-variant-numeric:tabular-nums}.up{color:#d1394b}.down{color:#2563c5}@media(max-width:760px){.steps{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stats strong{font-size:20px}}
</style>
