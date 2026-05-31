<template>
  <div class="workout-tab">
    <UiLoading v-if="loading" overlay />

    <template v-if="workouts.length > 0">
      <div class="workout-tab__list">
        <div
          v-for="w in workouts"
          :key="w.id"
          class="workout-tab__card"
          @click="openEdit(w)"
        >
          <div class="workout-tab__card-body">
            <div class="workout-tab__card-info">
              <div class="workout-tab__card-name">{{ w.name }}</div>
              <div class="workout-tab__card-detail">
                <template v-if="w.weight">{{ w.weight }}kg</template>
                <template v-if="w.weight && (w.sets || w.reps)"> · </template>
                <template v-if="w.sets">{{ w.sets }}세트</template>
                <template v-if="w.sets && w.reps"> · </template>
                <template v-if="w.reps">{{ w.reps }}회</template>
                <template v-if="w.duration">{{ w.duration }}분</template>
              </div>
              <div v-if="w.memo" class="workout-tab__card-memo">{{ w.memo }}</div>
            </div>
            <button
              class="workout-tab__delete-btn"
              @click.stop="handleDelete(w)"
              aria-label="삭제"
            >
              <UiIcon name="trash-2" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <UiEmpty v-else icon="dumbbell" message="아직 운동 기록이 없어요">
      <template #action>
        <UiButton size="sm" @click="openAdd">첫 운동 기록하기</UiButton>
      </template>
    </UiEmpty>

    <!-- FAB 추가 버튼 -->
    <button class="workout-tab__fab" @click="openAdd" aria-label="운동 추가">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 입력/수정 Drawer -->
    <WorkoutForm
      v-model:open="formOpen"
      :workout="editTarget"
      :selected-date="selectedDate"
      :recent-workouts="recentWorkouts"
      @saved="emit('saved')"
      @deleted="emit('deleted')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiIcon, UiEmpty, UiLoading, openConfirm, openToast } from '@leechanyong/ispark-ui'
import { useWorkout, type WorkoutEntry } from '../../composables/useWorkout'
import WorkoutForm from './WorkoutForm.vue'

defineProps<{
  workouts: WorkoutEntry[]
  recentWorkouts: WorkoutEntry[]
  loading: boolean
  selectedDate: string
}>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const { deleteWorkout } = useWorkout()

const formOpen = ref(false)
const editTarget = ref<WorkoutEntry | null>(null)

function openAdd() {
  editTarget.value = null
  formOpen.value = true
}

function openEdit(w: WorkoutEntry) {
  editTarget.value = w
  formOpen.value = true
}

async function handleDelete(w: WorkoutEntry) {
  const confirmed = await openConfirm({
    title: '삭제 확인',
    message: `"${w.name}" 기록을 삭제하시겠습니까?`,
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!confirmed) return

  try {
    await deleteWorkout(w.id)
    openToast({ message: '운동 기록이 삭제되었습니다.', type: 'success' })
    emit('deleted')
  } catch (e: any) {
    openToast({ message: e.message || '삭제에 실패했습니다.', type: 'warning' })
  }
}
</script>

<style scoped lang="scss">
.workout-tab {
  position: relative;
  min-height: 200px;
}

.workout-tab__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workout-tab__card {
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #f3f4f6;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: #e0e3e8;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }
}

.workout-tab__card-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workout-tab__card-info {
  flex: 1;
  min-width: 0;
}

.workout-tab__card-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.workout-tab__card-detail {
  font-size: 13px;
  color: #6b7280;
}

.workout-tab__card-memo {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.workout-tab__delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;

  &:hover {
    background: #fef2f2;
    color: #ef4444;
  }
}

.workout-tab__fab {
  position: fixed;
  bottom: 76px;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #4f6af6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.35);
  cursor: pointer;
  z-index: 50;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(79, 106, 246, 0.45);
  }

  &:active {
    transform: scale(0.96);
  }
}

@media (max-width: 768px) {
  .workout-tab__fab {
    bottom: 72px;
    right: 16px;
    width: 48px;
    height: 48px;
  }
}
</style>
