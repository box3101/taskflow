/**
 * 포트폴리오 공개용 데모 계정 시드.
 *
 * 목적: 채용담당자가 로그인해서 TaskFlow를 둘러볼 수 있게 하되,
 *       개인 실계정의 데이터는 일절 보이지 않게 한다.
 *
 * seed.ts 와 달리 **어떤 데이터도 삭제하지 않는다.**
 * 프로덕션 DB에서 실행해도 안전하도록 전부 upsert / 존재 확인 후 생성으로 작성했다.
 *
 * 실행: npm run db:seed:demo
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

const DEMO_EMAIL = 'demo@taskflow.dev'
const DEMO_PASSWORD = 'demo1234'
const DEMO_NAME = '데모 사용자'

/** 데모용 프로젝트. 실제 회사 프로젝트명을 쓰지 않는다. */
const DEMO_PROJECTS = [
  {
    name: '웹사이트 리뉴얼',
    description: '기업 홈페이지 전면 개편 — 정보구조 재설계 및 반응형 대응',
    status: 'active',
    order: 1,
    issues: [
      { title: '메인 히어로 섹션 퍼블리싱', status: 'done', priority: 'high', category: 'improvement' },
      { title: '모바일 내비게이션 햄버거 메뉴', status: 'doing', priority: 'mid', category: 'improvement' },
      { title: 'IE11에서 그리드 레이아웃 깨짐', status: 'todo', priority: 'high', category: 'bug' },
      { title: '접근성 검수 — 키보드 포커스 순서', status: 'todo', priority: 'mid', category: 'improvement' },
    ],
  },
  {
    name: '디자인 시스템 구축',
    description: '공용 UI 컴포넌트 라이브러리 및 디자인 토큰 정의',
    status: 'active',
    order: 2,
    issues: [
      { title: 'Button 컴포넌트 variant 정리', status: 'done', priority: 'high', category: 'improvement' },
      { title: 'Table 정렬·필터 기능 추가', status: 'doing', priority: 'high', category: 'improvement' },
      { title: '다크 테마 토큰 정의', status: 'todo', priority: 'mid', category: 'improvement' },
    ],
  },
  {
    name: '모바일 앱 v2.0',
    description: '사용자 피드백 반영 개선 및 성능 최적화',
    status: 'hold',
    order: 3,
    issues: [
      { title: '초기 로딩 시간 3초 → 1.5초 단축', status: 'confirm', priority: 'high', category: 'improvement' },
      { title: '푸시 알림 수신 실패 케이스', status: 'todo', priority: 'mid', category: 'bug' },
    ],
  },
]

/** 데모용 할일. 개인 신상과 무관한 업무 항목만 둔다. */
const DEMO_TODOS = [
  { title: '주간 회의 안건 정리', done: true, daysFromNow: -1 },
  { title: '컴포넌트 문서 업데이트', done: false, daysFromNow: 0 },
  { title: '코드 리뷰 피드백 반영', done: false, daysFromNow: 1 },
  { title: '배포 전 QA 체크리스트 점검', done: false, daysFromNow: 3 },
  { title: '월간 회고 작성', done: false, daysFromNow: 7 },
]

function dateFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

async function main() {
  console.log('데모 계정 시드를 시작합니다. (기존 데이터는 삭제하지 않습니다)')

  // ===== 데모 사용자 =====
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { password: passwordHash, name: DEMO_NAME },
    create: {
      email: DEMO_EMAIL,
      password: passwordHash,
      name: DEMO_NAME,
      role: 'member',
    },
  })
  console.log(`  사용자: ${user.email} (id=${user.id})`)

  // ===== 프로젝트 · 멤버 · 이슈 =====
  for (const p of DEMO_PROJECTS) {
    // 이 데모 사용자가 멤버인 동명 프로젝트가 이미 있으면 재사용한다.
    const existing = await prisma.project.findFirst({
      where: { name: p.name, members: { some: { userId: user.id } } },
    })

    if (existing) {
      console.log(`  프로젝트(기존): ${p.name}`)
      continue
    }

    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        status: p.status,
        order: p.order,
        members: { create: [{ userId: user.id, role: 'owner' }] },
        issues: {
          create: p.issues.map((issue, i) => ({
            title: issue.title,
            status: issue.status,
            priority: issue.priority,
            category: issue.category,
            assigneeId: user.id,
            order: i,
          })),
        },
      },
    })
    console.log(`  프로젝트(생성): ${project.name} — 이슈 ${p.issues.length}건`)
  }

  // ===== 할일 =====
  for (const t of DEMO_TODOS) {
    const exists = await prisma.todo.findFirst({
      where: { userId: user.id, title: t.title, deletedAt: null },
    })
    if (exists) continue

    await prisma.todo.create({
      data: {
        userId: user.id,
        title: t.title,
        done: t.done,
        dueDate: dateFromNow(t.daysFromNow),
      },
    })
  }
  console.log(`  할일: ${DEMO_TODOS.length}건 확인`)

  console.log('')
  console.log('데모 계정 준비 완료')
  console.log(`  이메일   : ${DEMO_EMAIL}`)
  console.log(`  비밀번호 : ${DEMO_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
