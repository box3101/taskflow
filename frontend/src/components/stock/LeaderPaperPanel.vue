<script setup>
import { computed } from 'vue'
import { UiBadge, UiEmpty, UiAlert } from '@leechanyong/ispark-ui'
const props=defineProps({data:Object,day:String})
const days=computed(()=>(props.data?.days||[]).filter(d=>props.day==='all'||d.date===props.day).slice().reverse())
const pct=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'—'
const num=n=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:0}):'—'
const time=n=>new Date(n).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})
</script>
<template>
 <section class="paper">
  <h4>시간대별 전략 · 자동 모의 성적</h4>
  <p>후보 선정 다음 새 시세로 진입 · 종목당 하루 1회 · 손절 −3% / 나머지 당일 장 마감 청산 · 왕복 비용 0.21%. 실제 주문 없음.</p>
  <p>09:00–09:30은 이전 후보가 당일 고점 아래에서 직전 새 시세보다 상승하고 당일 등락률이 양수일 때 신호를 만듭니다. 09:30 이후는 당일 후보 선정 시 신호를 만듭니다. 15:20부터 새 진입을 중단합니다. 모두 검증용 가정이며 홍인기의 공식 자동매매 규칙이 아닙니다.</p>
  <UiAlert v-if="data?.replayError" variant="warning" :description="data.replayError" />
  <UiEmpty v-if="!days.length" title="모의 기록을 기다리고 있습니다" description="후보 신호와 그 다음 새 시세가 있어야 모의 진입이 기록됩니다." />
  <article v-for="result in days" :key="result.date+result.mode">
   <div class="heading"><b>{{ result.date }}</b><UiBadge size="sm" :variant="result.mode==='replay'?'warning':'primary'">{{ result.mode==='replay'?'저장 시세 재생 · 소급 실험':'실시간 모의 기록' }}</UiBadge></div>
   <p>마지막 관측 {{ result.lastAt?time(result.lastAt):'없음' }} · {{ result.mode==='replay'?'오늘 저장 시세를 시간순으로 재계산합니다. 실시간 검증 성적과 구분합니다.':'배포 후 기록한 신호입니다.' }}</p>
   <div class="stats">
    <div><small>진입 / 보유</small><strong>{{ result.trades.length }} / {{ result.holding }}</strong></div>
    <div><small>청산 완료 / 제외</small><strong>{{ result.completed }} / {{ result.excluded }}</strong></div>
    <div><small>완료 거래 평균 순수익</small><strong>{{ pct(result.mean) }}</strong></div>
    <div><small>비용 후 승률</small><strong>{{ pct(result.win) }}</strong></div>
   </div>
   <p>보유 중 평가손익은 승률·평균 성적에 포함하지 않습니다. 미관측 구간은 성적에서 제외하며, 10초 시세 사이의 손절과 실제 체결은 재현하지 못합니다. 개별 거래 동일 비중 평균이며 계좌 수익률이 아닙니다.</p>
   <details v-for="t in result.trades" :key="t.code" class="trade">
    <summary>{{ t.name }} · {{ t.lane==='previous'?'이전 대장주 눌림':'당일 대장주' }} · {{ t.invalid?'평가 제외':t.exitAt?'청산 '+pct(t.netPct):'모의 보유' }}</summary>
    <p>{{ t.theme }} · 신호 {{ time(t.signalAt) }} → 진입 {{ time(t.entryAt) }}</p>
    <p>진입 {{ num(t.entry) }} · 손절 기준 {{ num(t.stop) }} · {{ t.exitAt?'청산':'관측가' }} {{ num(t.exitAt?t.exit:t.lastPrice) }}</p>
    <p v-if="!t.invalid&&!t.exitAt">비용 반영 평가손익 {{ pct((t.lastPrice/t.entry-1)*100-result.rule.feePct) }} · 미확정</p>
    <p v-if="t.reason">{{ t.exitAt?time(t.exitAt)+' · ':'' }}{{ t.reason }}</p>
   </details>
  </article>
 </section>
</template>
<style scoped>
.paper{display:grid;gap:12px;border:1px solid #e1e7f2;border-radius:12px;padding:16px}h4{margin:0;font-size:15px}p{font-size:12px;color:#687990;line-height:1.8;margin:6px 0}.heading{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:12px 0}.stats>div{background:#f5f7ff;padding:12px;border-radius:10px}.stats small{display:block;color:#687990}.stats strong{display:block;font-size:20px;margin-top:6px}.trade{border-top:1px solid #e1e7f2;padding:12px 0}.trade summary{cursor:pointer;font-size:13px;line-height:1.8}@media(max-width:760px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
