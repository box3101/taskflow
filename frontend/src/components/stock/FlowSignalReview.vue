<script setup>
import { UiBadge } from '@leechanyong/ispark-ui'
defineProps({signals:Object,error:String,retrospective:Object})
const reaction={missing:'자료 부족','selling-price-up':'현물 순매도에도 지수 상승','buying-price-down':'현물 순매수에도 지수 하락','buying-price-up':'현물 순매수·지수 상승','selling-price-down':'현물 순매도·지수 하락','flat-or-mixed':'보합·방향 혼재'}
const names={cash:'외국인 현물',futures:'외국인 선물',nonArb:'외국인 비차익'}
const n=v=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:2}):'—'
</script>
<template>
 <details class="signal-review">
  <summary>가격 반응·시간대별 수급 강도 · {{ retrospective?.status||'복기 대기' }}</summary>
  <p v-if="!signals">{{ error||'이 판단은 새 입력 자료를 저장하기 전의 기록입니다.' }}</p>
  <template v-else>
   <p>AI에 실제 전달한 관측 당시 자료입니다. 백분위는 상승 확률이 아닙니다.</p>
   <div class="windows"><div v-for="w in signals.priceReaction" :key="w.minutes"><b>{{ w.minutes }}분 · {{ reaction[w.reaction] }}</b><p>현물 {{ n(w.cash) }} · 선물 {{ n(w.futures) }} · 비차익 {{ n(w.nonArb) }}<br>코스피 {{ n(w.kospiPoints) }}pt / {{ n(w.kospiPct) }}%</p></div></div>
   <div v-for="s in signals.strength" :key="s.key" class="strength"><b>{{ names[s.key] }}</b><span v-if="s.status==='ready'"> 최근 15분 변화 {{ n(s.value) }} · 순매수 변화 {{ n(s.signedPercentile) }}백분위 · 절댓값 강도 {{ n(s.magnitudePercentile) }}백분위 · 비교 {{ s.sampleCount }}일</span><span v-else> 자료 부족 · {{ s.sampleCount }}/최소 10일</span></div>
   <p>현물·비차익은 저장된 API 단위, 선물은 계약입니다. 최근 60일 이내 최대 20기록일의 같은 시간대와 비교하며 당일·미래 자료는 제외합니다.</p>
  </template>
  <p v-if="retrospective"><UiBadge size="sm">자동 복기</UiBadge> {{ retrospective.status }}<span v-if="retrospective.actualDirection"> · 실제 {{ {up:'상승',down:'하락',flat:'보합'}[retrospective.actualDirection] }}</span><br>{{ retrospective.note }}</p>
 </details>
</template>
<style scoped>
.signal-review{border:1px solid #e1e7f2;border-radius:10px;padding:12px;font-size:12px}.signal-review summary{cursor:pointer;line-height:1.8;font-weight:600}.signal-review p{color:#687990;line-height:1.8;margin:8px 0}.windows{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.windows>div{background:#f8faff;padding:10px;border-radius:8px}.strength{padding:8px 0;border-top:1px solid #edf0f6;line-height:1.8}@media(max-width:700px){.windows{grid-template-columns:1fr}}
</style>
