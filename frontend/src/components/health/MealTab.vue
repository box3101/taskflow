<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiIcon, UiEmpty, openConfirm, openToast } from '@leechanyong/ispark-ui'
import { useMeal, type MealEntry, MEAL_LABELS, MEAL_ICONS } from '../../composables/useMeal'
import MealForm from './MealForm.vue'

const props = defineProps<{
  meals: MealEntry[]
  loading: boolean
  selectedDate: string
}>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const { deleteMeal } = useMeal()

// Drawer 상태
const formOpen = ref(false)
const editingMeal = ref<MealEntry | null>(null)

function openAdd() {
  editingMeal.value = null
  formOpen.value = true
}

function openEdit(meal: MealEntry) {
  editingMeal.value = meal
  formOpen.value = true
}

async function onDeleteItem(meal: MealEntry) {
  const confirmed = await openConfirm({
    title: '식단 삭제',
    message: '이 식단 기록을 삭제할까요?',
    confirmLabel: '삭제',
    cancelLabel: '취소',
  })
  if (!confirmed) return

  try {
    await deleteMeal(meal.id)
    openToast({ message: '식단이 삭제되었습니다.', type: 'success' })
    emit('deleted')
  } catch (e: any) {
    openToast({ message: e.message || '삭제에 실패했습니다.', type: 'warning' })
  }
}

function onFormSaved() {
  emit('saved')
}

function onFormDeleted() {
  emit('deleted')
}
</script>

<template>
  <div class="meal-tab">
    <!-- 식단 목록 -->
    <div v-if="meals.length > 0" class="meal-tab__list">
      <div
        v-for="m in meals"
        :key="m.id"
        class="meal-tab__item"
        @click="openEdit(m)"
      >
        <div class="meal-tab__item-main">
          <span class="meal-tab__item-icon">{{ MEAL_ICONS[m.type] || '' }}</span>
          <span class="meal-tab__item-label">{{ MEAL_LABELS[m.type] || m.type }}</span>
          <span class="meal-tab__item-content">{{ m.content }}</span>
        </div>
        <button
          class="meal-tab__item-delete"
          @click.stop="onDeleteItem(m)"
          aria-label="삭제"
        >
          <UiIcon name="trash-2" :size="16" />
        </button>
      </div>
    </div>

    <!-- 빈 상태 -->
    <div v-else class="meal-tab__empty">
      <UiEmpty icon="utensils" message="오늘 뭐 먹었어요?" />
      <UiButton variant="outline" size="sm" @click="openAdd" style="margin-top: 12px;">
        <template #icon-left><UiIcon name="plus" :size="16" /></template>
        식단 기록하기
      </UiButton>
    </div>

    <!-- 식단 추가 FAB -->
    <div v-if="meals.length > 0" class="meal-tab__fab">
      <UiButton variant="solid" size="sm" @click="openAdd">
        <template #icon-left><UiIcon name="plus" :size="16" /></template>
        식단 추가
      </UiButton>
    </div>

    <!-- 입력/수정 폼 Drawer -->
    <MealForm
      v-model:open="formOpen"
      :meal="editingMeal"
      :selected-date="selectedDate"
      @saved="onFormSaved"
      @deleted="onFormDeleted"
    />
  </div>
</template>

<style scoped lang="scss">
.meal-tab__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meal-tab__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f9fafb;
  }
}

.meal-tab__item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.meal-tab__item-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.meal-tab__item-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  flex-shrink: 0;
}

.meal-tab__item-content {
  font-size: 14px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meal-tab__item-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: #fef2f2;
    color: #ef4444;
  }
}

.meal-tab__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.meal-tab__fab {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
