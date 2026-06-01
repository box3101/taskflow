<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  UiLoading, UiEmpty, UiTab, UiInput, UiButton,
  UiSelect, UiTextarea, UiToggle, UiBadge, UiDrawer, UiIcon,
  UiDatePicker, UiFileList, UiFileUpload, openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption, FileItem } from '@leechanyong/ispark-ui'
import type { DateValue } from '@internationalized/date'
import type { Todo, TodoFile } from '../types/todo'
import { CalendarDate } from '@internationalized/date'
import api from '../api/client'

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
const drawerSaving = ref(false)
const drawerRepeatType = ref('')
const drawerRepeatDay = ref<number | null>(null)
const drawerFiles = ref<TodoFile[]>([])
const fileUploading = ref(false)

// 반복 옵션
const repeatOptions: SelectOption[] = [
  { value: '', label: '반복 안함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
]

const dayOptions: SelectOption[] = [
  { value: 0, label: '일요일' },
  { value: 1, label: '월요일' },
  { value: 2, label: '화요일' },
  { value: 3, label: '수요일' },
  { value: 4, label: '목요일' },
  { value: 5, label: '금요일' },
  { value: 6, label: '토요일' },
]

const monthDayOptions: SelectOption[] = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}일`,
}))

// 반복 라벨
function repeatLabel(type: string, day?: number | null): string {
  if (type === 'daily') return '매일'
  if (type === 'weekly') {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `매주 ${days[day ?? 0]}`
  }
  if (type === 'monthly') return `매월 ${day}일`
  return ''
}

// 미완료 (필터 + 정렬)
const incompleteTodos = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  let filtered = todos.value.filter(t => !t.done)

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

async function loadTodos() {
  todoLoading.value = true
  try {
    const { data } = await api.get('/todos')
    todos.value = data.data
  } finally {
    todoLoading.value = false
  }
}

onMounted(() => { loadTodos() })

function openCreateTodoDrawer() {
  drawerMode.value = 'create'
  drawerTodo.value = null
  drawerTitle.value = ''
  drawerDueDate.value = undefined
  drawerMemo.value = ''
  drawerRepeatType.value = ''
  drawerRepeatDay.value = null
  todoDrawerOpen.value = true
}

function openTodoDrawer(todo: Todo) {
  drawerMode.value = 'edit'
  drawerTodo.value = todo
  drawerTitle.value = todo.title
  drawerDueDate.value = toCalendarDate(todo.dueDate)
  drawerMemo.value = todo.memo ?? ''
  drawerDone.value = todo.done
  drawerRepeatType.value = todo.repeatType ?? ''
  drawerRepeatDay.value = todo.repeatDay ?? null
  drawerFiles.value = todo.files ? [...todo.files] : []
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

async function saveTodoDrawer() {
  const title = drawerTitle.value.trim()
  if (!title || drawerSaving.value) return

  const dueDate = fromCalendarDate(drawerDueDate.value)
  const memo = drawerMemo.value.trim() || null
  const repeatType = drawerRepeatType.value || null
  const repeatDay = repeatType === 'weekly' || repeatType === 'monthly' ? drawerRepeatDay.value : null

  drawerSaving.value = true
  try {
    if (drawerMode.value === 'create') {
      const { data } = await api.post('/todos', { title, dueDate, memo, repeatType, repeatDay })
      todos.value.push(data.data)
      todoDrawerOpen.value = false
      openToast({ message: '할일이 추가되었습니다.', type: 'success' })
    } else {
      const todo = drawerTodo.value!
      const patch: Record<string, unknown> = {}
      if (title !== todo.title) patch.title = title
      if (dueDate !== todo.dueDate) patch.dueDate = dueDate
      if (memo !== (todo.memo ?? null)) patch.memo = memo
      if (repeatType !== (todo.repeatType ?? null)) patch.repeatType = repeatType
      if (repeatDay !== (todo.repeatDay ?? null)) patch.repeatDay = repeatDay

      if (Object.keys(patch).length === 0) {
        todoDrawerOpen.value = false
        return
      }

      const { data } = await api.patch(`/todos/${todo.id}`, patch)
      const idx = todos.value.findIndex(t => t.id === todo.id)
      if (idx !== -1) todos.value[idx] = data.data
      todoDrawerOpen.value = false
      openToast({ message: '할일이 수정되었습니다.', type: 'success' })
    }
  } catch {
    openToast({ message: drawerMode.value === 'create' ? '할일 추가에 실패했습니다.' : '수정에 실패했습니다.', type: 'error' })
  } finally {
    drawerSaving.value = false
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
  const confirmed = await openConfirm({
    title: '할일 삭제',
    message: `<strong>${drawerTodo.value.title}</strong>을(를) 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
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

