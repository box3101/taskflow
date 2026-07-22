<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { UiButton, UiIcon, UiLoading, UiCalendarMonth, UiDrawer, openToast } from '@leechanyong/ispark-ui'
import type { CalendarMonthEvent } from '@leechanyong/ispark-ui'
import api from '../api/client'
import { getCached, setCached } from '../composables/useCachedFetch'
import type { Movie } from '../types/movie'
import { movieCalendarColor } from '../utils/movieDisplay'
import MovieDetailDrawer from '../components/screening/MovieDetailDrawer.vue'

type BookmarkChange = { movieCd: string; bookmarked: boolean }

const loading = ref(true)
const monthMovies = ref<Movie[]>([]) // 선택 월 개봉작 (캘린더 배지 + 그날 개봉작)
const nowShowing = ref<Movie[]>([])  // 현재상영작 (박스오피스)
const bookmarkedMovies = ref<Movie[]>([]) // 보고싶은 영화 목록 (드로어용 전체 정보)
const bookmarkedCodes = ref<Set<string>>(new Set())
const bookmarkPending = ref<Set<string>>(new Set()) // 토글 진행 중인 movieCd (중복 클릭 방지)
const bookmarkListOpen = ref(false)

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

const drawerOpen = ref(false)
const selectedMovie = ref<Movie | null>(null)

const monthLabel = computed(() => `${currentYear.value}년 ${currentMonth.value}월`)

// ===== 색/날짜 헬퍼 =====
// openDt는 UTC 자정 저장 → 앞 10자리(YYYY-MM-DD)만 쓰면 시간대 밀림 없음
function dateOf(m: Movie): string {
  return (m.openDt ?? '').slice(0, 10)
}
function isUpcoming(dateStr: string): boolean {
  return !!dateStr && dateStr > todayStr
}

// 같은 날짜 안에서는 북마크한 영화를 먼저 (캘린더 바·사이드 목록 공통)
function compareMoviesForDisplay(a: Movie, b: Movie): number {
  const da = dateOf(a)
  const db = dateOf(b)
  if (da !== db) return da.localeCompare(db)
  const aBook = bookmarkedCodes.value.has(a.movieCd) ? 0 : 1
  const bBook = bookmarkedCodes.value.has(b.movieCd) ? 0 : 1
  if (aBook !== bBook) return aBook - bBook
  return a.movieNm.localeCompare(b.movieNm)
}

// ===== 캘린더 배지 매핑 (movie → CalendarMonthEvent) =====
const calendarMonthEvents = computed<CalendarMonthEvent[]>(() =>
  monthMovies.value
    .filter(m => m.openDt)
    .slice()
    .sort(compareMoviesForDisplay)
    .map(m => {
      const d = dateOf(m)
      return {
        id: m.movieCd,
        start: d,
        end: null,
        title: m.movieNm,
        color: movieCalendarColor(m, bookmarkedCodes.value, todayStr),
        allDay: true,
        meta: m,
      }
    }),
)

// 선택한 날짜의 개봉작 (북마크 우선)
const selectedDayMovies = computed(() =>
  monthMovies.value
    .filter(m => dateOf(m) === selectedDate.value)
    .slice()
    .sort(compareMoviesForDisplay),
)

