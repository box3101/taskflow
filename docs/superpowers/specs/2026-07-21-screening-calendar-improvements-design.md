# 상영 캘린더 개선 (Screening Calendar v2) 설계 스펙

- 작성일: 2026-07-21
- 대상 프로젝트: TaskFlow
- 선행 스펙: [2026-07-20-screening-calendar-design.md](./2026-07-20-screening-calendar-design.md)
- 목표: 상영 캘린더에 **TMDB 줄거리·포스터 / 사용자별 북마크 / 성인물 제외 / 재개봉 표시**를 추가

## 1. 배경 / 목표

v1(상영 캘린더)은 KOBIS 데이터만으로 개봉작 캘린더 + 현재상영작 + 텍스트 상세 드로어를 제공했다.
v2에서는 다음 네 가지를 더한다.

| 기능 | 한 줄 요약 |
|------|-----------|
| TMDB 줄거리·포스터 | 텍스트만이던 상세에 포스터 이미지와 줄거리(overview)를 붙인다 |
| 사용자별 북마크 | "보고 싶은 영화"를 사용자별로 저장·필터 |
| 성인물 제외 | 캘린더에서 성인물(제한상영가 등)을 숨긴다 |
| 재개봉 표시 | 옛 영화의 재개봉을 별도로 표식 |

## 2. 확정된 결정

| 항목 | 결정 |
|------|------|
| KOBIS 역할 | v1 그대로 — 개봉·박스오피스의 **기준 데이터**. 성인물 제외·재개봉 판정은 동기화 단계에서 수행 |
| TMDB 조회 시점 | **상세 조회 시 백엔드에서 1회 조회 → `Movie`에 캐시**(지연 캐시). 크론 일괄 조회 안 함(호출량·속도) |
| TMDB 매칭 | 공통 키가 없어 **제목 + 개봉연도**로 검색, 첫 결과 사용(best-effort). 포스터/줄거리라 오매칭이 치명적이지 않음 |
| 북마크 | 사용자–영화를 잇는 **별도 모델**(`MovieBookmark`)로 관리 |
| 성인물 판정 | TMDB `adult` 플래그를 우선 활용(상세 캐시 시 함께 저장). KOBIS 관람등급은 목록 API 미제공이라 보조 |
| stale 방지 | 프론트는 **영화 배열과 선택 객체(드로어 대상)를 함께 갱신**해 참조 어긋남 방지 |

## 3. 아키텍처

```
[크론] KOBIS ──동기화──▶ Movie(기준 데이터) ── 성인물 제외/재개봉 판정 (동기화 단계)
                              │
[상세 열람] 드로어 열기 ──▶ GET /movies/:movieCd
                              └ tmdbSyncedAt 없으면 → TMDB 1회 조회 → Movie에 캐시(overview/poster/adult)
                              └ 있으면 → 캐시 그대로 반환

[북마크] 사용자 ──▶ MovieBookmark(userId ↔ movieCd)  (KOBIS/TMDB와 독립)
```

TMDB는 **읽기 경로(상세)**에서만, 그것도 1회만 건드린다. 크론(쓰기)은 KOBIS만 다룬다.

## 4. 데이터 모델

### 4.1 `Movie` 확장 (기존 모델에 필드 추가)

| 필드 | 타입 | 용도 |
|------|------|------|
| `tmdbId` | Int? | TMDB 영화 ID (매칭 성공 시) |
| `overview` | String? @db.Text | 줄거리 (TMDB, ko-KR) |
| `posterPath` | String? | TMDB 포스터 경로 (`/xxxx.jpg`) |
| `adult` | Boolean? | 성인물 여부 (TMDB adult 플래그) — 성인물 제외에 사용 |
| `isRerelease` | Boolean @default(false) | 재개봉 여부 (동기화 단계 판정) |
| `tmdbSyncedAt` | DateTime? | TMDB 조회 시도 시각. **miss여도 기록**해 재호출 방지 |

### 4.2 `MovieBookmark` (신규)

| 필드 | 타입 | 용도 |
|------|------|------|
| `id` | Int @id @default(autoincrement()) | PK |
| `userId` | Int | 사용자 |
| `movieCd` | String | 영화(KOBIS 코드) |
| `createdAt` | DateTime @default(now()) | 담은 시각 |

- `@@unique([userId, movieCd])` — 중복 북마크 방지
- 조회 성능을 위해 `movieCd`는 `Movie.movieCd`(@unique)와 논리적으로 연결(앱 레벨 조인)

## 5. 백엔드

### 5.1 TMDB 클라이언트 — `services/tmdb.ts` (신규)
- API 키는 `TMDB_API_KEY` 환경변수. v3 `api_key` 쿼리 방식.
- `searchMovie({ title, year })` → `GET /3/search/movie?query=&year=&language=ko-KR`
  - 첫 결과에서 `{ tmdbId, overview, posterPath, adult }` 추출. 결과 없음/키 없음/실패 시 `null`.

