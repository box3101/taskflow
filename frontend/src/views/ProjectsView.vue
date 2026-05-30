<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu, UiDrawer,
  UiIcon, UiTab, UiInput, UiButton, UiCheckbox, UiSelect, UiTextarea, UiToggle,
  UiToast, UiConfirm, openToast, openConfirm, UiDatePicker,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef, TableColumn, TabItem, SelectOption } from '@leechanyong/ispark-ui'
import type { DateValue } from '@internationalized/date'
import type { Todo, TodoFile } from '../types/todo'
import { CalendarDate } from '@internationalized/date'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'
import StockDashboard from '../components/stock/StockDashboard.vue'
import AiToolsTab from '../components/ai-tools/AiToolsTab.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// 탭 & 메뉴 (PC: UiTab, 모바일: 사이드 메뉴)
const activeTab = ref((route.query.tab as string) || 'ai-tools')
const menuOpen = ref(false)
const mainTabs: TabItem[] = [
  { label: 'AI Tools', value: 'ai-tools' },
  { label: '캘린더', value: 'calendar' },
  { label: '프로젝트', value: 'projects' },
  { label: '개인할일', value: 'todos' },
  { label: '주식', value: 'stock' },
]
const menuItems = [
  { label: 'AI Tools', value: 'ai-tools', icon: 'bot' },
  { label: '캘린더', value: 'calendar', icon: 'calendar' },
  { label: '프로젝트', value: 'projects', icon: 'folder' },
  { label: '개인할일', value: 'todos', icon: 'check-square' },
  { label: '주식', value: 'stock', icon: 'trending-up' },
]

function onMenuSelect(value: string) {
  activeTab.value = value
  menuOpen.value = false
  onTabChange(value)
}


// ── 프로젝트 ──
const projectLoading = ref(true)
const projects = ref<any[]>([])
const projectColumns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center', hideBelow: 640 },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center', hideBelow: 640 },
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

// 마감일 표시 포맷 (6/15(일))
const dayNames = ['일', '월', '화', '수', '목', '금', '토']
function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`
}

// ISO string ↔ CalendarDate 변환
function toCalendarDate(iso: string | null): DateValue | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function fromCalendarDate(val: DateValue | undefined): string | null {
  if (!val) return null
  return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`
}

const todoLoading = ref(false)
const todosLoaded = ref(false)
const todos = ref<Todo[]>([])
const trashTodos = ref<Todo[]>([])
const trashLoaded = ref(false)

// 필터/정렬
const todoFilter = ref('all')
const todoSort = ref('dueDate')

const filterOptions: SelectOption[] = [
  { label: '전체', value: 'all' },
  { label: '오늘', value: 'today' },
  { label: '이번주', value: 'week' },
  { label: '이번달', value: 'month' },
  { label: '지남', value: 'overdue' },
  { label: '기한없음', value: 'none' },
]

const sortOptions: SelectOption[] = [
  { label: '마감일순', value: 'dueDate' },
  { label: '생성일순', value: 'createdAt' },
]

// 서브탭
const todoSubTab = ref('todo')
const todoSubTabs = computed<TabItem[]>(() => [
  { label: '할일', value: 'todo', count: incompleteTodos.value.length || undefined },
  { label: '완료', value: 'done', count: completedTodos.value.length || undefined },
  { label: '휴지통', value: 'trash', count: trashTodos.value.length || undefined },
])

// Drawer (추가/수정 공용)
const todoDrawerOpen = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const drawerTodo = ref<Todo | null>(null)
const drawerTitle = ref('')
const drawerDueDate = ref<DateValue | undefined>(undefined)
const drawerMemo = ref('')
const drawerDone = ref(false)
const drawerFiles = ref<TodoFile[]>([])
const fileUploading = ref(false)

