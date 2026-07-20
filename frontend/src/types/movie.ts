// 상영 캘린더 — KOBIS 영화 (백엔드 /movies 응답과 1:1)
export interface Movie {
  id: number
  movieCd: string
  movieNm: string
  movieNmEn: string | null
  openDt: string | null // ISO (UTC 자정) 또는 null
  prdtStatNm: string | null
  genreNm: string | null
  nationNm: string | null
  directors: string | null
  boxRank: number | null
  audiCnt: number | null
  audiAcc: number | null
  boxUpdatedAt: string | null
  syncedAt: string
}
