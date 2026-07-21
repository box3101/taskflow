import { afterEach, describe, expect, it, vi } from 'vitest'
import { findTmdbMovie, selectTmdbCandidate } from './tmdb'

describe('selectTmdbCandidate', () => {
  it('제목과 개봉연도가 같은 후보를 선택한다', () => {
    const result = selectTmdbCandidate([
      { id: 1, title: '동명', original_title: 'Other', release_date: '2020-01-01' },
      { id: 2, title: '동명', original_title: 'Same', release_date: '2026-07-01' },
    ], { movieNm: '동명', movieNmEn: 'Same', openDt: new Date('2026-07-01Z') })

    expect(result?.id).toBe(2)
  })

  it('같은 우선순위 후보가 둘이면 임의 선택하지 않는다', () => {
    const result = selectTmdbCandidate([
      { id: 1, title: '동명', original_title: 'Same', release_date: '2026-01-01' },
      { id: 2, title: '동명', original_title: 'Same', release_date: '2026-07-01' },
    ], { movieNm: '동명', movieNmEn: 'Same', openDt: new Date('2026-07-01Z') })

    expect(result).toBeNull()
  })

  it('제목이 맞지 않고 개봉연도만 같으면 선택하지 않는다', () => {
    const result = selectTmdbCandidate([
      { id: 1, title: '다른 제목', original_title: 'Other', release_date: '2026-07-01' },
    ], { movieNm: '동명', movieNmEn: 'Same', openDt: new Date('2026-07-01Z') })

    expect(result).toBeNull()
  })
})

describe('findTmdbMovie', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('TMDB 검색 결과를 선택해 보강 메타데이터로 반환한다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{
        id: 42,
        title: '동명',
        original_title: 'Same',
        release_date: '2026-07-01',
        overview: '줄거리',
        poster_path: '/poster.jpg',
      }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(findTmdbMovie({
      movieNm: '동명',
      movieNmEn: 'Same',
      openDt: new Date('2026-07-01Z'),
    })).resolves.toEqual({ tmdbId: 42, overview: '줄거리', posterPath: '/poster.jpg' })

    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.origin + requestUrl.pathname).toBe('https://api.themoviedb.org/3/search/movie')
    expect(requestUrl.searchParams.get('api_key')).toBe('test-key')
    expect(requestUrl.searchParams.get('query')).toBe('동명')
    expect(requestUrl.searchParams.get('language')).toBe('ko-KR')
    expect(requestUrl.searchParams.get('include_adult')).toBe('false')
    expect(requestUrl.searchParams.get('year')).toBe('2026')
  })

  it('TMDB HTTP 실패를 호출자에게 전파한다', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 500 })))

    await expect(findTmdbMovie({
      movieNm: '동명',
      movieNmEn: null,
      openDt: null,
    })).rejects.toThrow('TMDB search failed: 500')
  })
})
