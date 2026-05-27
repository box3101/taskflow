<script setup lang="ts">
import { computed } from 'vue'
import type { FearGreedData } from '../../api/stockApi'

const props = defineProps<{
  data: FearGreedData
}>()

const gaugeColor = computed(() => {
  const v = props.data.value
  if (v === null) return '#9ca3af'
  if (v <= 25) return '#3b82f6'  // 극단 공포
  if (v <= 45) return '#60a5fa'  // 공포
  if (v <= 55) return '#9ca3af'  // 중립
  if (v <= 75) return '#f97316'  // 탐욕
  return '#ef4444'               // 극단 탐욕
})

const statusText = computed(() => {
  const v = props.data.value
  if (v === null) return 'N/A'
  if (v <= 25) return '극단 공포'
  if (v <= 45) return '공포'
  if (v <= 55) return '중립'
  if (v <= 75) return '탐욕'
  return '극단 탐욕'
})

const advice = computed(() => {
  const v = props.data.value
  if (v === null) return ''
  if (v <= 25) return '시장이 극도로 두려워하고 있습니다. 매도하지 마세요.'
  if (v <= 45) return '공포 구간입니다. 흔들리지 마세요.'
  if (v <= 55) return '시장이 평온합니다. 계획을 유지하세요.'
  if (v <= 75) return '탐욕 구간입니다. 추격 매수를 자제하세요.'
  return '극단 탐욕입니다. 신규 매수를 멈추세요.'
})

// 게이지 각도 (0~180도)
const rotation = computed(() => {
  const v = props.data.value ?? 50
  return (v / 100) * 180
})
</script>

<template>
  <div class="fear-greed-gauge">
    <div class="section-header">
      <h3>😱 공포 탐욕 지수</h3>
      <span class="source">CNN Fear & Greed</span>
    </div>

    <div class="gauge-container">
      <!-- 반원 게이지 (CSS) -->
      <div class="gauge">
        <div class="gauge-bg"></div>
        <div class="gauge-needle" :style="{ transform: `rotate(${rotation}deg)` }"></div>
        <div class="gauge-center">
          <span class="gauge-value" :style="{ color: gaugeColor }">
            {{ data.value ?? '-' }}
          </span>
          <span class="gauge-status" :style="{ color: gaugeColor }">
            {{ statusText }}
          </span>
        </div>
      </div>

      <!-- 범례 -->
      <div class="gauge-labels">
        <span class="label-fear">공포</span>
        <span class="label-greed">탐욕</span>
      </div>
    </div>

    <p class="advice" :style="{ color: gaugeColor }">{{ advice }}</p>
  </div>
</template>

<style lang="scss" scoped>
.fear-greed-gauge {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}
.source { font-size: 11px; color: #9ca3af; }

.gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.gauge {
  position: relative;
  width: 200px;
  height: 100px;
  overflow: hidden;
}

.gauge-bg {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: conic-gradient(
    from 180deg,
    #3b82f6 0deg,
    #60a5fa 45deg,
    #9ca3af 90deg,
    #f97316 135deg,
    #ef4444 180deg,
    transparent 180deg
  );
  mask: radial-gradient(circle at center, transparent 60px, black 62px);
  -webkit-mask: radial-gradient(circle at center, transparent 60px, black 62px);
}

.gauge-needle {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 3px;
  height: 70px;
  background: #1f2937;
  border-radius: 2px;
  transform-origin: bottom center;
  transform: rotate(90deg);
  transition: transform 1s ease-out;
  margin-left: -1.5px;
}

.gauge-center {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.gauge-value {
  display: block;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.gauge-status {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-top: 2px;
}

.gauge-labels {
  display: flex;
  justify-content: space-between;
  width: 200px;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}

.advice {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  margin-top: 12px;
  line-height: 1.5;
}
</style>
