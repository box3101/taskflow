<template>
  <UiDrawer
    :open="open"
    :title="workout ? '운동 수정' : '운동 추가'"
    width="480px"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <div class="workout-form__fields">
      <div class="workout-form__field">
        <label>운동명 <span class="required">*</span></label>
        <UiInput v-model="form.name" placeholder="예: 벤치프레스, 러닝" />
      </div>
      <div class="workout-form__field">
        <label>무게 (kg)</label>
        <UiInput v-model="form.weight" type="number" inputmode="numeric" placeholder="0" />
      </div>
      <div class="workout-form__row">
        <div class="workout-form__field">
          <label>세트</label>
          <UiInput v-model="form.sets" type="number" inputmode="numeric" placeholder="0" />
        </div>
        <div class="workout-form__field">
          <label>횟수</label>
          <UiInput v-model="form.reps" type="number" inputmode="numeric" placeholder="0" />
        </div>
      </div>
      <div class="workout-form__field">
        <label>시간 (분)</label>
        <UiInput v-model="form.duration" type="number" inputmode="numeric" placeholder="0" />
      </div>
      <div class="workout-form__field">
        <label>메모</label>
        <UiInput v-model="form.memo" placeholder="메모 (선택)" />
      </div>
    </div>

    <template #footer>
      <div class="workout-form__footer">
        <UiButton variant="outline" @click="emit('update:open', false)">취소</UiButton>
        <UiButton
          v-if="workout"
          variant="danger"
          @click="handleDelete"
        >삭제</UiButton>
        <UiButton @click="handleSave" :disabled="!form.name.trim()" :loading="saving">저장</UiButton>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiDrawer, UiButton, UiInput, openToast, openConfirm } from '@leechanyong/ispark-ui'
import { useWorkout, type WorkoutEntry } from '../../composables/useWorkout'

const props = defineProps<{
  open: boolean
  workout: WorkoutEntry | null
  selectedDate: string
  recentWorkouts: WorkoutEntry[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const { addWorkout, updateWorkout, deleteWorkout } = useWorkout()

const saving = ref(false)
const form = ref(createEmptyForm())

function createEmptyForm() {
  return {
    name: '',
    weight: '',
    sets: '',
    reps: '',
    duration: '',
    memo: '',
  }
}

// props.open 변경 시 폼 초기화
watch(() => props.open, (v) => {
  if (v) {
    if (props.workout) {
      form.value = {
        name: props.workout.name,
        weight: props.workout.weight != null ? String(props.workout.weight) : '',
        sets: props.workout.sets != null ? String(props.workout.sets) : '',
        reps: props.workout.reps != null ? String(props.workout.reps) : '',
        duration: props.workout.duration != null ? String(props.workout.duration) : '',
        memo: props.workout.memo || '',
      }
    } else {
      form.value = createEmptyForm()
    }
  }
})

function fillFromRecent(r: WorkoutEntry) {
  form.value = {
    name: r.name,
    weight: r.weight != null ? String(r.weight) : '',
    sets: r.sets != null ? String(r.sets) : '',
    reps: r.reps != null ? String(r.reps) : '',
    duration: r.duration != null ? String(r.duration) : '',
    memo: '',
  }
}

function toNumber(val: string): number | undefined {
  const n = Number(val)
  return val && !isNaN(n) ? n : undefined
}

async function handleSave() {
  if (!form.value.name.trim() || saving.value) return

  const entry = {
    date: props.selectedDate,
    name: form.value.name.trim(),
    weight: toNumber(form.value.weight),
    sets: toNumber(form.value.sets),
    reps: toNumber(form.value.reps),
    duration: toNumber(form.value.duration),
    memo: form.value.memo.trim() || undefined,
  }

  saving.value = true
  try {
    if (props.workout) {
      await updateWorkout(props.workout.id, entry)
      openToast({ message: '운동 기록이 수정되었습니다.', type: 'success' })
    } else {
      await addWorkout(entry)
      openToast({ message: '운동 기록이 추가되었습니다.', type: 'success' })
    }
    emit('update:open', false)
    emit('saved')
  } catch (e: any) {
    openToast({ message: e.message || '저장에 실패했습니다.', type: 'warning' })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.workout) return
  const confirmed = await openConfirm({
    title: '삭제 확인',
    message: '이 운동 기록을 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!confirmed) return

  try {
    await deleteWorkout(props.workout.id)
    openToast({ message: '운동 기록이 삭제되었습니다.', type: 'success' })
    emit('update:open', false)
    emit('deleted')
  } catch (e: any) {
    openToast({ message: e.message || '삭제에 실패했습니다.', type: 'warning' })
  }
}
</script>

<style scoped lang="scss">
.workout-form__recent {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.workout-form__recent-title {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.workout-form__recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.workout-form__recent-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #4f6af6;
    color: #4f6af6;
  }
}

.workout-form__recent-name {
  font-weight: 500;
  color: #1f2937;
}

.workout-form__recent-detail {
  color: #9ca3af;
  font-size: 12px;
}

.workout-form__fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workout-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;

  label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }

  .required {
    color: #ef4444;
  }
}

.workout-form__row {
  display: flex;
  gap: 12px;
}

.workout-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
