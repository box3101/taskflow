<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu,
  UiTab, UiInput, UiButton, UiCheckbox,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef, TableColumn, TabItem } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'

const router = useRouter()
const auth = useAuthStore()

// 탭
const activeTab = ref('projects')
const tabs: TabItem[] = [
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
interface Todo {
  id: number
  title: string
  done: boolean
  createdAt: string
}
const todoLoading = ref(false)
const todos = ref<Todo[]>([])
const newTodoTitle = ref('')
const showDone = ref(true)

// 미완료 / 완료 분리
const incompleteTodos = () => todos.value.filter(t => !t.done)
const completedTodos = () => todos.value.filter(t => t.done)

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

// 탭 전환 시 할일 로드
function onTabChange(val: string) {
  if (val === 'todos' && todos.value.length === 0) {
    loadTodos()
  }
}

async function addTodo() {
  const title = newTodoTitle.value.trim()
  if (!title) return
  const { data } = await api.post('/todos', { title })
  todos.value.unshift(data.data)
  // 미완료 목록에 추가 후 정렬 (createdAt asc)
  todos.value.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  newTodoTitle.value = ''
}

async function toggleTodo(todo: Todo) {
  const { data } = await api.patch(`/todos/${todo.id}`, { done: !todo.done })
  const idx = todos.value.findIndex(t => t.id === todo.id)
  if (idx !== -1) todos.value[idx] = data.data
  // 재정렬
  todos.value.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
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
        :tabs="tabs"
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
        <div class="todo-input-row">
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
          <!-- 미완료 -->
          <div
            v-for="todo in incompleteTodos()"
            :key="todo.id"
            class="todo-item"
          >
            <UiCheckbox
              :model-value="todo.done"
              @update:model-value="toggleTodo(todo)"
            />
            <span class="todo-title">{{ todo.title }}</span>
            <button class="todo-delete" @click="deleteTodo(todo)">
              <i class="icon-close size-16" />
            </button>
          </div>

          <!-- 완료 섹션 -->
          <div v-if="completedTodos().length > 0" class="todo-done-section">
            <button class="todo-done-toggle" @click="showDone = !showDone">
              {{ showDone ? '▾' : '▸' }} 완료 ({{ completedTodos().length }})
            </button>
            <template v-if="showDone">
              <div
                v-for="todo in completedTodos()"
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

// 개인할일
.todo-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.todo-list {
  display: flex;
  flex-direction: column;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-bottom: 1px solid #f0f1f3;
  transition: background 0.1s;
  &:hover {
    background: #fafbfc;
    .todo-delete {
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
}
.todo-title--done {
  text-decoration: line-through;
  color: #9ca3af;
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
