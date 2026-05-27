<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu, UiDrawer,
  UiTab, UiInput, UiButton, UiCheckbox, UiSelect, UiTextarea,
  UiToast, UiConfirm, openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef, TableColumn, TabItem, SelectOption } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'
import StockDashboard from '../components/stock/StockDashboard.vue'

const router = useRouter()
const auth = useAuthStore()

// 탭
const activeTab = ref('projects')
const mainTabs: TabItem[] = [
  { label: '프로젝트', value: 'projects' },
  { label: '개인할일', value: 'todos' },
  { label: '주식', value: 'stock' },
]


// ── 프로젝트 ──
const projectLoading = ref(true)
const projects = ref<any[]>([])
const projectColumns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center' },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center' },
  { key: 'actions', label: '', width: '48px', align: 'center' },
]

// 프로젝트 행 액션 메뉴
const projectActionItems: DropdownMenuItemDef[] = [
  { label: '수정', value: 'edit', icon: 'icon-edit' },
  { label: '삭제', value: 'delete', icon: 'icon-trashcan', color: 'danger' },
]

// 프로젝트 Drawer (추가/수정)
const projectDrawerOpen = ref(false)
const projectDrawerMode = ref<'create' | 'edit'>('create')
const projectForm = ref({ name: '', description: '', status: 'active' })
const projectFormLoading = ref(false)
const editingProjectId = ref<number | null>(null)

const statusSelectOptions: SelectOption[] = [
  { label: '진행중', value: 'active' },
  { label: '보류', value: 'hold' },
  { label: '완료', value: 'done' },
]

function openCreateProject() {
  projectDrawerMode.value = 'create'
  projectForm.value = { name: '', description: '', status: 'active' }
  editingProjectId.value = null
  projectDrawerOpen.value = true
}

function openEditProject(project: any) {
  projectDrawerMode.value = 'edit'
  projectForm.value = {
    name: project.name,
    description: project.description || '',
    status: project.status,
  }
  editingProjectId.value = project.id
  projectDrawerOpen.value = true
}

async function onProjectSave() {
  if (!projectForm.value.name.trim()) return
  projectFormLoading.value = true
  try {
    if (projectDrawerMode.value === 'create') {
      const { data } = await api.post('/projects', projectForm.value)
      projects.value.unshift(data)
      openToast({ message: '프로젝트가 생성되었습니다.', type: 'success' })
    } else {
      const { data } = await api.put(`/projects/${editingProjectId.value}`, projectForm.value)
      const idx = projects.value.findIndex(p => p.id === editingProjectId.value)
      if (idx > -1) Object.assign(projects.value[idx], data)
      openToast({ message: '프로젝트가 수정되었습니다.', type: 'success' })
    }
    projectDrawerOpen.value = false
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  } finally {
    projectFormLoading.value = false
  }
}

