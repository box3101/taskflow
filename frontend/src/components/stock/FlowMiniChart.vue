<script setup lang="ts">
import { computed } from 'vue'
import { UiChart, UiEmpty } from '@leechanyong/ispark-ui'
const props = withDefaults(defineProps<{
  points: { time: string; value: number | null }[]
  label: string
  unit: string
  color?: string
}>(), { color: '#4f6af6' })
const valid = computed(() => props.points.filter(p => p.value !== null))
function time(value: string) { return new Date(value).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }) }
const config = computed(() => {
  // Expand missing minutes to null: the library must not connect a collection gap.
  const values: (number | null)[] = [], categories: string[] = []
  props.points.forEach((point, i) => {
    const prev = props.points[i - 1]
    if (prev) {
      for (let at = Date.parse(prev.time) + 60_000; at < Date.parse(point.time) - 30_000; at += 60_000) {
        categories.push(time(new Date(at).toISOString())); values.push(null)
      }
    }
    categories.push(time(point.time)); values.push(point.value)
  })
  const numeric = valid.value.map(p => p.value!)
  const lo = Math.min(...numeric), hi = Math.max(...numeric)
  const padding = Math.max((hi - lo) * .15, .5)
  return {
    categories,
    datasets: [{ label: props.label, data: values, borderColor: props.color, spanGaps: false, tension: 0 }],
    minValue: lo - padding, maxValue: hi + padding,
    tooltipValueSuffix: ` ${props.unit}`,
    scales: {
      x: { ticks: { maxTicksLimit: 5, maxRotation: 0, color: '#929db0', font: { size: 10 } }, grid: { display: false }, border: { color: '#e9edf5' } },
      y: { min: lo - padding, max: hi + padding, ticks: { maxTicksLimit: 4, color: '#929db0', font: { size: 10 } }, grid: { color: '#f0f3f8' }, border: { display: false } },
    },
  }
})
</script>

<template>
  <div class="flow-chart">
    <div class="flow-chart__label"><i :style="{ background: color }" />{{ label }} <small>{{ unit }}</small></div>
    <UiEmpty v-if="valid.length < 2" class="flow-chart__empty" description="관측이 두 번 이상 쌓이면 흐름이 표시됩니다." />
    <div v-else class="flow-chart__plot" role="img" :aria-label="`${label} 시간별 추이, ${unit}`">
      <UiChart type="line" :config="config" :show-legend="false" />
    </div>
  </div>
</template>

<style scoped>
.flow-chart { min-width: 0; }
.flow-chart__label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #53617b; margin-bottom: 5px; }
.flow-chart__label i { width: 7px; height: 7px; border-radius: 50%; }
.flow-chart__label small { color: #929db0; }
.flow-chart__plot { height: 145px; }
.flow-chart__plot :deep(.ui-chart-canvas-wrap) { min-height: 0; }
.flow-chart__empty { min-height: 100px; padding: 24px 0; }
.flow-chart__empty :deep(.ui-empty-description) { font-size: 11px; }
</style>
