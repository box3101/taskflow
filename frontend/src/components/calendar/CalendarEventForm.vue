<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import {
  UiDrawer, UiInput, UiTextarea, UiDatePicker, UiButton, UiToggle, UiSelect,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DateValue } from '@internationalized/date'
import { COLOR_PRESETS, TIME_OPTIONS } from '../../types/calendar'
import type { CalendarEvent } from '../../types/calendar'
import api from '../../api/client'

const props = defineProps<{
  open: boolean
  event: CalendarEvent | null
  defaultDate: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const saving = ref(false)
const title = ref('')
const date = ref<DateValue | undefined>()
const endDate = ref<DateValue | undefined>()
const allDay = ref(true)
const startTime = ref('')
const endTime = ref('')
const location = ref('')
const memo = ref('')
const color = ref('#3b82f6')

const dateError = computed(() => {
  if (date.value && endDate.value && fromDateValue(endDate.value)! < fromDateValue(date.value)!) {
    return '종료일은 시작일 이후여야 합니다'
  }
  return ''
})

const timeError = computed(() => {
  if (!allDay.value && startTime.value && endTime.value && startTime.value >= endTime.value) {
    return '종료 시간은 시작 시간 이후여야 합니다'
  }
  return ''
})

const canSave = computed(() => {
  return title.value.trim().length > 0 && date.value && !dateError.value && !timeError.value && !saving.value
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  if (props.event) {
    title.value = props.event.title
    // 확장된 일별 항목이므로 원본 시작/종료일(srcStart/srcEnd) 우선 사용
    const startStr = props.event.srcStart ?? props.event.date
    const d = new Date(startStr + 'T00:00:00')
    date.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    if (props.event.srcEnd) {
      const e = new Date(props.event.srcEnd + 'T00:00:00')
      endDate.value = new CalendarDate(e.getFullYear(), e.getMonth() + 1, e.getDate())
    } else {
      endDate.value = undefined
    }
    allDay.value = props.event.allDay ?? !(props.event.startTime || props.event.endTime)
    startTime.value = props.event.startTime || ''
    endTime.value = props.event.endTime || ''
    location.value = props.event.location || ''
    memo.value = props.event.memo || ''
    color.value = props.event.color
  } else {
    title.value = ''
    const d = new Date(props.defaultDate + 'T00:00:00')
    date.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    endDate.value = undefined
    allDay.value = true
    startTime.value = ''
    endTime.value = ''
    location.value = ''
    memo.value = ''
    color.value = '#22c55e'
  }
})

function fromDateValue(val: DateValue | undefined): string | null {
  if (!val) return null
  return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`
}

async function onSave() {
  if (!canSave.value) return
  saving.value = true
  try {
    const endDateStr = fromDateValue(endDate.value)
    const startDateStr = fromDateValue(date.value)
    const body = {
      title: title.value.trim(),
      date: startDateStr,
      // 종료일이 시작일과 같거나 비었으면 단일 날짜
      endDate: endDateStr && endDateStr > startDateStr! ? endDateStr : null,
      allDay: allDay.value,
      startTime: allDay.value ? null : (startTime.value || null),
      endTime: allDay.value ? null : (endTime.value || null),
      location: location.value || null,
      memo: memo.value || null,
      color: color.value,
    }
    if (props.event) {
      await api.patch(`/calendar/${props.event.id}`, body)
    } else {
      await api.post('/calendar', body)
      openToast({ message: '일정이 추가되었습니다.', type: 'success' })
    }
    emit('update:open', false)
    emit('saved')
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!props.event) return
  const ok = await openConfirm({
    title: '일정 삭제',
    message: '이 일정을 삭제하시겠습니까?',
    confirmText: '삭제',
  })
  if (!ok) return
  try {
    await api.delete(`/calendar/${props.event.id}`)
    openToast({ message: '일정이 삭제되었습니다.', type: 'success' })
    emit('update:open', false)
    emit('deleted')
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}
</script>

<template>
  <UiDrawer :open="open" :title="event ? '일정 수정' : '일정 추가'" @update:open="emit('update:open', $event)">
    <div class="event-form">
      <UiInput v-model="title" label="제목" placeholder="일정 제목을 입력하세요" />
      <div class="event-form__date-row">
        <UiDatePicker v-model="date" label="시작일" type="date" locale="ko-KR" />
        <UiDatePicker v-model="endDate" label="종료일 (선택)" type="date" locale="ko-KR" />
      </div>
      <p v-if="dateError" class="event-form__time-error">{{ dateError }}</p>
      <div class="event-form__allday">
        <span class="event-form__allday-label">하루종일</span>
        <UiToggle v-model="allDay" />
      </div>
      <div v-if="!allDay" class="event-form__time-row">
        <div class="event-form__field">
          <label class="event-form__field-label">시작 시간</label>
          <UiSelect v-model="startTime" :options="TIME_OPTIONS" placeholder="시작 시간" size="sm" />
        </div>
        <div class="event-form__field">
          <label class="event-form__field-label">종료 시간</label>
          <UiSelect v-model="endTime" :options="TIME_OPTIONS" placeholder="종료 시간" size="sm" />
        </div>
      </div>
      <p v-if="timeError" class="event-form__time-error">{{ timeError }}</p>
      <UiInput v-model="location" label="장소" placeholder="장소를 입력하세요" />
      <UiTextarea v-model="memo" label="메모" placeholder="메모를 입력하세요" :rows="3" />
    </div>
    <template #footer>
      <div class="event-form__footer">
        <UiButton v-if="event" variant="danger" size="sm" @click="onDelete">삭제</UiButton>
        <div class="event-form__footer-right">
          <UiButton variant="outline" size="sm" @click="emit('update:open', false)">취소</UiButton>
          <UiButton size="sm" :loading="saving" :disabled="!canSave" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.event-form { display: flex; flex-direction: column; gap: 16px; }
.event-form__date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.event-form__time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.event-form__field { display: flex; flex-direction: column; gap: 6px; }
.event-form__field-label { font-size: 12px; font-weight: 500; color: #374151; }
.event-form__allday { display: flex; align-items: center; gap: 10px; }
.event-form__allday-label { font-size: 13px; font-weight: 500; color: #374151; }
.event-form__time-error { font-size: 12px; color: #ef4444; margin-top: -8px; }
.event-form__footer { display: flex; justify-content: space-between; align-items: center; }
.event-form__footer-right { display: flex; gap: 8px; margin-left: auto; }
</style>
