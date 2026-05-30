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

// 대시보드용 할일 필터 (미완료 + 7일 이내 마감 또는 마감일 없음)
const todayTodos = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return todos.value.filter(t => {
    if (t.done) return false
    if (!t.dueDate) return true
    const due = new Date(t.dueDate)
    due.setHours(0, 0, 0, 0)
    return due.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000
  }).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })
})

// 미완료 할일 수
const todayTodoCount = computed(() =>
  todos.value.filter(t => !t.done).length
)

// 완료 수 / 전체
const completedCount = computed(() => todos.value.filter(t => t.done).length)
const completionSub = computed(() => `/${todos.value.length}`)

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
