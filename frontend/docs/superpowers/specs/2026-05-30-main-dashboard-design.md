# 메인 대시보드 디자인 스펙

## 개요

TaskFlow 앱(`localhost:5177`)에 메인 대시보드를 추가한다. 앱 접속 시 첫 화면으로 표시되며, 프로젝트와 개인할일의 핵심 정보를 한눈에 보여주는 통합 요약 페이지이다.

## 디자인 결정 사항

- **스타일**: 하이브리드형 (인사말 + 요약 숫자 + 핵심 리스트)
- **진입 방식**: 앱 첫 화면 (`/`), 상단 로고(CYLEE) 클릭 시 대시보드로 이동. 하단 탭은 기존 4탭 유지.
- **데이터 범위**: 프로젝트 + 개인할일 (AI Tools, 주식 제외)
- **인터랙션**: 할일 체크(완료 처리) + 빠른 추가 가능
- **데이터 로딩**: 페이지 진입 시 자동 로딩 (Promise.all 병렬 호출)
- **백엔드 변경 없음**: 기존 `GET /projects`, `GET /todos` API 재사용

## 아키텍처

### 파일 구조

```
src/
  views/
    DashboardView.vue          ← NEW (얇은 뷰, 레이아웃만)
    ProjectsView.vue           (기존 유지)
  components/
    dashboard/                 ← NEW
      DashboardHome.vue        (메인 로직, 데이터 로딩)
      StatCard.vue             (숫자 요약 카드)
      TodoQuickList.vue        (할일 리스트 + 체크 + 빠른 추가)
      ProjectSummary.vue       (프로젝트 요약 리스트)
  router.ts                    ← MODIFIED
  App.vue                      ← MODIFIED (로고 클릭 → /)
```

### 라우팅 변경

| 경로 | 변경 전 | 변경 후 |
|------|---------|---------|
| `/` | ProjectsView | **DashboardView** |
| `/main` | — | **ProjectsView** |
| `/projects/:id` | ProjectDetailView | (유지) |
| `/login` | LoginView | (유지) |

### 데이터 흐름

```
DashboardHome.vue (onMounted)
  ├── GET /projects → projects 데이터
  │     ├── StatCard (진행 중 프로젝트 수)
  │     └── ProjectSummary (프로젝트 리스트)
  └── GET /todos → todos 데이터
        ├── StatCard (오늘 할일 수 / 완료율)
        └── TodoQuickList (할일 리스트)

두 API를 Promise.all로 병렬 호출
```

## UI 레이아웃

### 화면 구성 (위→아래)

1. **인사말 영역**
   - 시간대별 인사: "좋은 아침이에요 👋" / "좋은 오후예요" / "좋은 저녁이에요"
   - 요약 한 줄: "오늘 할일 N개, 마감 임박 N개"

2. **요약 카드 (2열 그리드)**
   - 왼쪽: 진행 중 프로젝트 수 (UiIcon: `folder`)
   - 오른쪽: 오늘 할일 완료/전체 (UiIcon: `circle-check`)

3. **오늘 할일 섹션**
   - 헤더: "오늘 할일" + "+ 추가" 링크
   - 할일 아이템: UiCheckbox + 제목 + UiBadge(D-day)
   - 완료된 항목: 취소선 처리
   - 하단: 빠른 추가 UiInput

4. **프로젝트 요약 섹션**
   - 헤더: "프로젝트" + "전체보기 →" 링크
   - 프로젝트 아이템: 프로젝트명 + 이슈/멤버 수 + UiBadge(상태)

## 컴포넌트 상세

### StatCard.vue

```
Props:
  - icon: string        (UiIcon name)
  - iconBg: string      (아이콘 배경색 클래스)
  - label: string       (라벨 텍스트)
  - value: number       (주요 숫자)
  - sub?: string        (부가 텍스트, 예: "/5")
```

### TodoQuickList.vue

```
Props:
  - todos: Todo[]
  - loading: boolean

Emits:
  - toggle(todo: Todo)           할일 완료 토글
  - add(title: string)           빠른 추가
  - navigate-all()               "전체보기" 클릭

사용 컴포넌트:
  - UiCheckbox: 완료 토글
  - UiBadge (variant="danger"): D-1 이하
  - UiBadge (variant="warning"): D-2 ~ D-7
  - UiInput: 빠른 추가 입력
  - UiLoading (overlay): 로딩 상태
```

### ProjectSummary.vue

```
Props:
  - projects: Project[]
  - loading: boolean

Emits:
  - select(project: Project)     프로젝트 클릭 → 상세 이동
  - navigate-all()               "전체보기" 클릭

사용 컴포넌트:
  - UiBadge (variant="success"): 진행중
  - UiBadge (variant="warning"): 보류
  - UiBadge (variant="info"): 완료
  - UiIcon (name="users"): 멤버 수
  - UiIcon (name="circle-dot"): 이슈 수
  - UiIcon (name="arrow-right"): 전체보기 링크
  - UiEmpty: 프로젝트 없을 때
```

### DashboardHome.vue

```
역할: 데이터 로딩 + 하위 컴포넌트 조합

데이터:
  - projects: ref<Project[]>
  - todos: ref<Todo[]>
  - loading: ref<boolean>

Computed:
  - activeProjects: 상태가 'active'인 프로젝트
  - todayTodos: 오늘 마감이거나 마감일 없는 미완료 + 오늘 완료한 할일
  - completionRate: 오늘 할일 완료율
  - urgentCount: 마감 임박(D-3 이내) 할일 수
  - greeting: 시간대별 인사말

사용 컴포넌트:
  - UiLoading (overlay): 초기 로딩
  - openToast(): 할일 추가/완료 시 피드백
```

### DashboardView.vue

```
역할: 얇은 뷰 래퍼, DashboardHome을 렌더링
```

## 인터랙션

| 액션 | 동작 | API |
|------|------|-----|
| 할일 체크 | UiCheckbox 토글 → 완료/미완료 전환 | `PATCH /todos/:id` |
| 빠른 추가 | UiInput에서 Enter → 새 할일 생성 | `POST /todos` |
| 프로젝트 클릭 | 프로젝트 행 클릭 → 상세 페이지 이동 | `router.push(/projects/:id)` |
| 전체보기 (할일) | "전체보기" 클릭 | `router.push(/main?tab=todos)` |
| 전체보기 (프로젝트) | "전체보기" 클릭 | `router.push(/main?tab=projects)` |
| 로고 클릭 | CYLEE 로고 클릭 → 대시보드로 이동 | `router.push(/)` |

## 토스트 규칙

기존 프로젝트 규칙에 따름:
- 할일 추가: `openToast({ message: '할일이 추가되었습니다.', type: 'success' })`
- 할일 완료 토글: 토스트 없음 (수정/토글은 토스트 표시 안 함)
- 에러 시: `openToast({ message: '...실패했습니다.', type: 'error' })`

## 에러 처리

- API 실패 시: 해당 섹션만 에러 표시, 나머지는 정상 렌더링
- 네트워크 에러: openToast로 에러 메시지 표시

## 타입 재사용

`ProjectsView.vue`에 정의된 `Todo`, `TodoFile` 인터페이스를 `src/types/` 디렉토리로 추출하여 대시보드와 공유한다.

```
src/types/
  todo.ts    ← Todo, TodoFile 인터페이스
  stock.ts   (기존)
```
