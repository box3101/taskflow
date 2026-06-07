<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiDrawer, UiButton, UiInput, UiSelect, UiIcon, openToast, openConfirm } from '@leechanyong/ispark-ui'
import { useMeal, type MealEntry } from '../../composables/useMeal'

const props = defineProps<{
  open: boolean
  meal: MealEntry | null
  selectedDate: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const { addMeal, updateMeal, deleteMeal } = useMeal()

const mealTypeOptions = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
  { value: 'midnight', label: '야식' },
]

const type = ref<string>('lunch')
const content = ref('')
const saving = ref(false)

const isEdit = () => !!props.meal

// 폼 초기화
watch(() => props.open, (opened) => {
  if (opened) {
    if (props.meal) {
      type.value = props.meal.type
      content.value = props.meal.content
    } else {
      type.value = 'lunch'
      content.value = ''
    }
  }
})

function close() {
  emit('update:open', false)
}

async function onSave() {
  if (!type.value || !content.value.trim()) {
    openToast({ message: '끼니와 내용을 모두 입력해주세요.', type: 'warning' })
    return
  }

  saving.value = true
  try {
    if (props.meal) {
      await updateMeal(props.meal.id, {
        type: type.value as MealEntry['type'],
        content: content.value.trim(),
      })
      openToast({ message: '식단이 수정되었습니다.', type: 'success' })
    } else {
      await addMeal({
        date: props.selectedDate,
        type: type.value as MealEntry['type'],
        content: content.value.trim(),
      })
      openToast({ message: '식단이 추가되었습니다.', type: 'success' })
    }
    emit('saved')
    close()
  } catch (e: any) {
    openToast({ message: e.message || '저장에 실패했습니다.', type: 'warning' })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!props.meal) return
  const confirmed = await openConfirm({
    title: '식단 삭제',
    message: '이 식단 기록을 삭제할까요?',
    confirmLabel: '삭제',
    cancelLabel: '취소',
  })
  if (!confirmed) return

  saving.value = true
  try {
    await deleteMeal(props.meal.id)
    openToast({ message: '식단이 삭제되었습니다.', type: 'success' })
    emit('deleted')
    close()
  } catch (e: any) {
    openToast({ message: e.message || '삭제에 실패했습니다.', type: 'warning' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="isEdit() ? '식단 수정' : '식단 추가'"
    @update:open="(v: boolean) => { if (!v) close() }"
  >
    <div class="meal-form">
      <div class="meal-form__field">
        <label class="meal-form__label">끼니</label>
        <UiSelect
          v-model="type"
          :options="mealTypeOptions"
          placeholder="끼니 선택"
        />
      </div>

      <div class="meal-form__field">
        <label class="meal-form__label">내용</label>
        <UiInput
          v-model="content"
          placeholder="먹은 음식을 적어주세요"
        />
      </div>
    </div>

    <template #footer>
      <div class="meal-form__footer">
        <div class="meal-form__footer-left">
          <UiButton
            v-if="isEdit()"
            variant="outline"
            size="sm"
            :disabled="saving"
            @click="onDelete"
          >
            <template #icon-left><UiIcon name="trash-2" :size="16" /></template>
            삭제
          </UiButton>
        </div>
        <div class="meal-form__footer-right">
          <UiButton variant="outline" size="sm" :disabled="saving" @click="close">취소</UiButton>
          <UiButton variant="primary" size="sm" :loading="saving" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.meal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.meal-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meal-form__label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.meal-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.meal-form__footer-left {
  display: flex;
  align-items: center;
}

.meal-form__footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
