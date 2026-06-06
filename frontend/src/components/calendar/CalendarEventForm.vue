<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import {
  UiDrawer, UiInput, UiTextarea, UiDatePicker, UiButton,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DateValue } from '@internationalized/date'
import { COLOR_PRESETS } from '../../types/calendar'
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
const startTime = ref('')
const endTime = ref('')
const location = ref('')
const memo = ref('')
const color = ref('#22c55e')

const timeError = computed(() => {
  if (startTime.value && endTime.value && startTime.value >= endTime.value) {
    return '종료 시간은 시작 시간 이후여야 합니다'
  }
  return ''
})

const canSave = computed(() => {
  return title.value.trim().length > 0 && date.value && !timeError.value && !saving.value
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  if (props.event) {
    title.value = props.event.title
    const d = new Date(props.event.date + 'T00:00:00')
    date.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    startTime.value = props.event.startTime || ''
    endTime.value = props.event.endTime || ''
    location.value = props.event.location || ''
    memo.value = props.event.memo || ''
    color.value = props.event.color
  } else {
    title.value = ''
    const d = new Date(props.defaultDate + 'T00:00:00')
    date.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
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
    const body = {
      title: title.value.trim(),
      date: fromDateValue(date.value),
      startTime: startTime.value || null,
      endTime: endTime.value || null,
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
      <UiDatePicker v-model="date" label="날짜" type="date" locale="ko-KR" />
      <div class="event-form__time-row">
        <UiInput v-model="startTime" label="시작 시간" type="time" />
        <UiInput v-model="endTime" label="종료 시간" type="time" />
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
.event-form__time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.event-form__time-error { font-size: 12px; color: #ef4444; margin-top: -8px; }
.event-form__footer { display: flex; justify-content: space-between; align-items: center; }
.event-form__footer-right { display: flex; gap: 8px; margin-left: auto; }
</style>