async function onDeleteProject(project: any) {
  const confirmed = await openConfirm({
    title: '프로젝트 삭제',
    message: `<strong>${project.name}</strong>을(를) 삭제하시겠습니까?<br>모든 이슈와 멤버가 함께 삭제됩니다.`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/projects/${project.id}`)
    projects.value = projects.value.filter(p => p.id !== project.id)
    openToast({ message: '프로젝트가 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

function onProjectAction(project: any, action: string) {
  if (action === 'edit') openEditProject(project)
  if (action === 'delete') onDeleteProject(project)
}

// ── 개인할일 ──
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

const priorityGroups: Priority[] = ['high', 'mid', 'low', 'none']

const priorityOptions: SelectOption[] = [
  { label: '🔴 높음', value: 'high' },
  { label: '🟡 보통', value: 'mid' },
  { label: '🔵 낮음', value: 'low' },
  { label: '없음', value: 'none' },
]

const todoLoading = ref(false)
const todosLoaded = ref(false)
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
  if (val === 'todos' && !todosLoaded.value) {
    todosLoaded.value = true
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
  if (!title || title === todo.title) { cancelEdit(); return }
  const { data } = await api.patch(`/todos/${todo.id}`, { title })
  const idx = todos.value.findIndex(t => t.id === todo.id)
  if (idx !== -1) todos.value[idx] = data.data
  cancelEdit()
}

function onEditKeydown(e: KeyboardEvent, todo: Todo) {
  if (e.key === 'Enter') saveEdit(todo)
  if (e.key === 'Escape') cancelEdit()
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
  if (value === 'logout') { auth.logout(); router.push('/login') }
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
        <UiButton v-if="activeTab === 'projects'" variant="primary" size="sm" @click="openCreateProject">+ 프로젝트 추가</UiButton>
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
          :columns="projectColumns"
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
          <template #cell-actions="{ row }">
            <div @click.stop>
              <UiDropdownMenu
                :items="projectActionItems"
                @select="(val: string) => onProjectAction(row, val)"
              >
                <template #trigger>
                  <button class="project-action-btn">⋮</button>
                </template>
              </UiDropdownMenu>
            </div>
          </template>
        </UiTable>
      </div>

      <!-- 주식 대시보드 탭 -->
      <div v-if="activeTab === 'stock'" class="tab-content">
        <StockDashboard />
      </div>

      <!-- 개인할일 탭 -->
      <div v-if="activeTab === 'todos'" class="tab-content">
        <!-- 할일 입력 -->
        <div class="todo-input-row">
          <div class="todo-input-priority">
            <UiSelect v-model="newTodoPriority" :options="priorityOptions" size="sm" />
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
              <input
                v-if="editingId === todo.id"
                v-model="editingTitle"
                class="todo-edit-input"
                @blur="saveEdit(todo)"
                @keydown="(e: KeyboardEvent) => onEditKeydown(e, todo)"
                @vue:mounted="($event: any) => $event.el.focus()"
              />
              <span v-else class="todo-title" @click="startEdit(todo)">{{ todo.title }}</span>
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
                <span class="todo-title todo-title--done" @click="toggleTodo(todo)">{{ todo.title }}</span>
                <button class="todo-delete" @click="deleteTodo(todo)">
                  <i class="icon-close size-16" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>

    <!-- 프로젝트 추가/수정 Drawer -->
    <UiDrawer v-model:open="projectDrawerOpen" :title="projectDrawerMode === 'create' ? '프로젝트 추가' : '프로젝트 수정'">
      <form class="drawer-form" @submit.prevent="onProjectSave">
        <UiInput v-model="projectForm.name" label="프로젝트명" placeholder="프로젝트 이름을 입력하세요" />
        <UiTextarea v-model="projectForm.description" label="설명" placeholder="프로젝트 설명 (선택)" :rows="3" />
        <UiSelect v-model="projectForm.status" label="상태" :options="statusSelectOptions" />
      </form>
      <template #footer>
        <div class="drawer-footer">
          <UiButton variant="ghost" size="md" @click="projectDrawerOpen = false">취소</UiButton>
          <UiButton variant="primary" size="md" :loading="projectFormLoading" @click="onProjectSave">
            {{ projectDrawerMode === 'create' ? '추가' : '저장' }}
          </UiButton>
        </div>
      </template>
    </UiDrawer>

    <UiConfirm />
    <UiToast />
  </div>
</template>

<style scoped lang="scss">
.layout { min-height: 100vh; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px; background: #fff; border-bottom: 1px solid #e6e8ec;
}
.header-title { font-size: 18px; font-weight: 700; }
.header-right { display: flex; align-items: center; gap: 12px; }
.user-avatar-btn {
  display: flex; align-items: center; background: none; border: none;
  cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.user-avatar {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: #4f6af6; color: #fff; font-size: 14px; font-weight: 600;
}
.main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
.tab-content { margin-top: 24px; }

// 프로젝트
.project-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.project-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none;
  border-radius: 6px; cursor: pointer; font-size: 18px; color: #9ca3af;
  letter-spacing: 1px;
  &:hover { background: #f3f4f6; color: #374151; }
}
.drawer-form {
  display: flex; flex-direction: column; gap: 16px;
}
.drawer-footer {
  display: flex; justify-content: flex-end; gap: 8px;
}

// 개인할일
.todo-input-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 20px;
}
.todo-input-priority {
  width: 120px;
  flex-shrink: 0;
}
.todo-list { display: flex; flex-direction: column; }

// 중요도 그룹
.todo-group {
  margin-bottom: 8px;
}
.todo-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.todo-group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.todo-group-label {
  font-size: 13px;
}
.todo-group-count {
  font-size: 12px;
  color: #9ca3af;
  background: #e5e7eb;
  padding: 1px 7px;
  border-radius: 10px;
}

.todo-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 8px; border-bottom: 1px solid #f0f1f3;
  transition: background 0.1s;
  &:hover {
    background: #fafbfc;
    .todo-delete { opacity: 1; }
  }
}
.todo-item--done { opacity: 0.6; }
.todo-title {
  flex: 1; font-size: 14px; line-height: 1.5;
  cursor: pointer; word-break: break-word;
}
.todo-title--done { text-decoration: line-through; color: #9ca3af; }
.todo-edit-input {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  padding: 4px 8px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  outline: none;
}
.todo-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.todo-priority-select {
  width: 100px;
}
.todo-delete {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none;
  border-radius: 6px; cursor: pointer; opacity: 0; flex-shrink: 0;
  transition: opacity 0.15s, background 0.15s; color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}
.todo-done-section { margin-top: 16px; }
.todo-done-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 8px; background: none; border: none; cursor: pointer;
  font-size: 13px; color: #6b7280; font-weight: 500;
  &:hover { color: #374151; }
}

</style>
