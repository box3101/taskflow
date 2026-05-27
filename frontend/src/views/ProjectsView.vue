<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu,
  UiTab, UiInput, UiButton, UiCheckbox, UiSelect, UiTextarea,
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
  { label: '주식', value: 'stock' },
]

// ── 주식 마음가짐 ──
interface StockHolding {
  name: string
  buyPrice: string
  targetPrice: string
  buyDate: string // YYYY-MM-DD
}

interface MindsetEntry {
  date: string
  text: string
}

// 어드바이저 목록 (서브에이전트 토론)
interface Advisor {
  name: string
  role: string
  emoji: string
  quotes: string[]
}

const advisors: Advisor[] = [
  {
    name: '법정스님',
    role: '선사',
    emoji: '🧘',
    quotes: [
      '욕심을 내려놓으면 이미 가진 것이 보입니다. 주가도 마찬가지입니다.',
      '흔들리는 마음은 시장이 아니라 내 안에 있습니다. 고요히 앉아 지켜보세요.',
      '나무는 매일 뽑아보지 않습니다. 뿌리를 믿고 기다리세요.',
      '잠깐의 하락은 파도입니다. 바다 자체가 사라지는 건 아닙니다.',
      '팔고 싶은 마음이 올 때, 그 마음을 먼저 관찰하세요. 두려움인가, 탐욕인가.',
      '기다림이란, 아무것도 하지 않는 것이 아니라 흔들리지 않는 것입니다.',
    ],
  },
  {
    name: '심리학자',
    role: '행동경제학 전문가',
    emoji: '🧠',
    quotes: [
      '손실 회피 편향: 잃는 고통은 얻는 기쁨의 2.5배입니다. 매도 충동은 본능이지 이성이 아닙니다.',
      '후회 회피: "팔았는데 올랐으면?" 이 두려움이 지금 당신을 흔드는 겁니다. 계획을 믿으세요.',
      '군중심리에 휘둘리지 마세요. 남들이 팔 때 당신의 원칙이 시험받습니다.',
      '확증 편향 주의: 하락 뉴스만 찾고 있다면, 당신의 뇌가 매도를 정당화하려는 겁니다.',
      '감정적 매매의 수익률은 -7% 이하. 규칙 기반 투자가 이기는 이유입니다.',
      '오늘의 불안은 내일의 "왜 안 들고 있었지?"가 됩니다. 시간은 투자자의 편입니다.',
    ],
  },
  {
    name: '워런 버핏',
    role: '전설의 투자자',
    emoji: '👴',
    quotes: [
      '주식시장은 인내심 없는 사람의 돈을 인내심 있는 사람에게 옮기는 장치입니다.',
      '10년 이상 보유할 생각이 없으면 10분도 보유하지 마세요.',
      '공포에 사고, 탐욕에 팔아라. 지금 공포를 느끼고 있다면, 팔 때가 아닙니다.',
      '가장 좋은 투자 기간은 "거의 영원히"입니다.',
      '엉덩이로 번 돈이 머리로 번 돈보다 많습니다. 앉아 있으세요.',
      '좋은 기업의 주식은 시간이 갈수록 빛납니다. 반도체는 미래 그 자체입니다.',
    ],
  },
  {
    name: '스토아 철학자',
    role: '에픽테토스',
    emoji: '🏛️',
    quotes: [
      '주가는 내가 통제할 수 없습니다. 내가 통제할 수 있는 것은 나의 반응뿐입니다.',
      '오늘의 하락에 동요하는가? 그것은 당신의 판단이지, 현실이 아닙니다.',
      '부는 인내의 결과물입니다. 조급함은 가난의 씨앗입니다.',
      '어떤 일이든 일어나야 할 일이 일어납니다. 당신은 준비되어 있으면 됩니다.',
      '매일 아침 물으세요 - 오늘 내가 통제할 수 있는 것은 무엇인가?',
      '자유란 욕망의 노예가 되지 않는 것입니다. 매도 버튼에서 손을 떼세요.',
    ],
  },
  {
    name: '전직 트레이더',
    role: '현실주의자',
    emoji: '📊',
    quotes: [
      '사팔사팔 수수료만 증권사 배불립니다. 당신의 수익률을 갉아먹는 건 시장이 아니라 매매 횟수입니다.',
      'SK하이닉스 HBM AI 수요: 매출 전년비 +40%. 팔아야 할 이유가 어디에 있습니까?',
      '단타 성공률 5% 미만. 나머지 95%는 장기투자자에게 돈을 바칩니다.',
      '차트를 끄세요. 5분봉은 당신의 적입니다. 분기 실적만 보세요.',
      '팔고 나서 오른 적이 더 많지 않습니까? 그게 답입니다.',
      '매일 호가창 들여다보는 시간에 본업에 집중하세요. 그게 진짜 수익입니다.',
    ],
  },
]

