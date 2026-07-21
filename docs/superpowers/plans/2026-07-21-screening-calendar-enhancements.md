# 상영 캘린더 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상영 캘린더에 TMDB 줄거리·포스터, 사용자별 보고 싶은 영화 북마크, 성인물 제외, 재개봉 표시를 추가한다.

**Architecture:** KOBIS는 개봉 및 박스오피스의 기준 데이터로 유지하고 동기화 단계에서 성인물 제외와 재개봉 판정을 수행한다. TMDB 정보는 상세 조회 시 백엔드에서 한 번 조회해 `Movie`에 캐시하며, 북마크는 사용자와 영화를 연결하는 별도 모델로 관리한다. 프론트는 영화 배열과 선택 객체를 함께 갱신해 stale 참조를 방지한다.

**Tech Stack:** Vue 3, TypeScript, SCSS, Express 5, Prisma 7, PostgreSQL, Vitest, Supertest, `@leechanyong/ispark-ui`

## Global Constraints

- TMDB 키는 `TMDB_API_KEY` 백엔드 환경변수만 사용하고 저장소에 실제 키를 넣지 않는다.
- UI는 `UiDrawer`, `UiButton`, `UiIcon`, `UiLoading` 등 ispark-ui 컴포넌트를 우선 사용한다.
- 성인물은 DB 저장과 API 응답에서 제외한다.
- 재개봉은 `openDt 연도 - productionYear >= 2`인 추정값이며 정확한 공식 분류로 표현하지 않는다.
- 배열의 영화 객체를 교체할 때 `monthMovies`, `nowShowing`, `selectedMovie`를 모두 동기화한다.
- 요청받지 않은 리팩터링과 북마크 전용 페이지는 추가하지 않는다.
- 각 작업의 변경은 검증하되 사용자가 별도로 요청하기 전에는 커밋하지 않는다.

---

## File Map

### 신규

- `backend/src/services/movieMetadata.ts`: 성인 장르 및 재개봉 판정 순수 함수
- `backend/src/services/movieMetadata.test.ts`: 동기화 판정 단위 테스트
- `backend/src/services/tmdb.ts`: TMDB 검색, 후보 매칭, 응답 파싱
- `backend/src/services/tmdb.test.ts`: TMDB 매칭 단위 테스트
- `backend/src/routes/movies.test.ts`: 북마크 및 영화 조회 라우트 테스트
- `frontend/src/utils/movieDisplay.ts`: 날짜·색·재개봉 제목 표시 순수 함수
- `frontend/src/utils/movieDisplay.test.ts`: 프론트 표시 규칙 테스트

### 수정

- `backend/package.json`: Vitest/Supertest 테스트 스크립트와 개발 의존성
- `backend/prisma/schema.prisma`: `Movie` 확장 및 `MovieBookmark` 관계 추가
- `backend/src/services/kobis.ts`: `prdtYear` 응답 타입 추가
- `backend/src/services/syncMoviesCron.ts`: 제작연도 저장, 재개봉 판정, 성인물 제외/정리
- `backend/src/routes/movies.ts`: TMDB 지연 보강, 성인물 방어 필터, 북마크 API
- `backend/.env.example`: `TMDB_API_KEY` 항목
- `frontend/package.json`: Vitest 테스트 스크립트와 개발 의존성
- `frontend/src/types/movie.ts`: 신규 Movie 필드 추가
- `frontend/src/views/ScreeningCalendarView.vue`: 북마크 조회, 색/범례, 객체 동기화
- `frontend/src/components/screening/MovieDetailDrawer.vue`: 상세 재조회, 포스터·줄거리·북마크·재개봉 UI

---

