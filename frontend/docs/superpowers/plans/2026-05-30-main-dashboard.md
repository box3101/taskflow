# 메인 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TaskFlow 앱에 프로젝트 + 개인할일을 한눈에 볼 수 있는 하이브리드형 메인 대시보드를 추가한다.

**Architecture:** 새 `DashboardView.vue`를 `/` 라우트로 등록하고, 기존 `ProjectsView`는 `/main`으로 이동. 대시보드 로직은 `components/dashboard/` 하위 4개 컴포넌트로 분리. 기존 `GET /projects`, `GET /todos` API를 `Promise.all`로 병렬 호출하여 백엔드 변경 없이 구현.

**Tech Stack:** Vue 3 + TypeScript, ispark-ui 컴포넌트 (UiCheckbox, UiBadge, UiIcon, UiInput, UiLoading, UiEmpty, openToast), axios API client

---

## File Structure

| 파일 | 역할 |
|------|------|
| `src/types/todo.ts` | Todo, TodoFile 인터페이스 (ProjectsView에서 추출) |
| `src/components/dashboard/StatCard.vue` | 숫자 요약 카드 (아이콘 + 라벨 + 숫자) |
| `src/components/dashboard/TodoQuickList.vue` | 할일 리스트 (체크 + D-day + 빠른 추가) |
| `src/components/dashboard/ProjectSummary.vue` | 프로젝트 요약 리스트 (상태 뱃지 + 이슈/멤버) |
| `src/components/dashboard/DashboardHome.vue` | 대시보드 메인 (데이터 로딩 + 인사말 + 하위 조합) |
| `src/views/DashboardView.vue` | 얇은 뷰 래퍼 |
| `src/router.ts` | 라우트 변경 (`/` → Dashboard, `/main` → ProjectsView) |
| `src/views/ProjectsView.vue` | 로고 클릭 시 `/`로 이동 추가 |

---

### Task 1: Todo/TodoFile 타입 추출

**Files:**
- Create: `src/types/todo.ts`
- Modify: `src/views/ProjectsView.vue:136-154`

- [ ] **Step 1: 타입 파일 생성**

```typescript
// src/types/todo.ts
export interface TodoFile {
  id: number
  todoId: number
  filename: string
  path: string
  mimetype: string
  size: number
}

export interface Todo {
  id: number
  title: string
  memo: string | null
  done: boolean
  dueDate: string | null
  createdAt: string
  deletedAt?: string | null
  files?: TodoFile[]
}
```

- [ ] **Step 2: ProjectsView에서 타입 import로 교체**

`src/views/ProjectsView.vue`에서 `interface TodoFile { ... }` 블록(136~143행)과 `interface Todo { ... }` 블록(145~154행)을 삭제하고, 파일 상단 import에 추가:

```typescript
import type { Todo, TodoFile } from '../types/todo'
```

- [ ] **Step 3: 앱 동작 확인**

Run: 브라우저에서 `http://localhost:5177/?tab=todos` 접속, 할일 탭이 정상 동작하는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/types/todo.ts src/views/ProjectsView.vue
git commit -m "refactor: Todo/TodoFile 타입을 types/todo.ts로 추출"
```

---

### Task 2: StatCard 컴포넌트

**Files:**
- Create: `src/components/dashboard/StatCard.vue`

- [ ] **Step 1: StatCard.vue 생성**

```vue
<script setup lang="ts">
import { UiIcon } from '@leechanyong/ispark-ui'

defineProps<{
  icon: string
  iconBg?: string
  label: string
  value: number
  sub?: string
}>()
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__icon" :style="{ background: iconBg || '#eff3ff' }">
      <UiIcon :name="icon" :size="20" />
    </div>
    <div class="stat-card__info">
      <span class="stat-card__label">{{ label }}</span>
      <span class="stat-card__value">
        {{ value }}<span v-if="sub" class="stat-card__sub">{{ sub }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  color: #374151;
}

.stat-card__info {
  display: flex;
  flex-direction: column;
}