const dayNames = ['일', '월', '화', '수', '목', '금', '토']
const selectedDateLabel = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`
})

function fmtAcc(n: number | null): string {
  return n != null ? `${n.toLocaleString()}명` : ''
}

// ===== 조회 =====
async function fetchMonth() {
  const cacheKey = `screenings-${currentYear.value}-${currentMonth.value}`
  const cached = getCached<Movie[]>(cacheKey)
  if (cached) {
    monthMovies.value = cached
    loading.value = false
  } else {
    loading.value = true
  }
  try {
    const { data } = await api.get('/movies', {
      params: { year: currentYear.value, month: currentMonth.value },
    })
    monthMovies.value = data.data
    setCached(cacheKey, data.data)
  } catch {
    if (!cached) openToast({ message: '개봉작을 불러오는데 실패했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
}

async function fetchNowShowing() {
  const cacheKey = 'screenings-now-showing'
  const cached = getCached<Movie[]>(cacheKey)
  if (cached) nowShowing.value = cached
  try {
    const { data } = await api.get('/movies/now-showing')
    nowShowing.value = data.data
    setCached(cacheKey, data.data)
  } catch {
    // 갱신 실패 시 기존(stale) 데이터 유지
  }
}

async function fetchBookmarks() {
  try {
    const { data } = await api.get<{ data: Movie[] }>('/movies/bookmarks')
    bookmarkedMovies.value = data.data
    bookmarkedCodes.value = new Set(data.data.map(m => m.movieCd))
  } catch {
    bookmarkedMovies.value = []
    bookmarkedCodes.value = new Set()
  }
}

// ===== 월 이동 =====
function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else { currentMonth.value-- }
}
function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else { currentMonth.value++ }
}
function goToday() {
  const n = new Date()
  currentYear.value = n.getFullYear()
  currentMonth.value = n.getMonth() + 1
  selectedDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

watch([currentYear, currentMonth], () => {
  const n = new Date()
  if (currentYear.value === n.getFullYear() && currentMonth.value === n.getMonth() + 1) {
    selectedDate.value = todayStr
  } else {
    selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  }
  fetchMonth()
})

// ===== 드로어 =====
function openDrawer(m: Movie) {
  selectedMovie.value = m
  drawerOpen.value = true
}
function onSelectEvent(cm: CalendarMonthEvent) {
  openDrawer(cm.meta as Movie)
}

function syncMovie(updated: Movie) {
  monthMovies.value = monthMovies.value.map(m => m.movieCd === updated.movieCd ? updated : m)
  nowShowing.value = nowShowing.value.map(m => m.movieCd === updated.movieCd ? updated : m)
  if (selectedMovie.value?.movieCd === updated.movieCd) selectedMovie.value = updated

  setCached(`screenings-${currentYear.value}-${currentMonth.value}`, monthMovies.value)
  setCached('screenings-now-showing', nowShowing.value)
}

function sortByOpenDt(movies: Movie[]): Movie[] {
  return [...movies].sort((a, b) => {
    const da = dateOf(a) || '9999'
    const db = dateOf(b) || '9999'
    return da === db ? a.movieNm.localeCompare(b.movieNm) : da.localeCompare(db)
  })
}

function onBookmarkChanged({ movieCd, bookmarked }: BookmarkChange, movie?: Movie) {
  const next = new Set(bookmarkedCodes.value)
  bookmarked ? next.add(movieCd) : next.delete(movieCd)
  bookmarkedCodes.value = next

  if (bookmarked) {
    if (bookmarkedMovies.value.some(m => m.movieCd === movieCd)) return
    const target = movie
      ?? monthMovies.value.find(m => m.movieCd === movieCd)
      ?? nowShowing.value.find(m => m.movieCd === movieCd)
      ?? (selectedMovie.value?.movieCd === movieCd ? selectedMovie.value : null)
    if (target) bookmarkedMovies.value = sortByOpenDt([...bookmarkedMovies.value, target])
  } else {
    bookmarkedMovies.value = bookmarkedMovies.value.filter(m => m.movieCd !== movieCd)
  }
}

// 캘린더 카드/북마크 목록에서 바로 토글 (드로어를 열지 않고 별 클릭만으로 처리)
async function toggleBookmark(movie: Movie) {
  if (bookmarkPending.value.has(movie.movieCd)) return

  const bookmarked = !bookmarkedCodes.value.has(movie.movieCd)
  bookmarkPending.value = new Set(bookmarkPending.value).add(movie.movieCd)
  try {
    if (bookmarked) await api.post(`/movies/${movie.movieCd}/bookmark`)
    else await api.delete(`/movies/${movie.movieCd}/bookmark`)
    onBookmarkChanged({ movieCd: movie.movieCd, bookmarked }, movie)
  } catch {
    openToast({ message: bookmarked ? '북마크 추가에 실패했습니다.' : '북마크 해제에 실패했습니다.', type: 'error' })
  } finally {
    const next = new Set(bookmarkPending.value)
    next.delete(movie.movieCd)
    bookmarkPending.value = next
  }
}

function openFromBookmarkList(m: Movie) {
  bookmarkListOpen.value = false
  openDrawer(m)
}

onMounted(() => {
  fetchMonth()
  fetchNowShowing()
  fetchBookmarks()
})
</script>

<template>
  <div class="screening-page">
    <UiLoading v-if="loading" overlay />
    <div class="screening-page__body">
      <!-- 좌: 개봉작 캘린더 -->
      <div class="screening-page__grid">
        <div class="screening-page__header">
          <div class="screening-page__nav">
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="이전 달" @click="prevMonth">
              <template #icon-left><UiIcon name="chevron-left" :size="16" /></template>
            </UiButton>
            <span class="screening-page__month">{{ monthLabel }}</span>
            <UiButton variant="outline" size="sm" iconOnly ariaLabel="다음 달" @click="nextMonth">
              <template #icon-left><UiIcon name="chevron-right" :size="16" /></template>
            </UiButton>
            <UiButton class="screening-page__today" variant="ghost" size="sm" @click="goToday">오늘</UiButton>
          </div>
          <UiButton
            class="screening-page__bookmark-list"
            variant="outline"
            size="sm"
            @click="bookmarkListOpen = true"
          >
            <template #icon-left><UiIcon name="star" :size="16" /></template>
            북마크 목록
          </UiButton>
          <div class="screening-page__legend">
            <span class="screening-page__legend-item">
              <span class="screening-page__dot" style="background:#3b82f6;" />예정
            </span>
            <span class="screening-page__legend-item">
              <span class="screening-page__dot" style="background:#22c55e;" />개봉
            </span>
            <span class="screening-page__legend-item">
              <span class="screening-page__dot" style="background:#f59e0b;" />보고싶은 영화
            </span>
          </div>
        </div>
        <UiCalendarMonth v-model:year="currentYear" v-model:month="currentMonth"
          :events="calendarMonthEvents" :selected-date="selectedDate"
          @select-date="selectedDate = $event" @select-event="onSelectEvent" />
      </div>

      <!-- 우: 그날 개봉작 + 현재상영작 -->
      <div class="screening-page__side">
        <!-- 선택 날짜 개봉작 -->
        <section class="screening-list">
          <div class="screening-list__header">
            <span class="screening-list__title">{{ selectedDateLabel }} 개봉</span>
            <span v-if="selectedDayMovies.length" class="screening-list__count">{{ selectedDayMovies.length }}편</span>
          </div>
          <div v-if="selectedDayMovies.length === 0" class="screening-list__empty">이 날 개봉작이 없습니다</div>
          <div v-else class="screening-list__items">
            <div v-for="m in selectedDayMovies" :key="m.movieCd" class="screening-item" role="button" tabindex="0"
              :style="{ borderLeftColor: movieCalendarColor(m, bookmarkedCodes, todayStr) }"
              @click="openDrawer(m)" @keydown.enter="openDrawer(m)">
              <div class="screening-item__body">
                <div class="screening-item__title">{{ m.movieNm }}</div>
                <div v-if="m.genreNm" class="screening-item__meta">{{ m.genreNm }}</div>
              </div>
              <button
                class="screening-item__star"
                type="button"
                :aria-label="bookmarkedCodes.has(m.movieCd) ? '북마크 해제' : '북마크 추가'"
                :disabled="bookmarkPending.has(m.movieCd)"
                @click.stop="toggleBookmark(m)"
              >
                <UiIcon name="star" :size="16" :class="{ 'screening-item__star-icon--active': bookmarkedCodes.has(m.movieCd) }" />
              </button>
            </div>
          </div>
        </section>

        <!-- 현재상영작 (박스오피스) -->
        <section class="screening-list">
          <div class="screening-list__header">
            <span class="screening-list__title">현재상영작</span>
            <span v-if="nowShowing.length" class="screening-list__count">박스오피스</span>
          </div>
          <div v-if="nowShowing.length === 0" class="screening-list__empty">데이터가 없습니다</div>
          <div v-else class="screening-list__items">
            <div v-for="m in nowShowing" :key="m.movieCd" class="screening-item screening-item--rank" role="button" tabindex="0"
              @click="openDrawer(m)" @keydown.enter="openDrawer(m)">
              <span class="screening-item__rank">{{ m.boxRank }}</span>
              <div class="screening-item__body">
                <div class="screening-item__title">{{ m.movieNm }}</div>
                <div v-if="m.audiAcc" class="screening-item__meta">누적 {{ fmtAcc(m.audiAcc) }}</div>
              </div>
              <button
                class="screening-item__star"
                type="button"
                :aria-label="bookmarkedCodes.has(m.movieCd) ? '북마크 해제' : '북마크 추가'"
                :disabled="bookmarkPending.has(m.movieCd)"
                @click.stop="toggleBookmark(m)"
              >
                <UiIcon name="star" :size="16" :class="{ 'screening-item__star-icon--active': bookmarkedCodes.has(m.movieCd) }" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <MovieDetailDrawer
      v-model:open="drawerOpen"
      :movie="selectedMovie"
      :bookmarked="selectedMovie ? bookmarkedCodes.has(selectedMovie.movieCd) : false"
      @movie-updated="syncMovie"
      @bookmark-changed="onBookmarkChanged"
    />

    <UiDrawer :open="bookmarkListOpen" @update:open="bookmarkListOpen = $event" position="left" width="360px" title="북마크 목록">
      <div v-if="bookmarkedMovies.length === 0" class="bookmark-list__empty">북마크한 영화가 없습니다</div>
      <div v-else class="bookmark-list__items">
        <div v-for="m in bookmarkedMovies" :key="m.movieCd" class="bookmark-list__item" role="button" tabindex="0"
          @click="openFromBookmarkList(m)" @keydown.enter="openFromBookmarkList(m)">
          <div class="bookmark-list__body">
            <div class="bookmark-list__title">{{ m.movieNm }}</div>
            <div class="bookmark-list__meta">{{ m.openDt ? dateOf(m) : '개봉일 미정' }}</div>
          </div>
          <button
            class="bookmark-list__star"
            type="button"
            aria-label="북마크 해제"
            :disabled="bookmarkPending.has(m.movieCd)"
            @click.stop="toggleBookmark(m)"
          >
            <UiIcon name="star" :size="16" class="bookmark-list__star-icon--active" />
          </button>
        </div>
      </div>
    </UiDrawer>
  </div>
</template>

<style scoped lang="scss">
.screening-page { max-width: 1100px; margin: 0 auto; position: relative; }
.screening-page__body { display: flex; gap: 24px; align-items: flex-start; }
.screening-page__grid { flex: 1; min-width: 0; }
.screening-page__side {
  flex-shrink: 0; width: 280px; position: sticky; top: 80px;
  max-height: calc(100vh - 166px); overflow-y: auto;
  display: flex; flex-direction: column; gap: 20px;
}
.screening-page__header {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px; gap: 12px; position: relative;
}
.screening-page__nav {
  display: flex; align-items: center; gap: 8px;
  :deep(.ui-button) { min-width: 36px; min-height: 36px; }
}
.screening-page__month { font-size: 18px; font-weight: 700; color: #1f2937; min-width: 120px; text-align: center; }
.screening-page__bookmark-list { position: absolute; right: 0; flex-shrink: 0; }
.screening-page__legend {
  display: flex; gap: 12px; flex-shrink: 0; position: absolute; left: 0;
  font-size: 12px; color: #6b7280;
}
.screening-page__legend-item { display: flex; align-items: center; gap: 4px; }
.screening-page__dot { width: 8px; height: 8px; border-radius: 50%; }

.screening-list__header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.screening-list__title { font-size: 14px; font-weight: 700; color: #1f2937; }
.screening-list__count { font-size: 12px; color: #9ca3af; }
.screening-list__empty { text-align: center; padding: 20px; color: #9ca3af; font-size: 13px; }
.screening-list__items { display: flex; flex-direction: column; gap: 6px; }

.screening-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: #f9fafb; border: none; border-left: 3px solid transparent; border-radius: 8px;
  cursor: pointer; text-align: left; width: 100%; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
  &--rank { border-left-color: transparent; }
}
.screening-item__rank {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
  background: #eef2ff; color: #4f6af6; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.screening-item__body { flex: 1; min-width: 0; }
.screening-item__title { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.screening-item__meta { font-size: 11px; color: #6b7280; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.screening-item__star {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent;
  color: #9ca3af; cursor: pointer; transition: background 0.15s, color 0.15s;
  &:hover { background: #e5e7eb; color: #6b7280; }
  &:disabled { cursor: default; opacity: 0.6; }
}
.screening-item__star-icon--active { color: #f59e0b; fill: currentColor; }

.bookmark-list__empty { text-align: center; padding: 32px 16px; color: #9ca3af; font-size: 13px; }
.bookmark-list__items { display: flex; flex-direction: column; gap: 6px; }
.bookmark-list__item {
  display: flex; align-items: center; gap: 10px; padding: 10px;
  background: #f9fafb; border-radius: 8px; cursor: pointer; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.bookmark-list__body { flex: 1; min-width: 0; }
.bookmark-list__title { font-size: 14px; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bookmark-list__meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
.bookmark-list__star {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent;
  cursor: pointer; transition: background 0.15s;
  &:hover { background: #e5e7eb; }
  &:disabled { cursor: default; opacity: 0.6; }
}
.bookmark-list__star-icon--active { color: #f59e0b; fill: currentColor; }

@media (max-width: 1024px) {
  .screening-page__body { flex-direction: column; gap: 20px; }
  .screening-page__side { width: 100%; position: static; max-height: none; }
}
@media (max-width: 768px) {
  .screening-page__header { gap: 8px; flex-wrap: wrap; justify-content: center; }
  .screening-page__nav { gap: 4px; order: 1; }
  .screening-page__bookmark-list { position: static; order: 2; }
  .screening-page__legend { position: static; order: 3; flex-basis: 100%; justify-content: center; margin-left: 0; }
  .screening-page__today { display: none !important; }
  .screening-page__month { font-size: 16px; min-width: 100px; }
}

:global([data-theme="dark"]) {
  .screening-page__month, .screening-list__title { color: #f3f4f6; }
  .screening-item { background: #1f2937; &:hover { background: #374151; } }
  .screening-item__title { color: #e5e7eb; }
  .screening-item__star { color: #6b7280; &:hover { background: #374151; color: #9ca3af; } }
  .screening-item__star-icon--active { color: #f59e0b; }
  .screening-item__rank { background: #374151; color: #a5b4fc; }
  .bookmark-list__item { background: #1f2937; &:hover { background: #374151; } }
  .bookmark-list__title { color: #e5e7eb; }
  .bookmark-list__star:hover { background: #374151; }
}
</style>
