# 상영 캘린더 (Screening Calendar) 설계 스펙

- 작성일: 2026-07-20
- 대상 프로젝트: TaskFlow
- 목표: 현재상영작·상영예정작을 월간 캘린더로 보여주는 화면 추가

## 1. 배경 / 목표

TaskFlow는 개인 대시보드(할일·주식·프로젝트·식단·메모)로, **영화/상영 데이터가 전혀 없다.**
좌측 메뉴에 신규 항목 "상영 캘린더"를 추가하여, KOBIS 오픈API 기반으로 개봉작을 월간 캘린더에
표시하고, 현재상영작을 별도 리스트로 함께 보여준다.

## 2. 확정된 결정

| 항목 | 결정 |
|------|------|
| 데이터 소스 | KOBIS 오픈API (단일 소스) |
| 표시 방식 | 하이브리드 — 캘린더=개봉일 마킹 + 현재상영작 별도 리스트 |
| 데이터 파이프라인 | 크론 1일 1회 → DB 저장, 프론트는 DB만 조회 |
| 캘린더 UI | ispark-ui `UiCalendarMonth` 재사용 (외부 라이브러리 미도입) |
| 클릭 동작 | 상세 드로어(`UiDrawer`), 포스터 없이 텍스트만 |
| 다편 처리 | 칸에 N개 + "더보기", 날짜 클릭 → 그날 개봉작 리스트 |
| 색 구분 | 2색 — 예정(미래 개봉일)=파랑 / 개봉함(개봉일 ≤ 오늘)=초록 |

### 스택 정정
요청서에는 "Vue3 + Nuxt3"로 적혀 있었으나 실제 TaskFlow는 **Vue3 + Vite SPA**(vue-router +
`frontend/src/views/` + `layouts/AppLayout.vue`)다. Nuxt 아님. 본 스펙은 실제 스택 기준으로 작성한다.

## 3. 아키텍처

```
KOBIS API ──(매일 새벽 크론)──▶ Movie 테이블(DB) ──▶ /movies API ──▶ 상영캘린더 화면
  ├ 영화목록(searchMovieList)     : 개봉작·개봉일·감독·제작상태
  └ 일별박스오피스(searchDailyBoxOfficeList): 현재상영작·순위·관객수
```

프론트엔드는 KOBIS를 직접 호출하지 않는다. DB만 조회하므로 응답이 빠르고 KOBIS의 호출 제한/장애에
영향받지 않는다.

## 4. 데이터 모델 — `Movie` 테이블 (Prisma 신규)

| 필드 | 타입 | 용도 |
|------|------|------|
| `movieCd` | String @unique | KOBIS 영화코드 (중복·충돌 방지 키, upsert 기준) |
| `movieNm` | String | 한글 제목 |
| `movieNmEn` | String? | 영문 제목 |
| `openDt` | DateTime? (@db.Date) | 개봉일 — 캘린더 배치 기준. null(미정)이면 캘린더에서 제외 |
| `prdtStatNm` | String? | 제작상태 (개봉 / 개봉예정 등) |
| `genreNm` | String? | 장르 (상세 드로어용) |
| `nationNm` | String? | 제작국가 (상세 드로어용) |
| `directors` | String? | 감독명(들). KOBIS 배열을 콤마 조인해 저장 |
| `boxRank` | Int? | 최신 박스오피스 순위 (없으면 박스오피스 밖) |
| `audiCnt` | Int? | 박스오피스 기준일 관객수 |
| `audiAcc` | Int? | 누적 관객수 |
| `boxUpdatedAt` | DateTime? | 박스오피스 기준일 |
| `syncedAt` | DateTime | 마지막 동기화 시각 |

### 상태(배지 색) 규칙
- `openDt > 오늘` → **예정 (파랑)**
- `openDt ≤ 오늘` → **개봉 (초록)**
- 색 판정은 순수하게 개봉일 대 오늘 비교로 결정한다(단순·명확).

### "현재상영작" 판정
- 캘린더 배지 색과 별개로, **현재상영작 리스트**는 최신 박스오피스(`boxRank`가 존재하는 행)를
  순위 오름차순으로 산출한다. 선택된 월과 무관하게 "지금 상영 중"을 보여준다.

## 5. 백엔드

### 5.1 KOBIS 클라이언트 — `backend/src/services/kobis.ts`
KOBIS 호출 래퍼 + 응답 파싱. API 키는 `KOBIS_API_KEY` 환경변수에서 읽는다.
- `fetchMovieList({ openYear, curPage })` → `searchMovieList.json` (개봉작 목록; openStartDt/openEndDt는 연도 단위 필터, 월 필터는 `openDt`로 후처리)
- `fetchDailyBoxOffice({ targetDt })` → `searchDailyBoxOfficeList.json` (일별 박스오피스)
- `fetchMovieInfo({ movieCd })` → `searchMovieInfo.json` (상세; 필요 시 사용)