.stat-card__label {
  font-size: 11px;
  color: #9ca3af;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-card__sub {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 400;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/StatCard.vue
git commit -m "feat: StatCard 대시보드 요약 카드 컴포넌트 추가"
```

---

### Task 3: TodoQuickList 컴포넌트

**Files:**
- Create: `src/components/dashboard/TodoQuickList.vue`

- [ ] **Step 1: TodoQuickList.vue 생성**

```vue
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
  padding: 0;

  &:hover {
    text-decoration: underline;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/TodoQuickList.vue
git commit -m "feat: TodoQuickList 대시보드 할일 리스트 컴포넌트 추가"
```

---

### Task 4: ProjectSummary 컴포넌트

**Files:**
- Create: `src/components/dashboard/ProjectSummary.vue`

- [ ] **Step 1: ProjectSummary.vue 생성**

```vue
<script setup lang="ts">
import { UiBadge, UiIcon, UiEmpty } from '@leechanyong/ispark-ui'

defineProps<{
  projects: any[]
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [project: any]
  navigateAll: []
}>()

function statusBadge(status: string) {
  switch (status) {
    case 'active': return { label: '진행중', variant: 'success' as const }
    case 'done': return { label: '완료', variant: 'info' as const }
    default: return { label: '보류', variant: 'warning' as const }
  }
}
</script>

<template>
  <div class="project-summary">
    <div class="project-summary__header">
      <span class="project-summary__title">프로젝트</span>
      <button class="project-summary__link" @click="emit('navigateAll')">
        전체보기
        <UiIcon name="arrow-right" :size="14" />
      </button>
    </div>

    <UiEmpty v-if="projects.length === 0" title="프로젝트가 없습니다." />

    <div v-else class="project-summary__list">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-summary__item"
        @click="emit('select', project)"
      >
        <div class="project-summary__info">
          <span class="project-summary__name">{{ project.name }}</span>
          <span class="project-summary__meta">
            <UiIcon name="circle-dot" :size="12" />
            {{ project._count?.issues ?? 0 }}개
            <UiIcon name="users" :size="12" style="margin-left: 6px;" />
            {{ project._count?.members ?? 0 }}명
          </span>
        </div>
        <UiBadge
          :variant="statusBadge(project.status).variant"
          size="xs"
        >
          {{ statusBadge(project.status).label }}
        </UiBadge>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-summary {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.project-summary__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.project-summary__title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.project-summary__link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #3c69db;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

.project-summary__list {
  display: flex;
  flex-direction: column;
}

.project-summary__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #fafbfc;
    margin: 0 -16px;
    padding: 10px 16px;
  }
}

.project-summary__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-summary__name {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.project-summary__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/ProjectSummary.vue
git commit -m "feat: ProjectSummary 대시보드 프로젝트 요약 컴포넌트 추가"
```

---

### Task 5: DashboardHome 메인 컴포넌트

**Files:**
- Create: `src/components/dashboard/DashboardHome.vue`

- [ ] **Step 1: DashboardHome.vue 생성**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiLoading, openToast } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { Todo } from '../../types/todo'
import StatCard from './StatCard.vue'
import TodoQuickList from './TodoQuickList.vue'
import ProjectSummary from './ProjectSummary.vue'

const router = useRouter()
const loading = ref(true)
const projects = ref<any[]>([])
const todos = ref<Todo[]>([])

// 시간대별 인사말
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return '좋은 아침이에요 👋'
  if (h < 18) return '좋은 오후예요 👋'
  return '좋은 저녁이에요 👋'
})

// 진행 중 프로젝트
const activeProjects = computed(() =>
  projects.value.filter(p => p.status === 'active')
)

// 오늘 기준 할일 필터
const todayTodos = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return todos.value.filter(t => {
    // 완료된 항목: 오늘 완료한 것만
    if (t.done) {
      // 완료 여부만 체크 (createdAt 기준 오늘)
      return false // 대시보드에서는 미완료 중심으로 표시
    }
    // 미완료: 마감일이 오늘이거나 지났거나 없는 것
    if (!t.dueDate) return true
    const due = new Date(t.dueDate)
    due.setHours(0, 0, 0, 0)
    return due.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000 // 7일 이내
  }).sort((a, b) => {
    // 마감일 없는 건 뒤로
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })
})

// 오늘 할일 수 (미완료)
const todayTodoCount = computed(() =>
  todos.value.filter(t => !t.done).length
)

// 완료율
const completionSub = computed(() => `/${todos.value.length}`)
const completedCount = computed(() => todos.value.filter(t => t.done).length)

// 마감 임박 (D-3 이내)
const urgentCount = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return todos.value.filter(t => {
    if (t.done || !t.dueDate) return false
    const due = new Date(t.dueDate)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= 3
  }).length
})

// 요약 텍스트
const summaryText = computed(() => {
  const parts: string[] = []
  parts.push(`오늘 할일 ${todayTodoCount.value}개`)
  if (urgentCount.value > 0) {
    parts.push(`마감 임박 ${urgentCount.value}개`)
  }
  return parts.join(', ')
})

// 데이터 로딩
onMounted(async () => {
  try {
    const [projectRes, todoRes] = await Promise.all([
      api.get('/projects'),
      api.get('/todos'),
    ])
    projects.value = projectRes.data.data
    todos.value = todoRes.data.data
  } catch {
    openToast({ message: '데이터를 불러오는데 실패했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
})

// 할일 토글
async function onToggleTodo(todo: Todo) {
  try {
    const { data } = await api.patch(`/todos/${todo.id}`, { done: !todo.done })
    const idx = todos.value.findIndex(t => t.id === todo.id)
    if (idx !== -1) todos.value[idx] = data.data
  } catch {
    openToast({ message: '상태 변경에 실패했습니다.', type: 'error' })
  }
}

// 빠른 추가
async function onAddTodo(title: string) {
  try {
    const { data } = await api.post('/todos', { title, dueDate: null, memo: null })
    todos.value.push(data.data)
    openToast({ message: '할일이 추가되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '할일 추가에 실패했습니다.', type: 'error' })
  }
}

// 네비게이션
function onSelectProject(project: any) {
  router.push(`/projects/${project.id}`)
}

function onNavigateProjects() {
  router.push('/main?tab=projects')
}

function onNavigateTodos() {
  router.push('/main?tab=todos')
}
</script>

<template>
  <div class="dashboard">
    <UiLoading v-if="loading" overlay />

    <template v-else>
      <!-- 인사말 -->
      <div class="dashboard__greeting">
        <h1 class="dashboard__greeting-title">{{ greeting }}</h1>
        <p class="dashboard__greeting-sub">{{ summaryText }}</p>
      </div>

      <!-- 요약 카드 -->
      <div class="dashboard__stats">
        <StatCard
          icon="folder"
          icon-bg="#eff3ff"
          label="진행 중 프로젝트"
          :value="activeProjects.length"
        />
        <StatCard
          icon="circle-check"
          icon-bg="#fef3c7"
          label="오늘 할일"
          :value="completedCount"
          :sub="completionSub"
        />
      </div>

      <!-- 오늘 할일 -->
      <TodoQuickList
        :todos="todayTodos"
        @toggle="onToggleTodo"
        @add="onAddTodo"
        @navigate-all="onNavigateTodos"
      />

      <!-- 프로젝트 요약 -->
      <ProjectSummary
        :projects="activeProjects"
        @select="onSelectProject"
        @navigate-all="onNavigateProjects"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.dashboard__greeting {
  margin-bottom: 4px;
}

.dashboard__greeting-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.dashboard__greeting-sub {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.dashboard__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .dashboard__stats {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/DashboardHome.vue
git commit -m "feat: DashboardHome 메인 대시보드 컴포넌트 추가"
```

---

### Task 6: DashboardView 뷰 + 라우팅 + 로고 클릭

**Files:**
- Create: `src/views/DashboardView.vue`
- Modify: `src/router.ts`
- Modify: `src/views/ProjectsView.vue:557`

- [ ] **Step 1: DashboardView.vue 생성**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  UiIcon, UiDropdownMenu, UiConfirm, UiToast,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import DashboardHome from '../components/dashboard/DashboardHome.vue'

const router = useRouter()
const auth = useAuthStore()

// 사이드 메뉴
const menuOpen = ref(false)
const menuItems = [
  { label: 'AI Tools', value: 'ai-tools', icon: 'bot' },
  { label: '프로젝트', value: 'projects', icon: 'folder' },
  { label: '개인할일', value: 'todos', icon: 'check-square' },
  { label: '주식', value: 'stock', icon: 'trending-up' },
]

function onMenuSelect(value: string) {
  menuOpen.value = false
  router.push(`/main?tab=${value}`)
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
        <button class="menu-toggle-btn" @click="menuOpen = !menuOpen">
          <UiIcon :name="menuOpen ? 'x' : 'menu'" :size="20" />
        </button>
        <img src="/logo.svg" alt="CYLEE" class="header-logo" @click="router.push('/')" style="cursor: pointer;" />
      </div>
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

    <!-- 사이드 메뉴 오버레이 -->
    <Transition name="overlay-fade">
      <div v-if="menuOpen" class="menu-overlay" @click="menuOpen = false" />
    </Transition>

    <!-- 사이드 메뉴 패널 -->
    <Transition name="slide-left">
      <nav v-if="menuOpen" class="side-menu">
        <button
          v-for="item in menuItems"
          :key="item.value"
          class="side-menu__item"
          @click="onMenuSelect(item.value)"
        >
          <UiIcon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </Transition>

    <main class="main">
      <DashboardHome />
    </main>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <button
        v-for="item in menuItems"
        :key="item.value"
        class="bottom-nav__item"
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
// ProjectsView와 동일한 레이아웃 스타일 재사용
.layout { min-height: 100vh; padding-top: 56px; padding-bottom: 56px; background: #f8f9fb; }

.header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 101;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px; background: #fff; border-bottom: 1px solid #e6e8ec;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-logo { height: 24px; }
.header-right { display: flex; align-items: center; gap: 12px; }

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

.menu-overlay {
  position: fixed; inset: 0; z-index: 99;
  background: rgba(0, 0, 0, 0.3);
}

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
}

.slide-left-enter-active,
.slide-left-leave-active { transition: transform 0.25s ease; }
.slide-left-enter-from,
.slide-left-leave-to { transform: translateX(-100%); }

.overlay-fade-enter-active,
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from,
.overlay-fade-leave-to { opacity: 0; }

.main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

@media (max-width: 768px) {
  .header { padding: 0 12px; }
  .header-right { gap: 8px; }
  .side-menu { width: 240px; }
  .bottom-nav { gap: 0; justify-content: space-around; padding: 0; }
  .bottom-nav__item {
    flex-direction: column; gap: 2px;
    padding: 6px 12px; font-size: 10px;
  }
  .main { padding: 16px 12px; }
}
</style>
```

**참고:** `ref` import를 `<script setup>` 상단에 추가해야 합니다:
```typescript
import { ref } from 'vue'
```

- [ ] **Step 2: router.ts 수정**

`src/router.ts`를 다음으로 교체:

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('./views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('./views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/main',
      component: () => import('./views/ProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:id',
      component: () => import('./views/ProjectDetailView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// 로그인 안 했으면 /login으로 리다이렉트
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return '/login'
  }
})

export default router
```

- [ ] **Step 3: ProjectsView에서 로고 클릭 시 대시보드로 이동**

`src/views/ProjectsView.vue` 557행의 `<img>` 태그를 수정:

변경 전:
```html
<img src="/logo.svg" alt="CYLEE" class="header-logo" />
```

변경 후:
```html
<img src="/logo.svg" alt="CYLEE" class="header-logo" @click="router.push('/')" style="cursor: pointer;" />
```

- [ ] **Step 4: 브라우저에서 전체 플로우 확인**

1. `http://localhost:5177/` 접속 → 대시보드 표시 확인
2. 인사말 + 요약 카드 + 할일 + 프로젝트 확인
3. 할일 체크 → 토글 동작 확인
4. 빠른 추가 → 새 할일 생성 확인
5. 프로젝트 클릭 → `/projects/:id` 이동 확인
6. "전체보기" 클릭 → `/main?tab=todos`, `/main?tab=projects` 이동 확인
7. CYLEE 로고 클릭 → `/` 대시보드 복귀 확인
8. 하단 탭 클릭 → `/main?tab=...` 이동 확인

- [ ] **Step 5: Commit**

```bash
git add src/views/DashboardView.vue src/router.ts src/views/ProjectsView.vue
git commit -m "feat: 메인 대시보드 뷰, 라우팅, 로고 클릭 연결"
```
