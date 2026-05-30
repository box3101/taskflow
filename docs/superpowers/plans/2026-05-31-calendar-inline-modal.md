# 캘린더 할일/이슈 인라인 드로워 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캘린더에서 할일/이슈 클릭 시 페이지 이동 대신 사이드 드로워로 상세/편집 가능하게 한다.

**Architecture:** CalendarEventList에서 todo/issue 클릭 시 emit으로 변경하고, CalendarView에서 CalendarTodoDrawer/CalendarIssueDrawer 컴포넌트를 배치한다. 백엔드에 GET /todos/:id, GET /issues/:id API를 추가한다.

**Tech Stack:** Vue 3 + TypeScript, Express, Prisma, UiDrawer (ispark-ui)

---

### Task 1: 백엔드 - GET /todos/:id API 추가

**Files:**
- Modify: `taskflow/backend/src/routes/todos.ts:22-37` (GET / 라우트 바로 아래)

- [ ] **Step 1: GET /todos/:id 라우트 추가**

`taskflow/backend/src/routes/todos.ts`의 GET `/` 라우트(line 37) 뒤, POST `/` 라우트(line 40) 앞에 추가:

```typescript
// 할일 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id
    const id = Number(req.params.id)
    const todo = await prisma.todo.findFirst({
      where: { id, userId, deletedAt: null },
      include: { files: true },
    })
    if (!todo) {
      res.status(404).json({ message: '할일을 찾을 수 없습니다.' })
      return
    }
    res.json({ data: todo })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})
```

**주의:** 이 라우트는 반드시 `GET /trash` (line 112)보다 뒤에 배치하거나, `/trash`가 먼저 매칭되도록 현재 위치(line 112)를 유지해야 한다. 현재 `/trash`는 line 112에 있고 `/:id`가 line 39 아래에 들어가면 `/trash`가 `:id`로 매칭되는 문제 발생. **따라서 GET `/trash` 라우트(line 112-124) 바로 아래에 배치한다.**

- [ ] **Step 2: 서버 재시작 후 확인**

백엔드 dev 서버가 자동 재시작되므로 별도 작업 불필요 (ts-node-dev --respawn).

- [ ] **Step 3: 커밋**

```bash
cd taskflow
git add backend/src/routes/todos.ts
git commit -m "feat: add GET /todos/:id endpoint for single todo retrieval"
```

---

### Task 2: 백엔드 - GET /issues/:id API 추가

**Files:**
- Modify: `taskflow/backend/src/routes/issues.ts:24-48` (PUT /:id 라우트 앞)

- [ ] **Step 1: GET /issues/:id 라우트 추가**

`taskflow/backend/src/routes/issues.ts`의 `PUT /reorder` 라우트(line 24) 뒤, `PUT /:id` 라우트(line 27) 앞에 추가:

```typescript
// 이슈 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: Number(req.params.id) },
      include: { assignee: { select: { id: true, name: true } } },
    })
    if (!issue) {
      res.status(404).json({ message: '이슈를 찾을 수 없습니다.' })
      return
    }
    res.json({ data: issue })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})
```

- [ ] **Step 2: 커밋**

```bash
cd taskflow
git add backend/src/routes/issues.ts
git commit -m "feat: add GET /issues/:id endpoint for single issue retrieval"
```

---

### Task 3: 프론트 - CalendarTodoDrawer 컴포넌트 생성

**Files:**
- Create: `taskflow/frontend/src/components/calendar/CalendarTodoDrawer.vue`

- [ ] **Step 1: CalendarTodoDrawer.vue 작성**

