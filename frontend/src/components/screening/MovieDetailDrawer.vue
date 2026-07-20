<script setup lang="ts">
import { computed } from 'vue'
import { UiDrawer } from '@leechanyong/ispark-ui'
import type { Movie } from '../../types/movie'

const props = defineProps<{
  open: boolean
  movie: Movie | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

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
  const m = props.movie
  if (!m || !m.openDt) return { label: m?.prdtStatNm || '미정', color: '#9ca3af' }
  const upcoming = m.openDt.slice(0, 10) > todayStr
  return upcoming
    ? { label: '개봉예정', color: '#3b82f6' }
    : { label: '개봉', color: '#22c55e' }
})

const rows = computed(() => {
  const m = props.movie
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
  const m = props.movie
  if (!m || m.boxRank == null) return []
  return [
    { label: '박스오피스 순위', value: `${m.boxRank}위` },
    { label: '관객수(기준일)', value: fmtNum(m.audiCnt) },
    { label: '누적 관객수', value: fmtNum(m.audiAcc) },
  ]
})
</script>

<template>
  <UiDrawer :open="open" title="영화 상세" max-width="100vw" @update:open="emit('update:open', $event)">
    <div v-if="movie" class="movie-detail">
      <div class="movie-detail__head">
        <span class="movie-detail__status" :style="{ background: status.color }">{{ status.label }}</span>
        <h2 class="movie-detail__title">{{ movie.movieNm }}</h2>
      </div>

      <dl class="movie-detail__list">
        <div v-for="row in rows" :key="row.label" class="movie-detail__row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <template v-if="boxRows.length">
        <div class="movie-detail__section">박스오피스</div>
        <dl class="movie-detail__list">
          <div v-for="row in boxRows" :key="row.label" class="movie-detail__row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
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
.movie-detail__title { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0; }
.movie-detail__section {
  font-size: 13px; font-weight: 700; color: #6b7280;
  padding-top: 8px; border-top: 1px solid #f3f4f6;
}
.movie-detail__list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.movie-detail__row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: baseline; }
.movie-detail__row dt { font-size: 13px; color: #9ca3af; }
.movie-detail__row dd { font-size: 14px; color: #1f2937; margin: 0; word-break: break-word; }

:global([data-theme="dark"]) {
  .movie-detail__title { color: #f3f4f6; }
  .movie-detail__section { color: #9ca3af; border-top-color: #374151; }
  .movie-detail__row dd { color: #e5e7eb; }
}
</style>
