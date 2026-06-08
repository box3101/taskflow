<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiLoading, openToast } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/client'
import type { Todo } from '../../types/todo'
import DailyQuote from './DailyQuote.vue'
import StatCard from './StatCard.vue'
import TodoQuickList from './TodoQuickList.vue'
import ProjectSummary from './ProjectSummary.vue'
import WeatherOutfit from './WeatherOutfit.vue'
import MoodWidget from './MoodWidget.vue'
import CalendarWidget from '../calendar/CalendarWidget.vue'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const projects = ref<any[]>([])
const todos = ref<Todo[]>([])

// 시간대별 인사말
const greeting = computed(() => {
  const h = new Date().getHours()
  const name = auth.user?.name || ''
  if (h < 12) return `${name}님, 좋은 아침이에요 👋`
  if (h < 18) return `${name}님, 좋은 오후예요 👋`
  return `${name}님, 좋은 저녁이에요 👋`
})

// 진행 중 프로젝트
const activeProjects = computed(() =>
  projects.value.filter(p => p.status === 'active')
)

// 대시보드용 할일 필터 (미완료 + 7일 이내 마감)
const todayTodos = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayDay = now.getDay() // 0=일~6=토

  return todos.value.filter(t => {
    if (t.done) return false

    // 마감일 없는 경우: 반복 할일이면 오늘이 해당 요일인지 확인
    if (!t.dueDate) {
      if (t.repeatType === 'daily') return true
      if (t.repeatType === 'weekly') return t.repeatDay === todayDay
      if (t.repeatType === 'monthly') return now.getDate() === t.repeatDay
      return true // 반복 아닌 마감일 없는 할일은 표시
    }

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

// 미완료 할일 수 (대시보드에 표시되는 todayTodos 기준)
const todayTodoCount = computed(() => todayTodos.value.length)

// 완료 수 / 전체 (전체 기준)
const completedCount = computed(() => todos.value.filter(t => t.done).length)
const totalCount = computed(() => todos.value.length)
const completionSub = computed(() => `/${totalCount.value}`)

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

// 식욕 억제 문구 (밤 9시 이후, chanyong만)
const appetiteMessages = [
  '공복이 불편한 게 아니라, 공복을 참지 못하는 마음이 불편한 거다.',
  '하윤이 아빠는 오래 건강해야 한다.',
  '40대에 후회할 몸을 30대에 만들지 마라.',
  '지금 참는 한 끼가, 내일의 자존감이 된다.',
  '배고픔은 30분이면 지나간다. 후회는 내일까지 간다.',
  '몸이 가벼워야 마음도 가볍다.',
  '오늘 밤 참으면, 내일 아침 거울이 웃는다.',
]
const showAppetiteMsg = computed(() => {
  return auth.user?.email === 'chanyong@test.com'
})
const appetiteIdx = ref(Math.floor(Math.random() * appetiteMessages.length))
const appetiteMsg = computed(() => appetiteMessages[appetiteIdx.value])

// 10초마다 슬라이드
let appetiteTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  appetiteTimer = setInterval(() => {
    appetiteIdx.value = (appetiteIdx.value + 1) % appetiteMessages.length
  }, 10000)
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
  router.push('/projects')
}

function onNavigateTodos() {
  router.push('/todos')
}
</script>

<template>
  <div class="dashboard">
    <UiLoading v-if="loading" overlay />

    <template v-else>
      <!-- 인사말 (한 줄) -->
      <div class="dashboard__greeting">
        <h1 class="dashboard__greeting-title">
          {{ greeting }}
          <span class="dashboard__greeting-sub">{{ summaryText }}</span>
        </h1>
      </div>

      <!-- 식욕 억제 문구 (chanyong@test.com만) -->
      <Transition name="fade" mode="out-in">
        <div v-if="showAppetiteMsg" :key="appetiteIdx" class="dashboard__appetite">
          <span class="dashboard__appetite-icon">🧘</span>
          <span class="dashboard__appetite-text">{{ appetiteMsg }}</span>
        </div>
      </Transition>

      <!-- 명언 + 기분/날씨 (2열 grid = StatCard와 폭 동일) -->
      <div class="dashboard__quote-weather">
        <DailyQuote class="dashboard__quote" />
        <div class="dashboard__mood-weather">
          <MoodWidget />
          <WeatherOutfit />
        </div>
      </div>

      <!-- 요약 카드 -->
      <div class="dashboard__stats">
        <StatCard
          icon="folder"
          icon-bg="#eef2ff"
          icon-color="#4f6af6"
          label="진행 중 프로젝트"
          :value="activeProjects.length"
        />
        <StatCard
          icon="circle-check"
          icon-bg="#fef3c7"
          icon-color="#d97706"
          label="할일 완료"
          :value="completedCount"
          :sub="completionSub"
        />
      </div>

      <!-- 프로젝트 + 할일 + 일정 (PC: 3열, 모바일: 세로) -->
      <div class="dashboard__content">
        <ProjectSummary
          :projects="activeProjects"
          @select="onSelectProject"
          @navigate-all="onNavigateProjects"
        />
        <TodoQuickList
          :todos="todayTodos"
          @add="onAddTodo"
          @navigate-all="onNavigateTodos"
        />
        <CalendarWidget />
      </div>
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

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dashboard__appetite {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #f0fdf4;
  border-radius: 10px;
  margin-bottom: 4px;
}
.dashboard__appetite-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.dashboard__appetite-text {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  line-height: 1.5;
  font-style: italic;
}
.dashboard__greeting {
  margin-bottom: 4px;
}

.dashboard__greeting-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard__greeting-sub {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
}

.dashboard__quote-weather {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: stretch;
}

.dashboard__quote {
  min-width: 0;
}

/* 기분+날씨를 오른쪽 1fr 안에서 나란히 */
.dashboard__mood-weather {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.dashboard__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.dashboard__content {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
  > * { min-width: 0; overflow: hidden; }
}

@media (max-width: 1024px) {
  .dashboard__content {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard__content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard__stats {
    grid-template-columns: 1fr;
  }

  .dashboard__quote-weather {
    grid-template-columns: 1fr;
  }

  .dashboard__mood-weather {
    flex-direction: column;
  }

  .dashboard__greeting-sub,
  .dashboard__greeting {
    display: none;
  }

  .dashboard__quote {
    display: none;
  }

  .dashboard__mood-weather :deep(.mood-widget) {
    display: none;
  }
}
</style>
