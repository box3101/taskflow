<script setup>
// Ported from C:/Average/index.html: preserve original first-alert and grading rules.
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { UiPageHeader, UiButton, UiIcon, UiBadge, UiTab, UiTable, UiEmpty, UiDrawer, UiAlert, UiSelect } from '@leechanyong/ispark-ui'
import api from '../api/client'
import { marketCells } from '../utils/spikeMarket.mjs'
import SpikeLeaderPanel from '../components/stock/SpikeLeaderPanel.vue'
import LeaderStrategyPanel from '../components/stock/LeaderStrategyPanel.vue'
import SurgeRotationPanel from '../components/stock/SurgeRotationPanel.vue'
const strategyData = ref(null)
const screen = ref('rotation')
const screenTabs = [{ label: '대장 3분 · 모의', value: 'rotation' }, { label: '기존 돌파 기록', value: 'strategy' }, { label: '대장주 필터', value: 'leader' }, { label: '원본 기록·성적', value: 'original' }]
const leaderData = ref({ records: {}, lastCapturedAt: null })
const collector = ref(null)
const tradeLog = ref(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref('')
const cls = n => n == null ? 'mut' : n > 0 ? 'pos' : n < 0 ? 'neg' : 'mut'
const num = n => n == null ? '—' : Number(n).toLocaleString('ko-KR')
const SPIKE_LABEL_TABS = [
  { label: '추세주 점화',       value: '추세주 점화' },
  { label: '중립',            value: '중립' },
  { label: '약보합/횡보',       value: '약보합/횡보' },
  { label: '낙폭과대',         value: '낙폭과대 반등 주의' },
  { label: '실매매',           value: '실매매' },
  { label: '전체',            value: 'all' },
];
const SPIKE_COLS = [
  { key: 'date', label: '날짜', width: '100px', align: 'left' },
  { key: 'time',  label: '시각',   width: '62px',  align: 'left'  },
  { key: 'name',  label: '종목',   width: '178px', align: 'left'  },
  { key: 'theme', label: '테마',   width: '86px',  align: 'left'  },
  { key: 'label', label: '라벨',   width: '128px', align: 'left' },
  { key: 'price', label: '알림가', width: '84px',  align: 'right', sortable: true, sortType: 'number' },
  { key: 'nightpct', label: '야간선물', width: '96px', align: 'right', sortable: true, sortType: 'number' },
  { key: 'kospigap', label: '코스피 출발', width: '104px', align: 'right', sortable: true, sortType: 'number' },
  { key: 'kospisignal', label: '신호 시가대비', width: '116px', align: 'right', sortable: true, sortType: 'number' },
  { key: 'high',  label: '최고',   width: '76px',  align: 'right', sortable: true, sortType: 'number' },
  { key: 'fixed', label: '고정',   width: '76px',  align: 'right', sortable: true, sortType: 'number' },
  { key: 'trail',  label: '트레일1.5', width: '84px', align: 'right', sortable: true, sortType: 'number' },
  { key: 'trail3', label: '트레일3',   width: '76px', align: 'right', sortable: true, sortType: 'number' },
  { key: 'close', label: '종가',   width: '76px',  align: 'right', sortable: true, sortType: 'number' },
];
    const spike = ref(null);
    const spikeMarket = ref(null), spikeMarketLive = ref(null);
    // spike-auto 실체결. 알림 채점(spike)과 별개 파일이다 — 신호 자체가 다르다.
    const spikeAuto = ref(null);
    const themeOf = ref({});          // code -> 테마 (themes.json)
    const spikeDay = ref('all');
    const spikeLabel = ref('추세주 점화');
    const spikeSel = ref(null);
    const signed2 = n => (n === null || n === undefined) ? '–'
                        : (n > 0 ? '+' : '') + n.toFixed(2);
    // 회귀 계수는 10년물이 -6.7, WTI 가 +0.08 로 자릿수가 세 자리 벌어진다
    const signed4 = n => (n === null || n === undefined) ? '–'
                        : (n > 0 ? '+' : '') + n.toFixed(4);
    // 9/3 이전은 풀이 4테마 74종이던 시절이라 지금과 기준이 다르다. 섞어 세지 않는다.
    const SPIKE_SINCE = '2026-09-03';
    const spikeDays = computed(() =>
      (((spike.value && spike.value.days) || []).filter(d => d.date >= SPIKE_SINCE)));
    const spikeDayTabs = computed(() => {
      const d = spikeDays.value;
      if (!d.length) return [];
      return [{ label: '전체', value: 'all' }]
        .concat([...d].reverse().map(x => ({ label: x.date.slice(5), value: x.date })));
    });
    const spikeRows = computed(() => {
      const d = spikeDays.value.filter(x => spikeDay.value === 'all' || x.date === spikeDay.value);
      const out = [];
      for (const day of d) {
        // 종목당 첫 알림만 — 카드·라벨 통계와 같은 기준이어야 숫자가 안 어긋난다.
        // 재알림(전체의 18%)은 이미 오른 자리라 성적이 다르다.
        const seen = new Set();
        for (const a of [...day.alerts].sort((x, y) => x.time.localeCompare(y.time))) {
          // 채점 전(당일) 알림도 표에는 띄운다. 분봉 수확이 15:40 이라 그 전엔 성적이 없다.
          // 통계(spikeStat / spikeByLabel)는 그대로 graded 만 쓴다 — 섞으면 숫자가 오염된다.
          if (seen.has(a.code)) continue;
          seen.add(a.code);
          if (spikeLabel.value !== 'all' && a.label !== spikeLabel.value) continue;
          out.push({ ...a, key: a.date + a.time + a.code });
        }
      }
      // spike-auto 실체결을 같은 표에 얹는다. 알림과 신호가 다른 프로세스라
      // 알림에 없는 종목(9/4 포스코퓨처엠)이 여기서만 나온다.
      // 청산룰이 '고점 -1.5%' 라 실현손익은 트레일1.5 칸에 그대로 대응된다.
      // 고정/트레일3/종가는 해당 없음 — null 이면 표에 '–' 로 뜬다.
      // spike-auto 는 chg20>=20 인 '추세주 점화' 만 산다. 라벨을 '실매매' 로 따로 두면
      // 정작 추세주 점화 탭에서 사라진다 (9/4 포스코퓨처엠이 그랬다).
      // 라벨은 실제 성격대로 두고, 실매매 여부는 isAuto 로 구분해 배지로 표시한다.
      const sa = spikeAuto.value;
      const AUTO_LABEL = '추세주 점화';
      if (sa && (spikeDay.value === 'all' || spikeDay.value === sa.date)
             && (spikeLabel.value === 'all' || spikeLabel.value === '실매매'
                 || spikeLabel.value === AUTO_LABEL)) {
        // spike-auto 기록은 '지정가' 다. 실제 체결은 그보다 낫게 잡히는 일이 많다
        // (9/4 더블유씨피 지정 10,130 -> 체결 10,100). 체결 기록이 있으면 그쪽을 쓴다.
        const tl = tradeLog.value || {};
        const fillOf = {};
        for (const k in tl) {
          const f = tl[k];
          if (!f || f.dateISO !== sa.date || !f.filledQty) continue;
          const b = (fillOf[f.code] = fillOf[f.code] || { buy: null, sell: null });
          if (f.side === 'buy') { if (!b.buy || f.time < b.buy.time) b.buy = f; }
          else { if (!b.sell || f.time > b.sell.time) b.sell = f; }
        }
        for (const pz of (sa.positions || [])) {
          const e = pz.exit || null;
          const f = fillOf[pz.code] || {};
          const entry = (f.buy && f.buy.avgPrice) || pz.entry;
          const exitPx = f.sell && f.sell.avgPrice;
          const hhmm = t => t ? t.slice(0, 2) + ':' + t.slice(2, 4) : '';
          out.push({
            key: 'auto' + sa.date + pz.time + pz.code,
            date: sa.date, time: hhmm(f.buy && f.buy.time) || pz.time,
            name: pz.name, code: pz.code,
            theme: (pz.themes && pz.themes[0]) || themeOf.value[pz.code] || '–',
            label: AUTO_LABEL, price: entry,
            high: pz.high ? +((pz.high / entry - 1) * 100).toFixed(2) : null,
            fixed: null,
            trail: exitPx ? +((exitPx / entry - 1) * 100).toFixed(2)
                          : (e ? e.pnl : null),
            trail3: null, close: null,
            isAuto: true, filled: !!exitPx,
            why: exitPx ? `${hhmm(f.sell.time)} · ${e ? e.why : '청산'}`
                        : (e ? `${e.at} · ${e.why}` : '보유 중'),
            signal: pz.signal, qty: (f.buy && f.buy.filledQty) || pz.qty,
          });
        }
      }
      return out.map(row => ({ ...marketCells(row, spikeMarket.value, spikeMarketLive.value), leader: row.isAuto ? null : leaderData.value.records?.[row.key] }))
                .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
    });
    // 통계는 항상 전체 기준이다 — 하루치로 룰을 판단하지 않기 위해서
    const spikeStat = computed(() => {
      // 라벨은 반영하고 날짜는 항상 전체다 — 하루치로 룰을 판단하지 않기 위해서
      const all = [];
      for (const day of spikeDays.value) {
        const seen = new Set();
        for (const a of [...day.alerts].sort((x, y) => x.time.localeCompare(y.time))) {
          if (!a.graded || seen.has(a.code)) continue;
          seen.add(a.code);
          if (spikeLabel.value !== 'all' && a.label !== spikeLabel.value) continue;
          all.push(a);
        }
      }
      const fee = (spike.value && spike.value.rule && spike.value.rule.fee) || 0;
      const mk = (key, label) => {
        const v = all.map(a => a[key]).filter(x => x !== null && x !== undefined);
        if (!v.length) return { key, label, raw: null, net: null, win: 0 };
        const m = v.reduce((s, x) => s + x, 0) / v.length;
        return { key, label, raw: m, net: m - fee,
                 win: Math.round(v.filter(x => x > 0).length / v.length * 100) };
      };
      return { n: all.length,
               rules: [mk('trail', '트레일 1.5%'), mk('trail3', '트레일 3%'),
                       mk('fixed', '고정 익절'), mk('close', '종가 보유')] };
    });

    const SPIKE_LABEL_VARIANT = { '추세주 점화': 'success', '중립': 'default',
                                  '약보합/횡보': 'warning', '낙폭과대 반등 주의': 'danger' };
    const spikeLabelVariant = l => SPIKE_LABEL_VARIANT[l] || 'default';
    // 라벨별 성적은 항상 전체 기간으로 낸다. 하루치로 라벨을 판단하지 않기 위해서다.
    const spikeByLabel = computed(() => {
      // 종목당 첫 알림만. 재알림은 이미 오른 자리라 성적이 다르고,
      // 위 카드도 같은 기준이어야 숫자가 어긋나지 않는다.
      const g = {};
      for (const day of spikeDays.value) {
        const seen = new Set();
        for (const a of [...day.alerts].sort((x, y) => x.time.localeCompare(y.time))) {
          if (!a.graded || seen.has(a.code)) continue;
          seen.add(a.code);
          const k = a.label || '(없음)';
          (g[k] = g[k] || { rows: [], days: new Set() }).rows.push(a);
          g[k].days.add(a.date);
        }
      }
      // 평균만 보면 대박 1건·장세 하루에 속는다 (CLAUDE.md 사전 기준: 날짜 교차표)
      const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
      return Object.entries(g).map(([label, v]) => {
        const cl = v.rows.map(r => r.close);
        const close = mean(cl);
        // 상위 1건을 빼면 평균이 어디로 가나 — 한 건이 표를 끌고 가는지 본다
        const exTop = cl.length > 1 ? mean([...cl].sort((a, b) => b - a).slice(1)) : null;
        // 날짜지배: 한 날짜를 빼서 평균이 가장 많이 내려가는 폭
        let domDate = '', domDrop = 0;
        if (v.days.size > 1) {
          for (const dt of v.days) {
            const rest = v.rows.filter(r => r.date !== dt).map(r => r.close);
            if (!rest.length) continue;
            const drop = close - mean(rest);
            if (drop > domDrop) { domDrop = drop; domDate = dt; }
          }
        }
        return { label, n: v.rows.length, days: v.days.size, close, exTop, domDate, domDrop,
                 win: Math.round(v.rows.filter(r => r.close > 0).length / v.rows.length * 100) };
      }).sort((a, b) => b.close - a.close);
    });


let timer
let disposed = false
let controller
async function refreshAll() {
  if (loading.value) return
  loading.value = true
  controller = new AbortController()
  try {
    const { data } = await api.get('/spike-detector', { signal: controller.signal, timeout: 20000 })
    if (disposed) return
    const payload = data.data
    spike.value = payload.spike
    strategyData.value = payload.strategy || null
    leaderData.value = payload.leader || { records: {}, lastCapturedAt: null }
    collector.value = payload.collector || null
    spikeMarket.value = payload.market
    spikeMarketLive.value = payload.live
    spikeAuto.value = payload.auto
    tradeLog.value = payload.fills
    themeOf.value = payload.themes
    updatedAt.value = new Date(payload.loadedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
    error.value = ''
  } catch (e) {
    if (!disposed && e.code !== 'ERR_CANCELED') error.value = e.response?.data?.message || '급등 기록을 불러오지 못했습니다.'
  } finally { if (!disposed) loading.value = false }
}
onMounted(() => { void refreshAll(); timer = setInterval(() => { if (!document.hidden) void refreshAll() }, 30000) })
onUnmounted(() => { disposed = true; clearInterval(timer); controller?.abort() })
</script>
<template>
<section class="spike-view">
<UiAlert v-if="error && screen !== 'rotation'" variant="error" :description="error" />
<p class="note" v-if="updatedAt">최근 조회 {{ updatedAt }} · {{ collector?.mode === 'cloud' ? '서버 10초 수집 · 화면 30초 갱신 · PC 종료 가능' : '30초마다 원본 기록 갱신' }}</p>
<UiAlert v-if="collector?.lastError" variant="warning" :description="collector.lastError" />
    <ui-page-header class="page-head" title="급등 탐지기">
      <template #description><template v-if="screen === 'strategy'">주도주 관찰 · 공개 원칙 참고 · 기존 자동 실험 기록 별도</template><template v-else-if="screen === 'leader'">세부 테마 거래대금 상위 3위 · 5분 거래대금과 가격 강도 비교</template><template v-else-if="spike">실제 텔레그램 알림을 그대로 채점 · 주문 없음 ·
      {{ spike.days.length }}일 ·
      <b>{{ spikeLabel === 'all' ? '전체' : spikeLabel }}</b> {{ spikeStat.n }}건 ·
      익절 +{{ spike.rule.target }}% / 손절 −{{ spike.rule.stop }}% /
      트레일링 −{{ spike.rule.trail }}%·−{{ spike.rule.trail2 }}%</template></template>
      <template #actions>
        <ui-button variant="outline" size="sm" :loading="loading" @click="refreshAll">
        <ui-icon name="refresh-cw" :size="14"></ui-icon>
        새로고침
        </ui-button>
      </template>
    </ui-page-header>

    <UiTab v-model="screen" :tabs="screenTabs" size="sm" aria-label="급등 탐지기 보기" />
    <SurgeRotationPanel v-if="screen === 'rotation'" />
    <UiEmpty v-if="screen !== 'rotation' && !updatedAt && (error || loading)" :title="error ? '급등 기록을 조회하지 못했습니다' : '급등 기록을 불러오는 중입니다'" :description="error ? '연결이 복구되면 기록과 성적을 표시합니다. 현재 기록 수는 확인할 수 없습니다.' : '서버에 저장된 기록을 확인하고 있습니다.'" />
    <LeaderStrategyPanel v-if="updatedAt && screen === 'strategy'" :data="strategyData" />
    <SpikeLeaderPanel v-if="updatedAt && screen === 'leader'" :rows="spikeRows" :board="leaderData.board || []" :loading="loading" :last-captured-at="leaderData.lastCapturedAt" :fee="spike?.rule?.fee" @detail="spikeSel = $event">
      <template #filters>
        <UiSelect v-model="spikeLabel" :options="SPIKE_LABEL_TABS.filter(t => t.value !== '실매매')" label="신호 라벨" label-hidden size="sm" class="spike-label-select" />
        <UiSelect v-if="spikeDayTabs.length" v-model="spikeDay" :options="spikeDayTabs" label="신호 날짜" label-hidden size="sm" class="spike-date-select" />
      </template>
    </SpikeLeaderPanel>

    <template v-if="updatedAt && screen === 'original'">
    <div class="rulecards" v-if="spikeStat.n">
      <div class="rc" v-for="s in spikeStat.rules" :key="s.key">
        <div class="rc-l">{{ s.label }}</div>
        <div class="rc-v" :class="cls(s.net)">{{ signed2(s.net) }}%</div>
        <div class="rc-s">비용 전 {{ signed2(s.raw) }}% · 승률 {{ s.win }}%</div>
      </div>
    </div>

    <div class="lblbox" v-if="spikeByLabel.length">
      <div class="ct">라벨별 성적 (전체 기간 · 종목당 첫 알림 · 종가 보유 기준)</div>
      <dl class="kv">
        <div v-for="l in spikeByLabel" :key="l.label">
          <dt>{{ l.label }} <span class="mut">{{ l.n }}건/{{ l.days }}일</span></dt>
          <dd :class="cls(l.close)">{{ signed2(l.close) }}% · 승률 {{ l.win }}%<span class="mut lblsub" v-if="l.exTop !== null"> · 상위1건 제외 {{ signed2(l.exTop) }}%<template v-if="l.domDate"> · {{ l.domDate.slice(5) }} 빼면 {{ signed2(-l.domDrop) }}%p</template></span></dd>
        </div>
      </dl>
    </div>

    <ui-tab v-model="spikeLabel" :tabs="SPIKE_LABEL_TABS" size="sm" align="left"></ui-tab>
    <ui-tab v-model="spikeDay" :tabs="spikeDayTabs" size="sm" align="left" v-if="spikeDayTabs.length"></ui-tab>

    <ui-table v-if="spikeRows.length" :columns="SPIKE_COLS" :data="spikeRows"
              size="sm" bordered clickable row-key="key"
              sticky-header max-height="calc(100vh - 340px)"
              @row-click="r => spikeSel = r">
      <template #cell-price="{ row }"><span class="num">{{ num(row.price) }}</span></template>
      <template #cell-nightpct="{ row }">
        <span class="num" :class="cls(row.nightPct)" :title="row.nightNote">{{ row.nightPct == null ? '미확인' : signed2(row.nightPct) + '%' }}</span>
      </template>
      <template #cell-kospigap="{ row }">
        <span class="num" :class="cls(row.kospiGap)" title="당일 코스피 시가 / 전일 종가 대비">{{ row.kospiGap == null ? '미확인' : signed2(row.kospiGap) + '%' }}</span>
      </template>
      <template #cell-kospisignal="{ row }">
        <span class="num" :class="cls(row.kospiSignal)" :title="row.marketNote">{{ row.kospiSignal == null ? '미확인' : signed2(row.kospiSignal) + '%' }}</span>
      </template>
      <template #cell-name="{ row }">
        <div class="spkname">
          <span class="ell">{{ row.name }}</span>
          <ui-badge v-if="row.isAuto" size="sm" variant="primary" class="autob">실매매</ui-badge>
        </div>
      </template>
      <template #cell-theme="{ row }">
        <ui-badge size="sm" variant="default">{{ row.theme }}</ui-badge>
      </template>
      <template #cell-label="{ row }">
        <ui-badge size="sm" :variant="spikeLabelVariant(row.label)">{{ row.label || '–' }}</ui-badge>
      </template>
      <template #cell-high="{ row }">
        <span class="num" :class="row.high >= spike.rule.target ? 'pos' : 'mut'">{{ signed2(row.high) }}%</span>
      </template>
      <template #cell-fixed="{ row }">
        <span class="num" :class="cls(row.fixed)">{{ signed2(row.fixed) }}%</span>
      </template>
      <template #cell-trail="{ row }">
        <span class="num" :class="cls(row.trail)">{{ signed2(row.trail) }}%</span>
      </template>
      <template #cell-trail3="{ row }">
        <span class="num mut">{{ signed2(row.trail3) }}%</span>
      </template>
      <template #cell-close="{ row }">
        <span class="num" :class="cls(row.close)">{{ signed2(row.close) }}%</span>
      </template>
    </ui-table>
    <ui-empty v-else-if="!loading && !error" title="조건에 맞는 알림이 없습니다"
              description="날짜나 라벨을 바꾸거나 새로운 탐지 기록을 기다려 주세요."></ui-empty>
    <div class="note">야간선물: 전일 정산가 대비 · 코스피 출발: 시가 갭 · 신호 시가대비: 당일 시가 기준. 과거 신호는 직전 완료 1분봉으로 보완하며 없는 자료는 미확인입니다.</div>

    </template>
    <ui-drawer :open="!!spikeSel" position="right" width="420px"
               :confirm-before-close="false" :show-fullscreen="false"
               :title="spikeSel ? spikeSel.name : ''"
               @update:open="v => { if (!v) spikeSel = null }">
      <template v-if="spikeSel">
        <div class="note">야간선물 {{ spikeSel.nightPct == null ? '미확인' : signed2(spikeSel.nightPct) + '%' }} · {{ spikeSel.nightNote }}<br>코스피 출발 {{ spikeSel.kospiGap == null ? '미확인' : signed2(spikeSel.kospiGap) + '%' }} · 신호 시가대비 {{ spikeSel.kospiSignal == null ? '미확인' : signed2(spikeSel.kospiSignal) + '%' }}<br>{{ spikeSel.marketNote }}</div>
        <div class="sub" style="margin:0 0 4px">
          {{ spikeSel.date }} {{ spikeSel.time }} · {{ spikeSel.code }} · {{ spikeSel.theme }}
        </div>
        <div class="sec">
          <div class="grid2">
            <span class="k">알림가</span><span class="v">{{ num(spikeSel.price) }}원</span>
            <span class="k">라벨</span><span class="v">{{ spikeSel.label || '–' }}</span>
            <span class="k">당일 등락</span><span class="v" :class="cls(spikeSel.dayPct)">{{ signed2(spikeSel.dayPct) }}%</span>
            <span class="k">chg20</span><span class="v">{{ signed2(spikeSel.chg20) }}%</span>
            <span class="k">CoH</span><span class="v">{{ spikeSel.coh }}%</span>
          </div>
        </div>
        <div class="sec">
          <h3>알림 이후</h3>
          <div class="grid2">
            <span class="k">+5분</span><span class="v" :class="cls(spikeSel.m5)">{{ signed2(spikeSel.m5) }}%</span>
            <span class="k">+15분</span><span class="v" :class="cls(spikeSel.m15)">{{ signed2(spikeSel.m15) }}%</span>
            <span class="k">+30분</span><span class="v" :class="cls(spikeSel.m30)">{{ signed2(spikeSel.m30) }}%</span>
            <span class="k">최고</span><span class="v pos">{{ signed2(spikeSel.high) }}%</span>
            <span class="k">종가</span><span class="v" :class="cls(spikeSel.close)">{{ signed2(spikeSel.close) }}%</span>
          </div>
        </div>
        <div class="sec">
          <h3>청산 룰별</h3>
          <div class="grid2">
            <span class="k">고정 +{{ spike.rule.target }}%/−{{ spike.rule.stop }}%</span>
            <span class="v" :class="cls(spikeSel.fixed)">{{ signed2(spikeSel.fixed) }}%</span>
            <span class="k">트레일링 −{{ spike.rule.trail }}%</span>
            <span class="v" :class="cls(spikeSel.trail)">{{ signed2(spikeSel.trail) }}%</span>
          </div>
          <div class="note">왕복 비용 {{ spike.rule.fee }}% 는 차감 전입니다.</div>
        </div>
      </template>
    </ui-drawer>
</section>
</template>
<style scoped>
.rulecards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
           gap:10px;margin:0 0 14px}
.rc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.rc-l{font-size:12px;font-weight:650;color:var(--muted);letter-spacing:.2px}
.rc-v{font-size:26px;font-weight:680;line-height:1.15;margin:4px 0 2px;
      font-variant-numeric:tabular-nums;letter-spacing:-.5px}
.rc-s{font-size:12px;color:var(--muted)}
/* 라벨별 성적 */
.lblsub{font-weight:400;font-size:11px;line-height:1.5}
/* 종목명 + 실매매 배지를 한 줄에. 배지가 접히면 행 높이가 두 배가 된다. */
.spkname{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap}
.spkname .ell{overflow:hidden;text-overflow:ellipsis;min-width:0}
.autob{flex:0 0 auto}
.lblbox{background:var(--card);border:1px solid var(--line);border-radius:12px;
        padding:14px 16px;margin:0 0 14px}
.lblbox .ct{font-size:13px;font-weight:650;margin:0 0 6px}
/* 라벨이 4개인데 한 줄에 하나씩 두면 가운데가 통째로 빈다. 2열로 반씩 쓴다. */
.lblbox .kv{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;border-top:0}
.lblbox .kv > div{border-top:1px solid var(--line-light);border-bottom:0;padding:9px 0}
@media (max-width:860px){ .lblbox .kv{grid-template-columns:1fr} }


.spike-view { --card:#fff; --line:#e2e8f0; --line-light:#edf1f7; --muted:#66758d; display:grid; gap:14px; padding:24px; color:#1b2e4b; min-width:0; }
.pos { color:#d1394b; }.neg { color:#2563c5; }.mut,.note,.sub { color:var(--muted); }.note,.sub { font-size:12px;line-height:1.8; }.num { font-variant-numeric:tabular-nums; }
.kv { margin:0; }.kv dt { font-size:12px; font-weight:600; }.kv dd { margin:5px 0 0; font-size:13px; }.lblsub { display:block; }
.grid2 { display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px; }.v { text-align:right; }.k { color:var(--muted); }.sec { padding:18px 0;border-bottom:1px solid var(--line); }.sec h3 { font-size:14px;margin:0 0 15px; }
.spike-view { grid-template-columns:minmax(0,1fr); }
.spike-view > * { min-width:0; }
.spike-view :deep(.ui-table-wrapper) { overflow-x:auto; }.spike-view :deep(table) { min-width:1300px; }
@media(max-width:600px){ .spike-view { padding:16px 10px; }.rc-v {font-size:22px;} }

</style>
