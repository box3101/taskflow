import { describe, it, expect } from 'vitest'
import type { Movie } from '../types/movie'
import { movieCalendarColor } from './movieDisplay'

const baseMovie: Movie = {
  id: 1,
  movieCd: '20251234',
  movieNm: '영화명',
  movieNmEn: null,
  openDt: '2026-07-01T00:00:00.000Z',
  prdtStatNm: '개봉',
  genreNm: '드라마',
  nationNm: '한국',
  directors: '감독',
  boxRank: null,
  audiCnt: null,
  audiAcc: null,
  boxUpdatedAt: null,
  syncedAt: '2026-07-01T00:00:00.000Z',
  productionYear: 2024,
  isRerelease: false,
  tmdbId: null,
  overview: null,
  posterPath: null,
  tmdbCheckedAt: null,
}

describe('movieCalendarColor', () => {
  const today = '2026-07-21'

  it('북마크 색이 개봉 상태보다 우선한다', () => {
    expect(movieCalendarColor(baseMovie, new Set([baseMovie.movieCd]), today))
      .toBe('#f59e0b')
  })

  it('북마크 색이 예정 상태보다 우선한다', () => {
    const upcoming: Movie = { ...baseMovie, openDt: '2026-08-01T00:00:00.000Z' }
    expect(movieCalendarColor(upcoming, new Set([upcoming.movieCd]), today))
      .toBe('#f59e0b')
  })

  it('미래 개봉은 파랑', () => {
    const upcoming: Movie = { ...baseMovie, openDt: '2026-08-01T00:00:00.000Z' }
    expect(movieCalendarColor(upcoming, new Set(), today)).toBe('#3b82f6')
  })

  it('개봉일이 오늘 이하면 초록', () => {
    expect(movieCalendarColor(baseMovie, new Set(), today)).toBe('#22c55e')
  })
})