### Task 1: 테스트 기반과 영화 분류 규칙

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/services/movieMetadata.ts`
- Create: `backend/src/services/movieMetadata.test.ts`

**Interfaces:**
- Produces: `isAdultGenre(genre?: string | null): boolean`
- Produces: `isLikelyRerelease(openDt: Date | null, productionYear: number | null): boolean`

- [ ] **Step 1: Vitest 설치 및 스크립트 추가**

Run:

```powershell
cd backend
npm install --save-dev vitest supertest @types/supertest
```

`backend/package.json`에 `"test": "vitest run"`을 추가한다.

- [ ] **Step 2: 분류 규칙 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest'
import { isAdultGenre, isLikelyRerelease } from './movieMetadata'

describe('isAdultGenre', () => {
  it.each(['성인물(에로)', '드라마,에로', '성인물'])('%s를 제외한다', genre => {
    expect(isAdultGenre(genre)).toBe(true)
  })
  it.each(['드라마', '멜로/로맨스', null])('%s는 유지한다', genre => {
    expect(isAdultGenre(genre)).toBe(false)
  })
})

describe('isLikelyRerelease', () => {
  it('제작 2년 뒤 개봉이면 재개봉으로 추정한다', () => {
    expect(isLikelyRerelease(new Date('2026-07-01T00:00:00Z'), 2024)).toBe(true)
  })
  it('1년 차이거나 값이 없으면 false다', () => {
    expect(isLikelyRerelease(new Date('2026-07-01T00:00:00Z'), 2025)).toBe(false)
    expect(isLikelyRerelease(null, 2020)).toBe(false)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/services/movieMetadata.test.ts`

Expected: `movieMetadata` 모듈을 찾지 못해 FAIL.

- [ ] **Step 4: 최소 구현**

```ts
export function isAdultGenre(genre?: string | null): boolean {
  if (!genre) return false
  const normalized = genre.replace(/\s/g, '').toLowerCase()
  return normalized.includes('성인물') || normalized.includes('에로')
}

export function isLikelyRerelease(openDt: Date | null, productionYear: number | null): boolean {
  return !!openDt && productionYear != null
    && openDt.getUTCFullYear() - productionYear >= 2
}
```

- [ ] **Step 5: 단위 테스트와 빌드 확인**

Run:

```powershell
npm test -- src/services/movieMetadata.test.ts
npm run build
```

Expected: 테스트 PASS, TypeScript 빌드 성공.

---

### Task 2: Prisma 모델과 KOBIS 동기화 확장

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/services/kobis.ts`
- Modify: `backend/src/services/syncMoviesCron.ts`

**Interfaces:**
- Consumes: `isAdultGenre`, `isLikelyRerelease`
- Produces: `Movie.productionYear`, `isRerelease`, `tmdbId`, `overview`, `posterPath`, `tmdbCheckedAt`
- Produces: `MovieBookmark`의 `userId_movieCd` 복합 unique 입력

- [ ] **Step 1: Prisma 모델 변경**

`User`에 `movieBookmarks MovieBookmark[]`, `Movie`에 TMDB/재개봉 필드와 `bookmarks` 관계를 추가한다. `MovieBookmark`는 다음 형태로 추가한다.

```prisma
model MovieBookmark {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  movieCd   String   @map("movie_cd")
  createdAt DateTime @default(now()) @map("created_at")

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  movie Movie @relation(fields: [movieCd], references: [movieCd], onDelete: Cascade)

  @@unique([userId, movieCd])
  @@map("movie_bookmarks")
}
```

- [ ] **Step 2: DB 스키마와 생성 클라이언트 반영**

Run:

```powershell
npx prisma db push
npx prisma generate
```

Expected: DB push 및 Prisma Client 생성 성공. 실제 `.env` 값은 출력하지 않는다.

- [ ] **Step 3: KOBIS 타입과 upsert 변경**

`KobisMovie`에 `prdtYear?: string`을 추가한다. `upsertMovieMeta`는 성인 장르면 즉시 반환하고, 그 외에는 `productionYear`와 `isRerelease`를 저장한다.

```ts
const openDt = parseKobisDate(m.openDt)
const productionYear = /^\d{4}$/.test(m.prdtYear || '') ? Number(m.prdtYear) : null
if (isAdultGenre(m.genreAlt || m.repGenreNm)) return