### 5.2 동기화 크론 — `backend/src/cron/syncMovies.ts`
기존 스코어 크론 패턴을 따른다. 매일 1회 실행:
1. **박스오피스**: "어제"자 `fetchDailyBoxOffice` 호출(KOBIS는 당일 데이터가 다음날 확정). 비어 있으면
   하루씩 뒤로 폴백(최대 며칠). 결과로 `boxRank`/`audiCnt`/`audiAcc`/`boxUpdatedAt` 갱신.
2. **개봉작 목록**: 당해 연도(필요 시 ±1년) `fetchMovieList`로 페이지 순회. `openDt`/`prdtStatNm`/
   `genreNm`/`nationNm`/`directors` 갱신.
3. `movieCd` 기준으로 `Movie` upsert(멱등). 박스오피스에서 사라진 영화의 `boxRank`는 이번 동기화에서
   갱신되지 않은 경우 null 처리(현재상영작에서 빠지도록).

### 5.3 API 라우트 — `backend/src/routes/movies.ts` (`authenticate` 적용)
- `GET /movies?year&month` → 해당 월에 `openDt`가 속하는 개봉작 목록 (캘린더용)
- `GET /movies/now-showing` → 최신 박스오피스 리스트 (현재상영작), `boxRank` 오름차순
- `GET /movies/:movieCd` → 단일 영화 상세 (드로어용)

라우트는 `backend/src/index`(또는 app 엔트리)에 `/api/movies`로 등록한다.

## 6. 프론트엔드

### 6.1 화면 — `frontend/src/views/ScreeningCalendarView.vue`
- 라우트: `/screenings` (`frontend/src/router.ts`의 `AppLayout` children에 추가)
- 메뉴: `frontend/src/layouts/AppLayout.vue` 사이드바에 "상영 캘린더" 항목 추가
- 레이아웃: 좌측 `UiCalendarMonth`(개봉작 배지, 2색) / 우측 "현재상영작" 리스트(박스오피스 순위)
- 날짜 클릭 시: 그날 개봉작 리스트 표시(기존 `CalendarEventList` 패턴 재사용)
- 데이터 매핑: `movie → CalendarMonthEvent { id: movieCd, start: openDt, end: null, color: 상태색, title: movieNm, meta: movie }`
- 월별 캐시는 기존 `frontend/src/composables/useCachedFetch` 패턴 재사용
- API 호출은 기존 `frontend/src/api/client` 사용

### 6.2 상세 드로어 — `frontend/src/components/screening/MovieDetailDrawer.vue`
- 캘린더 배지 또는 현재상영작 리스트 항목 클릭 → `UiDrawer`로 상세 표시(텍스트만)
- 표시 항목: 제목, 개봉일, 제작상태, 감독, 장르, 제작국가, 박스오피스 순위/관객수/누적관객수
- 포스터 이미지는 없음(KOBIS 미제공). 향후 확장 여지로만 남김

## 7. 엣지 케이스 / 에러 처리

- KOBIS 박스오피스는 다음날 확정 → 크론은 "어제"자 조회, 비면 하루씩 폴백.
- `openDt` 미정/빈값 → 캘린더에서 제외(현재상영작 리스트에는 나올 수 있음).
- KOBIS 장애/호출 제한 → 크론만 실패 로깅하고 종료, DB의 마지막 데이터 유지 → 화면은 정상 동작.
- 재개봉·동명 영화 → `movieCd`로 구분되어 안전.
- 같은 날 다수 개봉 → 캘린더 칸은 N개 + "더보기", 날짜 클릭으로 전체 리스트 확인.

## 8. 테스트

- 백엔드
  - KOBIS 응답 파싱(목킹된 JSON 기준)
  - 상태(배지 색) 판정 로직: `openDt` 대 오늘 비교
  - 월 필터 쿼리(`GET /movies?year&month`)
  - 크론 upsert 멱등성(같은 데이터 재실행 시 중복 생성 없음)
- 프론트
  - `movie → CalendarMonthEvent` 매핑 및 색 로직
  - 현재상영작 리스트 정렬(순위 오름차순)

## 9. 사전 준비물 (사용자 직접)

KOBIS 오픈API **키 발급 필요** (kobis.or.kr → 오픈API 신청, 무료).
발급받은 키를 백엔드 환경변수 `KOBIS_API_KEY`에 설정해야 크론이 동작한다.

## 10. 범위 밖 (이번 버전 제외, 향후 확장)

- 포스터 이미지 (TMDB 등 보조 소스 연동)
- 상영기간(종영일) 막대 표시 — KOBIS가 종영일을 제공하지 않아 추정이 필요하므로 제외
- 개인 관람 계획/즐겨찾기, 알림 등 부가 기능
