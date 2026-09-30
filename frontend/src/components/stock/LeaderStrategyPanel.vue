<script setup>
import { computed, ref } from 'vue'
import LeaderPaperPanel from './LeaderPaperPanel.vue'
import { UiBadge, UiEmpty, UiSelect } from '@leechanyong/ispark-ui'
const props=defineProps({data:Object})
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const day=ref(today)
const trades=computed(()=>props.data?.trades||[])
const sessions=computed(()=>props.data?.observation?.sessions||[])
const selectedSessions=computed(()=>sessions.value.filter(s=>day.value==='all'||s.date===day.value).slice().reverse())
const phaseLabel={prepare:'장전 준비',previous:'전일·전전일 대장주 눌림 관찰',today:'당일 대장주 관찰',closed:'장 마감 · 최종 저장 자료'}
const won=n=>Number.isFinite(n)?(n/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억':'—'
const dates=computed(()=>[{label:'전체 기간',value:'all'},...[...new Set([today,...sessions.value.map(s=>s.date),...trades.value.map(t=>t.date)])].sort().reverse().map(value=>({label:value,value}))])
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
    <div class="intro"><div><UiBadge variant="primary" size="sm">공개 원칙 참고 · 자동 모의 실험</UiBadge><h3>주도주 전략 · 시간대별 관찰</h3><p>장전 준비 → 전일 대장주 눌림 → 당일 대장주 · 실제 주문 없음</p></div><UiSelect v-model="day" :options="dates" label="전략 날짜" label-hidden size="sm" /></div>
    <details v-if="data?.universe" class="universe">
      <summary>관찰 {{ data.universe.count }}종목 · {{ data.universe.themes.length }}개 비교군 · 추가 {{ data.universe.addedCount }}종목 <span>목록 보기</span></summary>
      <p>매 거래일 목록을 고정합니다. 시장 전체 순위가 아닌 등록 종목 내 비교이며, 3종목 미만인 비교군은 진입 대상에서 제외합니다. ‘추가’는 기존 점화 122종목에 없던 종목입니다.</p>
      <div class="universe-grid"><div v-for="group in data.universe.themes" :key="group.name"><b>{{ group.name }} · {{ group.stocks.length }}종목</b><small v-if="!group.eligible"> · 비교 부족</small><p><span v-for="stock in group.stocks" :key="stock.code" class="stock-name">{{ stock.name }}<em v-if="stock.added">추가</em></span></p></div></div>
    </details>
    <div class="steps session-steps">
      <div><b>장 시작 전 · 관심 종목 준비</b><p>이전 두 거래일의 저장 자료로 후보 준비<br>전일·전전일 테마 강도와 대장주 확인</p></div>
      <div><b>09:00–09:30 · 이전 대장주</b><p>준비한 종목의 눌림과 지지 확인<br>당일 새 주도 테마는 관찰하며 대기</p></div>
      <div><b>09:30 이후 · 당일 대장주</b><p>당일 거래대금 집중과 테마 강도 확인<br>10시 종료 제한 없이 장중 관찰</p></div>
      <div><b>이른 진입 예외 · 직접 판단</b><p>재료·테마·수급이 일찍 뚜렷한 경우<br>자동 진입하지 않고 직접 확인</p></div>
    </div>
    <p class="caption">9시 30분은 관찰 대상을 나누기 위한 앱의 기준입니다. 홍인기의 공개 설명은 유동적입니다. <a href="https://www.youtube.com/watch?v=aCn1jpHdrAk&t=202s" target="_blank" rel="noopener noreferrer">참고 영상 03:22–03:59</a></p>
    <p class="caption">참고 후보를 바탕으로 자동 모의 진입·청산을 계산합니다. 아래 후보 목록은 최종 저장 시점 기준이며 실제 모의 진입 내역은 성적 카드에서 확인합니다.</p>
    <LeaderPaperPanel :data="data?.paper" :day="day" />
    <details class="universe">
      <summary>참고 후보 계산 기준</summary>
      <p>등록 비교군 3종목 이상 · 비교군 시세 모두 확인 · 테마 등락률 중앙값 양수 · 종목 등락률 양수 · 테마 누적 거래대금 공동 1위까지 표시합니다. 테마 거래대금 합계 순으로 정렬합니다. 이는 앱의 관찰용 근사 조건이며 홍인기의 공식 수치 조건이 아닙니다. 장대양봉·시장 전체 대장주·뉴스·호가는 별도 확인이 필요합니다.</p>
      <p>이전 후보는 바로 앞 두 기록 거래일의 종가 시세만 사용합니다. 종가 자료가 없으면 더 오래된 날짜로 대체하지 않습니다. 과거 날짜의 당일 후보는 최종 저장 시점 기준이며 장중 진입 신호나 소급 매매 성적이 아닙니다.</p>
    </details>
    <UiEmpty v-if="!selectedSessions.length" title="시간대별 후보 자료를 기다리고 있습니다" description="새 서버 응답을 받은 뒤 후보 목록이 표시됩니다." />
    <section v-for="session in selectedSessions" :key="session.date" class="session">
      <div class="trade-head"><h4>{{ session.date }}</h4><UiBadge variant="primary" size="sm">{{ phaseLabel[session.phase] }}</UiBadge></div>
      <p>관측 기준 {{ session.observedAt ? time(session.observedAt) : '당일 자료 없음' }}<span v-if="session.stale"> · 실시간 시세 아님</span></p>
      <details class="universe" :open="session.phase==='prepare'||session.phase==='previous'">
        <summary>장전 준비 · 전일·전전일 참고 후보 {{ session.previous.length }}건</summary>
        <p>기준 날짜 {{ session.previousDates.join(' · ') || '없음' }}<span v-if="session.missingPreviousDays"> · 이전 {{ session.missingPreviousDays }}거래일 자료 부족</span></p>
        <UiEmpty v-if="!session.previous.length" title="이전 거래일 후보를 확인할 수 없습니다" description="종가 비교 자료가 부족하거나 참고 후보 조건을 충족하는 종목이 없습니다." />
        <div v-else class="trades">
          <article v-for="c in session.previous" :key="c.sourceDate+c.code">
            <div class="trade-head"><b>{{ c.name }} <small>{{ c.theme }}</small></b><UiBadge size="sm">{{ c.daysAgo===1?'전일':'전전일' }} 참고 후보</UiBadge></div>
            <p>{{ c.sourceDate }} · 거래대금 {{ won(c.turnover) }} · 등락률 {{ pct(c.dayPct) }} · 테마 중앙값 {{ pct(c.themePct) }}<span v-if="c.tied"> · 거래대금 공동 1위</span></p>
            <p>당일 관측가 {{ number(c.currentPrice) }} · 당일 고점 대비 {{ pct(c.currentFromHighPct) }} · 눌림·지지는 직접 확인</p>
          </article>
        </div>
      </details>
      <details class="universe" :open="session.phase==='today'||session.phase==='closed'">
        <summary>09:30 이후 · 당일 참고 후보 {{ session.current.length }}건</summary>
        <UiEmpty v-if="!session.current.length" :title="session.phase==='prepare'||session.phase==='previous'?'09:30 이후 관측부터 후보를 표시합니다':'확인 가능한 당일 후보가 없습니다'" description="누락·지연 시세와 비교군 부족은 후보 계산에서 제외됩니다." />
        <div v-else class="trades">
          <article v-for="c in session.current" :key="c.code">
            <div class="trade-head"><b>{{ c.name }} <small>{{ c.theme }}</small></b><UiBadge variant="warning" size="sm">진입 판단 필요</UiBadge></div>
            <p>거래대금 {{ won(c.turnover) }} · 등락률 {{ pct(c.dayPct) }} · 테마 중앙값 {{ pct(c.themePct) }}<span v-if="c.tied"> · 거래대금 공동 1위</span></p>
            <p>최근 5분 거래대금 {{ Number.isFinite(c.turnoverRatio)?c.turnoverRatio.toFixed(2)+'배':'자료 부족' }} · 테마 대비 5분 {{ Number.isFinite(c.relative5m)?c.relative5m.toFixed(2)+'%p':'자료 부족' }}</p>
          </article>
        </div>
      </details>
      <p class="caption">이른 진입은 재료·테마·수급을 직접 확인하는 예외입니다. 자동 예외 신호와 모의 체결을 생성하지 않습니다.</p>
    </section>
    <details class="legacy">
      <summary>기존 자동 실험 기록 · {{ rows.length }}건 · 원래 조건과 성적 보기</summary>
      <p>이하 9:10–10:00 자동 모의 전략은 기존 규칙의 결과입니다. 판단 지원 방식의 승률·수익률로 합산하지 않습니다. 새 자동 진입은 중단했습니다. 이미 진입한 모의 보유분은 원래 청산 조건으로 마무리합니다.</p>
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
    </details>
  </section>
</template>
<style scoped>
.session{display:grid;gap:12px}.session-steps{grid-template-columns:repeat(4,minmax(0,1fr))}.session .trades{margin-top:12px}
h4{margin:0;font-size:14px}.legacy{display:grid;gap:16px;border-top:1px solid #e1e7f2;padding-top:16px}.legacy summary{cursor:pointer;font-weight:600;line-height:1.8}.legacy[open]>.steps,.legacy[open]>.stats,.legacy[open]>.trades{margin-top:16px}
.universe{border:1px solid #e1e7f2;border-radius:12px;padding:14px 16px}.universe summary{cursor:pointer;font-weight:600;line-height:1.8}.universe summary span{font-size:12px;color:#687990;margin-left:12px}.universe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:16px}.stock-name{display:inline-block;margin-right:10px}.stock-name em{font-size:10px;font-style:normal;color:#5360ec;margin-left:3px}
.strategy{display:grid;gap:16px;min-width:0;font-size:13px}.intro{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.intro>:last-child{max-width:180px}h3{font-size:18px;margin:10px 0 4px}p{color:#687990;font-size:12px;line-height:1.8;margin:6px 0}.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.steps>div{background:#f5f7ff;border-radius:12px;padding:16px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stats>div{border:1px solid #e1e7f2;border-radius:12px;padding:16px}.stats span{display:block;color:#687990;font-size:12px}.stats strong{display:block;font-size:23px;margin-top:8px}.caption{margin:0}.trades{display:grid;gap:10px}.trades article{border:1px solid #e1e7f2;border-radius:12px;padding:16px;min-width:0}.trade-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}small{font-weight:400;color:#687990;margin-left:6px}.prices{display:flex;flex-wrap:wrap;gap:12px 24px;font-size:12px}.prices b{margin-left:6px;font-variant-numeric:tabular-nums}.up{color:#d1394b}.down{color:#2563c5}@media(max-width:760px){.steps{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stats strong{font-size:20px}}
</style>