// 오늘 날짜 포맷
function getToday() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function formatDateKR(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

// 날짜 기반으로 어드바이저 3명 선택 + 각각 명언 1개
function getDailyAdvisorPanel(dateStr: string) {
  const seed = dateStr.split('-').join('')
  const num = parseInt(seed, 10)
  const panel: { advisor: Advisor; quote: string }[] = []
  const indices = [0, 1, 2, 3, 4]
  // 날짜별로 3명 선택 (셔플)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (num + i * 7) % (i + 1)
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  for (let k = 0; k < 3; k++) {
    const advisor = advisors[indices[k]]
    const quoteIdx = (num + k * 3) % advisor.quotes.length
    panel.push({ advisor, quote: advisor.quotes[quoteIdx] })
  }
  return panel
}

// 보유 기간 계산
function getHoldingDays(buyDate: string) {
  if (!buyDate) return 0
  const buy = new Date(buyDate + 'T00:00:00')
  const now = new Date()
  return Math.floor((now.getTime() - buy.getTime()) / (1000 * 60 * 60 * 24))
}

// localStorage 키
const STORAGE_MINDSET = 'stock-mindsets'
const STORAGE_HOLDINGS = 'stock-holdings'

// 상태
const stockLoaded = ref(false)
const todayMindset = ref('')
const mindsetSaved = ref(false)
const holdings = ref<StockHolding[]>([])
const mindsetHistory = ref<MindsetEntry[]>([])
const dailyPanel = computed(() => getDailyAdvisorPanel(getToday()))

// 연속 기록 일수
const streak = computed(() => {
  let count = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (mindsetHistory.value.some(m => m.date === key)) {
      count++
    } else {
      break
    }
  }
  return count
})

function loadStockData() {
  // 마음가짐 로드
  const raw = localStorage.getItem(STORAGE_MINDSET)
  const entries: MindsetEntry[] = raw ? JSON.parse(raw) : []
  mindsetHistory.value = entries.sort((a, b) => b.date.localeCompare(a.date))

  const todayEntry = entries.find(e => e.date === getToday())
  if (todayEntry) {
    todayMindset.value = todayEntry.text
    mindsetSaved.value = true
  }

  // 보유 종목 로드
  const holdRaw = localStorage.getItem(STORAGE_HOLDINGS)
  holdings.value = holdRaw ? JSON.parse(holdRaw) : [
    { name: 'SK하이닉스', buyPrice: '', targetPrice: '', buyDate: getToday() },
  ]
}

function saveMindset() {
  if (!todayMindset.value.trim()) return
  const entries: MindsetEntry[] = JSON.parse(localStorage.getItem(STORAGE_MINDSET) || '[]')
  const text = todayMindset.value.trim()
  const idx = entries.findIndex(e => e.date === getToday())
  if (idx >= 0) {
    entries[idx].text = text
  } else {
    entries.push({ date: getToday(), text })
  }
  localStorage.setItem(STORAGE_MINDSET, JSON.stringify(entries))
  mindsetHistory.value = entries.sort((a, b) => b.date.localeCompare(a.date))
  todayMindset.value = ''
  mindsetSaved.value = true
  setTimeout(() => { mindsetSaved.value = false }, 2000)
}

function saveHoldings() {
  localStorage.setItem(STORAGE_HOLDINGS, JSON.stringify(holdings.value))
}

function addHolding() {
  holdings.value.push({ name: '', buyPrice: '', targetPrice: '', buyDate: getToday() })
  saveHoldings()
}

function removeHolding(idx: number) {
  holdings.value.splice(idx, 1)
  saveHoldings()
}

const holdingsSaved = ref(false)

function onSaveHoldings() {
  saveHoldings()
  holdingsSaved.value = true
  setTimeout(() => { holdingsSaved.value = false }, 2000)
}

