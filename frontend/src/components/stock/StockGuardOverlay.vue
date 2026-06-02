<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { UiIcon } from '@anthropic-ai/ispark-ui'
import type { GuardStatus } from '../../api/stockApi'

const props = defineProps<{
  status: GuardStatus
}>()

// 격려 문구
const encouragements = [
  '쉬는 것도 투자입니다 🧘',
  '지금 안 봐도 주가는 그대로에요 📊',
  '잠깐 쉬면 더 냉정한 판단을 할 수 있어요 🧠',
  '매매 충동은 5분이면 사라집니다 ⏳',
  '워렌 버핏도 하루종일 주식창을 보진 않아요 📖',
  '산책이라도 다녀오세요 🚶',
  '과도한 모니터링은 수익률을 낮춥니다 📉',
]

const encouragement = ref('')
const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  encouragement.value = encouragements[Math.floor(Math.random() * encouragements.length)]
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

// 다음 오픈까지 남은 시간 계산
const countdown = computed(() => {
  if (!props.status.nextOpenTime) return ''

  const [h, m] = props.status.nextOpenTime.split(':').map(Number)

  // KST 기준 현재 시간
  const kst = new Date(now.value.getTime() + 9 * 60 * 60 * 1000)
  const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  const nowSec = kst.getUTCSeconds()

  let targetMin = h * 60 + m

  // 다음 날인 경우 (nextOpenDay가 있거나 targetMin <= nowMin)
  if (targetMin <= nowMin) {
    targetMin += 24 * 60
  }

  const diffSec = (targetMin - nowMin) * 60 - nowSec
  if (diffSec <= 0) return '곧 열립니다!'

  const hours = Math.floor(diffSec / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  const secs = diffSec % 60

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

// 남은 윈도우 수
const remainingWindows = computed(() => {
  if (!props.status.windows) return 0

  const kst = new Date(now.value.getTime() + 9 * 60 * 60 * 1000)
  const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()

  return props.status.windows.filter(w => {
    const [h, m] = w.open.split(':').map(Number)
    return h * 60 + m > nowMin
  }).length
})
</script>

<template>
  <div class="stock-guard-overlay">
    <div class="stock-guard-overlay__content">
      <UiIcon name="lock" :size="48" class="stock-guard-overlay__icon" />

      <h2 class="stock-guard-overlay__title">
        주식 확인 시간이 아닙니다
      </h2>

      <div v-if="status.nextOpenTime" class="stock-guard-overlay__next">
        <span class="stock-guard-overlay__label">다음 확인 가능</span>
        <span class="stock-guard-overlay__time">{{ status.nextOpenTime }}</span>
        <span v-if="status.nextOpenDay === 'monday'" class="stock-guard-overlay__day">(월요일)</span>
      </div>

      <div v-if="countdown" class="stock-guard-overlay__countdown">
        {{ countdown }}
      </div>

      <div class="stock-guard-overlay__remaining">
        오늘 남은 확인 횟수: <strong>{{ remainingWindows }}회</strong>
      </div>

      <p class="stock-guard-overlay__encourage">
        {{ encouragement }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stock-guard-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;

  &__content {
    text-align: center;
    max-width: 400px;
  }

  &__icon {
    color: var(--color-text-tertiary);
    margin-bottom: 1.5rem;
  }

  &__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 1.5rem;
  }

  &__next {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  &__time {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  &__day {
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
  }

  &__countdown {
    font-size: 2.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
    margin-bottom: 1.5rem;
    letter-spacing: 0.05em;
  }

  &__remaining {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;

    strong {
      color: var(--color-text-primary);
    }
  }

  &__encourage {
    font-size: 0.9375rem;
    color: var(--color-text-tertiary);
    font-style: italic;
  }
}
</style>