ProjectsView.vue의 Todo 드로워 로직을 독립 컴포넌트로 추출. API로 단건 조회 후 편집 폼 표시.

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import {
  UiDrawer, UiInput, UiTextarea, UiDatePicker, UiButton, UiToggle,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { Todo, TodoFile } from '../../types/todo'

const props = defineProps<{
  open: boolean
  todoId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const loading = ref(false)
const title = ref('')
const dueDate = ref<DateValue | undefined>(undefined)
const memo = ref('')
const done = ref(false)
const files = ref<TodoFile[]>([])
const fileUploading = ref(false)
const todo = ref<Todo | null>(null)

function toCalendarDate(iso: string | null): DateValue | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function fromCalendarDate(val: DateValue | undefined): string | null {
  if (!val) return null
  return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`
}

function getFileUrl(filePath: string) {
  return `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/uploads/${filePath}`
}

function isImage(mimetype: string) {
  return mimetype.startsWith('image/')
}

// todoId가 바뀔 때 데이터 로드
watch(() => [props.open, props.todoId], async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  try {
    const { data } = await api.get(`/todos/${id}`)
    const t: Todo = data.data
    todo.value = t
    title.value = t.title
    dueDate.value = toCalendarDate(t.dueDate)
    memo.value = t.memo ?? ''
    done.value = t.done
    files.value = t.files ? [...t.files] : []
  } catch {
    openToast({ message: '할일을 불러오는데 실패했습니다.', type: 'error' })
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function onSave() {
  if (!todo.value) return
  const trimTitle = title.value.trim()
  if (!trimTitle) return

  const dueDateStr = fromCalendarDate(dueDate.value)
  const memoStr = memo.value.trim() || null

  const patch: Record<string, unknown> = {}
  if (trimTitle !== todo.value.title) patch.title = trimTitle
  if (dueDateStr !== todo.value.dueDate) patch.dueDate = dueDateStr
  if (memoStr !== (todo.value.memo ?? null)) patch.memo = memoStr

  if (Object.keys(patch).length === 0) {
    emit('update:open', false)
    return
  }

  try {
    await api.patch(`/todos/${todo.value.id}`, patch)
    emit('update:open', false)
    emit('saved')
    openToast({ message: '할일이 수정되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  }
}

async function onToggleDone(val: boolean) {
  if (!todo.value) return
  done.value = val
  try {
    await api.patch(`/todos/${todo.value.id}`, { done: val })
    emit('update:open', false)
    emit('saved')
    openToast({ message: val ? '완료 처리되었습니다.' : '할일로 복원되었습니다.', type: 'success' })
  } catch {
    done.value = !val
    openToast({ message: '상태 변경에 실패했습니다.', type: 'error' })
  }
}

async function onDelete() {
  if (!todo.value) return
  const confirmed = await openConfirm({
    title: '할일 삭제',
    message: `<strong>${todo.value.title}</strong>을(를) 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/todos/${todo.value.id}`)
    emit('update:open', false)
    emit('deleted')
    openToast({ message: '휴지통으로 이동했습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

async function onFileUpload(e: Event) {
  if (!todo.value) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(`/todos/${todo.value.id}/files`, formData)
    files.value.push(data.data)
  } catch {
    openToast({ message: '파일 업로드에 실패했습니다.', type: 'error' })
  } finally {
    fileUploading.value = false
    input.value = ''
  }
}

async function deleteFile(file: TodoFile) {
  if (!todo.value) return
  try {
    await api.delete(`/todos/${todo.value.id}/files/${file.id}`)
    files.value = files.value.filter(f => f.id !== file.id)
  } catch {
    openToast({ message: '파일 삭제에 실패했습니다.', type: 'error' })
  }
}
</script>

<template>
  <UiDrawer :open="open" title="할일 상세" max-width="100vw" @update:open="emit('update:open', $event)">
    <div v-if="loading" style="text-align:center; padding:40px; color:#9ca3af;">불러오는 중...</div>
    <form v-else class="drawer-form" @submit.prevent="onSave">
      <UiInput v-model="title" label="제목" placeholder="할일 제목" />
      <div class="drawer-field">
        <label class="drawer-field__label">마감일</label>
        <UiDatePicker v-model="dueDate" type="date" size="sm" />
      </div>
      <UiTextarea v-model="memo" label="메모" placeholder="메모를 입력하세요..." :rows="5" />

      <!-- 파일 첨부 -->
      <div class="drawer-field">
        <label class="drawer-field__label">첨부파일</label>
        <div class="drawer-files">
          <div v-for="file in files" :key="file.id" :class="isImage(file.mimetype) ? 'drawer-file drawer-file--image' : 'drawer-file'">
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
          <label class="drawer-file-add" :class="{ 'drawer-file-add--disabled': fileUploading }">
            <input type="file" hidden @change="onFileUpload" :disabled="fileUploading" />
            {{ fileUploading ? '업로드 중...' : '+ 파일 추가' }}
          </label>
        </div>
      </div>
    </form>
    <template #footer>
      <div class="todo-drawer-footer">
        <div class="todo-drawer-footer__left">
          <UiButton variant="danger" size="sm" @click="onDelete">삭제</UiButton>
        </div>
        <div class="todo-drawer-footer__center">
          <span class="todo-drawer-footer__done-label" :class="{ 'todo-drawer-footer__done-label--active': done }">
            {{ done ? '완료됨' : '미완료' }}
          </span>
          <UiToggle :model-value="done" @update:model-value="onToggleDone" />
        </div>
        <div class="todo-drawer-footer__right">
          <UiButton variant="ghost" size="sm" @click="emit('update:open', false)">취소</UiButton>
          <UiButton variant="primary" size="sm" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.drawer-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.drawer-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drawer-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
  &--image {
    flex-direction: column;
    align-items: stretch;
  }
}
.drawer-file__preview {
  display: block;
  border-radius: 4px;
  overflow: hidden;
}
.drawer-file__img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 4px;
}
.drawer-file__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.drawer-file__icon {
  font-size: 16px;
}
.drawer-file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
.drawer-file__delete {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}
.drawer-file-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  &:hover { border-color: #3b82f6; color: #3b82f6; }
  &--disabled { opacity: 0.5; cursor: not-allowed; }
}
.drawer-file-hint {
  font-size: 12px;
  color: #9ca3af;
}
.todo-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.todo-drawer-footer__left,
.todo-drawer-footer__right {
  display: flex;
  gap: 8px;
}
.todo-drawer-footer__center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.todo-drawer-footer__done-label {
  font-size: 12px;
  color: #9ca3af;
  &--active { color: #22c55e; font-weight: 600; }
}
</style>
```

- [ ] **Step 2: 커밋**

```bash
cd taskflow
git add frontend/src/components/calendar/CalendarTodoDrawer.vue
git commit -m "feat: add CalendarTodoDrawer component for inline todo editing"
```

---

### Task 4: 프론트 - CalendarIssueDrawer 컴포넌트 생성

**Files:**
- Create: `taskflow/frontend/src/components/calendar/CalendarIssueDrawer.vue`

- [ ] **Step 1: CalendarIssueDrawer.vue 작성**

ProjectDetailView.vue의 Issue 패널 로직을 독립 컴포넌트로 추출.

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  UiDrawer, UiButton, UiTextarea, UiBadge, UiDropdownMenu,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import api from '../../api/client'

interface Issue {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  assignee: { id: number; name: string } | null
  assigneeId: number | null
  requestedAt: string | null
  dueAt: string | null
  createdAt: string
  projectId: number
}

const props = defineProps<{
  open: boolean
  issueId: number | null
  projectId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const loading = ref(false)
const issue = ref<Issue | null>(null)
const description = ref('')
const saving = ref(false)
const deleting = ref(false)

const statusMenuItems: DropdownMenuItemDef[] = [
  { value: 'todo', label: '할 일' },
  { value: 'doing', label: '진행중' },
  { value: 'done', label: '완료' },
]

const priorityMenuItems: DropdownMenuItemDef[] = [
  { value: 'high', label: '높음' },
  { value: 'mid', label: '보통' },
  { value: 'low', label: '낮음' },
]

const priorityMap: Record<string, { label: string; variant: string }> = {
  high: { label: '높음', variant: 'danger' },
  mid: { label: '보통', variant: 'warning' },
  low: { label: '낮음', variant: 'default' },
}

watch(() => [props.open, props.issueId], async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  try {
    const { data } = await api.get(`/issues/${id}`)
    issue.value = data.data
    description.value = data.data.description || ''
  } catch {
    openToast({ message: '이슈를 불러오는데 실패했습니다.', type: 'error' })
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function onInlineChange(field: string, val: string) {
  if (!issue.value) return
  const prev = (issue.value as any)[field]
  ;(issue.value as any)[field] = val

  const updateData: Record<string, unknown> = { [field]: val }
  if (field === 'assigneeId') {
    updateData.assigneeId = val ? Number(val) : null
  }

  try {
    const { data } = await api.put(`/issues/${issue.value.id}`, updateData)
    issue.value = data
    emit('saved')
  } catch {
    ;(issue.value as any)[field] = prev
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  }
}

async function onSave() {
  if (!issue.value) return
  saving.value = true
  try {
    const { data } = await api.put(`/issues/${issue.value.id}`, {
      description: description.value.trim() || null,
    })
    issue.value = data
    emit('update:open', false)
    emit('saved')
    openToast({ message: '저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!issue.value) return
  const confirmed = await openConfirm({
    title: '이슈 삭제',
    message: `<strong>${issue.value.title}</strong> 이슈를 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  deleting.value = true
  try {
    await api.delete(`/issues/${issue.value.id}`)
    emit('update:open', false)
    emit('deleted')
    openToast({ message: '삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  } finally {
    deleting.value = false
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR')
}
</script>

<template>
  <UiDrawer :open="open" :title="issue?.title || '이슈 상세'" width="480px" max-width="700px" @update:open="emit('update:open', $event)">
    <div v-if="loading" style="text-align:center; padding:40px; color:#9ca3af;">불러오는 중...</div>
    <div v-else-if="issue" class="panel-detail">
      <!-- 속성 테이블 -->
      <div class="panel-props">
        <div class="panel-prop">
          <span class="panel-prop-label">상태</span>
          <UiDropdownMenu :items="statusMenuItems" @select="(val: string) => onInlineChange('status', val)">
            <template #trigger>
              <button class="cell-badge-btn">
                <UiBadge :variant="issue.status === 'done' ? 'success' : issue.status === 'doing' ? 'primary' : 'default'" size="sm">
                  {{ issue.status === 'done' ? '완료' : issue.status === 'doing' ? '진행중' : '할 일' }}
                </UiBadge>
              </button>
            </template>
          </UiDropdownMenu>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">우선순위</span>
          <UiDropdownMenu :items="priorityMenuItems" @select="(val: string) => onInlineChange('priority', val)">
            <template #trigger>
              <button class="cell-badge-btn">
                <UiBadge :variant="(priorityMap[issue.priority]?.variant || 'default') as any" size="sm">
                  {{ priorityMap[issue.priority]?.label || '낮음' }}
                </UiBadge>
              </button>
            </template>
          </UiDropdownMenu>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">담당자</span>
          <span v-if="issue.assignee" class="panel-prop-value">{{ issue.assignee.name }}</span>
          <span v-else class="panel-prop-value" style="color:#9ca3af">미배정</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">요청일</span>
          <span class="panel-prop-value">{{ formatDate(issue.requestedAt) }}</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">마감일</span>
          <span class="panel-prop-value">{{ formatDate(issue.dueAt) }}</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">생성일</span>
          <span class="panel-prop-value">{{ formatDate(issue.createdAt) }}</span>
        </div>
      </div>

      <hr class="panel-divider" />

      <!-- 설명 -->
      <form class="drawer-form" @submit.prevent="onSave">
        <UiTextarea v-model="description" label="설명" placeholder="이슈에 대한 메모를 작성하세요..." :rows="6" />
      </form>
    </div>
    <template #footer>
      <div class="drawer-footer-between">
        <UiButton variant="danger" size="sm" :loading="deleting" @click="onDelete">삭제</UiButton>
        <div class="drawer-footer">
          <UiButton variant="ghost" size="md" @click="emit('update:open', false)">취소</UiButton>
          <UiButton variant="primary" size="md" :loading="saving" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.panel-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.panel-props {
  display: flex;
  flex-direction: column;
}
.panel-prop {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.panel-prop-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}
.panel-prop-value {
  font-size: 13px;
  color: #374151;
}
.panel-divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}
.cell-badge-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.1s;
  &:hover { background: #f3f4f6; }
}
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.drawer-footer-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
```

- [ ] **Step 2: 커밋**

```bash
cd taskflow
git add frontend/src/components/calendar/CalendarIssueDrawer.vue
git commit -m "feat: add CalendarIssueDrawer component for inline issue editing"
```

---

### Task 5: 프론트 - CalendarEventList에서 emit 방식으로 변경

**Files:**
- Modify: `taskflow/frontend/src/components/calendar/CalendarEventList.vue:1-15,31-35`

- [ ] **Step 1: emit에 openTodo, openIssue 추가하고 router.push 제거**

`CalendarEventList.vue`에서:

1. `vue-router` import 및 `useRouter()` 제거 (line 3, 17)
2. emit에 `openTodo`, `openIssue` 추가 (line 12-15)
3. `onClickEvent`에서 `router.push` → `emit` 변경 (line 31-35)

변경 후 script 전체:

```typescript
import { computed } from 'vue'
import { UiButton, UiIcon } from '@leechanyong/ispark-ui'
import type { CalendarEvent } from '../../types/calendar'

const props = defineProps<{
  date: string
  events: CalendarEvent[]
}>()

const emit = defineEmits<{
  add: []
  editEvent: [event: CalendarEvent]
  openTodo: [event: CalendarEvent]
  openIssue: [event: CalendarEvent]
}>()

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const formattedDate = computed(() => {
  const d = new Date(props.date + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`
})

const typeBadge = {
  event: { label: '일정', bg: '#dbeafe', color: '#3b82f6' },
  todo: { label: 'Todo', bg: '#fee2e2', color: '#ef4444' },
  issue: { label: 'Issue', bg: '#dcfce7', color: '#22c55e' },
}

function onClickEvent(ev: CalendarEvent) {
  if (ev.type === 'event') emit('editEvent', ev)
  else if (ev.type === 'todo') emit('openTodo', ev)
  else if (ev.type === 'issue') emit('openIssue', ev)
}

function formatTime(ev: CalendarEvent): string {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`
  if (ev.startTime) return ev.startTime
  if (ev.type !== 'event') return '마감일'
  return '종일'
}
```

- [ ] **Step 2: 커밋**

```bash
cd taskflow
git add frontend/src/components/calendar/CalendarEventList.vue
git commit -m "feat: change CalendarEventList to emit openTodo/openIssue instead of router.push"
```

---

### Task 6: 프론트 - CalendarView에 드로워 통합

**Files:**
- Modify: `taskflow/frontend/src/views/CalendarView.vue:1-15,113-117,205-213`

- [ ] **Step 1: CalendarView에 Todo/Issue 드로워 import 및 상태 추가**

`CalendarView.vue`의 script에 추가:

1. import 추가 (line 14 뒤):

```typescript
import CalendarTodoDrawer from '../components/calendar/CalendarTodoDrawer.vue'
import CalendarIssueDrawer from '../components/calendar/CalendarIssueDrawer.vue'
```

2. 드로워 상태 추가 (line 56 `drawerOpen` 뒤):

```typescript
const todoDrawerOpen = ref(false)
const todoDrawerId = ref<number | null>(null)
const issueDrawerOpen = ref(false)
const issueDrawerId = ref<number | null>(null)
const issueDrawerProjectId = ref<number | null>(null)
```

3. 핸들러 추가 (line 117 `onDeleted` 뒤):

```typescript
function openTodoDrawer(ev: CalendarEvent) {
  todoDrawerId.value = ev.id
  todoDrawerOpen.value = true
}
function openIssueDrawer(ev: CalendarEvent) {
  issueDrawerId.value = ev.id
  issueDrawerProjectId.value = ev.projectId ?? null
  issueDrawerOpen.value = true
}
function onTodoSavedOrDeleted() { fetchEvents() }
function onIssueSavedOrDeleted() { fetchEvents() }
```

- [ ] **Step 2: template에 emit 핸들러 연결 및 드로워 컴포넌트 배치**

CalendarEventList (line 208-209)에 emit 핸들러 추가:

```vue
<CalendarEventList :date="selectedDate" :events="selectedEvents"
  @add="openAddOnDate" @edit-event="openEdit"
  @open-todo="openTodoDrawer" @open-issue="openIssueDrawer" />
```

CalendarEventForm (line 211) 뒤에 드로워 컴포넌트 추가:

```vue
<CalendarTodoDrawer v-model:open="todoDrawerOpen" :todo-id="todoDrawerId"
  @saved="onTodoSavedOrDeleted" @deleted="onTodoSavedOrDeleted" />
<CalendarIssueDrawer v-model:open="issueDrawerOpen" :issue-id="issueDrawerId"
  :project-id="issueDrawerProjectId"
  @saved="onIssueSavedOrDeleted" @deleted="onIssueSavedOrDeleted" />
```

- [ ] **Step 3: 커밋**

```bash
cd taskflow
git add frontend/src/views/CalendarView.vue
git commit -m "feat: integrate todo/issue drawers into CalendarView"
```

---

### Task 7: 브라우저 QA 테스트

- [ ] **Step 1: 브라우저에서 확인**

1. http://localhost:5173/calendar 접속
2. 캘린더에서 Todo가 있는 날짜 클릭 → Todo 항목 클릭 → 드로워 열림 확인
3. 제목/메모/마감일 편집 후 저장 → 캘린더 갱신 확인
4. 완료 토글 → 동작 확인
5. Issue가 있는 날짜 클릭 → Issue 항목 클릭 → 드로워 열림 확인
6. 상태/우선순위 변경 → 동작 확인
7. Event 항목 클릭 → 기존 CalendarEventForm 동작 유지 확인

- [ ] **Step 2: 최종 커밋 (필요 시 수정 사항)**
