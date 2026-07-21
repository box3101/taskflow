<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiButton, UiDrawer, UiIcon, UiLoading, openToast } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { Movie } from '../../types/movie'

const props = defineProps<{
  open: boolean
  movie: Movie | null
  bookmarked: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'movie-updated': [movie: Movie]
  'bookmark-changed': [value: { movieCd: string; bookmarked: boolean }]
}>()

const detailMovie = ref<Movie | null>(props.movie)
const detailLoading = ref(false)
const bookmarkLoading = ref(false)
const imageFailed = ref(false)

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

// openDt는 UTC 자정 저장 → UTC 기준으로 표시(하루 밀림 방지)
function fmtDate(iso: string | null): string {
  if (!iso) return '미정'
  const d = new Date(iso)
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${dayNames[d.getUTCDay()]})`
}

function fmtNum(n: number | null): string {
  return n != null ? `${n.toLocaleString()}명` : '-'
}

const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

// 상태(색): openDt > 오늘 → 예정(파랑) / openDt ≤ 오늘 → 개봉(초록) / 미정 → 회색
const status = computed(() => {
  const m = detailMovie.value
  if (!m || !m.openDt) return { label: m?.prdtStatNm || '미정', color: '#9ca3af' }
  const upcoming = m.openDt.slice(0, 10) > todayStr
  return upcoming
    ? { label: '개봉예정', color: '#3b82f6' }
    : { label: '개봉', color: '#22c55e' }
})

const rows = computed(() => {
  const m = detailMovie.value
  if (!m) return []
  return [
    { label: '개봉일', value: fmtDate(m.openDt) },
    { label: '제작상태', value: m.prdtStatNm || '-' },
    { label: '감독', value: m.directors || '-' },
    { label: '장르', value: m.genreNm || '-' },
    { label: '제작국가', value: m.nationNm || '-' },
    { label: '영문 제목', value: m.movieNmEn || '-' },
  ]
})

const boxRows = computed(() => {
  const m = detailMovie.value
  if (!m || m.boxRank == null) return []
  return [
    { label: '박스오피스 순위', value: `${m.boxRank}위` },
    { label: '관객수(기준일)', value: fmtNum(m.audiCnt) },
    { label: '누적 관객수', value: fmtNum(m.audiAcc) },
  ]
})

async function fetchMovieDetails() {
  if (!props.movie) return

  detailLoading.value = true
  try {
    const { data } = await api.get<{ data: Movie }>(`/movies/${props.movie.movieCd}`)
    detailMovie.value = data.data
    emit('movie-updated', data.data)
  } catch {
    openToast({ message: '영화 상세 정보를 불러오지 못했습니다.', type: 'error' })
  } finally {
    detailLoading.value = false
  }
}

async function toggleBookmark() {
  const movie = detailMovie.value
  if (!movie || bookmarkLoading.value) return

  const bookmarked = !props.bookmarked
  bookmarkLoading.value = true
  try {
    if (bookmarked) await api.post(`/movies/${movie.movieCd}/bookmark`)
    else await api.delete(`/movies/${movie.movieCd}/bookmark`)
    emit('bookmark-changed', { movieCd: movie.movieCd, bookmarked })
  } catch {
    openToast({ message: bookmarked ? '북마크 추가에 실패했습니다.' : '북마크 해제에 실패했습니다.', type: 'error' })
  } finally {
    bookmarkLoading.value = false
  }
}

watch(() => props.movie, (movie) => {
  detailMovie.value = movie
  imageFailed.value = false
})

watch(() => props.open, (open, wasOpen) => {
  if (open && !wasOpen) fetchMovieDetails()
})
</script>

<template>
  <UiDrawer :open="open" title="영화 상세" max-width="100vw" @update:open="emit('update:open', $event)">
    <UiLoading v-if="detailLoading" />
    <div v-else-if="detailMovie" class="movie-detail">
      <div class="movie-detail__head">
        <span class="movie-detail__status" :style="{ background: status.color }">{{ status.label }}</span>
        <span v-if="detailMovie.isRerelease" class="movie-detail__rerelease">재개봉</span>
        <h2 class="movie-detail__title">{{ detailMovie.movieNm }}</h2>
        <UiButton
          class="movie-detail__bookmark"
          variant="ghost"
          size="sm"
          iconOnly
          :loading="bookmarkLoading"
          :aria-label="bookmarked ? '북마크 해제' : '북마크 추가'"
          @click="toggleBookmark"
        >
          <UiIcon name="star" :size="18" :class="{ 'movie-detail__bookmark-icon--active': bookmarked }" />
        </UiButton>
      </div>

      <div class="movie-detail__content">
        <img
          v-if="detailMovie.posterPath && !imageFailed"
          class="movie-detail__poster"
          :src="`https://image.tmdb.org/t/p/w342${detailMovie.posterPath}`"
          :alt="`${detailMovie.movieNm} 포스터`"
          @error="imageFailed = true"
        >
        <dl class="movie-detail__list">
          <div v-for="row in rows" :key="row.label" class="movie-detail__row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </div>

      <template v-if="boxRows.length">
        <div class="movie-detail__section">박스오피스</div>
        <dl class="movie-detail__list">
          <div v-for="row in boxRows" :key="row.label" class="movie-detail__row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </template>

      <template v-if="detailMovie.overview">
        <div class="movie-detail__section">줄거리</div>
        <p class="movie-detail__overview">{{ detailMovie.overview }}</p>
      </template>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.movie-detail { display: flex; flex-direction: column; gap: 16px; }
.movie-detail__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.movie-detail__status {
  flex-shrink: 0; padding: 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; color: #fff;
}
.movie-detail__rerelease {
  flex-shrink: 0; padding: 3px 8px; border: 1px solid #f59e0b; border-radius: 999px;
  color: #b45309; background: #fffbeb; font-size: 12px; font-weight: 600;
}
.movie-detail__title { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0; }
.movie-detail__bookmark { margin-left: auto; }
.movie-detail__bookmark-icon--active { color: #f59e0b; fill: currentColor; }
.movie-detail__content { display: flex; gap: 16px; align-items: flex-start; }
.movie-detail__poster {
  flex: 0 0 130px; width: 130px; border-radius: 8px; object-fit: cover;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}
.movie-detail__section {
  font-size: 13px; font-weight: 700; color: #6b7280;
  padding-top: 8px; border-top: 1px solid #f3f4f6;
}
.movie-detail__list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.movie-detail__content .movie-detail__list { flex: 1; min-width: 0; }
.movie-detail__row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: baseline; }
.movie-detail__row dt { font-size: 13px; color: #9ca3af; }
.movie-detail__row dd { font-size: 14px; color: #1f2937; margin: 0; word-break: break-word; }
.movie-detail__overview { margin: -6px 0 0; color: #374151; font-size: 14px; line-height: 1.65; white-space: pre-line; word-break: break-word; }

@media (max-width: 480px) {
  .movie-detail__content { flex-direction: column; }
  .movie-detail__poster { flex-basis: auto; width: min(180px, 100%); }
  .movie-detail__row { grid-template-columns: 88px 1fr; gap: 8px; }
}

:global([data-theme="dark"]) {
  .movie-detail__title { color: #f3f4f6; }
  .movie-detail__section { color: #9ca3af; border-top-color: #374151; }
  .movie-detail__row dd { color: #e5e7eb; }
  .movie-detail__overview { color: #d1d5db; }
  .movie-detail__rerelease { border-color: #fbbf24; color: #fcd34d; background: #3f3216; }
}
</style>