const data = {
  // 기존 필드
  openDt,
  productionYear,
  isRerelease: isLikelyRerelease(openDt, productionYear),
}
```

- [ ] **Step 4: 기존 성인물 정리와 API 방어 조건 준비**

연간 영화목록 동기화가 끝난 뒤 장르가 있는 기존 행을 조회하고 `isAdultGenre`로 판정된 ID를 `deleteMany`한다. Prisma의 데이터베이스별 대소문자 옵션에 의존하지 않고 동일한 순수 함수를 사용한다.

- [ ] **Step 5: 검증**

Run:

```powershell
npm test
npm run build
npx prisma validate
```

Expected: 테스트 PASS, 빌드 성공, schema valid.

---

### Task 3: TMDB 지연 보강 서비스

**Files:**
- Create: `backend/src/services/tmdb.ts`
- Create: `backend/src/services/tmdb.test.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `findTmdbMovie(movie: TmdbLookupMovie): Promise<TmdbMetadata | null>`
- `TmdbLookupMovie = { movieNm: string; movieNmEn: string | null; openDt: Date | null }`
- `TmdbMetadata = { tmdbId: number; overview: string | null; posterPath: string | null }`

- [ ] **Step 1: 후보 선택 실패 테스트 작성**

fetch와 후보 선택을 분리하여 `selectTmdbCandidate(candidates, movie)` 순수 함수를 테스트한다.

```ts
it('제목과 개봉연도가 같은 후보를 선택한다', () => {
  const result = selectTmdbCandidate([
    { id: 1, title: '동명', original_title: 'Other', release_date: '2020-01-01' },
    { id: 2, title: '동명', original_title: 'Same', release_date: '2026-07-01' },
  ], { movieNm: '동명', movieNmEn: 'Same', openDt: new Date('2026-07-01Z') })
  expect(result?.id).toBe(2)
})

it('같은 우선순위 후보가 둘이면 임의 선택하지 않는다', () => {
  expect(selectTmdbCandidate(ambiguousCandidates, lookup)).toBeNull()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/services/tmdb.test.ts`

Expected: TMDB 모듈이 없어 FAIL.

- [ ] **Step 3: TMDB 클라이언트 구현**

- `https://api.themoviedb.org/3/search/movie`
- 쿼리: `api_key`, `query`, `language=ko-KR`, `include_adult=false`, 가능한 경우 `year`
- 제목은 trim 후 Unicode lower-case 비교한다.
- 동률 후보가 둘 이상이면 `null`.
- HTTP 실패 또는 TMDB 오류 응답은 예외를 던져 라우트가 일시 실패로 구분하게 한다.

- [ ] **Step 4: 환경변수 예시 추가**

`backend/.env.example`에 실제 키 없이 다음 한 줄을 추가한다.

```dotenv
TMDB_API_KEY=
```

- [ ] **Step 5: 테스트·빌드 확인**

Run:

```powershell
npm test -- src/services/tmdb.test.ts
npm run build
```

Expected: 테스트 PASS, 빌드 성공.

---

### Task 4: 영화 상세 보강과 북마크 API

**Files:**
- Modify: `backend/src/routes/movies.ts`
- Create: `backend/src/routes/movies.test.ts`

**Interfaces:**
- Consumes: `findTmdbMovie`, `isAdultGenre`, Prisma `movieBookmark`
- Produces:
  - `GET /movies/bookmarks -> { data: string[] }`
  - `POST /movies/:movieCd/bookmark -> { data: { movieCd: string } }`
  - `DELETE /movies/:movieCd/bookmark -> { data: { movieCd: string } }`
  - 확장된 `GET /movies/:movieCd -> { data: Movie }`

- [ ] **Step 1: 라우트 테스트 작성**

Vitest에서 Prisma와 TMDB 모듈을 mock하고 Express 테스트 앱에 movieRouter만 장착한다. 인증은 유효 JWT를 `signToken`으로 생성한다.

