<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu,
  UiTab, UiInput, UiButton, UiCheckbox, UiSelect,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef, TableColumn, TabItem, SelectOption } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'

const router = useRouter()
const auth = useAuthStore()

// 탭
const activeTab = ref('projects')
const mainTabs: TabItem[] = [
  { label: '프로젝트', value: 'projects' },
  { label: '개인할일', value: 'todos' },
]

// 프로젝트
const projectLoading = ref(true)
const projects = ref<any[]>([])
const columns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center' },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center' },
]

// 개인할일
type Priority = 'high' | 'mid' | 'low' | 'none'
interface Todo {
  id: number
  title: string
  done: boolean
  priority: Priority
  createdAt: string
}

const priorityConfig: Record<Priority, { label: string; dot: string }> = {
  high: { label: '높음', dot: '#ef4444' },
  mid: { label: '보통', dot: '#f59e0b' },
  low: { label: '낮음', dot: '#3b82f6' },
  none: { label: '기타', dot: '#d1d5db' },
}

// 중요도 그룹 순서
const priorityGroups: Priority[] = ['high', 'mid', 'low', 'none']

// UiSelect 옵션
const priorityOptions: SelectOption[] = [
  { label: '🔴 높음', value: 'high' },
  { label: '🟡 보통', value: 'mid' },
  { label: '🔵 낮음', value: 'low' },
  { label: '없음', value: 'none' },
]

const todoLoading = ref(false)
const todos = ref<Todo[]>([])
const newTodoTitle = ref('')
const newTodoPriority = ref<Priority>('none')
const showDone = ref(true)

// 미완료를 중요도별 그룹으로 분리
const groupedTodos = computed(() => {
  const incomplete = todos.value.filter(t => !t.done)
  return priorityGroups
    .map(key => ({
      key,
      label: priorityConfig[key].label,
      dot: priorityConfig[key].dot,
      items: incomplete
        .filter(t => t.priority === key)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }))
    .filter(group => group.items.length > 0)
})

const completedTodos = computed(() => todos.value.filter(t => t.done))

onMounted(async () => {
  try {
    const { data } = await api.get('/projects')
    projects.value = data.data
  } finally {
    projectLoading.value = false
  }
})

async function loadTodos() {
  todoLoading.value = true
  try {
    const { data } = await api.get('/todos')
    todos.value = data.data
  } finally {
    todoLoading.value = false
  }
}

function onTabChange(val: string) {
  if (val === 'todos' && todos.value.length === 0) {
    loadTodos()
  }
}

async function addTodo() {
  const title = newTodoTitle.value.trim()
  if (!title) return
  const { data } = await api.post('/todos', { title, priority: newTodoPriority.value })
  todos.value.push(data.data)
  newTodoTitle.value = ''
  newTodoPriority.value = 'none'
}

async function toggleTodo(todo: Todo) {
  const { data } = await api.patch(`/todos/${todo.id}`, { done: !todo.done })
  const idx = todos.value.findIndex(t => t.id === todo.id)
  if (idx !== -1) todos.value[idx] = data.data
}

async function onPriorityChange(todo: Todo, val: string | number) {
  const priority = val as Priority
  if (priority === todo.priority) return
  const { data } = await api.patch(`/todos/${todo.id}`, { priority })
  const idx = todos.value.findIndex(t => t.id === todo.id)
  if (idx !== -1) todos.value[idx] = data.data
}

// 인라인 수정
const editingId = ref<number | null>(null)
const editingTitle = ref('')

function startEdit(todo: Todo) {
  editingId.value = todo.id
  editingTitle.value = todo.title
}

function cancelEdit() {
  editingId.value = null
  editingTitle.value = ''
}

async function saveEdit(todo: Todo) {
  const title = editingTitle.value.trim()
  if (!title || title === todo.title) {
    cancelEdit()
    return
  }
  const { data } = await api.patch(`/todos/${todo.id}`, { title })
  const idx = todos.value.findIndex(t => t.id === todo.id)
  if (idx !== -1) todos.value[idx] = data.data
  cancelEdit()
}

function onEditKeydown(e: KeyboardEvent, todo: Todo) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit(todo)
  }
  if (e.key === 'Escape') cancelEdit()
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function onEditMounted(e: any) {
  const el = e.el as HTMLTextAreaElement
  el.focus()
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
  el.select()
}

async function deleteTodo(todo: Todo) {
  await api.delete(`/todos/${todo.id}`)
  todos.value = todos.value.filter(t => t.id !== todo.id)
}

function onRowClick(row: any) {
  router.push(`/projects/${row.id}`)
}

const userMenuItems: DropdownMenuItemDef[] = [
  { value: 'logout', label: '로그아웃', icon: 'icon-arrow-right', color: 'danger' },
]

