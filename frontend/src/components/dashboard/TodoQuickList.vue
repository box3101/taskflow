<script setup lang="ts">
import { ref } from 'vue'
import { UiCheckbox, UiBadge, UiIcon, UiInput } from '@leechanyong/ispark-ui'
import type { Todo } from '../../types/todo'

defineProps<{
  todos: Todo[]
  loading?: boolean
}>()

const emit = defineEmits<{
  toggle: [todo: Todo]
  add: [title: string]
  navigateAll: []
}>()

const quickTitle = ref('')

function onQuickAdd() {
  const title = quickTitle.value.trim()
  if (!title) return
  emit('add', title)
  quickTitle.value = ''
}

// D-day 계산
function getDday(dueDate: string | null): { label: string; variant: 'danger' | 'warning' | 'default' } | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, variant: 'danger' }
  if (diff === 0) return { label: 'D-day', variant: 'warning' }
  if (diff === 1) return { label: 'D-1', variant: 'warning' }
  return { label: `D-${diff}`, variant: 'default' }
}
</script>

<template>
  <div class="todo-quick">
    <div class="todo-quick__header">
      <span class="todo-quick__title">오늘 할일</span>
      <button class="todo-quick__link" @click="emit('navigateAll')">
        전체보기
        <UiIcon name="arrow-right" :size="14" />
      </button>
    </div>

    <div class="todo-quick__list">
      <div
        v-for="todo in todos"
        :key="todo.id"
        class="todo-quick__item"
        :class="{ 'todo-quick__item--done': todo.done }"
      >
        <UiCheckbox
          :model-value="todo.done"
          @update:model-value="emit('toggle', todo)"
        />
        <span class="todo-quick__item-title" :class="{ 'todo-quick__item-title--done': todo.done }">
          {{ todo.title }}
        </span>
        <UiBadge
          v-if="!todo.done && getDday(todo.dueDate)"
          :variant="getDday(todo.dueDate)!.variant"
          size="xs"
        >
          {{ getDday(todo.dueDate)!.label }}
        </UiBadge>
      </div>
    </div>

    <!-- 빠른 추가 -->
    <form class="todo-quick__add" @submit.prevent="onQuickAdd">
      <UiInput
        v-model="quickTitle"
        placeholder="할일 빠른 추가..."
        size="sm"
        @keyup.enter="onQuickAdd"
      />
    </form>
  </div>
</template>

<style scoped lang="scss">
.todo-quick {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.todo-quick__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.todo-quick__title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.todo-quick__link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #3c69db;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  margin: -8px -12px;
  border-radius: 6px;

  &:hover {
    background: #f3f4f6;
  }
}

.todo-quick__list {
  display: flex;
  flex-direction: column;
}

.todo-quick__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.todo-quick__item-title {
  flex: 1;
  font-size: 13px;
  color: #1a1a1a;

  &--done {
    text-decoration: line-through;
    color: #b0b0b0;
  }
}

.todo-quick__add {
  margin-top: 8px;
}
</style>
