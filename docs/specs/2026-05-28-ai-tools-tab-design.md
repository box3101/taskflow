# AI Tools 탭 디자인 스펙

> TaskFlow 앱에 Claude Code 생태계 도구/스킬 레퍼런스 탭 추가

**작성일:** 2026-05-28
**대상 사용자:** 본인 + 팀원 (개인 레퍼런스 겸 팀 공유)
**범위:** Claude Code 생태계 (superpowers 스킬, gstack, MCP 서버)

---

## 1. 개요

ProjectsView의 4번째 탭으로 "AI Tools"를 추가한다. 자유 단위로 카드를 생성하고, 각 카드에 마크다운 상세 가이드를 작성할 수 있다. 백엔드 API + DB에 저장하여 팀원 간 공유 가능.

## 2. 데이터 모델

### Prisma 스키마

```prisma
model AiTool {
  id          Int      @id @default(autoincrement())
  title       String
  description String
  content     String   @db.Text
  tags        String[]
  icon        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  authorId    Int
  author      User     @relation(fields: [authorId], references: [id])
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| title | String | 도구/스킬 이름 (예: "brainstorming") |
| description | String | 카드에 표시되는 한 줄 설명 |
| content | Text | 마크다운 상세 가이드 |
| tags | String[] | 자유 태그 (예: ["superpowers", "계획"]) |
| icon | String? | 아이콘 클래스명 (선택) |
| authorId | Int | 작성자 User FK |

## 3. API 엔드포인트

```
GET    /ai-tools          목록 조회 (쿼리: ?tag=superpowers&search=검색어)
POST   /ai-tools          생성
GET    /ai-tools/:id      상세 조회
PUT    /ai-tools/:id      수정
DELETE /ai-tools/:id      삭제
```

### 요청/응답 예시

**POST /ai-tools**
```json
{
  "title": "brainstorming",
  "description": "아이디어를 설계로 발전시키는 협업 도구",
  "content": "## 개요\n협업 설계 스킬...",
  "tags": ["superpowers", "계획"],
  "icon": "icon-idea"
}
```

**GET /ai-tools?tag=superpowers**
```json
[
  {
    "id": 1,
    "title": "brainstorming",
    "description": "아이디어를 설계로 발전시키는 협업 도구",
    "tags": ["superpowers", "계획"],
    "icon": "icon-idea",
    "author": { "id": 1, "name": "찬용" },
    "createdAt": "2026-05-28T..."
  }
]
```

## 4. 프론트엔드 구조

### 탭 추가

ProjectsView의 탭 배열에 `{ key: 'ai-tools', label: 'AI Tools' }` 추가.

### 컴포넌트 구조

```
src/components/ai-tools/
├── AiToolsTab.vue      # 탭 전체 (목록 + 필터 + 검색)
├── AiToolCard.vue       # 개별 카드
└── AiToolDrawer.vue     # 상세 보기 / 생성 / 수정 Drawer
```

### AiToolsTab.vue — 카드 목록 화면

- **상단:** 태그 필터 칩 + 검색 입력 + "새 도구 추가" 버튼
- **본문:** 카드 그리드 (3열, 반응형 640px 이하 1열)
- **빈 상태:** UiEmpty 컴포넌트 표시
- **로딩:** UiLoading overlay

**태그 필터:**
- 전체 태그를 API 응답에서 추출하여 칩으로 표시
- 클릭 시 해당 태그로 필터링 (다중 선택 가능)
- "전체" 칩으로 필터 초기화

**검색:**
- 제목 + 설명 대상 프론트엔드 필터링

### AiToolCard.vue — 개별 카드

```
┌────────────────────┐
│  [아이콘]           │
│  제목               │
│  한 줄 설명         │
│                    │
│  #태그1  #태그2     │
└────────────────────┘
```

- 클릭 → AiToolDrawer 열기
- 호버 시 elevation 효과

### AiToolDrawer.vue — 상세/편집

**보기 모드:**
- 제목 + 태그 배지
- 수정/삭제 버튼
- 마크다운 렌더링 영역 (코드블록 하이라이트)

**편집 모드:**
- 제목: UiInput
- 설명: UiInput
- 태그: 콤마 구분 UiInput (입력 후 태그 변환)
- 아이콘: UiInput (선택)
- 내용: textarea (마크다운 작성)
- 저장/취소 버튼

**마크다운 렌더링:**
- `marked` 라이브러리 사용 (또는 유사 경량 라이브러리)
- 코드블록 하이라이팅은 선택사항 (초기 버전에서는 기본 `<pre><code>` 스타일링)

## 5. 사용하는 ispark-ui 컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| UiButton | 추가/수정/삭제 버튼 |
| UiInput | 제목, 설명, 태그, 검색 입력 |
| UiTextarea | 마크다운 내용 입력 |
| UiDrawer | 상세/편집 사이드 패널 |
| UiBadge | 태그 표시 |
| UiEmpty | 빈 상태 |
| UiLoading | 로딩 overlay |
| UiToast | 저장/삭제 알림 |
| UiConfirm | 삭제 확인 |

## 6. 토스트 규칙

기존 프로젝트 규칙을 따른다:
- 저장/추가/삭제 → 토스트 표시
- 수정 모드 진입/토글 → 토스트 없음

## 7. 스타일링

기존 ProjectsView 패턴을 따른다:
- max-width: 1200px, margin: 0 auto
- 카드 그리드: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px`
- 반응형: `@media (max-width: 640px) { grid-template-columns: 1fr }`
- 카드: 흰색 배경, border-radius: 12px, box-shadow, 패딩 20px
- 색상: 기존 팔레트 (primary #3b82f6, 등)

## 8. 파일 변경 목록

### 백엔드

| 파일 | 변경 |
|------|------|
| `backend/prisma/schema.prisma` | AiTool 모델 추가 |
| `backend/prisma/migrations/` | 마이그레이션 생성 |
| `backend/src/routes/aiTools.ts` | 새 라우트 파일 |
| `backend/src/app.ts` | 라우트 등록 |

### 프론트엔드

| 파일 | 변경 |
|------|------|
| `frontend/src/views/ProjectsView.vue` | AI Tools 탭 추가 + AiToolsTab import |
| `frontend/src/components/ai-tools/AiToolsTab.vue` | 새 파일 |
| `frontend/src/components/ai-tools/AiToolCard.vue` | 새 파일 |
| `frontend/src/components/ai-tools/AiToolDrawer.vue` | 새 파일 |

### 의존성

| 패키지 | 용도 |
|--------|------|
| `marked` | 마크다운 → HTML 변환 (프론트엔드) |