### 5.2 상세 라우트 — `GET /movies/:movieCd` (지연 캐시 로직 추가)
1. `Movie` 조회. 없으면 404.
2. `tmdbSyncedAt`이 null이면 → `tmdb.searchMovie({ title: movieNm, year: openDt의 연도 })` 호출.
3. 결과를 `Movie`에 업데이트(`overview`/`posterPath`/`adult`/`tmdbId`/`tmdbSyncedAt=now()`). miss여도 `tmdbSyncedAt`은 기록.
4. 채워진 `Movie`를 응답. (프론트 계약 불변 — 필드만 늘어남)

### 5.3 성인물 제외 (동기화/조회 단계)
- 캘린더용 조회(`GET /movies?year&month`)와 현재상영작(`/now-showing`)에서 `adult = true` 행 제외.
- `adult`는 상세를 한 번이라도 연 영화만 채워지므로, 보수적으로는 동기화 시 대표작 위주 프리페치 또는 "판명된 성인물만 숨김" 정책. (판정 소스가 붙는 대로 강화)

### 5.4 재개봉 판정 (동기화 단계)
- KOBIS `Movie`의 개봉연도(`openDt`의 연도)가 제작연도(`prdtYear`)보다 유의미하게 뒤(예: +2년 이상)면 `isRerelease = true`.
- upsert 시 계산해 저장.

### 5.5 북마크 라우트 — `routes/movieBookmarks.ts` (신규, `authenticate`)
- `GET /movie-bookmarks` → 내 북마크 목록(영화 조인)
- `POST /movie-bookmarks` `{ movieCd }` → 추가(멱등, unique)
- `DELETE /movie-bookmarks/:movieCd` → 제거

## 6. 프론트엔드

### 6.1 타입 — `types/movie.ts`
- `Movie`에 `tmdbId/overview/posterPath/adult/isRerelease` 추가.
- `MovieBookmark` 타입 신규.

### 6.2 상세 드로어 — `MovieDetailDrawer.vue`
- `posterPath` 있으면 상단에 포스터 이미지: `https://image.tmdb.org/t/p/w500{posterPath}`.
- `overview` 있으면 "줄거리" 섹션.
- `isRerelease`면 상태 배지 옆 "재개봉" 표식.
- 북마크 토글 버튼(담기/해제) — 클릭 시 `movie-bookmarks` API 호출 후 **영화 배열 + 선택 객체 동시 갱신**(stale 방지).

### 6.3 화면 — `ScreeningCalendarView.vue`
- 성인물은 응답 단계에서 이미 빠져 옴(별도 처리 불필요).
- (선택) "내 북마크만" 필터 토글 — 켜면 북마크한 영화만 배지/리스트에 표시.
- 재개봉 배지: 캘린더 배지/리스트 항목에 작은 "재" 표식.

## 7. 엣지 케이스

- TMDB 매칭 실패 → `overview/posterPath` null, 드로어는 기존 텍스트만(우아한 축소).
- TMDB 키 미설정/장애 → 상세는 KOBIS 데이터로 정상 동작, 포스터/줄거리만 비어 있음.
- 동명이인·리메이크로 오매칭 → best-effort 수용. 필요 시 `tmdbId` 수동 교정 여지.
- 재개봉 오판정(제작연도 데이터 부실) → 표식만 영향, 데이터 훼손 없음.
- 북마크한 영화가 이후 성인물로 판명 → 북마크 목록엔 남기되 캘린더 노출만 정책에 따름.

## 8. 범위 밖 (v2 제외)

- TMDB 배경(backdrop)·평점·출연진 등 확장 메타(줄거리·포스터로 한정).
- 성인물의 "표시하되 블러" 옵션(현재는 제외만).
- 북마크 알림/공유.

## 9. 사전 준비물

- **TMDB API 키 발급** (themoviedb.org → Settings → API, 무료). 백엔드 `.env`의 `TMDB_API_KEY`에 설정.

## 10. 구현 순서 (마일스톤)

> 실제 구현은 팀에서 선행 진행됨. 본 문서는 그 설계 기준을 정리한다.

- **M2 TMDB 줄거리·포스터** — `Movie` 확장 + `tmdb.ts` + 상세 라우트 지연 캐시 + 드로어 포스터/줄거리. (`adult` 플래그 함께 확보 → M1 재사용)
- **M1 성인물 제외** — 조회 단계에서 `adult` 제외.
- **M3 사용자별 북마크** — `MovieBookmark` + 북마크 API + 프론트 토글/필터.
- **M4 재개봉 표시** — 동기화 단계 `isRerelease` 판정 + 프론트 표식.
