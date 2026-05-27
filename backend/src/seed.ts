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
    { title: 'KPI 피드백 삭제 오류 핫픽스 배포', done: true, priority: 'high' as const },
    { title: '홍다래 QA 확인 요청 전달', done: true, priority: 'mid' as const },
    { title: 'Railway 환경변수 정리', done: false, priority: 'high' as const },
    { title: 'ispark-ui 0.6.0 체인지로그 작성', done: false, priority: 'mid' as const },
    { title: 'OKR 매니저/공유자 탭 분리 건 김정의 리뷰 요청', done: false, priority: 'mid' as const },
    { title: '칸반보드 성능 최적화 리서치', done: false, priority: 'low' as const },
    { title: '주간 회의 안건 정리', done: false, priority: 'none' as const },
  ]

  for (const todo of todos) {
    await prisma.todo.create({
      data: { userId: chanyong.id, ...todo },
    })
  }

  console.log('시드 완료!')
  console.log(`  사용자: 4명 (이찬용, 홍다래, 김정의, 김현우)`)
  console.log(`  프로젝트: 3개 (S-Gate 개인성과, TaskFlow MVP, ispark-ui)`)
  console.log(`  이슈: ${sgateIssues.length + taskflowIssues.length + designIssues.length}개`)
  console.log(`  할일: ${todos.length}개`)
  console.log(`  로그인: chanyong@test.com / 1234`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
