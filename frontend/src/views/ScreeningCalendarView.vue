<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { UiButton, UiIcon, UiLoading, UiCalendarMonth, openToast } from '@leechanyong/ispark-ui'
import type { CalendarMonthEvent } from '@leechanyong/ispark-ui'
import api from '../api/client'
import { getCached, setCached } from '../composables/useCachedFetch'
import type { Movie } from '../types/movie'
import { movieCalendarColor, movieCalendarTitle } from '../utils/movieDisplay'
import MovieDetailDrawer from '../components/screening/MovieDetailDrawer.vue'

type BookmarkChange = { movieCd: string; bookmarked: boolean }

const loading = ref(true)
const monthMovies = ref<Movie[]>([]) // 선택 월 개봉작 (캘린더 배지 + 그날 개봉작)
const nowShowing = ref<Movie[]>([])  // 현재상영작 (박스오피스)
const bookmarkedCodes = ref<Set<string>>(new Set())

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

// ===== 캘린더 배지 매핑 (movie → CalendarMonthEvent) =====
const calendarMonthEvents = computed<CalendarMonthEvent[]>(() =>
  monthMovies.value
    .filter(m => m.openDt)
    .map(m => {
      const d = dateOf(m)
      return {
        id: m.movieCd,
        start: d,
        end: null,
        title: movieCalendarTitle(m),
        color: movieCalendarColor(m, bookmarkedCodes.value, todayStr),
        allDay: true,
        meta: m,
      }
    }),
)

// 선택한 날짜의 개봉작
const selectedDayMovies = computed(() =>
  monthMovies.value.filter(m => dateOf(m) === selectedDate.value),
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
    const { data } = await api.get<{ data: string[] }>('/movies/bookmarks')
    bookmarkedCodes.value = new Set(data.data)
  } catch {
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

function onBookmarkChanged({ movieCd, bookmarked }: BookmarkChange) {
  const next = new Set(bookmarkedCodes.value)
  bookmarked ? next.add(movieCd) : next.delete(movieCd)
  bookmarkedCodes.value = next
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
            <button v-for="m in selectedDayMovies" :key="m.movieCd" class="screening-item"
              :style="{ borderLeftColor: movieCalendarColor(m, bookmarkedCodes, todayStr) }" @click="openDrawer(m)">
              <div class="screening-item__body">
                <div class="screening-item__title">
                  {{ m.movieNm }}
                  <span v-if="m.isRerelease" class="screening-item__rerelease">재개봉</span>
                </div>
                <div v-if="m.genreNm" class="screening-item__meta">{{ m.genreNm }}</div>
              </div>
            </button>
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
            <button v-for="m in nowShowing" :key="m.movieCd" class="screening-item screening-item--rank"
              @click="openDrawer(m)">
              <span class="screening-item__rank">{{ m.boxRank }}</span>
              <div class="screening-item__body">
                <div class="screening-item__title">
                  {{ m.movieNm }}
                  <span v-if="m.isRerelease" class="screening-item__rerelease">재개봉</span>
                </div>
                <div v-if="m.audiAcc" class="screening-item__meta">누적 {{ fmtAcc(m.audiAcc) }}</div>
              </div>
            </button>
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
  </div>
</template>

<style scoped lang="scss">
.screening-page { max-width: 1100px; margin: 0 auto; position: relative; }
.screening-page__body { display: flex; gap: 24px; align-items: flex-start; }
.screening-page__grid { flex: 1; min-width: 0; }
.screening-page__side {
  flex-shrink: 0; width: 280px; position: sticky; top: 80px;
  max-height: calc(100vh - 140px); overflow-y: auto;
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
.screening-item__rerelease { flex-shrink: 0; padding: 1px 5px; border: 1px solid #f59e0b; border-radius: 999px; color: #b45309; background: #fffbeb; font-size: 10px; font-weight: 600; }
.screening-item__meta { font-size: 11px; color: #6b7280; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 1024px) {
  .screening-page__body { flex-direction: column; gap: 20px; }
  .screening-page__side { width: 100%; position: static; max-height: none; }
}
@media (max-width: 768px) {
  .screening-page__header { gap: 8px; }
  .screening-page__legend { position: static; margin-left: auto; }
  .screening-page__nav { gap: 4px; }
  .screening-page__today { display: none !important; }
  .screening-page__month { font-size: 16px; min-width: 100px; }
}

:global([data-theme="dark"]) {
  .screening-page__month, .screening-list__title { color: #f3f4f6; }
  .screening-item { background: #1f2937; &:hover { background: #374151; } }
  .screening-item__title { color: #e5e7eb; }
  .screening-item__rerelease { border-color: #fbbf24; color: #fcd34d; background: #3f3216; }
  .screening-item__rank { background: #374151; color: #a5b4fc; }
}
</style>