// ── 프로젝트 ──
const projectLoading = ref(true)
const projects = ref<any[]>([])
const projectColumns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center' },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center' },
]

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
  if (val === 'stock' && !stockLoaded.value) {
    stockLoaded.value = true
    loadStockData()
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
        </UiTable>
      </div>

      <!-- 주식 마음가짐 탭 -->
      <div v-if="activeTab === 'stock'" class="tab-content stock-tab">
        <!-- 오늘의 어드바이저 토론 -->
        <div class="stock-section advisor-panel">
          <div class="section-header">
            <h3>🎙️ 오늘의 어드바이저 토론</h3>
            <span class="section-date">{{ formatDateKR(getToday()) }}</span>
          </div>
          <div class="advisor-cards">
            <div
              v-for="(item, i) in dailyPanel"
              :key="i"
              class="advisor-card"
            >
              <div class="advisor-header">
                <span class="advisor-emoji">{{ item.advisor.emoji }}</span>
                <div>
                  <div class="advisor-name">{{ item.advisor.name }}</div>
                  <div class="advisor-role">{{ item.advisor.role }}</div>
                </div>
              </div>
              <p class="advisor-quote">"{{ item.quote }}"</p>
            </div>
          </div>
        </div>

        <!-- 오늘의 마음가짐 -->
        <div class="stock-section mindset-card">
          <div class="section-header">
            <h3>✍️ 오늘의 마음가짐</h3>
            <UiBadge v-if="streak > 0" variant="success" size="sm">
              🔥 {{ streak }}일 연속
            </UiBadge>
          </div>
          <UiTextarea
            v-model="todayMindset"
            placeholder="오늘의 투자 마음가짐을 적어보세요... (예: 하이닉스 홀딩. 단타 금지. 흔들리지 말자.)"
            :rows="3"
            border
          />
          <div class="mindset-actions">
            <UiButton
              @click="saveMindset"
              :variant="mindsetSaved ? 'success' : 'primary'"
              :disabled="!todayMindset.trim()"
            >
              {{ mindsetSaved ? '✓ 저장됨' : '저장' }}
            </UiButton>
          </div>
        </div>

        <!-- 보유 종목 -->
        <div class="stock-section holdings-card">
          <div class="section-header">
            <h3>📈 보유 종목</h3>
            <UiButton size="sm" variant="ghost" @click="addHolding">+ 종목 추가</UiButton>
          </div>
          <div v-for="(h, idx) in holdings" :key="idx" class="holding-item">
            <div class="holding-top">
              <UiInput v-model="h.name" placeholder="종목명" class="holding-name" />
              <button v-if="holdings.length > 1" class="holding-remove" @click="removeHolding(idx)">
                <i class="icon-close size-16" />
              </button>
            </div>
            <div class="holding-fields">
              <div class="holding-field">
                <label>매수가</label>
                <UiInput v-model="h.buyPrice" placeholder="0" size="sm" />
              </div>
              <div class="holding-field">
                <label>목표가</label>
                <UiInput v-model="h.targetPrice" placeholder="0" size="sm" />
              </div>
              <div class="holding-field">
                <label>매수일</label>
                <input type="date" v-model="h.buyDate" class="date-input" />
              </div>
            </div>
            <div v-if="h.buyDate" class="holding-counter">
              <span class="holding-days">D+{{ getHoldingDays(h.buyDate) }}</span>
              <span class="holding-msg">
                {{ getHoldingDays(h.buyDate) < 30 ? '아직 초반입니다. 인내심을 가지세요.' :
                   getHoldingDays(h.buyDate) < 90 ? '좋습니다! 3개월 목표를 향해 가고 있습니다.' :
                   getHoldingDays(h.buyDate) < 180 ? '훌륭합니다! 반년 이상 홀딩 중.' :
                   getHoldingDays(h.buyDate) < 365 ? '대단합니다! 진정한 투자자의 길.' :
                   '🏆 1년 이상 홀딩! 워런 버핏이 박수를 보냅니다.' }}
              </span>
            </div>
          </div>
          <div class="holdings-actions">
            <UiButton variant="primary" size="sm" @click="onSaveHoldings">
              {{ holdingsSaved ? '✓ 저장됨' : '저장' }}
            </UiButton>
          </div>
        </div>

        <!-- 마음가짐 히스토리 -->
        <div v-if="mindsetHistory.length > 0" class="stock-section history-card">
          <div class="section-header">
            <h3>📝 마음가짐 기록</h3>
          </div>
          <div class="history-list">
            <div
              v-for="entry in mindsetHistory"
              :key="entry.date"
              class="history-item"
              :class="{ 'history-item--today': entry.date === getToday() }"
            >
              <div class="history-date">{{ formatDateKR(entry.date) }}</div>
              <div class="history-text">{{ entry.text }}</div>
            </div>
          </div>
        </div>
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
.main { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
.tab-content { margin-top: 24px; }

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

// 주식 탭
.stock-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stock-section {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .section-date {
    font-size: 13px;
    color: #9ca3af;
  }
}

// 어드바이저 패널
.advisor-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advisor-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

.advisor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.advisor-emoji {
  font-size: 28px;
  line-height: 1;
}

.advisor-name {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}

.advisor-role {
  font-size: 12px;
  color: #6b7280;
}

.advisor-quote {
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  margin: 0;
  padding-left: 38px;
  font-style: italic;
}

// 마음가짐
.mindset-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

// 보유 종목
.holding-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.holding-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.holding-name {
  flex: 1;
}

.holding-remove {
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

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

.holding-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.holding-field {
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 4px;
  }
}

.date-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dce4e9;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
}

.holding-counter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.holding-days {
  font-size: 20px;
  font-weight: 800;
  color: #4f6af6;
  white-space: nowrap;
}

.holding-msg {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.holdings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

// 히스토리
.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 12px;
  border-bottom: 1px solid #f0f1f3;

  &:last-child {
    border-bottom: none;
  }

  &--today {
    background: #eff6ff;
    border-radius: 8px;
    border-bottom: none;
    margin-bottom: 4px;
  }
}

.history-date {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  margin-bottom: 4px;
}

.history-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}
</style>