async function onFileSelect(file: File) {
  if (!drawerTodo.value) return

  fileUploading.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const { data } = await api.post(`/todos/${drawerTodo.value.id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    drawerFiles.value.push(data.data)
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
  }
}

async function deleteFile(file: FileItem) {
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
</script>

<template>
  <div class="todos-page">
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
              <UiBadge v-if="todo.repeatType" variant="info" size="xs">🔄 {{ repeatLabel(todo.repeatType, todo.repeatDay) }}</UiBadge>
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
      <div v-else class="todo-cards">
        <div
          v-for="todo in completedTodos"
          :key="todo.id"
          class="todo-card todo-card--done"
        >
          <div class="todo-card__title todo-card__title--done">{{ todo.title }}</div>
          <div class="todo-card__footer">
            <div class="todo-card__tags">
              <UiBadge variant="primary" size="xs">완료</UiBadge>
              <UiBadge v-if="todo.repeatType" variant="info" size="xs">🔄 {{ repeatLabel(todo.repeatType, todo.repeatDay) }}</UiBadge>
            </div>
            <div class="todo-card__actions">
              <button class="todo-card__action" @click.stop="toggleTodo(todo)" title="되돌리기">
                <UiIcon name="undo-2" :size="14" />
              </button>
              <button class="todo-card__action todo-card__action--delete" @click.stop="deleteTodo(todo)" title="삭제">
                <UiIcon name="trash-2" :size="14" />
              </button>
            </div>
          </div>
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
        <div v-for="todo in trashTodos" :key="todo.id" class="todo-trash-item">
          <span class="todo-trash-item__title">{{ todo.title }}</span>
          <span class="todo-trash-item__date">{{ new Date(todo.deletedAt!).toLocaleDateString('ko-KR') }}</span>
          <button class="todo-trash-item__restore" @click="restoreTodo(todo)" title="복원">↩</button>
          <button class="todo-trash-item__delete" @click="permanentDeleteTodo(todo)" title="영구 삭제">
            <i class="icon-close size-16" />
          </button>
        </div>
      </div>
    </template>

    <!-- FAB: 추가 버튼 -->
    <button class="fab" aria-label="할일 추가" @click="openCreateTodoDrawer">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 할일 상세 Drawer -->
    <UiDrawer v-model:open="todoDrawerOpen" :title="drawerMode === 'create' ? '할일 추가' : '할일 상세'" max-width="100vw">
      <form class="drawer-form" @submit.prevent="saveTodoDrawer">
        <UiInput v-model="drawerTitle" label="제목" placeholder="할일 제목" />
        <div class="drawer-field">
          <label class="drawer-field__label">마감일</label>
          <UiDatePicker v-model="drawerDueDate" type="date" size="sm" />
        </div>
        <UiTextarea v-model="drawerMemo" label="메모" placeholder="메모를 입력하세요..." :rows="5" />
        <div class="drawer-field">
          <label class="drawer-field__label">반복</label>
          <UiSelect v-model="drawerRepeatType" :options="repeatOptions" placeholder="반복 안함" size="sm" />
        </div>
        <div v-if="drawerRepeatType === 'weekly'" class="drawer-field">
          <label class="drawer-field__label">요일</label>
          <UiSelect v-model="drawerRepeatDay" :options="dayOptions" placeholder="요일 선택" size="sm" />
        </div>
        <div v-if="drawerRepeatType === 'monthly'" class="drawer-field">
          <label class="drawer-field__label">날짜</label>
          <UiSelect v-model="drawerRepeatDay" :options="monthDayOptions" placeholder="날짜 선택" size="sm" />
        </div>
        <div class="drawer-field">
          <label class="drawer-field__label">첨부파일</label>
          <UiFileList :files="drawerFiles" :get-url="getFileUrl" @delete="deleteFile" />
          <template v-if="drawerMode === 'edit'">
            <UiFileUpload :loading="fileUploading" @upload="onFileSelect" />
          </template>
          <span v-else class="drawer-file-hint">할일 추가 후 파일을 첨부할 수 있습니다.</span>
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
            <UiButton variant="primary" size="sm" :loading="drawerSaving" @click="saveTodoDrawer">{{ drawerMode === 'create' ? '추가' : '저장' }}</UiButton>
          </div>
        </div>
      </template>
    </UiDrawer>
  </div>
</template>

<style scoped lang="scss">
.todos-page { position: relative; }

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

.todo-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px; margin: 16px 0;
}
.todo-toolbar__filters {
  display: flex; gap: 8px;
  :deep(.ui-select-trigger) { min-width: 110px; min-height: 36px; }
}

.todo-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.todo-card {
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 18px 20px; min-height: 100px;
  background: var(--card-bg, #fff); border: none; border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.25s ease-out, transform 0.2s ease-out;
  &:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04); transform: translateY(-2px); }
  &:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); }
  &--warning { --card-bg: #fffdf5; box-shadow: 0 2px 8px rgba(251, 191, 36, 0.12), 0 0 0 1px rgba(251, 191, 36, 0.2); }
  &--danger { --card-bg: #fffafa; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1), 0 0 0 1px rgba(239, 68, 68, 0.15); }
}
.todo-card__title {
  font-size: 15px; font-weight: 500; line-height: 1.5; color: #111827;
  word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  &--done { text-decoration: line-through; color: #9ca3af; }
}
.todo-card--done {
  opacity: 0.75;
  &:hover { opacity: 1; }
}
.todo-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.todo-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }
.todo-card__actions { display: flex; gap: 4px; }
.todo-card__action {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none; border-radius: 6px;
  cursor: pointer; color: #9ca3af; transition: background 0.15s, color 0.15s;
  &:hover { background: #eef2ff; color: #4f6af6; }
  &--delete:hover { background: #fee2e2; color: #ef4444; }
}


.todo-trash-header { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 4px; }
.todo-trash-list { margin-top: 8px; }
.todo-trash-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 8px;
  border-bottom: 1px solid #f0f1f3; opacity: 0.6;
}
.todo-trash-item__title { flex: 1; font-size: 14px; text-decoration: line-through; color: #9ca3af; }
.todo-trash-item__date { font-size: 12px; color: #9ca3af; flex-shrink: 0; }
.todo-trash-item__restore {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none; border-radius: 6px;
  cursor: pointer; font-size: 16px; color: #3b82f6; flex-shrink: 0;
  &:hover { background: #dbeafe; }
}
.todo-trash-item__delete {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none; border-radius: 6px;
  cursor: pointer; color: #9ca3af; flex-shrink: 0;
  &:hover { background: #fee2e2; color: #ef4444; }
}

.drawer-form { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 6px; }
.drawer-field__label { font-size: 12px; font-weight: 500; color: #374151; }
.drawer-file-hint { font-size: 12px; color: #9ca3af; }

.todo-drawer-footer { display: flex; align-items: center; gap: 8px; }
.todo-drawer-footer__left { flex-shrink: 0; }
.todo-drawer-footer__center { display: flex; align-items: center; gap: 8px; margin: 0 auto; }
.todo-drawer-footer__done-label { font-size: 13px; color: #9ca3af; font-weight: 500; &--active { color: #22c55e; } }
.todo-drawer-footer__right { display: flex; gap: 8px; flex-shrink: 0; }

@media (max-width: 900px) { .todo-cards { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) {
  .todo-cards { grid-template-columns: 1fr; gap: 10px; }
  .todo-card { padding: 16px 18px; min-height: 80px; border-radius: 14px; }
  .fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}
</style>
