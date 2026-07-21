import type { Movie } from '../types/movie'

const COLOR_BOOKMARK = '#f59e0b'
const COLOR_UPCOMING = '#3b82f6'
const COLOR_RELEASED = '#22c55e'

function openDateOf(movie: Movie): string {
  return (movie.openDt ?? '').slice(0, 10)
}

function isUpcoming(movie: Movie, today: string): boolean {
  const date = openDateOf(movie)
  return !!date && date > today
}

export function movieCalendarColor(
  movie: Movie,
  bookmarks: Set<string>,
  today: string,
): string {
  if (bookmarks.has(movie.movieCd)) return COLOR_BOOKMARK
  if (isUpcoming(movie, today)) return COLOR_UPCOMING
  return COLOR_RELEASED
}

export function movieCalendarTitle(movie: Movie): string {
  if (movie.isRerelease) return `[재개봉] ${movie.movieNm}`
  return movie.movieNm
}
