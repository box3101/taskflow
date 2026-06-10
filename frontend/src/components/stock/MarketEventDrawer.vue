<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiDrawer, UiButton, UiInput, UiTextarea, UiIcon, UiBadge, openToast } from '@leechanyong/ispark-ui'
import type { MarketEvent } from '../../types/stock'
import { saveEventResult } from '../../api/stockApi'

const props = defineProps<{
  open: boolean
  event: MarketEvent | null
  savedActual?: string | null
  savedMemo?: string | null
  savedImpact?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [eventId: string, data: { actual: string; memo: string; impact: string }]
}>()

const actual = ref('')
const memo = ref('')
const impact = ref<string>('')
const saving = ref(false)

// props가 바뀔 때 기존 저장값 복원
// 예상 vs 실제 비교하여 자동 impact 추론
function guessImpact(ev: MarketEvent | null, actualVal: string): string {
  if (!ev?.expected || !actualVal) return ''
  const exp = parseFloat(ev.expected)
  const act = parseFloat(actualVal)
  if (isNaN(exp) || isNaN(act)) return ''
  if (act > exp) return 'above'
  if (act < exp) return 'below'
  return 'meet'
}

function syncFields() {
  const actualVal = props.savedActual || props.event?.actual || ''
  actual.value = actualVal
  memo.value = props.savedMemo || ''
  // DB에 저장된 impact 우선, 없으면 자동 추론
  impact.value = props.savedImpact || guessImpact(props.event, actualVal)
}

watch(() => props.event, syncFields)
watch(() => props.open, (v) => { if (v) syncFields() })

const categoryColor: Record<string, string> = {
  'us-econ': '#ef5350',
  'us-earnings': '#42a5f5',
  'kr-schedule': '#ffa726',
  'global': '#ab47bc',
  'foreign-flow': '#26a69a',
  'sentiment': '#78909c',
}

const categoryLucideIcon: Record<string, string> = {
  'us-econ': 'landmark',
  'us-earnings': 'building-2',
  'kr-schedule': 'flag',
  'global': 'globe',
  'foreign-flow': 'bar-chart-3',
  'sentiment': 'activity',
}

const categoryLabel: Record<string, string> = {
  'us-econ': '미국 경제',
  'us-earnings': '기업 실적',
  'kr-schedule': '한국 증시',
  'global': '글로벌',
  'foreign-flow': '외국인',
  'sentiment': '시장 심리',
}

const isPast = computed(() => {
  if (!props.event) return false
  return props.event.date < new Date().toISOString().split('T')[0]
})