function onUserMenuSelect(value: string) {
  if (value === 'logout') {
    auth.logout()
    router.push('/login')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') addTodo()
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1 class="header-title">TaskFlow</h1>
      <div class="header-right">
        <UiDropdownMenu
          :items="userMenuItems"
          :title="auth.user?.name"
          align="end"
          @select="onUserMenuSelect"
        >
          <template #trigger>
            <button class="user-avatar-btn">
              <span class="user-avatar">{{ auth.user?.name?.charAt(0) }}</span>
            </button>
          </template>
        </UiDropdownMenu>
      </div>
    </header>

    <main class="main">
      <UiTab
        v-model="activeTab"
        :tabs="mainTabs"
        alignment="left"
        @update:model-value="onTabChange"
      />

      <!-- 프로젝트 탭 -->
      <div v-if="activeTab === 'projects'" class="tab-content">
        <UiLoading v-if="projectLoading" />
        <UiEmpty v-else-if="projects.length === 0" title="프로젝트가 없습니다." />
        <UiTable
          v-else
          :columns="columns"
          :data="projects"
          clickable
          @row-click="onRowClick"
        >
          <template #cell-status="{ row }">
            <UiBadge
              :variant="row.status === 'active' ? 'success' : row.status === 'done' ? 'primary' : 'default'"
              size="sm"
            >{{ row.status === 'active' ? '진행중' : row.status === 'done' ? '완료' : '보류' }}</UiBadge>
          </template>
          <template #cell-_count.members="{ row }">
            {{ row._count?.members ?? 0 }}명
          </template>
          <template #cell-_count.issues="{ row }">
            {{ row._count?.issues ?? 0 }}건
          </template>
        </UiTable>
      </div>

      <!-- 개인할일 탭 -->
      <div v-if="activeTab === 'todos'" class="tab-content">
        <!-- 할일 입력 -->
        <div class="todo-input-row">
          <div class="todo-input-priority">
            <UiSelect
              v-model="newTodoPriority"
              :options="priorityOptions"
              size="sm"
            />
          </div>
          <UiInput
            v-model="newTodoTitle"
            placeholder="할일을 입력하세요..."
            @keydown="handleKeydown"
          />
          <UiButton @click="addTodo" :disabled="!newTodoTitle.trim()">추가</UiButton>
        </div>

        <UiLoading v-if="todoLoading" />
        <UiEmpty v-else-if="todos.length === 0" title="할일이 없습니다." description="위에서 추가해보세요." />
        <div v-else class="todo-list">
          <!-- 중요도별 그룹 -->
          <div
            v-for="group in groupedTodos"
            :key="group.key"
            class="todo-group"
          >
            <div class="todo-group-header">
              <span class="todo-group-dot" :style="{ background: group.dot }" />
              <span class="todo-group-label">{{ group.label }}</span>
              <span class="todo-group-count">{{ group.items.length }}</span>
            </div>

            <div
              v-for="todo in group.items"
              :key="todo.id"
              class="todo-item"
            >
              <UiCheckbox
                :model-value="todo.done"
                @update:model-value="toggleTodo(todo)"
              />
              <div class="todo-content">
                <div class="todo-title-row">
                  <textarea
                    v-if="editingId === todo.id"
                    v-model="editingTitle"
                    class="todo-edit-input"
                    rows="1"
                    @blur="saveEdit(todo)"
                    @keydown="(e: KeyboardEvent) => onEditKeydown(e, todo)"
                    @input="autoResize"
                    @vue:mounted="onEditMounted"
                  />
                  <span v-else class="todo-title" @click="startEdit(todo)">{{ todo.title }}<i class="icon-edit size-12 todo-edit-icon" /></span>
                </div>
                <div class="todo-actions">
                  <div class="todo-priority-select">
                    <UiSelect
                      :model-value="todo.priority"
                      :options="priorityOptions"
                      size="sm"
                      @change="(val: string | number) => onPriorityChange(todo, val)"
                    />
                  </div>
                  <button class="todo-delete" @click="deleteTodo(todo)">
                    <i class="icon-close size-16" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 완료 섹션 -->
          <div v-if="completedTodos.length > 0" class="todo-done-section">
            <button class="todo-done-toggle" @click="showDone = !showDone">
              {{ showDone ? '▾' : '▸' }} 완료 ({{ completedTodos.length }})
            </button>
            <template v-if="showDone">
              <div
                v-for="todo in completedTodos"
                :key="todo.id"
                class="todo-item todo-item--done"
              >
                <UiCheckbox
                  :model-value="todo.done"
                  @update:model-value="toggleTodo(todo)"
                />
                <span class="todo-title todo-title--done">{{ todo.title }}</span>
                <button class="todo-delete" @click="deleteTodo(todo)">
                  <i class="icon-close size-16" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout {
  min-height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e6e8ec;
}
.header-title {
  font-size: 18px;
  font-weight: 700;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-avatar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.15s;
  &:hover {
    background: #f3f4f6;
  }
}
.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f6af6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.main {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}
.tab-content {
  margin-top: 24px;
}

// 할일 입력
.todo-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}
.todo-input-priority {
  width: 120px;
  flex-shrink: 0;
}

// 그룹
.todo-group {
  margin-bottom: 20px;
}
.todo-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 2px;
  border-bottom: 1px solid #e5e7eb;
}
.todo-group-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.todo-group-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.todo-group-count {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

// 할일 아이템
.todo-list {
  display: flex;
  flex-direction: column;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px 10px 20px;
  border-bottom: 1px solid #f0f1f3;
  transition: background 0.1s;
  &:hover {
    background: #fafbfc;
    .todo-delete {
      opacity: 1;
    }
    .todo-priority-select {
      opacity: 1;
    }
  }
}
.todo-item--done {
  opacity: 0.6;
}
.todo-title {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  cursor: text;
}
.todo-edit-icon {
  display: inline-block;
  margin-left: 4px;
  vertical-align: middle;
  color: #9ca3af;
  opacity: 0;
  transition: opacity 0.15s;
  .todo-item:hover & {
    opacity: 1;
  }
}
.todo-edit-input {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  padding: 2px 6px;
  border: 1px solid #4f6af6;
  border-radius: 4px;
  outline: none;
  background: #fff;
}
.todo-title--done {
  text-decoration: line-through;
  color: #9ca3af;
}
.todo-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.todo-priority-select {
  width: 100px;
  opacity: 0;
  transition: opacity 0.15s;
}
.todo-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  color: #9ca3af;
  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

// 완료 섹션
.todo-done-section {
  margin-top: 16px;
}
.todo-done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  &:hover {
    color: #374151;
  }
}
</style>
