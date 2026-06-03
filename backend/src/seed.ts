import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

async function main() {
  // 기존 데이터 정리
  await prisma.aiTool.deleteMany()
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

  // ── 개인 할일 (이찬용) — 대화 로그에서 복구한 실데이터 ──
  const todos = [
    { title: '베개, 꽈배기 세탁', done: false, dueDate: new Date('2026-06-20') },
    { title: '쇼파뒤 청소', done: false, dueDate: new Date('2026-06-20') },
    { title: '젖병세척기 세척', done: false, dueDate: new Date('2026-06-20') },
    { title: '아기침대 바퀴 닦기', done: false, dueDate: new Date('2026-06-20') },
    { title: '아기욕조 수세미+바디워시 닦고 말려두기', done: false, dueDate: new Date('2026-06-20') },
    { title: '지영이가 준 트레이 받고 물티슈로 닦아두기', done: false, dueDate: new Date('2026-06-20') },
    { title: '출생신고', done: false, dueDate: new Date('2026-06-01'), memo: '① 병원 → 출생증명서 수령\n② 부평구 OO동 행정복지센터 (도보 or 차)\n   - 출생신고 (이도윤)\n   - 가족관계증명서 새로 발급\n   - 행복출산 원스톱 서비스 일괄 신청\n     ↳ 첫만남이용권 300만원\n     ↳ 부모급여\n     ↳ 아동수당\n     ↳ 부평구 출산지원금 50만원\n     ↳ 전기요금 감면\n     ↳ 다자녀 우대 자동 등록\n③ NH농협 부평지점 → 아이모아카드 신청\n④ 정부24 (온라인) → 천사지원금 신청 (생일 후 120일 내, 급할 거 없음)\n⑤ 한전 123 전화 or 사이버지점 → 출산가구 전기요금 감면 확인' },
    { title: '하윤이견학준비물', done: false, dueDate: new Date('2026-06-04'), memo: '몸빼바지, 상의자유복, 크롭스 / 자연간식, 여름 티셔츠 (물총 놀이 후)' },
    { title: '하윤이등원', done: false, dueDate: null, memo: '출근 8시 25분 / 퇴근 5시 20분' },
    { title: '사랑니', done: false, dueDate: new Date('2026-06-03') },
  ]

  for (const todo of todos) {
    await prisma.todo.create({
      data: { userId: chanyong.id, ...todo },
    })
  }

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
        type: 'code',
        title: 'API 통신 실습',
        runnable: true,
        exercises: [
          { difficulty: 'easy', description: 'TaskFlow 헬스체크 API를 호출해보세요', code: "const res = await {{BLANK:HTTP 요청 함수}}('/health')\nconst data = await res.{{BLANK:JSON 변환 메서드}}()\nconsole.log(data)", answers: ['fetch', 'json'], alternateAnswers: [['window.fetch'], []], explanation: 'fetch()는 브라우저 내장 HTTP 클라이언트입니다. .json()으로 응답을 JSON 객체로 변환합니다.' },
          { difficulty: 'medium', description: 'POST 요청으로 데이터를 보내보세요', code: "const res = await fetch('/health', {\n  {{BLANK:HTTP 메서드 지정}}: 'POST',\n  headers: { '{{BLANK:컨텐츠 타입 헤더}}': 'application/json' },\n  body: JSON.stringify({ test: true })\n})\nconsole.log(res.status)", answers: ['method', 'Content-Type'], explanation: "method 속성으로 HTTP 메서드를 지정하고, Content-Type 헤더로 본문 형식을 알려줍니다." },
          { difficulty: 'hard', description: '에러 핸들링을 추가해보세요', code: "{{BLANK:에러 처리 시작}} {\n  const res = await fetch('/health')\n  if (!res.{{BLANK:응답 성공 여부}}) throw new Error('실패')\n  console.log('성공:', await res.json())\n} {{BLANK:에러 처리 끝}} (e) {\n  console.log('에러:', e.message)\n}", answers: ['try', 'ok', 'catch'], explanation: "try/catch로 네트워크 에러를 잡고, res.ok로 HTTP 상태를 확인합니다." },
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
        type: 'code',
        title: '상태관리 실습',
        runnable: true,
        exercises: [
          { difficulty: 'easy', description: '간단한 상태 객체를 만들고 값을 변경해보세요', code: "const state = { count: 0, name: '홍길동' }\nstate.{{BLANK:카운트 속성}} = 10\nconsole.log(state.count)\nconsole.log(state.{{BLANK:이름 속성}})", answers: ['count', 'name'], explanation: "객체의 속성에 직접 접근하여 값을 읽고 쓸 수 있습니다. 이것이 상태관리의 기본입니다." },
          { difficulty: 'medium', description: '옵저버 패턴으로 상태 변경을 감지해보세요', code: "const listeners = []\nfunction subscribe(fn) { listeners.{{BLANK:배열에 추가하는 메서드}}(fn) }\nfunction notify(val) { listeners.forEach(fn => fn(val)) }\n\nsubscribe(v => console.log('변경됨:', v))\n{{BLANK:구독자에게 알리는 함수}}('새로운 값')", answers: ['push', 'notify'], explanation: "subscribe로 리스너를 등록하고, notify로 모든 리스너에게 변경을 알립니다. Pinia도 내부적으로 이 패턴을 씁니다." },
          { difficulty: 'hard', description: '스토어 패턴을 직접 구현해보세요', code: "function createStore(initial) {\n  let state = { ...initial }\n  const getState = () => ({ ...state })\n  const {{BLANK:상태 변경 함수}}= (key, val) => { state[key] = val }\n  return { getState, {{BLANK:위에서 정의한 함수}} }\n}\nconst store = createStore({ user: null, token: '' })\nstore.setState('user', '이찬용')\nconsole.log(store.getState())", answers: ['setState', 'setState'], explanation: "getState로 현재 상태를 읽고, setState로 변경합니다. 이것이 Pinia defineStore의 핵심 구조입니다." },
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
        type: 'code',
        title: 'CRUD 실습',
        runnable: true,
        exercises: [
          { difficulty: 'easy', description: 'GET 요청으로 헬스체크를 조회해보세요', code: "const res = await {{BLANK:요청 함수}}('/health')\nconst data = await res.json()\nconsole.log('상태:', data.{{BLANK:상태 속성}})", answers: ['fetch', 'status'], explanation: "fetch()로 GET 요청을 보내고, 응답 JSON의 status 필드를 읽습니다." },
          { difficulty: 'medium', description: 'POST 요청으로 새 데이터를 만들어보세요', code: "const body = { title: '새 할일' }\nconst res = await fetch('/health', {\n  method: '{{BLANK:생성 메서드}}',\n  headers: { 'Content-Type': '{{BLANK:JSON 미디어타입}}' },\n  body: JSON.stringify(body)\n})\nconsole.log('응답 코드:', res.status)", answers: ['POST', 'application/json'], explanation: "POST 메서드로 새 리소스를 생성합니다. Content-Type을 application/json으로 지정해야 서버가 JSON을 파싱합니다." },
          { difficulty: 'hard', description: '완전한 CRUD 흐름을 작성해보세요', code: "// 조회\nconst list = await (await fetch('/health')).json()\nconsole.log('조회:', list)\n\n// 생성\nconst created = await fetch('/health', {\n  method: '{{BLANK:생성}}',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ title: 'test' })\n})\nconsole.log('생성:', created.{{BLANK:상태코드 속성}})\n\n// 삭제\nconst deleted = await fetch('/health', { method: '{{BLANK:삭제}}' })\nconsole.log('삭제:', deleted.status)", answers: ['POST', 'status', 'DELETE'], explanation: "CRUD: Create(POST), Read(GET), Update(PUT/PATCH), Delete(DELETE). status 속성으로 응답 코드를 확인합니다." },
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
        type: 'code',
        title: '컴포넌트 설계 실습',
        runnable: false,
        exercises: [
          { difficulty: 'easy', description: 'Props 타입을 정의해보세요', code: "defineProps<{\n  name: {{BLANK:문자열 타입}}\n  age: {{BLANK:숫자 타입}}\n  active?: boolean\n}>()", answers: ['string', 'number'], explanation: "defineProps의 제네릭으로 타입을 정의합니다. ?는 선택적 속성입니다." },
          { difficulty: 'medium', description: 'Emit 타입을 정의하고 이벤트를 발생시켜보세요', code: "const emit = {{BLANK:이벤트 정의 매크로}}<{\n  save: [data: { name: string }]\n  {{BLANK:삭제 이벤트}}: [id: number]\n}>()\n\n// 사용\nemit('save', { name: '이찬용' })\nemit('delete', 123)", answers: ['defineEmits', 'delete'], explanation: "defineEmits로 이벤트 타입을 정의하고, emit()으로 부모에게 이벤트를 보냅니다." },
          { difficulty: 'hard', description: 'Slot을 사용한 Card 컴포넌트를 완성해보세요', code: "<template>\n  <div class=\"card\">\n    <div class=\"card__header\">\n      <{{BLANK:이름있는 슬롯}} name=\"header\" />\n    </div>\n    <div class=\"card__body\">\n      <{{BLANK:기본 슬롯}} />\n    </div>\n  </div>\n</template>", answers: ['slot', 'slot'], explanation: "<slot>으로 부모가 자유롭게 콘텐츠를 주입할 수 있습니다. name 속성으로 이름있는 슬롯을 만듭니다." },
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
        type: 'code',
        title: 'TypeScript 실습',
        runnable: false,
        exercises: [
          { difficulty: 'easy', description: '변수의 타입을 지정해보세요', code: "const name: {{BLANK:문자열 타입}} = '이찬용'\nconst age: {{BLANK:숫자 타입}} = 30\nconst active: {{BLANK:참/거짓 타입}} = true", answers: ['string', 'number', 'boolean'], explanation: "TypeScript의 3가지 기본 타입: string, number, boolean. 타입을 지정하면 잘못된 값을 할당할 때 컴파일 에러가 납니다." },
          { difficulty: 'medium', description: 'Interface를 정의해보세요', code: "{{BLANK:인터페이스 키워드}} User {\n  id: number\n  name: string\n  email: string\n  role: 'admin' | '{{BLANK:일반 멤버}}'\n}", answers: ['interface', 'member'], explanation: "interface로 객체의 구조를 정의합니다. | (파이프)로 union 타입을 만들어 허용값을 제한합니다." },
          { difficulty: 'hard', description: 'Vue에서 TypeScript를 사용해보세요', code: "const todos = ref<{{BLANK:Todo 배열 타입}}>([])\n\ndefineProps<{\n  items: Todo[]\n  loading: {{BLANK:참/거짓 타입}}\n}>()\n\ndefineEmits<{\n  save: [data: {{BLANK:Todo 타입}}]\n  delete: [id: number]\n}>()", answers: ['Todo[]', 'boolean', 'Todo'], explanation: "ref<T>()로 반응형 데이터에 타입을 지정하고, defineProps/defineEmits에서 제네릭으로 타입을 정의합니다." },
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
        type: 'code',
        title: '배포/CI 실습',
        runnable: false,
        exercises: [
          { difficulty: 'easy', description: 'GitHub Actions 워크플로우의 기본 구조를 완성해보세요', code: "name: Deploy\n\non:\n  {{BLANK:트리거 이벤트}}:\n    branches: [main]\n\njobs:\n  build:\n    {{BLANK:실행 환경}}: ubuntu-latest", answers: ['push', 'runs-on'], explanation: "on.push로 git push 이벤트에 반응하고, runs-on으로 실행 환경(ubuntu, windows 등)을 지정합니다." },
          { difficulty: 'medium', description: '빌드 스텝을 추가해보세요', code: "steps:\n  - uses: actions/{{BLANK:코드 가져오기}}@v4\n  - uses: actions/setup-node@v4\n    with:\n      node-version: 20\n  - run: npm {{BLANK:의존성 설치 (clean)}}\n  - run: npm run build", answers: ['checkout', 'ci'], explanation: "checkout으로 코드를 가져오고, npm ci로 lock 파일 기반 깨끗한 설치를 합니다 (npm install보다 빠르고 안정적)." },
          { difficulty: 'hard', description: '환경변수와 시크릿을 사용해보세요', code: "steps:\n  - run: npm run build\n    {{BLANK:환경변수 키워드}}:\n      DATABASE_URL: ${{ {{BLANK:시크릿 접근 객체}}.DATABASE_URL }}\n      NODE_ENV: production", answers: ['env', 'secrets'], explanation: "env 키워드로 환경변수를 주입하고, secrets 객체로 GitHub Secrets에 저장된 민감한 값에 접근합니다." },
        ],
      }),
    },
  ]

  // ── AI Tools 시드 데이터 ──
  const aiTools = [
    { title: 'Superpowers 개요', description: 'Claude Code 플러그인 — 체계적 개발 워크플로우 스킬 모음', icon: 'zap', tags: ['superpowers', '개요'], content: '## Superpowers란?\n\nClaude Code용 **스킬 플러그인**으로, 체계적인 개발 워크플로우를 강제한다.\n브레인스토밍 → 계획 → 실행 → 검증까지 일관된 프로세스.\n\n## 설치\n\n```bash\n# Superpowers 본체\n/plugin install superpowers@claude-plugins-official\n\n# 또는 제작자 마켓플레이스\n/plugin marketplace add obra/superpowers-marketplace\n/plugin install superpowers@superpowers-marketplace\n\n# 브라우저 제어 (별도 플러그인)\n/plugin install superpowers-chrome@superpowers-marketplace\n```\n\n## 핵심 워크플로우\n\n```\nbrainstorm → write-plan → execute-plan → GrillMe/Improve → 머지\n```\n\n1. **brainstorm**으로 설계\n2. **execute-plan**으로 분할 구현\n3. **GrillMe + Improve Architecture**로 점검\n4. (선택) Codex 교차 리뷰 후 머지\n\n## 주의사항\n\n- brainstorm은 **모든 작업 전에** 실행해야 함 (단순한 것도)\n- 디자인 승인 전 코드 작성 금지\n- superpowers-chrome과 gstack의 browse는 **완전 별개**' },
    { title: 'brainstorming', description: '연한 아이디어 → 명확한 스펙으로 발전시키는 협업 설계 스킬', icon: 'lightbulb', tags: ['superpowers', '계획'], content: '## 개요\n\n아이디어를 구체적인 설계 스펙으로 발전시킨다.\n한 번에 하나씩 질문하며 요구사항을 구체화한 후, 2-3가지 접근법을 제안하고 승인된 디자인을 스펙 문서로 저장.\n\n## 사용법\n\n```\n/superpowers:brainstorming [아이디어 설명]\n```\n\n## 프로세스\n\n1. **프로젝트 컨텍스트 파악** — 파일, 문서, 커밋 확인\n2. **명확화 질문** — 한 번에 하나씩, 가급적 객관식\n3. **2-3가지 접근법 제안** — 트레이드오프 + 추천안\n4. **디자인 섹션별 제시** — 승인 후 다음 섹션\n5. **스펙 문서 저장** — `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`\n6. **writing-plans로 전환** — 구현 계획 작성\n\n## 핵심 원칙\n\n- **한 번에 하나의 질문** — 여러 질문 금지\n- **객관식 선호** — 선택지 제공\n- **YAGNI** — 불필요한 기능 제거\n- **디자인 승인 전 코드 작성 절대 금지**' },
    { title: 'writing-plans', description: '스펙 → 바이트 사이즈 태스크로 구성된 구현 계획서 작성', icon: 'clipboard-list', tags: ['superpowers', '계획'], content: '## 개요\n\nbrainstorming에서 승인된 스펙을 바탕으로 구현 계획서를 작성한다.\n각 태스크는 2-5분 단위의 바이트 사이즈 스텝으로 구성.\n\n## 사용법\n\n```\n/superpowers:writing-plans [스펙 파일 경로]\n```\n\n## 핵심 원칙\n\n- **정확한 파일 경로** — 항상 명시\n- **완전한 코드** — 모든 스텝에 코드 블록 포함\n- **No Placeholders** — TBD, TODO 금지\n- **DRY, YAGNI, TDD** — 반복하지 않고, 불필요한 건 빼고, 테스트 먼저\n- **잦은 커밋** — 태스크마다 커밋\n\n## 저장 위치\n\n`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`' },
    { title: 'executing-plans', description: '계획서를 태스크별로 분할 실행 + 리뷰 체크포인트', icon: 'rocket', tags: ['superpowers', '실행'], content: '## 개요\n\nwriting-plans에서 작성된 구현 계획을 태스크별로 순차 실행한다.\n각 태스크 완료 시 검증하고, 블로커 발생 시 즉시 멈추고 질문.\n\n## 사용법\n\n```\n/superpowers:executing-plans [계획 파일 경로]\n```\n\n## 실행 옵션\n\n| 방식 | 설명 |\n|------|------|\n| **Subagent-Driven (추천)** | 태스크별 독립 에이전트, 중간 리뷰 |\n| **Inline Execution** | 현재 세션에서 순차 실행 |\n\n## 블로커 대응\n\n- 의존성 누락 → **즉시 멈추고 질문**\n- 테스트 실패 → **즉시 멈추고 질문**\n- 명령 불명확 → **추측하지 말고 질문**' },
    { title: 'superpowers-chrome', description: '별도 플러그인 — 실제 크롬 브라우저를 띄워서 화면 보기/클릭/입력/테스트', icon: 'globe', tags: ['superpowers', '브라우저', '테스트'], content: '## 개요\n\nsuperpowers-chrome은 **별도 플러그인**으로, 실제 Chrome 브라우저를 띄워서 화면을 보고 클릭·입력·테스트한다.\n\n> **gstack의 browse와 완전 별개!** gstack은 헤드리스, superpowers-chrome은 실제 브라우저 창.\n\n## 설치\n\n```bash\n/plugin marketplace add obra/superpowers-marketplace\n/plugin install superpowers-chrome@superpowers-marketplace\n```\n\n## vs gstack browse\n\n| 항목 | superpowers-chrome | gstack browse |\n|------|-------------------|---------------|\n| 브라우저 | 실제 Chrome 창 | 헤드리스 |\n| 시각 확인 | 직접 눈으로 확인 | 스크린샷 기반 |\n| 용도 | 인터랙티브 QA | 자동화 테스트 |\n| 설치 | 별도 플러그인 | gstack 내장 |' },
    { title: '핵심 워크플로우', description: 'brainstorm → plan → execute → 검증 → 머지 전체 흐름 정리', icon: 'refresh-cw', tags: ['superpowers', '워크플로우'], content: '## 전체 흐름\n\n```\n아이디어\n  ↓\n/brainstorming        ← 연한 아이디어 → 명확한 스펙\n  ↓\n/writing-plans        ← 스펙 → 바이트사이즈 구현 계획서\n  ↓\n/executing-plans      ← 계획을 분할 실행 + 리뷰\n  ↓\nGrillMe / Improve     ← 품질 점검\n  ↓\n(선택) Codex 교차 리뷰\n  ↓\n머지\n```\n\n## 한 줄 요약\n\n> brainstorm으로 설계 → execute-plan으로 분할 구현 → GrillMe + Improve로 점검 → (선택) Codex 교차 리뷰 후 머지' },
    { title: 'gstack browse', description: '헤드리스 브라우저 — 스크린샷 기반 QA 테스트 & 사이트 점검', icon: 'search', tags: ['gstack', '브라우저', '테스트'], content: '## 개요\n\ngstack의 내장 헤드리스 브라우저. 페이지 이동, 클릭, 입력, 스크린샷, 반응형 테스트 등을 CLI로 수행.\n\n## 사용법\n\n```\n/browse [URL] [지시사항]\n```\n\n## 주요 명령어\n\n| 명령어 | 설명 |\n|--------|------|\n| `goto <url>` | 페이지 이동 |\n| `snapshot -i` | 인터랙티브 요소 목록 |\n| `snapshot -D` | 이전 스냅샷과 diff |\n| `click @e3` | 요소 클릭 |\n| `fill @e4 "값"` | 입력 필드 채우기 |\n| `screenshot <path>` | 스크린샷 저장 |\n| `responsive <prefix>` | 반응형 스크린샷 |' },
    { title: '/qa', description: 'QA 테스트 + 발견된 버그 자동 수정까지', icon: 'bug', tags: ['gstack', '테스트'], content: '## 개요\n\n웹 앱을 체계적으로 QA 테스트하고, 발견된 버그를 소스 코드에서 **자동으로 수정**한다.\n\n## 사용법\n\n```\n/qa [URL]\n```\n\n## /qa vs /qa-only\n\n| 항목 | /qa | /qa-only |\n|------|-----|----------|\n| 버그 발견 | O | O |\n| 자동 수정 | O | X |\n| 커밋 생성 | O | X |\n| 용도 | 빠른 수정 | 리포트만 |' },
    { title: '/ship', description: 'PR 생성 → CI 확인 → 배포까지 한 번에', icon: 'ship', tags: ['gstack', '배포'], content: '## 개요\n\n코드 변경사항을 PR로 만들고, CI를 확인하고, 배포까지 처리하는 원스톱 스킬.\n\n## 사용법\n\n```\n/ship\n```\n\n## 프로세스\n\n1. 베이스 브랜치 감지 + 머지\n2. 테스트 실행\n3. diff 리뷰\n4. VERSION bump + CHANGELOG\n5. 커밋 + 푸시\n6. PR 생성' },
    { title: '/investigate', description: '체계적 디버깅 — 근본 원인 분석 4단계', icon: 'microscope', tags: ['gstack', '디버깅'], content: '## 개요\n\n버그나 에러 발생 시 체계적으로 근본 원인을 찾는 4단계 디버깅 프로세스.\n**Iron Law: 근본 원인 없이 수정 금지.**\n\n## 사용법\n\n```\n/investigate [에러 설명]\n```\n\n## 4단계\n\n1. **Investigate** — 에러 수집, 재현 조건\n2. **Analyze** — 코드 탐색, 데이터 흐름 추적\n3. **Hypothesize** — 원인 2-3개 도출\n4. **Implement** — 확인된 원인만 수정' },
    { title: 'gstack 개요', description: 'Claude Code용 스킬 프레임워크 — QA, 배포, 디버깅, 코드리뷰 등', icon: 'wrench', tags: ['gstack', '개요'], content: '## gstack이란?\n\nClaude Code용 **스킬 프레임워크**. browse(헤드리스 브라우저)를 핵심으로 QA 테스트, 배포, 디버깅, 코드 리뷰 등 개발 워크플로우를 자동화.\n\n## 주요 스킬\n\n| 카테고리 | 스킬 | 설명 |\n|----------|------|------|\n| 테스트 | /qa | QA + 자동 수정 |\n| 테스트 | /browse | 헤드리스 브라우저 |\n| 배포 | /ship | PR → 배포 |\n| 디버깅 | /investigate | 근본 원인 분석 |\n| 리뷰 | /review | PR 코드 리뷰 |\n| 디자인 | /design-review | 시각 QA |\n| 품질 | /health | 코드 품질 대시보드 |' },
    { title: 'sub-agent', description: '독립 태스크를 병렬 서브에이전트로 분배·동시 실행하는 스킬', icon: 'git-branch', tags: ['superpowers', '실행'], content: '## 개요\n\nSub-Agent는 2개 이상의 **독립적인 태스크**를 병렬 서브에이전트로 동시에 실행하는 스킬이다.\n공유 상태나 순차 의존성이 없는 작업을 분할하여 속도를 극대화.\n\n## 관련 스킬 2가지\n\n### 1. dispatching-parallel-agents\n\n임의의 독립 태스크 2개 이상을 **병렬 에이전트로 동시 실행**한다.\n\n```\n/superpowers:dispatching-parallel-agents\n```\n\n**언제 사용?**\n- 2개 이상의 독립적인 태스크가 있을 때\n- 태스크 간 공유 상태·순차 의존성이 없을 때\n\n**예시:**\n```\nAgent 1: 프론트엔드 컴포넌트 구현\nAgent 2: 백엔드 API 엔드포인트 구현\nAgent 3: 테스트 코드 작성\n→ 3개 서브에이전트가 동시에 작업\n```\n\n### 2. subagent-driven-development\n\n구현 계획서(plan)의 태스크를 분석하여 **의존성 그래프 기반으로 서브에이전트에 분배**한다.\n\n```\n/superpowers:subagent-driven-development\n```\n\n**프로세스:**\n1. 계획 분석 → 의존성 그래프 파악\n2. 독립 태스크 식별 → 동시 실행 가능한 태스크 그룹핑\n3. 서브에이전트 배정 → 각 태스크에 에이전트 할당\n4. 병렬 실행 → 동시 구현\n5. 결과 통합 → 머지 + 충돌 해결\n6. 리뷰 체크포인트\n\n## 두 스킬 비교\n\n| 항목 | dispatching-parallel-agents | subagent-driven-development |\n|------|---------------------------|---------------------------|\n| 입력 | 개별 태스크 목록 | 구현 계획서 (plan) |\n| 의존성 분석 | 수동 (사용자 판단) | 자동 (계획서 기반) |\n| 용도 | 임의 병렬 작업 | 계획 기반 체계적 개발 |\n\n## 핵심 원칙\n\n- **독립성 확인** — 태스크 간 파일/상태 충돌 없어야 함\n- **명확한 브리핑** — 각 에이전트에게 충분한 컨텍스트 제공\n- **같은 파일 = 같은 에이전트** — 충돌 방지\n- **중간 리뷰 필수** — 에이전트 완료 후 반드시 결과 확인\n- **의존성 있으면 순차** — 무조건 병렬 금지' },
    { title: '/design-review', description: '디자이너 눈으로 시각 QA — 간격, 계층, AI 슬롭 패턴, 느린 인터랙션 찾아서 수정', icon: 'palette', tags: ['gstack', '디자인'], content: '## 개요\n\n디자이너 관점에서 시각적 품질을 점검한다.\n간격 불일치, 시각적 계층 문제, AI가 만든 슬롭 패턴, 느린 인터랙션을 찾아내고 **자동으로 수정**한다.\n\n## 사용법\n\n```\n/design-review [URL]\n```\n\n## 점검 항목\n\n| 항목 | 설명 |\n|------|------|\n| **간격 일관성** | padding, margin, gap 불일치 |\n| **시각적 계층** | 폰트 크기·굵기·색상 계층 |\n| **AI 슬롭 패턴** | AI가 만든 어색한 UI 패턴 |\n| **인터랙션 속도** | 느린 애니메이션·트랜지션 |\n| **반응형** | 브레이크포인트별 레이아웃 |\n\n## /qa와의 차이\n\n| 항목 | /qa | /design-review |\n|------|-----|----------------|\n| 관점 | 기능 동작 | 시각 품질 |\n| 대상 | 버그·에러 | 간격·계층·UX |\n| 수정 | 코드 버그 | CSS·레이아웃 |' },
    { title: '/plan-design-review', description: '구현 계획을 디자이너 관점에서 인터랙티브 리뷰', icon: 'pen-tool', tags: ['gstack', '디자인'], content: '## 개요\n\n구현 계획서를 **디자이너 관점**에서 리뷰한다.\nCEO 리뷰, Eng 리뷰와 동일한 인터랙티브 방식으로 진행.\n\n## 사용법\n\n```\n/plan-design-review [계획 파일 경로]\n```\n\n## 점검 항목\n\n| 항목 | 설명 |\n|------|------|\n| **UI 일관성** | 기존 디자인 시스템과 일치 여부 |\n| **사용자 경험** | 플로우·인터랙션 자연스러움 |\n| **접근성** | a11y 고려 여부 |\n| **반응형** | 모바일·태블릿 대응 계획 |\n| **시각적 계층** | 정보 우선순위 |\n\n## 관련 리뷰 스킬\n\n| 스킬 | 관점 |\n|------|------|\n| /plan-ceo-review | CEO/파운더 |\n| /plan-eng-review | 엔지니어링 매니저 |\n| /plan-design-review | 디자이너 |\n| /plan-devex-review | DX (개발자 경험) |' },
    { title: 'Codex 교차 리뷰', description: 'OpenAI Codex CLI — 독립 코드 리뷰, 챌린지 모드, 컨설팅', icon: 'bot', tags: ['codex', '리뷰'], content: '## 개요\n\nOpenAI Codex CLI를 활용한 **교차 리뷰** 도구.\n\n## 설치\n\n```bash\nnpm install -g @openai/codex\nexport OPENAI_API_KEY=sk-...\n```\n\n## 3가지 모드\n\n### 1. Code Review\n```\n/codex review\n```\nClaude와 독립적인 시각으로 diff 분석, pass/fail 판정.\n\n### 2. Challenge\n```\n/codex challenge\n```\n코드를 깨뜨릴 수 있는 시나리오를 찾는 적대적 모드.\n\n### 3. Consult\n```\n/codex consult "질문"\n```\n자유 질문, 세션 유지로 후속 질문 가능.\n\n## 왜 교차 리뷰?\n\n| 항목 | Claude 셀프 리뷰 | Codex 교차 리뷰 |\n|------|-----------------|----------------|\n| 관점 | 작성자 = 리뷰어 | 독립된 모델 |\n| 강점 | 컨텍스트 풍부 | 다른 패턴 인식 |\n| 용도 | 기본 리뷰 | 크리티컬 코드 |' },
  ]

  for (const tool of aiTools) {
    await prisma.aiTool.create({
      data: { ...tool, authorId: chanyong.id },
    })
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
