import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

async function main() {
  // 기존 데이터 정리
  await prisma.todo.deleteMany()
  await prisma.issue.deleteMany()
  await prisma.member.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // 사용자 생성
  const password = await bcrypt.hash('1234', 10)

  const chanyong = await prisma.user.create({
    data: { email: 'chanyong@test.com', password, name: '이찬용', role: 'admin' },
  })
  const dahrae = await prisma.user.create({
    data: { email: 'dahrae@test.com', password, name: '홍다래', role: 'member' },
  })
  const jungui = await prisma.user.create({
    data: { email: 'jungui@test.com', password, name: '김정의', role: 'member' },
  })
  const hyunwoo = await prisma.user.create({
    data: { email: 'hyunwoo@test.com', password, name: '김현우', role: 'member' },
  })

  // ── 프로젝트 1: S-Gate 개인성과 ──
  const sgateProject = await prisma.project.create({
    data: {
      name: 'S-Gate 개인성과',
      description: 'KPI/OKR 설정·합의·피드백·평가 시스템 개발 및 QA',
      status: 'active',
      members: {
        create: [
          { userId: chanyong.id, role: 'owner' },
          { userId: dahrae.id, role: 'dev' },
          { userId: jungui.id, role: 'dev' },
          { userId: hyunwoo.id, role: 'dev' },
        ],
      },
    },
  })

  const sgateIssues = [
    // done
    { title: '[KPI 보드] 받은 목표·새 목표 추가 버튼 기간 무관 항상 노출 처리', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 0 },
    { title: '[KPI 보드] 합의 상태 아이콘 표시 (합의요청/취소/반려/합의완료/합의취소)', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 1 },
    { title: '[KPI 보드] 매니저 재설정 후 피드백 삭제 시 [object Object] 오류 수정', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 2 },
    { title: '[OKR 보드] 매니저/공유자 설정 시 구성원·공유 탭 양쪽 표시되는 오류 수정', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 3 },
    { title: '[KPI 보드] KR 속성 상대가중치 % 표기 제거 (KPI만 가중치 표현)', status: 'done', priority: 'mid', assigneeId: chanyong.id, order: 4 },
    // doing
    { title: '[KPI 평가] 평가 점수 소수점 2자리 반올림 처리', status: 'doing', priority: 'mid', assigneeId: dahrae.id, order: 0 },
    { title: '[KPI 설정] 가중치 합계 100% 초과 시 저장 차단 및 안내 메시지', status: 'doing', priority: 'high', assigneeId: chanyong.id, order: 1 },
    // todo
    { title: '[KPI 피드백] 피드백 등록 시 매니저에게 알림 발송', status: 'todo', priority: 'mid', assigneeId: dahrae.id, order: 0 },
    { title: '[KPI 대시보드] 부서별 KPI 달성률 차트 구현', status: 'todo', priority: 'mid', assigneeId: hyunwoo.id, order: 1 },
    { title: '[OKR 보드] 목표 드래그앤드롭 순서 변경', status: 'todo', priority: 'low', assigneeId: chanyong.id, order: 2 },
    { title: '[KPI 설정] 전년도 KPI 목표 복사 기능', status: 'todo', priority: 'low', assigneeId: null, order: 3 },
    { title: '[KPI 평가] 자기평가 미작성 시 제출 차단', status: 'todo', priority: 'high', assigneeId: jungui.id, order: 4 },
    { title: '[OKR 보드] KR 가중치 활성화 시 가중치 합계 표시', status: 'todo', priority: 'mid', assigneeId: chanyong.id, order: 5 },
  ]

  for (const issue of sgateIssues) {
    await prisma.issue.create({
      data: { projectId: sgateProject.id, ...issue },
    })
  }

  // ── 프로젝트 2: TaskFlow MVP ──
  const taskflowProject = await prisma.project.create({
    data: {
      name: 'TaskFlow MVP',
      description: '프로젝트 관리 앱 MVP 개발',
      status: 'active',
      members: {
        create: [
          { userId: chanyong.id, role: 'owner' },
          { userId: dahrae.id, role: 'dev' },
        ],
      },
    },
  })

  const taskflowIssues = [
    { title: '칸반보드 드래그앤드롭 순서 저장', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 0 },
    { title: 'JWT 인증 + 로그인/로그아웃', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 1 },
    { title: '이슈 CRUD API + 모달 UI', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 2 },
    { title: 'Railway 배포 설정', status: 'done', priority: 'mid', assigneeId: chanyong.id, order: 3 },
    { title: '개인할일(Todo) CRUD + 중요도', status: 'doing', priority: 'mid', assigneeId: chanyong.id, order: 0 },
    { title: '이슈 코멘트 기능', status: 'todo', priority: 'mid', assigneeId: dahrae.id, order: 0 },
    { title: '프로젝트 생성/수정 모달', status: 'todo', priority: 'mid', assigneeId: dahrae.id, order: 1 },
    { title: '멤버 초대 기능', status: 'todo', priority: 'low', assigneeId: null, order: 2 },
    { title: '이슈 필터링 (상태/우선순위/담당자)', status: 'todo', priority: 'low', assigneeId: null, order: 3 },
  ]

  for (const issue of taskflowIssues) {
    await prisma.issue.create({
      data: { projectId: taskflowProject.id, ...issue },
    })
  }

  // ── 프로젝트 3: ispark-ui 디자인 시스템 ──
  const designProject = await prisma.project.create({
    data: {
      name: 'ispark-ui 디자인 시스템',
      description: 'Vue 3 UI 컴포넌트 라이브러리 개발 및 Storybook 문서화',
      status: 'active',
      members: {
        create: [
          { userId: chanyong.id, role: 'owner' },
          { userId: dahrae.id, role: 'dev' },
        ],
      },
    },
  })

  const designIssues = [
    { title: 'UiConfirm + openConfirm 컴포저블', status: 'done', priority: 'high', assigneeId: chanyong.id, order: 0 },
    { title: 'UiTable 정렬 기능 (sortable)', status: 'doing', priority: 'mid', assigneeId: dahrae.id, order: 0 },
    { title: 'UiDatePicker 신규 개발', status: 'todo', priority: 'high', assigneeId: chanyong.id, order: 0 },
    { title: 'UiTooltip 뷰포트 밖 위치 자동 조정', status: 'todo', priority: 'mid', assigneeId: dahrae.id, order: 1 },
    { title: 'npm 0.6.0 릴리즈', status: 'todo', priority: 'mid', assigneeId: chanyong.id, order: 2 },
  ]

  for (const issue of designIssues) {
    await prisma.issue.create({
      data: { projectId: designProject.id, ...issue },
    })
  }

  // ── 개인 할일 (이찬용) ──
  const todos = [
    // 업무
    { title: 'KPI 피드백 삭제 오류 핫픽스 배포', done: true, priority: 'high' as const },
    { title: '홍다래 QA 확인 요청 전달', done: true, priority: 'mid' as const },
    { title: 'Railway 환경변수 정리', done: false, priority: 'high' as const },
    { title: 'ispark-ui 0.6.0 체인지로그 작성', done: false, priority: 'mid' as const },
    { title: 'OKR 매니저/공유자 탭 분리 건 김정의 리뷰 요청', done: false, priority: 'mid' as const },
    { title: '칸반보드 성능 최적화 리서치', done: false, priority: 'low' as const },
    { title: '주간 회의 안건 정리', done: false, priority: 'none' as const },
    // 개인
    { title: '베개, 꽈배기 세탁', done: false, priority: 'mid' as const },
    { title: '쇼파뒤 청소', done: false, priority: 'mid' as const },
    { title: '젖병세척기 세척', done: false, priority: 'mid' as const },
    { title: '지영이 집 가서 물건 받아 오기', done: false, priority: 'high' as const },
    { title: '아기침대 바퀴 닦기', done: false, priority: 'low' as const },
    { title: '아기욕조 수세미+바디워시 닦고 말려두기', done: false, priority: 'low' as const },
    { title: '지영이가 준 트레이 물티슈로 닦아두기', done: false, priority: 'low' as const },
  ]

  for (const todo of todos) {
    await prisma.todo.create({
      data: { userId: chanyong.id, ...todo },
    })
  }

  // ── 역량확장 레벨 ──
  await prisma.skillProgress.deleteMany()
  await prisma.skillLevel.deleteMany()

  const skillLevels = [
    {
      order: 1,
      title: 'API 통신 기초',
      description: 'fetch/axios로 백엔드와 대화하는 법',
      icon: '🌐',
      content: `# API 통신 기초

## 핵심 개념
- **HTTP 메서드**: GET(조회), POST(생성), PUT(수정), DELETE(삭제)
- **요청(Request)**: 프론트 → 백엔드로 데이터 보내기
- **응답(Response)**: 백엔드 → 프론트로 결과 받기
- **JSON**: 데이터 교환 형식

## fetch 기본 사용법
\`\`\`javascript
// GET 요청
const res = await fetch('/api/users')
const data = await res.json()

// POST 요청
const res = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '홍길동', email: 'hong@test.com' })
})
\`\`\`

## axios 사용법 (우리 프로젝트 방식)
\`\`\`javascript
import axios from 'axios'

// GET
const { data } = await axios.get('/api/users')

// POST
const { data } = await axios.post('/api/users', {
  name: '홍길동',
  email: 'hong@test.com'
})
\`\`\`

## 실전: TaskFlow에서 쓰는 패턴
\`\`\`typescript
// api/client.ts — axios 인스턴스
import axios from 'axios'
const api = axios.create({ baseURL: '/api' })

// 요청 인터셉터: 토큰 자동 첨부
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = \\\`Bearer \\\${token}\\\`
  return config
})
\`\`\`

## 꿀팁
- **Network 탭**으로 요청/응답 항상 확인하는 습관!
- 에러 시 \`res.status\`부터 확인 (400: 내 잘못, 500: 서버 잘못)
- CORS 에러 → 백엔드에서 허용 설정 필요`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: 'API 통신 퀴즈',
        questions: [
          { q: '새 데이터를 서버에 생성할 때 사용하는 HTTP 메서드는?', options: ['GET', 'POST', 'DELETE', 'PATCH'], answer: 1 },
          { q: 'fetch로 POST 요청 시 body에 데이터를 넣을 때 사용하는 함수는?', options: ['JSON.parse()', 'JSON.stringify()', 'toString()', 'encodeURI()'], answer: 1 },
          { q: 'HTTP 상태코드 404는 무엇을 의미하나?', options: ['성공', '서버 에러', '찾을 수 없음', '권한 없음'], answer: 2 },
          { q: 'axios의 장점이 아닌 것은?', options: ['자동 JSON 변환', '인터셉터 지원', '브라우저 내장', '에러 처리 편리'], answer: 2 },
        ],
      }),
    },
    {
      order: 2,
      title: '상태관리 (Pinia)',
      description: '컴포넌트 간 데이터 공유의 핵심',
      icon: '🍍',
      content: `# 상태관리 with Pinia

## 왜 상태관리가 필요한가?
- 로그인 정보를 여러 컴포넌트에서 써야 할 때
- props 전달이 5단계 이상 깊어질 때 (Prop Drilling)
- 형제 컴포넌트 간 데이터 공유

## Pinia 기본 구조
\`\`\`typescript
// stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // state
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))

  // getters
  const isLoggedIn = computed(() => !!token.value)

  // actions
  function login(userData, tokenStr) {
    user.value = userData
    token.value = tokenStr
    localStorage.setItem('token', tokenStr)
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return { user, token, isLoggedIn, login, logout }
})
\`\`\`

## 컴포넌트에서 사용
\`\`\`vue
<script setup>
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
// auth.user, auth.isLoggedIn, auth.login(), auth.logout()
</script>

<template>
  <div v-if="auth.isLoggedIn">
    {{ auth.user.name }}님 환영합니다
  </div>
</template>
\`\`\`

## 실전: TaskFlow의 auth 스토어
우리 프로젝트의 \`stores/auth.ts\`를 열어보세요!`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: 'Pinia 상태관리 퀴즈',
        questions: [
          { q: 'Pinia에서 스토어를 정의할 때 사용하는 함수는?', options: ['createStore()', 'defineStore()', 'useStore()', 'newStore()'], answer: 1 },
          { q: 'Pinia의 getter에 해당하는 Vue Composition API는?', options: ['ref', 'reactive', 'computed', 'watch'], answer: 2 },
          { q: 'Prop Drilling이란?', options: ['props를 깊이 전달하는 문제', 'prop 타입 검증', 'prop 기본값 설정', 'prop 이벤트 발생'], answer: 0 },
        ],
      }),
    },
    {
      order: 3,
      title: '실전 프로젝트: Mini Todo',
      description: 'CRUD 전체 흐름을 직접 만들어보기',
      icon: '🏗️',
      content: `# 실전: Mini Todo 만들기

## 목표
API 통신 + 상태관리를 합쳐서 Todo CRUD를 처음부터 끝까지 만들어봅니다.

## 전체 흐름
\`\`\`
[사용자 입력] → [컴포넌트] → [API 호출] → [백엔드 라우트] → [DB 저장]
     ↑                                                        ↓
     └──────────── [화면 업데이트] ← [응답 수신] ←─────────────┘
\`\`\`

## Step 1: 백엔드 라우트 만들기
\`\`\`typescript
// routes/miniTodo.ts
router.get('/', async (req, res) => {
  const todos = await prisma.todo.findMany()
  res.json({ data: todos })
})

router.post('/', async (req, res) => {
  const { title } = req.body
  const todo = await prisma.todo.create({ data: { title } })
  res.json({ data: todo })
})
\`\`\`

## Step 2: API 함수 만들기
\`\`\`typescript
// api/miniTodoApi.ts
export async function getTodos() {
  const { data } = await api.get('/mini-todos')
  return data.data
}

export async function createTodo(title: string) {
  const { data } = await api.post('/mini-todos', { title })
  return data.data
}
\`\`\`

## Step 3: 컴포넌트 만들기
\`\`\`vue
<script setup>
import { ref, onMounted } from 'vue'
import { getTodos, createTodo } from '../api/miniTodoApi'

const todos = ref([])
const newTitle = ref('')

onMounted(async () => {
  todos.value = await getTodos()
})

async function addTodo() {
  const todo = await createTodo(newTitle.value)
  todos.value.push(todo)
  newTitle.value = ''
}
</script>
\`\`\`

## 도전 과제
1. 삭제 기능 추가 (DELETE 요청)
2. 완료 토글 추가 (PATCH 요청)
3. 에러 처리 추가 (try/catch)`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: 'CRUD 흐름 퀴즈',
        questions: [
          { q: 'CRUD에서 U는 무엇을 의미하나?', options: ['Upload', 'Update', 'User', 'Undo'], answer: 1 },
          { q: 'REST API에서 데이터 삭제에 사용하는 메서드는?', options: ['POST', 'PUT', 'PATCH', 'DELETE'], answer: 3 },
          { q: 'Prisma에서 하나의 레코드를 생성하는 메서드는?', options: ['create()', 'insert()', 'add()', 'save()'], answer: 0 },
        ],
      }),
    },
    {
      order: 4,
      title: '컴포넌트 설계 패턴',
      description: 'props, emit, slot으로 재사용 가능한 컴포넌트 만들기',
      icon: '🧩',
      content: `# 컴포넌트 설계 패턴

## Props: 부모 → 자식 데이터 전달
\`\`\`vue
<!-- 자식: UserCard.vue -->
<script setup>
defineProps<{
  name: string
  role: 'admin' | 'member'
  avatar?: string
}>()
</script>

<!-- 부모 -->
<UserCard name="이찬용" role="admin" />
\`\`\`

## Emit: 자식 → 부모 이벤트 전달
\`\`\`vue
<!-- 자식: DeleteButton.vue -->
<script setup>
const emit = defineEmits<{
  confirm: [id: number]
  cancel: []
}>()
</script>

<template>
  <button @click="emit('confirm', 123)">삭제</button>
</template>

<!-- 부모 -->
<DeleteButton @confirm="handleDelete" />
\`\`\`

## Slot: 컴포넌트 내부에 커스텀 콘텐츠
\`\`\`vue
<!-- Card.vue -->
<template>
  <div class="card">
    <div class="card__header">
      <slot name="header" />
    </div>
    <div class="card__body">
      <slot />  <!-- default slot -->
    </div>
  </div>
</template>

<!-- 사용 -->
<Card>
  <template #header>제목입니다</template>
  <p>본문 내용</p>
</Card>
\`\`\`

## 실전: ispark-ui의 UiDrawer 분석
우리 디자인 시스템의 UiDrawer가 slot을 어떻게 쓰는지 확인해보세요!`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: '컴포넌트 패턴 퀴즈',
        questions: [
          { q: '자식 컴포넌트에서 부모에게 이벤트를 보내려면?', options: ['props', 'emit', 'provide', 'ref'], answer: 1 },
          { q: '컴포넌트 내부에 자유로운 콘텐츠를 넣으려면?', options: ['props', 'emit', 'slot', 'ref'], answer: 2 },
          { q: 'defineProps에서 타입을 지정하는 방식은?', options: ['defineProps([])', 'defineProps<{}>()', 'defineProps(function)', 'defineProps(class)'], answer: 1 },
        ],
      }),
    },
    {
      order: 5,
      title: 'TypeScript 실전',
      description: '타입으로 버그를 미리 잡는 기술',
      icon: '🔷',
      content: `# TypeScript 실전

## 왜 TypeScript?
- 오타를 코드 작성 시점에 잡아준다
- 자동완성이 강력해진다
- 팀 협업 시 인터페이스가 문서 역할

## 기본 타입
\`\`\`typescript
// 원시 타입
const name: string = '이찬용'
const age: number = 30
const active: boolean = true

// 배열
const tags: string[] = ['vue', 'ts']

// 객체 — interface
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'  // 유니온 타입
}
\`\`\`

## Vue에서 TypeScript
\`\`\`vue
<script setup lang="ts">
interface Todo {
  id: number
  title: string
  done: boolean
}

const todos = ref<Todo[]>([])

// props 타입
defineProps<{
  items: Todo[]
  loading: boolean
}>()

// emit 타입
defineEmits<{
  save: [data: Todo]
  delete: [id: number]
}>()
\`\`\`

## 실전: TaskFlow의 타입 정의
\`types/stock.ts\`를 열어서 타입 구조를 확인해보세요!`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: 'TypeScript 퀴즈',
        questions: [
          { q: '여러 값 중 하나만 허용하는 타입은?', options: ['generic', 'union', 'intersection', 'enum'], answer: 1 },
          { q: 'interface와 type의 공통점은?', options: ['객체 구조 정의', '함수 실행', '변수 선언', 'DOM 조작'], answer: 0 },
          { q: 'ref<Todo[]>()에서 <>안의 역할은?', options: ['기본값 지정', '제네릭 타입 지정', '이벤트 바인딩', '스타일 지정'], answer: 1 },
          { q: '선택적 속성을 표현하는 기호는?', options: ['!', '&', '?', '*'], answer: 2 },
        ],
      }),
    },
    {
      order: 6,
      title: '배포 & CI/CD',
      description: 'GitHub Actions로 자동 배포 파이프라인 만들기',
      icon: '🚀',
      content: `# 배포 & CI/CD

## 배포 흐름
\`\`\`
코드 작성 → git push → GitHub Actions → 빌드 → 배포
\`\`\`

## GitHub Actions 기본 구조
\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test
\`\`\`

## 우리 프로젝트의 배포
\`\`\`
1. git push origin main
2. GitHub Actions 자동 트리거
3. 프론트엔드 빌드 (Vite)
4. 백엔드 빌드 (TypeScript → JS)
5. Railway/Vercel 자동 배포
\`\`\`

## 환경 변수 관리
\`\`\`bash
# .env (로컬 — git에 올리지 않음!)
DATABASE_URL=postgresql://...
JWT_SECRET=my-secret-key

# Railway/Vercel 대시보드에서 설정
# Settings → Environment Variables
\`\`\`

## 도전 과제
1. GitHub Actions에서 lint 자동 실행 추가해보기
2. PR 올릴 때만 테스트 돌리는 워크플로우 만들기`,
      challenge: JSON.stringify({
        type: 'quiz',
        title: '배포/CI 퀴즈',
        questions: [
          { q: 'CI/CD에서 CI는 무엇의 약자?', options: ['Continuous Integration', 'Code Inspection', 'Cloud Infrastructure', 'Commit Injection'], answer: 0 },
          { q: '.env 파일을 git에 올리면 안 되는 이유는?', options: ['파일이 너무 커서', '비밀 정보 노출', '빌드 속도 저하', '문법 에러 발생'], answer: 1 },
          { q: 'GitHub Actions가 트리거되는 시점은?', options: ['파일 저장 시', 'git push 시', '브라우저 새로고침 시', '서버 재시작 시'], answer: 1 },
        ],
      }),
    },
  ]

  for (const level of skillLevels) {
    await prisma.skillLevel.create({ data: level })
  }

  console.log('시드 완료!')
  console.log(`  사용자: 4명 (이찬용, 홍다래, 김정의, 김현우)`)
  console.log(`  프로젝트: 3개 (S-Gate 개인성과, TaskFlow MVP, ispark-ui)`)
  console.log(`  이슈: ${sgateIssues.length + taskflowIssues.length + designIssues.length}개`)
  console.log(`  할일: ${todos.length}개`)
  console.log(`  역량확장: ${skillLevels.length}개 레벨`)
  console.log(`  로그인: chanyong@test.com / 1234`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