const impactOptions = [
  { value: 'above', label: '예상 상회', icon: 'trending-up', color: '#ef4444' },
  { value: 'meet', label: '예상 부합', icon: 'minus', color: '#4f6af6' },
  { value: 'below', label: '예상 하회', icon: 'trending-down', color: '#3b82f6' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

async function handleSave() {
  if (!props.event) return
  saving.value = true
  try {
    await saveEventResult(props.event.id, {
      actual: actual.value,
      memo: memo.value,
      impact: impact.value,
    })
    emit('saved', props.event.id, {
      actual: actual.value,
      memo: memo.value,
      impact: impact.value,
    })
    openToast({ message: '결과가 저장되었습니다.', type: 'success' })
    emit('update:open', false)
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    :open="open"
    @update:open="emit('update:open', $event)"
    position="right"
    width="420px"
  >
    <template #title>
      <div class="drawer-title" v-if="event">
        <UiIcon
          :name="categoryLucideIcon[event.category] || 'calendar'"
          :size="18"
          :style="{ color: categoryColor[event.category] }"
        />
        <span>{{ event.title }}</span>
      </div>
    </template>

    <div class="event-detail" v-if="event">
      <!-- 카테고리 + 날짜 -->
      <div class="event-detail__meta">
        <UiBadge
          :color-hex="categoryColor[event.category]"
          size="sm"
        >
          {{ categoryLabel[event.category] }}
        </UiBadge>
        <span class="event-detail__date">{{ formatDate(event.date) }}</span>
        <span v-if="event.time" class="event-detail__time">
          <UiIcon name="clock" :size="12" /> {{ event.time }}
        </span>
      </div>

      <!-- 설명 -->
      <div v-if="event.subtitle" class="event-detail__subtitle">
        {{ event.subtitle }}
      </div>

      <!-- 중요도 -->
      <div class="event-detail__importance">
        <span class="label">중요도</span>
        <span class="dots">
          <span
            v-for="n in 3"
            :key="n"
            class="dot"
            :class="{ 'dot--active': n <= event.importance }"
            :style="n <= event.importance ? { background: categoryColor[event.category] } : {}"
          ></span>
        </span>
      </div>

      <!-- 예상/이전/실제 비교 -->
      <div class="event-detail__compare">
        <div v-if="event.expected" class="compare-item">
          <span class="compare-label">
            <UiIcon name="target" :size="14" /> 예상
          </span>
          <span class="compare-value">{{ event.expected }}</span>
        </div>
        <div v-if="event.previous" class="compare-item">
          <span class="compare-label">
            <UiIcon name="history" :size="14" /> 이전
          </span>
          <span class="compare-value">{{ event.previous }}</span>
        </div>
        <div v-if="savedActual || actual" class="compare-item compare-item--actual">
          <span class="compare-label">
            <UiIcon name="check-circle" :size="14" /> 실제
          </span>
          <span class="compare-value compare-value--actual">{{ savedActual || actual }}</span>
        </div>
      </div>

      <!-- 영향 분석 -->
      <div v-if="event.impact" class="event-detail__impact">
        <UiIcon name="lightbulb" :size="14" color="warning" />
        <span>{{ event.impact }}</span>
      </div>

      <!-- 구분선 -->
      <hr class="divider" />

      <!-- 결과 입력 섹션 -->
      <div class="event-detail__result">
        <h4>
          <UiIcon name="pencil" :size="14" />
          결과 기록
        </h4>

        <!-- 실제 결과 -->
        <div class="field">
          <label>실제 결과</label>
          <UiInput
            v-model="actual"
            placeholder="예: 2.7%, EPS $1.52"
            size="sm"
          />
        </div>

        <!-- 예상 대비 -->
        <div class="field">
          <label>예상 대비</label>
          <div class="impact-options">
            <button
              v-for="opt in impactOptions"
              :key="opt.value"
              class="impact-btn"
              :class="{ 'impact-btn--active': impact === opt.value }"
              :style="impact === opt.value ? { borderColor: opt.color, color: opt.color } : {}"
              @click="impact = impact === opt.value ? '' : opt.value"
            >
              <UiIcon :name="opt.icon" :size="14" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 메모 -->
        <div class="field">
          <label>메모</label>
          <UiTextarea
            v-model="memo"
            placeholder="시장 반응, 개인 분석 등"
            :rows="3"
          />
        </div>

        <UiButton
          variant="primary"
          full-width
          :loading="saving"
          @click="handleSave"
        >
          저장
        </UiButton>
      </div>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
}

.event-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__date {
    font-size: 13px;
    color: #6b7280;
  }

  &__time {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 13px;
    color: #6b7280;
  }

  &__subtitle {
    font-size: 14px;
    color: #9ca3af;
  }

  &__importance {
    display: flex;
    align-items: center;
    gap: 8px;

    .label {
      font-size: 12px;
      color: #9ca3af;
    }

    .dots { display: flex; gap: 4px; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e5e7eb;
      &--active { background: #ef4444; }
    }
  }

  &__compare {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__impact {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #6b7280;
    background: #fffbeb;
    padding: 10px 12px;
    border-radius: 8px;
    line-height: 1.5;
  }

  &__result {
    display: flex;
    flex-direction: column;
    gap: 12px;

    h4 {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 700;
      margin: 0;
    }
  }
}

.compare-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
  min-width: 80px;

  &--actual {
    background: #ecfdf5;
  }
}

.compare-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}

.compare-value {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;

  &--actual { color: #16a34a; }
}

.divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 4px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }
}

.impact-options {
  display: flex;
  gap: 8px;
}

.impact-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #d1d5db; }

  &--active {
    background: color-mix(in srgb, currentColor 8%, #fff);
    border-width: 2px;
    font-weight: 700;
  }
}

// 다크모드
:global([data-theme="dark"]) {
  .compare-item { background: #1f2937; }
  .compare-item--actual { background: #1a3a2a; }
  .compare-value { color: #e5e7eb; }
  .event-detail__impact { background: #2a2520; }
  .divider { border-top-color: #2d2f36; }
  .impact-btn {
    background: #1f2937;
    border-color: #374151;
    color: #9ca3af;
  }
}
</style>
