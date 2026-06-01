<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { UiLoading } from '@leechanyong/ispark-ui'
import { fetchMarketOutlook, type MarketOutlook } from '../../api/stockApi'

const props = defineProps<{
  code: string
  name: string
}>()

const outlook = ref<MarketOutlook | null>(null)
const loading = ref(false)
const error = ref(false)
const aiUnavailable = ref(false)

const signalConfig = {
  buy: { label: '매수 유리', emoji: '🟢', bg: '#f0fdf4', border: '#22c55e', color: '#15803d' },
  hold: { label: '관망', emoji: '🟡', bg: '#fffbeb', border: '#f59e0b', color: '#b45309' },
  sell: { label: '매도 유리', emoji: '🔴', bg: '#fef2f2', border: '#ef4444', color: '#dc2626' },
}

async function load() {
  if (!props.code) return
  loading.value = true
  error.value = false
  try {
    outlook.value = await fetchMarketOutlook(props.code, props.name)
  } catch (e: any) {
    if (e?.response?.status === 503) {
      aiUnavailable.value = true
    } else {
      error.value = true
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.code, load)

function fmtPct(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function pctClass(n: number) {
  return n >= 0 ? 'up' : 'down'
}

function splitSentences(text: string): string[] {
  if (!text) return []
  return text
    .split(/\n/)
    .flatMap(line => line.split(/(?<=다\.)\s*/))
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
</script>

<template>
  <div class="outlook">
    <div class="outlook__header">
      <span class="outlook__title">📊 내일 장 전망</span>
      <span v-if="outlook" class="outlook__date">{{ outlook.generatedAt.split('T')[0] }} 기준</span>
    </div>

    <UiLoading v-if="loading" overlay />

    <div v-if="aiUnavailable && !loading" class="outlook__error" style="color: #6b7280;">AI 분석 기능은 현재 사용할 수 없습니다.</div>
    <div v-else-if="error && !loading" class="outlook__error">전망 데이터를 불러올 수 없습니다.</div>

    <template v-if="outlook && !loading">
      <!-- 시그널 -->
      <div class="outlook__signal" :style="{
        background: signalConfig[outlook.signal].bg,
        borderColor: signalConfig[outlook.signal].border,
      }">
        <span class="outlook__signal-emoji">{{ signalConfig[outlook.signal].emoji }}</span>
        <div class="outlook__signal-body">
          <span class="outlook__signal-label" :style="{ color: signalConfig[outlook.signal].color }">
            {{ signalConfig[outlook.signal].label }}
          </span>
          <span class="outlook__confidence">확신도 {{ outlook.confidence }}/10</span>
        </div>
      </div>

      <!-- 요약 -->
      <p class="outlook__summary">"{{ outlook.summary }}"</p>

      <!-- 미국장 지표 -->
      <div class="outlook__indices">
        <div class="outlook__index">
          <span class="outlook__index-name">나스닥</span>
          <span class="outlook__index-val" :class="pctClass(outlook.marketData.nasdaq.changePct)">
            {{ fmtPct(outlook.marketData.nasdaq.changePct) }}
          </span>
        </div>
        <div class="outlook__index">
          <span class="outlook__index-name">SOX</span>
          <span class="outlook__index-val" :class="pctClass(outlook.marketData.sox.changePct)">
            {{ fmtPct(outlook.marketData.sox.changePct) }}
          </span>
        </div>
        <div class="outlook__index">
          <span class="outlook__index-name">VIX</span>
          <span class="outlook__index-val">{{ outlook.marketData.vix.price }}</span>
        </div>
        <div v-if="outlook.fearGreed !== null" class="outlook__index">
          <span class="outlook__index-name">탐욕</span>
          <span class="outlook__index-val">{{ outlook.fearGreed }}</span>
        </div>
        <div class="outlook__index">
          <span class="outlook__index-name">선물</span>
          <span class="outlook__index-val" :class="pctClass(outlook.marketData.nasdaqFutures.changePct)">
            {{ fmtPct(outlook.marketData.nasdaqFutures.changePct) }}
          </span>
        </div>
        <div class="outlook__index">
          <span class="outlook__index-name">환율</span>
          <span class="outlook__index-val" :class="pctClass(-outlook.marketData.usdkrw.changePct)">
            {{ outlook.marketData.usdkrw.price.toFixed(0) }}원
          </span>
        </div>
        <div v-if="outlook.marketData.nvda" class="outlook__index">
          <span class="outlook__index-name">엔비디아</span>
          <span class="outlook__index-val" :class="pctClass(outlook.marketData.nvda.changePct)">
            {{ fmtPct(outlook.marketData.nvda.changePct) }}
          </span>
        </div>
        <div v-if="outlook.marketData.mu" class="outlook__index">
          <span class="outlook__index-name">마이크론</span>
          <span class="outlook__index-val" :class="pctClass(outlook.marketData.mu.changePct)">
            {{ fmtPct(outlook.marketData.mu.changePct) }}
          </span>
        </div>
      </div>

      <!-- 수급 + 뉴스 -->
      <div class="outlook__meta">
        <span>{{ outlook.foreignTrend }}</span>
        <span>{{ outlook.newsSummary }}</span>
      </div>

      <!-- 상세 설명 (문장 단위 분리) -->
      <div class="outlook__detail">
        <p v-for="(sentence, i) in splitSentences(outlook.detail)" :key="i" class="outlook__sentence">
          {{ sentence }}
        </p>
      </div>

      <!-- 리스크 -->
      <div v-if="outlook.risks" class="outlook__risks">
        ⚠️ {{ outlook.risks }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.outlook {
  background: #fff; border-radius: 12px; padding: 20px;
  border: 1px solid #e6e8ec; position: relative;
}
.outlook__header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.outlook__title { font-size: 15px; font-weight: 700; color: #1f2937; }
.outlook__date { font-size: 11px; color: #9ca3af; }

.outlook__signal {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 10px; border: 1.5px solid; margin-bottom: 12px;
}
.outlook__signal-emoji { font-size: 28px; }
.outlook__signal-body { display: flex; flex-direction: column; gap: 2px; }
.outlook__signal-label { font-size: 18px; font-weight: 700; }
.outlook__confidence { font-size: 12px; color: #6b7280; }

.outlook__summary {
  font-size: 14px; color: #374151; font-weight: 500; font-style: italic;
  margin: 0 0 14px; line-height: 1.5;
}

.outlook__indices {
  display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
}
.outlook__index {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 14px; background: #f9fafb; border-radius: 8px; flex: 1; min-width: 60px;
}
.outlook__index-name { font-size: 10px; color: #9ca3af; font-weight: 600; }
.outlook__index-val {
  font-size: 13px; font-weight: 700; color: #374151;
  &.up { color: #ef4444; }
  &.down { color: #3b82f6; }
}

.outlook__meta {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;
  font-size: 11px; color: #6b7280; line-height: 1.5;
}

.outlook__detail {
  background: #f9fafb; border-radius: 8px; padding: 14px 16px;
  font-size: 13px; color: #374151; line-height: 1.8; margin-bottom: 10px;
}
.outlook__sentence {
  margin: 0; padding: 6px 0;
  & + & { border-top: 1px solid #eef0f2; }
}

.outlook__risks {
  font-size: 12px; color: #b45309; background: #fffbeb;
  padding: 10px 14px; border-radius: 8px; line-height: 1.5;
}

.outlook__error {
  text-align: center; color: #9ca3af; font-size: 13px; padding: 20px 0;
}
</style>
