// KOBIS 오픈API 클라이언트 — 영화목록 / 일별 박스오피스 / 상세
// API 키는 KOBIS_API_KEY 환경변수에서 읽는다. 프론트는 이 파일을 직접 호출하지 않고 DB만 조회한다.

const BASE = 'https://www.kobis.or.kr/kobisopenapi/webservice/rest'

function getKey(): string {
  const key = process.env.KOBIS_API_KEY
  if (!key) throw new Error('KOBIS_API_KEY 미설정')
  return key
}

// ===== 응답 타입 =====
export interface KobisMovie {
  movieCd: string
  movieNm: string
  movieNmEn?: string
  openDt?: string // searchMovieList는 "YYYYMMDD" (미정이면 "")
  prdtYear?: string
  prdtStatNm?: string
  genreAlt?: string
  nationAlt?: string
  repGenreNm?: string
  repNationNm?: string
  directors?: { peopleNm: string }[]
}

export interface KobisBoxOfficeItem {
  rank: string
  movieCd: string
  movieNm: string
  openDt?: string // searchDailyBoxOffice는 "YYYY-MM-DD"
  audiCnt: string
  audiAcc: string
}

// ===== 영화 목록 (개봉작) — 연도 단위 필터 =====
export async function fetchMovieList(params: {
  openYear: number
  curPage?: number
  itemPerPage?: number
}): Promise<{ totCnt: number; movieList: KobisMovie[] }> {
  const { openYear, curPage = 1, itemPerPage = 100 } = params
  const url = `${BASE}/movie/searchMovieList.json?key=${getKey()}&openStartDt=${openYear}&openEndDt=${openYear}&itemPerPage=${itemPerPage}&curPage=${curPage}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`KOBIS searchMovieList ${res.status}`)
  const data: any = await res.json()
  const result = data?.movieListResult
  if (!result) {
    // KOBIS 에러 응답: { faultInfo: { message, errorCode } }
    const msg = data?.faultInfo?.message || 'movieListResult 없음'
    throw new Error(`KOBIS searchMovieList: ${msg}`)
  }
  return { totCnt: Number(result.totCnt) || 0, movieList: result.movieList || [] }
}

// ===== 일별 박스오피스 =====
export async function fetchDailyBoxOffice(params: {
  targetDt: string // "YYYYMMDD"
}): Promise<KobisBoxOfficeItem[]> {
  const url = `${BASE}/boxoffice/searchDailyBoxOfficeList.json?key=${getKey()}&targetDt=${params.targetDt}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`KOBIS searchDailyBoxOfficeList ${res.status}`)
  const data: any = await res.json()
  const result = data?.boxOfficeResult
  if (!result) {
    const msg = data?.faultInfo?.message || 'boxOfficeResult 없음'
    throw new Error(`KOBIS searchDailyBoxOfficeList: ${msg}`)
  }
  return result.dailyBoxOfficeList || []
}

// ===== 상세 (필요 시 사용) =====
export async function fetchMovieInfo(params: { movieCd: string }): Promise<any> {
  const url = `${BASE}/movie/searchMovieInfo.json?key=${getKey()}&movieCd=${params.movieCd}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`KOBIS searchMovieInfo ${res.status}`)
  const data: any = await res.json()
  return data?.movieInfoResult?.movieInfo ?? null
}

// ===== 날짜 파싱 =====
// "YYYYMMDD" 또는 "YYYY-MM-DD" → UTC 자정 Date(@db.Date용). 빈값/이상값 → null
export function parseKobisDate(s?: string): Date | null {
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const y = Number(digits.slice(0, 4))
  const m = Number(digits.slice(4, 6))
  const d = Number(digits.slice(6, 8))
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}
