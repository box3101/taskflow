# 캘린더 할일/이슈 클릭 시 드로워 모달 표시

## 목적

캘린더에서 할일(Todo) 또는 이슈(Issue) 클릭 시 페이지 이동 대신 사이드 드로워로 상세 내용을 표시하고 편집할 수 있게 한다.

## 현재 동작

`CalendarEventList.vue:31-35`의 `onClickEvent`:
- `event` → `CalendarEventForm` 드로워 열림 (유지)
- `todo` → `router.push('/main?tab=todos')` 페이지 이동
- `issue` → `router.push('/projects/${projectId}')` 페이지 이동

## 변경 후 동작

- `event` → 기존 `CalendarEventForm` 드로워 (변경 없음)
- `todo` → 캘린더 내 Todo 드로워 표시 (제목/메모/마감일 편집 + 완료 토글 + 삭제)
- `issue` → 캘린더 내 Issue 드로워 표시 (설명 편집 + 상태/우선순위 확인)

## 아키텍처

### 변경 파일

1. **`CalendarEventList.vue`** — `onClickEvent`에서 `router.push` 대신 emit 발생
   - 새 emit: `openTodo(event)`, `openIssue(event)`

2. **`CalendarView.vue`** — Todo/Issue 드로워 상태 관리 및 컴포넌트 배치
   - Todo 드로워: API로 상세 데이터 조회 후 편집 폼 표시
   - Issue 드로워: API로 상세 데이터 조회 후 편집 폼 표시

3. **새 컴포넌트 `CalendarTodoDrawer.vue`** — Todo 상세/편집 드로워
   - `ProjectsView.vue`의 Todo 드로워 로직을 독립 컴포넌트로 추출
   - Props: `open`, `todoId` (CalendarEvent의 id)
   - Emits: `update:open`, `saved`, `deleted`
   - API: `GET /todos/:id`로 상세 조회 → 편집 → `PATCH /todos/:id`
   - 기능: 제목/메모/마감일 편집, 완료 토글, 삭제, 파일 첨부

4. **새 컴포넌트 `CalendarIssueDrawer.vue`** — Issue 상세/편집 드로워
   - `ProjectDetailView.vue`의 Issue 패널 로직을 독립 컴포넌트로 추출
   - Props: `open`, `issueId` (CalendarEvent의 id), `projectId`
   - Emits: `update:open`, `saved`
   - API: `GET /projects/:projectId/issues/:issueId`로 상세 조회
   - 기능: 상태/우선순위 변경, 설명 편집

### 데이터 흐름

```
CalendarEventList — click todo/issue
  ↓ emit('openTodo', ev) / emit('openIssue', ev)
CalendarView — todoDrawerOpen=true, todoId=ev.id
  ↓
CalendarTodoDrawer — GET /todos/:id → 편집 폼 표시
  ↓ @saved
CalendarView — fetchEvents() (캘린더 갱신)
```

### API 확인 필요 사항

- `GET /todos/:id` — 개별 Todo 상세 조회 API가 백엔드에 존재하는지 확인
- `GET /projects/:projectId/issues/:issueId` — 개별 Issue 상세 조회 API 존재 확인
- 없으면 백엔드에 추가 필요

### 드로워 내 UI (Todo)

```
┌─────────────────────┐
│ 할일 상세        [X] │
├─────────────────────┤
│ 제목: [__________]  │
│ 마감일: [날짜선택]   │
│ 메모: [__________]  │
│       [__________]  │
│ 첨부파일:           │
│   📎 file1.pdf [x]  │
│   [+ 파일 추가]     │
├─────────────────────┤
│ [삭제]  미완료 ○  [저장] │
└─────────────────────┘
```

### 드로워 내 UI (Issue)

```
┌─────────────────────┐
│ 이슈 상세        [X] │
├─────────────────────┤
│ 상태: [할 일 ▼]     │
│ 우선순위: [보통 ▼]   │
│ 담당자: [미배정 ▼]   │
│ 요청일: [날짜]       │
│ 마감일: [날짜]       │
│ ─────────────────── │
│ 설명:               │
│ [__________________]│
│ [__________________]│
├─────────────────────┤
│          [저장] │
└─────────────────────┘
```

## 에러 처리

- API 조회 실패 시 `openToast({ message: '...', type: 'error' })` 표시
- 드로워 저장/삭제 후 캘린더 이벤트 목록 갱신 (`fetchEvents()`)

## 테스트 계획

- 캘린더에서 Todo 클릭 → 드로워 열림, 편집/저장 동작 확인
- 캘린더에서 Issue 클릭 → 드로워 열림, 상태 변경 동작 확인
- Event 클릭 → 기존 동작 유지 확인
- 드로워에서 수정 후 캘린더 목록에 반영 확인