검증 케이스:
- 내 북마크 코드만 반환
- POST가 `userId_movieCd` 기준 upsert
- DELETE가 `deleteMany({ userId, movieCd })`
- `tmdbCheckedAt`이 null일 때만 TMDB 호출
- TMDB 네트워크 실패 시 기존 영화 200 응답 및 `tmdbCheckedAt` 미기록
- 정상 매칭 실패 시 `tmdbCheckedAt` 기록
- 성인 장르 영화가 월별/현재상영작 응답에서 제외

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/routes/movies.test.ts`

Expected: 신규 엔드포인트 또는 mock 호출 기대가 맞지 않아 FAIL.

- [ ] **Step 3: 북마크 엔드포인트 구현**

`/bookmarks`, `/now-showing`, `/:movieCd/bookmark`, `/:movieCd` 순으로 선언한다. 사용자 ID는 항상 `req.user!.id`를 사용한다.

- [ ] **Step 4: 상세 TMDB 보강 구현**

영화가 있고 `tmdbCheckedAt === null`이며 키가 있을 때만 조회한다.

```ts
try {
  const metadata = await findTmdbMovie(movie)
  const data = metadata
    ? { ...metadata, tmdbCheckedAt: new Date() }
    : { tmdbCheckedAt: new Date() }
  movie = await prisma.movie.update({ where: { movieCd }, data })
} catch (error) {
  console.error('TMDB enrichment failed:', error)
}
```

- [ ] **Step 5: 성인물 방어 필터 구현**

월별/현재상영작 쿼리 결과에 `!isAdultGenre(movie.genreNm)` 필터를 적용한다. 장르 null은 유지한다.

- [ ] **Step 6: 라우트 테스트·전체 빌드**

Run:

```powershell
npm test
npm run build
```

Expected: 전체 백엔드 테스트 PASS, 빌드 성공.

---

### Task 5: 프론트 표시 규칙과 타입

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/types/movie.ts`
- Create: `frontend/src/utils/movieDisplay.ts`
- Create: `frontend/src/utils/movieDisplay.test.ts`

**Interfaces:**
- Produces: 확장된 `Movie`
- Produces: `movieCalendarColor(movie, bookmarks, today): string`
- Produces: `movieCalendarTitle(movie): string`

- [ ] **Step 1: Vitest 설치**

Run:

```powershell
cd frontend
npm install --save-dev vitest
```

`frontend/package.json`에 `"test": "vitest run"`을 추가한다.

- [ ] **Step 2: 표시 규칙 실패 테스트 작성**

```ts
it('북마크 색이 개봉 상태보다 우선한다', () => {
  expect(movieCalendarColor(movie, new Set([movie.movieCd]), '2026-07-21'))
    .toBe('#f59e0b')
})

it('재개봉 제목에 접두어를 붙인다', () => {
  expect(movieCalendarTitle({ ...movie, isRerelease: true }))
    .toBe('[재개봉] 영화명')
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/utils/movieDisplay.test.ts`

Expected: 유틸 모듈이 없어 FAIL.

- [ ] **Step 4: 타입과 최소 구현**

`Movie`에 `productionYear`, `isRerelease`, `tmdbId`, `overview`, `posterPath`, `tmdbCheckedAt`을 추가하고 색 우선순위와 제목 생성 함수를 구현한다.

- [ ] **Step 5: 테스트·빌드**

Run:

```powershell
npm test
npm run build
```

Expected: 테스트 PASS, Vue TypeScript 빌드 성공.

---

### Task 6: 상세 드로어 UI

**Files:**
- Modify: `frontend/src/components/screening/MovieDetailDrawer.vue`

**Interfaces:**
- Props: `open`, `movie`, `bookmarked`
- Emits: `update:open`, `movie-updated`, `bookmark-changed`
- Consumes: `GET /movies/:movieCd`, POST/DELETE bookmark API

- [ ] **Step 1: 컴포넌트 상태와 이벤트 추가**

- `detailLoading`, `bookmarkLoading`, `imageFailed`
- 드로어가 닫힘→열림으로 바뀔 때 상세 API 조회
- 응답 영화는 `movie-updated` emit
- 영화가 바뀌면 `imageFailed = false`

- [ ] **Step 2: 북마크 토글 구현**

`bookmarked`가 false면 POST, true면 DELETE. 성공 시 `bookmark-changed`로 `{ movieCd, bookmarked }`를 emit하고 실패 시 `openToast`를 표시한다. 요청 중 버튼을 중복 실행하지 않는다.

- [ ] **Step 3: ispark-ui 기반 상세 UI 구현**

- 상단 `UiButton` + `UiIcon name="star"`
- `isRerelease`일 때 재개봉 배지
- `posterPath && !imageFailed`일 때 w342 포스터
- `overview`가 있을 때만 줄거리 섹션
- 상세 조회 중 내용 영역 `UiLoading`

- [ ] **Step 4: 접근성·반응형·다크 모드 확인**

