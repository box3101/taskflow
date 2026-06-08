<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiBadge, UiIcon, UiInput } from '@leechanyong/ispark-ui'
import type { Todo } from '../../types/todo'

const MAX_VISIBLE = 5

const props = defineProps<{
  todos: Todo[]
  loading?: boolean
}>()

const emit = defineEmits<{
  add: [title: string]
  navigateAll: []
}>()

const quickTitle = ref('')

const visibleTodos = computed(() => props.todos.slice(0, MAX_VISIBLE))
const remainingCount = computed(() => Math.max(0, props.todos.length - MAX_VISIBLE))

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
  if (diff === 0) return { label: 'D-day', variant: 'danger' }
  if (diff <= 3) return { label: `D-${diff}`, variant: 'warning' }
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
      <p v-if="todos.length === 0" class="todo-quick__empty">
        등록된 할일이 없어요. 아래에서 추가해보세요!
      </p>
      <div
        v-for="todo in visibleTodos"
        :key="todo.id"
        class="todo-quick__item"
      >
        <span class="todo-quick__item-title">
          {{ todo.title }}
        </span>
        <UiBadge
          v-if="getDday(todo.dueDate)"
          :variant="getDday(todo.dueDate)!.variant"
          size="xs"
        >
          {{ getDday(todo.dueDate)!.label }}
        </UiBadge>
      </div>

    </div>
  </div>
</template>

<style scoped lang="scss">
.todo-quick {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f1f3;
  display: flex;
  flex-direction: column;
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
  flex: 1;
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
}

.todo-quick__more {
  display: block;
  width: 100%;
  padding: 10px 0;
  font-size: 13px;
  color: #3c69db;
  background: none;
  border: none;
  cursor: pointer;
  text-align: center;

  &:hover {
    text-decoration: underline;
  }
}

.todo-quick__empty {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 16px 0;
}

.todo-quick__add {
  margin-top: 8px;
}
</style>