// 미완료 (필터 + 정렬)
const incompleteTodos = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // 이번주 월~일 계산
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // 월요일
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // 일요일

  let filtered = todos.value.filter(t => !t.done)

  // 필터 적용
  if (todoFilter.value !== 'all') {
    filtered = filtered.filter(t => {
      if (todoFilter.value === 'none') return !t.dueDate
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      due.setHours(0, 0, 0, 0)
      switch (todoFilter.value) {
        case 'today': return due.getTime() === now.getTime()
        case 'week': return due >= weekStart && due <= weekEnd
        case 'month': return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth()
        case 'overdue': return due.getTime() < now.getTime()
        default: return true
      }
    })
  }

  // 정렬 적용
  return filtered.sort((a, b) => {
    switch (todoSort.value) {
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'dueDate':
      default:
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
  })
})

const completedTodos = computed(() => todos.value.filter(t => t.done))

onMounted(async () => {
  try {
    const { data } = await api.get('/projects')
    projects.value = data.data
  } finally {
    projectLoading.value = false
  }
  // URL에서 직접 todos 탭으로 진입한 경우
  if (activeTab.value === 'todos' && !todosLoaded.value) {
    todosLoaded.value = true
    loadTodos()
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
  if (val === 'calendar') {
    router.push('/calendar')
    return
  }
  if (val === 'todos' && !todosLoaded.value) {
    todosLoaded.value = true
    loadTodos()
  }
}

function openCreateTodoDrawer() {
  drawerMode.value = 'create'
  drawerTodo.value = null
  drawerTitle.value = ''
  drawerDueDate.value = undefined
  drawerMemo.value = ''
  todoDrawerOpen.value = true
}

async function toggleTodo(todo: Todo) {
  try {
    const { data } = await api.patch(`/todos/${todo.id}`, { done: !todo.done })
    const idx = todos.value.findIndex(t => t.id === todo.id)
    if (idx !== -1) todos.value[idx] = data.data
  } catch {
    openToast({ message: '상태 변경에 실패했습니다.', type: 'error' })
  }
}

// Drawer 열기/저장
function openTodoDrawer(todo: Todo) {
  drawerMode.value = 'edit'
  drawerTodo.value = todo
  drawerTitle.value = todo.title
  drawerDueDate.value = toCalendarDate(todo.dueDate)
  drawerMemo.value = todo.memo ?? ''
  drawerDone.value = todo.done
  drawerFiles.value = todo.files ? [...todo.files] : []
  todoDrawerOpen.value = true
}

async function saveTodoDrawer() {
  const title = drawerTitle.value.trim()
  if (!title) return

  const dueDate = fromCalendarDate(drawerDueDate.value)
  const memo = drawerMemo.value.trim() || null

  if (drawerMode.value === 'create') {
    // 추가 모드
    try {
      const { data } = await api.post('/todos', { title, dueDate, memo })
      todos.value.push(data.data)
      todoDrawerOpen.value = false
      openToast({ message: '할일이 추가되었습니다.', type: 'success' })
    } catch {
      openToast({ message: '할일 추가에 실패했습니다.', type: 'error' })
    }
  } else {
    // 수정 모드
    const todo = drawerTodo.value!
    const patch: Record<string, unknown> = {}
    if (title !== todo.title) patch.title = title
    if (dueDate !== todo.dueDate) patch.dueDate = dueDate
    if (memo !== (todo.memo ?? null)) patch.memo = memo

    if (Object.keys(patch).length === 0) {
      todoDrawerOpen.value = false
      return
    }

    try {
      const { data } = await api.patch(`/todos/${todo.id}`, patch)
      const idx = todos.value.findIndex(t => t.id === todo.id)
      if (idx !== -1) todos.value[idx] = data.data
      todoDrawerOpen.value = false
      openToast({ message: '할일이 수정되었습니다.', type: 'success' })
    } catch {
      openToast({ message: '수정에 실패했습니다.', type: 'error' })
    }
  }
}

async function onDrawerToggleDone(val: boolean) {
  if (!drawerTodo.value) return
  drawerDone.value = val
  try {
    const { data } = await api.patch(`/todos/${drawerTodo.value.id}`, { done: val })
    const idx = todos.value.findIndex(t => t.id === drawerTodo.value!.id)
    if (idx !== -1) todos.value[idx] = data.data
    drawerTodo.value = data.data
    todoDrawerOpen.value = false
    openToast({ message: val ? '완료 처리되었습니다.' : '할일로 복원되었습니다.', type: 'success' })
  } catch {
    drawerDone.value = !val
    openToast({ message: '상태 변경에 실패했습니다.', type: 'error' })
  }
}

async function onDrawerDelete() {
  if (!drawerTodo.value) return
  try {
    const { data } = await api.delete(`/todos/${drawerTodo.value.id}`)
    todos.value = todos.value.filter(t => t.id !== drawerTodo.value!.id)
    trashTodos.value.unshift(data.data)
    todoDrawerOpen.value = false
    openToast({ message: '휴지통으로 이동했습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

async function onFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !drawerTodo.value) return

  fileUploading.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const { data } = await api.post(`/todos/${drawerTodo.value.id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    drawerFiles.value.push(data.data)
    // todos 배열에도 반영
    const idx = todos.value.findIndex(t => t.id === drawerTodo.value!.id)
    if (idx !== -1) {
      if (!todos.value[idx].files) todos.value[idx].files = []
      todos.value[idx].files!.push(data.data)
    }
    openToast({ message: '파일이 업로드되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '파일 업로드에 실패했습니다.', type: 'error' })
  } finally {
    fileUploading.value = false
    input.value = ''
  }
}

async function deleteFile(file: TodoFile) {
  if (!drawerTodo.value) return
  try {
    await api.delete(`/todos/${drawerTodo.value.id}/files/${file.id}`)
    drawerFiles.value = drawerFiles.value.filter(f => f.id !== file.id)
    const idx = todos.value.findIndex(t => t.id === drawerTodo.value!.id)
    if (idx !== -1) {
      todos.value[idx].files = todos.value[idx].files?.filter(f => f.id !== file.id)
    }
    openToast({ message: '파일이 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '파일 삭제에 실패했습니다.', type: 'error' })
  }
}

function getFileUrl(filePath: string) {
  return `http://localhost:4000/uploads/${filePath}`
}

function isImage(mimetype: string) {
  return mimetype.startsWith('image/')
}

function onTodoSubTabChange(val: string) {
  if (val === 'trash' && !trashLoaded.value) {
    loadTrash()
  }
}

async function deleteTodo(todo: Todo) {
  try {
    const { data } = await api.delete(`/todos/${todo.id}`)
    todos.value = todos.value.filter(t => t.id !== todo.id)
    trashTodos.value.unshift(data.data)
    openToast({ message: '휴지통으로 이동했습니다.', type: 'success' })
  } catch {
    openToast({ message: '할일 삭제에 실패했습니다.', type: 'error' })
  }
}

async function loadTrash() {
  try {
    const { data } = await api.get('/todos/trash')
    trashTodos.value = data.data
    trashLoaded.value = true
  } catch {
    openToast({ message: '휴지통 조회에 실패했습니다.', type: 'error' })
  }
}

async function restoreTodo(todo: Todo) {
  try {
    const { data } = await api.patch(`/todos/${todo.id}/restore`)
    trashTodos.value = trashTodos.value.filter(t => t.id !== todo.id)
    todos.value.push(data.data)
    openToast({ message: '할일이 복원되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '복원에 실패했습니다.', type: 'error' })
  }
}

async function permanentDeleteTodo(todo: Todo) {
  const confirmed = await openConfirm({
    title: '영구 삭제',
    message: `<strong>${todo.title}</strong>을(를) 영구 삭제하시겠습니까?<br>이 작업은 되돌릴 수 없습니다.`,
    confirmText: '영구 삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/todos/${todo.id}/permanent`)
    trashTodos.value = trashTodos.value.filter(t => t.id !== todo.id)
    openToast({ message: '영구 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

async function emptyTrash() {
  const confirmed = await openConfirm({
    title: '휴지통 비우기',
    message: `휴지통의 모든 할일(${trashTodos.value.length}건)을 영구 삭제하시겠습니까?<br>이 작업은 되돌릴 수 없습니다.`,
    confirmText: '전체 삭제',
  })
  if (!confirmed) return
  try {
    await api.delete('/todos/trash/empty')
    trashTodos.value = []
    openToast({ message: '휴지통을 비웠습니다.', type: 'success' })
  } catch {
    openToast({ message: '휴지통 비우기에 실패했습니다.', type: 'error' })
  }
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

</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <!-- 모바일: 메뉴 토글 버튼 -->
        <button class="menu-toggle-btn" @click="menuOpen = !menuOpen">
          <UiIcon :name="menuOpen ? 'x' : 'menu'" :size="20" />
        </button>
        <img src="/logo.svg" alt="CYLEE" class="header-logo" @click="router.push('/')" style="cursor: pointer;" />
      </div>
      <div class="header-right">
        <UiButton class="storybook-link" as="a" href="https://box3101.github.io/ispark-ui/" target="_blank" size="sm" variant="outline">📖 Storybook</UiButton>
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

    <!-- 모바일: 사이드 메뉴 오버레이 -->
    <Transition name="overlay-fade">
      <div v-if="menuOpen" class="menu-overlay" @click="menuOpen = false" />
    </Transition>

    <!-- 모바일: 사이드 메뉴 패널 -->
    <Transition name="slide-left">
      <nav v-if="menuOpen" class="side-menu">
        <button
          v-for="item in menuItems"
          :key="item.value"
          class="side-menu__item"
          :class="{ 'side-menu__item--active': activeTab === item.value }"
          @click="onMenuSelect(item.value)"
        >
          <UiIcon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </Transition>

    <main class="main">
      <!-- 프로젝트 탭 -->
      <div v-if="activeTab === 'projects'" class="tab-content">
        <UiLoading v-if="projectLoading" overlay />
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

      <!-- AI Tools 탭 -->
      <div v-if="activeTab === 'ai-tools'" class="tab-content">
        <AiToolsTab />
      </div>

      <!-- 주식 대시보드 탭 -->
      <div v-if="activeTab === 'stock'" class="tab-content">
        <StockDashboard />
      </div>


      <!-- 개인할일 탭 -->
      <div v-if="activeTab === 'todos'" class="tab-content">
        <!-- 서브탭 -->
        <UiTab
          v-model="todoSubTab"
          :tabs="todoSubTabs"
          size="sm"
          alignment="center"
          @update:model-value="onTodoSubTabChange"
        />

        <!-- 필터/정렬 + 추가 버튼 -->
        <div v-if="todoSubTab === 'todo'" class="todo-toolbar">
          <div class="todo-toolbar__filters">
            <UiSelect v-model="todoFilter" :options="filterOptions" size="sm" />
            <UiSelect v-model="todoSort" :options="sortOptions" size="sm" />
          </div>
        </div>

        <UiLoading v-if="todoLoading" overlay />

        <!-- 할일 서브탭: 할일 -->
        <template v-if="todoSubTab === 'todo'">
          <UiEmpty v-if="!todoLoading && incompleteTodos.length === 0" title="할일이 비어있어요" description="+ 할일 버튼으로 새 할일을 추가해보세요." />
          <div v-else class="todo-cards">
            <div
              v-for="todo in incompleteTodos"
              :key="todo.id"
              class="todo-card"
              :class="{
                'todo-card--danger': getDday(todo.dueDate)?.variant === 'danger',
                'todo-card--warning': getDday(todo.dueDate)?.variant === 'warning',
              }"
              @click="openTodoDrawer(todo)"
            >
              <div class="todo-card__title">{{ todo.title }}</div>
              <div class="todo-card__footer">
                <div class="todo-card__tags">
                  <UiBadge v-if="getDday(todo.dueDate)" :variant="getDday(todo.dueDate)!.variant" size="xs">{{ getDday(todo.dueDate)!.label }}</UiBadge>
                  <UiBadge v-if="todo.memo" variant="info" size="xs">메모</UiBadge>
                  <UiBadge v-if="todo.files && todo.files.length > 0" variant="default" size="xs">파일 {{ todo.files.length }}</UiBadge>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 할일 서브탭: 완료 -->
        <template v-if="todoSubTab === 'done'">
          <UiEmpty v-if="completedTodos.length === 0" title="완료된 할일이 없습니다." />
          <div v-else class="todo-done-list">
            <div
              v-for="todo in completedTodos"
              :key="todo.id"
              class="todo-done-item"
            >
              <UiCheckbox
                :model-value="todo.done"
                @update:model-value="toggleTodo(todo)"
              />
              <span class="todo-done-item__title">{{ todo.title }}</span>
              <button class="todo-done-item__delete" @click="deleteTodo(todo)">
                <i class="icon-close size-16" />
              </button>
            </div>
          </div>
        </template>

        <!-- 할일 서브탭: 휴지통 -->
        <template v-if="todoSubTab === 'trash'">
          <div v-if="trashTodos.length > 0" class="todo-trash-header">
            <UiButton size="sm" variant="ghost" @click="emptyTrash">비우기</UiButton>
          </div>
          <UiEmpty v-if="trashTodos.length === 0" title="휴지통이 비어있습니다." />
          <div v-else class="todo-trash-list">
            <div
              v-for="todo in trashTodos"
              :key="todo.id"
              class="todo-trash-item"
            >
              <span class="todo-trash-item__title">{{ todo.title }}</span>
              <span class="todo-trash-item__date">{{ new Date(todo.deletedAt!).toLocaleDateString('ko-KR') }}</span>
              <button class="todo-trash-item__restore" @click="restoreTodo(todo)" title="복원">↩</button>
              <button class="todo-trash-item__delete" @click="permanentDeleteTodo(todo)" title="영구 삭제">
                <i class="icon-close size-16" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </main>

    <!-- 할일 상세 Drawer -->
    <UiDrawer v-model:open="todoDrawerOpen" :title="drawerMode === 'create' ? '할일 추가' : '할일 상세'" max-width="100vw">
      <form class="drawer-form" @submit.prevent="saveTodoDrawer">
        <UiInput v-model="drawerTitle" label="제목" placeholder="할일 제목" />
        <div class="drawer-field">
          <label class="drawer-field__label">마감일</label>
          <UiDatePicker
            v-model="drawerDueDate"
            type="date"
            size="sm"
          />
        </div>
        <UiTextarea v-model="drawerMemo" label="메모" placeholder="메모를 입력하세요..." :rows="5" />

        <!-- 파일 첨부 -->
        <div class="drawer-field">
          <label class="drawer-field__label">첨부파일</label>
          <div class="drawer-files">
            <div v-for="file in drawerFiles" :key="file.id" :class="isImage(file.mimetype) ? 'drawer-file drawer-file--image' : 'drawer-file'">
              <template v-if="isImage(file.mimetype)">
                <a :href="getFileUrl(file.path)" target="_blank" class="drawer-file__preview">
                  <img :src="getFileUrl(file.path)" class="drawer-file__img" />
                </a>
                <div class="drawer-file__info">
                  <span class="drawer-file__name">{{ file.filename }}</span>
                  <button class="drawer-file__delete" @click="deleteFile(file)" type="button">
                    <i class="icon-close size-12" />
                  </button>
                </div>
              </template>
              <template v-else>
                <span class="drawer-file__icon">📎</span>
                <a :href="getFileUrl(file.path)" target="_blank" class="drawer-file__name">{{ file.filename }}</a>
                <button class="drawer-file__delete" @click="deleteFile(file)" type="button">
                  <i class="icon-close size-12" />
                </button>
              </template>
            </div>
            <template v-if="drawerMode === 'edit'">
              <label class="drawer-file-add" :class="{ 'drawer-file-add--disabled': fileUploading }">
                <input type="file" hidden @change="onFileUpload" :disabled="fileUploading" />
                {{ fileUploading ? '업로드 중...' : '+ 파일 추가' }}
              </label>
            </template>
            <span v-else class="drawer-file-hint">할일 추가 후 파일을 첨부할 수 있습니다.</span>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="todo-drawer-footer">
          <div class="todo-drawer-footer__left">
            <UiButton v-if="drawerMode === 'edit'" variant="danger" size="sm" @click="onDrawerDelete">삭제</UiButton>
          </div>
          <div class="todo-drawer-footer__center" v-if="drawerMode === 'edit'">
            <span class="todo-drawer-footer__done-label" :class="{ 'todo-drawer-footer__done-label--active': drawerDone }">
              {{ drawerDone ? '완료됨' : '미완료' }}
            </span>
            <UiToggle :model-value="drawerDone" @update:model-value="onDrawerToggleDone" />
          </div>
          <div class="todo-drawer-footer__right">
            <UiButton variant="ghost" size="sm" @click="todoDrawerOpen = false">취소</UiButton>
            <UiButton variant="primary" size="sm" @click="saveTodoDrawer">{{ drawerMode === 'create' ? '추가' : '저장' }}</UiButton>
          </div>
        </div>
      </template>
    </UiDrawer>

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

    <!-- FAB: 추가 버튼 (주식/AI Tools 탭에서는 숨김) -->
    <button
      v-if="activeTab === 'projects' || activeTab === 'todos'"
      class="fab"
      :aria-label="activeTab === 'projects' ? '프로젝트 추가' : '할일 추가'"
      @click="activeTab === 'projects' ? openCreateProject() : openCreateTodoDrawer()"
    >
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <button
        class="bottom-nav__item"
        @click="router.push('/')"
      >
        <UiIcon name="home" :size="18" />
        <span>홈</span>
      </button>
      <button
        v-for="item in menuItems"
        :key="item.value"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': activeTab === item.value }"
        @click="onMenuSelect(item.value)"
      >
        <UiIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <UiConfirm />
    <UiToast />
  </div>
</template>

<style scoped lang="scss">
.layout { min-height: 100vh; padding-top: 56px; padding-bottom: 56px; background: #f8f9fb; }

// 헤더 (fixed)
.header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 101;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px; background: #fff; border-bottom: 1px solid #e6e8ec;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-logo { height: 24px; }
.header-right { display: flex; align-items: center; gap: 12px; }

// 메뉴 토글 버튼
.menu-toggle-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; background: none;
  border-radius: 8px; cursor: pointer; color: #374151;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}

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

// 사이드 메뉴 오버레이
.menu-overlay {
  position: fixed; inset: 0; z-index: 99;
  background: rgba(0, 0, 0, 0.3);
}

// 사이드 메뉴 패널
.side-menu {
  position: fixed; top: 56px; left: 0; bottom: 0;
  width: 260px; z-index: 100;
  background: #fff; border-right: 1px solid #e6e8ec;
  padding: 12px 8px;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}

.side-menu__item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 14px;
  border: none; background: none; border-radius: 8px;
  font-size: 14px; color: #374151; cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover { background: #f3f4f6; }

  &--active {
    background: #eef2ff; color: #4f6af6; font-weight: 600;
  }
}

// 하단 네비게이션 바
.fab {
  position: fixed; bottom: 76px; right: 24px; z-index: 50;
  width: 52px; height: 52px; border-radius: 50%;
  background: #4f6af6; color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.4);
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(79, 106, 246, 0.5); }
  &:active { transform: scale(0.95); }
}
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 101;
  height: 56px; background: #fff; border-top: 1px solid #e6e8ec;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 0 16px;
}

.bottom-nav__item {
  display: flex; align-items: center; gap: 6px;
  border: none; background: none; padding: 8px 16px;
  border-radius: 8px; font-size: 13px; color: #9ca3af;
  cursor: pointer; transition: background 0.15s, color 0.15s;

  &:hover { background: #f3f4f6; color: #374151; }

  &--active {
    background: #eef2ff; color: #4f6af6; font-weight: 600;
  }
}

// 슬라이드 애니메이션
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

// 오버레이 페이드
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
.tab-content { margin-top: 8px; }

// 모바일
@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .header-right { gap: 8px; }
  .storybook-link { display: none !important; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item {
    flex-direction: column; gap: 2px;
    padding: 6px 12px; font-size: 10px;
  }
  .main { padding: 16px 12px; }
  .fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}

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
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.drawer-footer__right {
  display: flex; gap: 8px;
  margin-left: auto;
}

// Todo Drawer footer
.todo-drawer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-drawer-footer__left {
  flex-shrink: 0;
}

.todo-drawer-footer__center {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
}

.todo-drawer-footer__done-label {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 500;

  &--active {
    color: #22c55e;
  }
}

.todo-drawer-footer__right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

// 개인할일
.todo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 16px;
}

.todo-toolbar__filters {
  display: flex;
  gap: 8px;

  :deep(.ui-select-trigger) {
    min-width: 110px;
    min-height: 36px;
  }
}

// 카드 그리드
.todo-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.todo-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 20px;
  min-height: 100px;
  background: var(--card-bg, #fff);
  border: none;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.25s ease-out, transform 0.2s ease-out;

  &:focus-visible {
    outline: 2px solid #4f6af6;
    outline-offset: 2px;
  }

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  &--warning {
    --card-bg: #fffdf5;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.12), 0 0 0 1px rgba(251, 191, 36, 0.2);
    &:hover { box-shadow: 0 8px 24px rgba(251, 191, 36, 0.15), 0 0 0 1px rgba(251, 191, 36, 0.3); }
  }

  &--danger {
    --card-bg: #fffafa;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1), 0 0 0 1px rgba(239, 68, 68, 0.15);
    &:hover { box-shadow: 0 8px 24px rgba(239, 68, 68, 0.14), 0 0 0 1px rgba(239, 68, 68, 0.25); }
  }
}

.todo-card__title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  color: #111827;
  letter-spacing: -0.01em;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.todo-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.todo-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.todo-card__date {
  font-size: 12px;
  color: #b0b5bf;
  flex-shrink: 0;
  letter-spacing: 0.01em;

  &--warning {
    color: #d97706;
    font-weight: 600;
  }

  &--danger {
    color: #dc2626;
    font-weight: 600;
  }
}

// 완료 리스트
.todo-done-list {
  margin-top: 8px;
}

.todo-done-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-bottom: 1px solid #f0f1f3;

  &:hover {
    background: #fafbfc;
  }
}

.todo-done-item__title {
  flex: 1;
  font-size: 14px;
  text-decoration: line-through;
  color: #9ca3af;
}

.todo-done-item__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

.todo-done-item:hover .todo-done-item__delete {
  opacity: 1;
}

// 휴지통
.todo-trash-header {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  margin-bottom: 4px;
}

.todo-trash-list {
  margin-top: 8px;
}

.todo-trash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-bottom: 1px solid #f0f1f3;
  opacity: 0.6;
}

.todo-trash-item__title {
  flex: 1;
  font-size: 14px;
  text-decoration: line-through;
  color: #9ca3af;
}

.todo-trash-item__date {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

.todo-trash-item__restore {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  color: #3b82f6;
  flex-shrink: 0;

  &:hover {
    background: #dbeafe;
  }
}

.todo-trash-item__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

// Drawer 필드
.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-field__label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.drawer-field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

// 파일 첨부
.drawer-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 8px;

  // 이미지 파일은 세로 배치
  &--image {
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    overflow: hidden;
  }
}

.drawer-file__preview {
  display: block;
  cursor: pointer;
}

.drawer-file__img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  display: block;
  border-radius: 8px 8px 0 0;
}

.drawer-file__info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.drawer-file__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.drawer-file__name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.drawer-file__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

.drawer-file-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: #9ca3af;
    color: #374151;
  }
}

.drawer-file-add--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawer-file-hint {
  font-size: 12px;
  color: #9ca3af;
}

// 반응형
@media (max-width: 900px) {
  .todo-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .todo-card {
    transition: none;
  }
}

@media (max-width: 640px) {
  .todo-cards {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .todo-card {
    padding: 16px 18px;
    min-height: 80px;
    border-radius: 14px;
  }

  .todo-toolbar {
    gap: 6px;
  }
}

</style>