- 포스터 `alt="{영화명} 포스터"`
- 북마크 버튼 `aria-label`
- 좁은 화면에서 포스터와 정보가 세로 정렬
- 새 텍스트와 배지가 다크 모드에서 읽히는지 확인

- [ ] **Step 5: 프론트 빌드**

Run: `npm run build`

Expected: Vue/TypeScript/SCSS 빌드 성공.

---

### Task 7: 캘린더 북마크·재개봉 연동과 참조 동기화

**Files:**
- Modify: `frontend/src/views/ScreeningCalendarView.vue`

**Interfaces:**
- Consumes: `GET /movies/bookmarks`, `movieCalendarColor`, `movieCalendarTitle`
- Consumes drawer events: `movie-updated`, `bookmark-changed`

- [ ] **Step 1: 북마크 목록 조회**

화면 진입 시 `/movies/bookmarks`를 호출해 `bookmarkedCodes.value = new Set(data.data)`로 저장한다. 실패하면 빈 Set으로 화면을 유지한다.

- [ ] **Step 2: 캘린더 매핑과 범례 변경**

이벤트의 `color`는 `movieCalendarColor`, `title`은 `movieCalendarTitle`을 사용한다. 범례에 노랑 점과 "보고싶은 영화"를 추가한다.

- [ ] **Step 3: 객체 동기화 함수 구현**

```ts
function syncMovie(updated: Movie) {
  monthMovies.value = monthMovies.value.map(m => m.movieCd === updated.movieCd ? updated : m)
  nowShowing.value = nowShowing.value.map(m => m.movieCd === updated.movieCd ? updated : m)
  if (selectedMovie.value?.movieCd === updated.movieCd) selectedMovie.value = updated
}
```

캐시에도 갱신된 `monthMovies`와 `nowShowing`을 다시 저장해 다음 화면 진입에서 stale 객체가 복원되지 않게 한다.

- [ ] **Step 4: 북마크 이벤트 동기화**

```ts
function onBookmarkChanged({ movieCd, bookmarked }: BookmarkChange) {
  const next = new Set(bookmarkedCodes.value)
  bookmarked ? next.add(movieCd) : next.delete(movieCd)
  bookmarkedCodes.value = next
}
```

- [ ] **Step 5: 재개봉 목록 배지 추가**

선택일 및 현재상영작의 제목 옆에 `isRerelease`일 때 "재개봉" 소형 배지를 표시한다.

- [ ] **Step 6: 테스트·빌드**

Run:

```powershell
npm test
npm run build
```

Expected: 표시 규칙 테스트 PASS, 프론트 빌드 성공.

---

### Task 8: 통합 검증과 작업 기록

**Files:**
- Verify: all changed files
- External: TaskFlow 프로젝트 #32 이슈

- [ ] **Step 1: 전체 자동 검증**

Run from repository root:

```powershell
npm run db:generate
npm run build
cd backend
npm test
cd ../frontend
npm test
```

Expected: Prisma 생성, 양쪽 빌드, 모든 테스트 성공.

- [ ] **Step 2: IDE 진단 확인**

변경한 TypeScript/Vue/Prisma 파일의 신규 linter 오류가 없는지 확인하고, 도입한 오류만 수정한다.

- [ ] **Step 3: 실제 API 검증**

- 로컬 `.env`에 사용자가 발급한 `TMDB_API_KEY`가 있을 때 일반 영화 상세을 열어 줄거리·포스터 확인
- 키가 없을 때 기존 상세가 정상 표시되는지 확인
- 북마크 토글 후 캘린더 배지가 노랑으로 즉시 바뀌는지 확인
- 최근 재개봉작과 성인물 샘플을 KOBIS 실제 데이터로 대조

실제 키가 없으면 TMDB 실데이터 검증만 미완료로 명시하고, mock 테스트와 fallback 동작은 완료한다.

- [ ] **Step 4: 변경 범위 점검**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: 공백 오류 없음, 요청 범위 파일만 변경.

- [ ] **Step 5: 작업 이슈 등록**

커밋이 요청되어 커밋을 만든 경우에만 `docs/rules-issue-tracking.md` 형식으로 TaskFlow 프로젝트 #32에 완료 이슈를 등록한다. 커밋 요청이 없으면 이슈 등록도 보류하고 최종 보고에 명시한다.

