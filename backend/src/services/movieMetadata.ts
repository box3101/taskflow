export function isAdultGenre(genre?: string | null): boolean {
  if (!genre) return false
  const normalized = genre.replace(/\s/g, '').toLowerCase()
  return normalized.includes('성인물') || normalized.includes('에로')
}

// KOBIS는 성인물(주로 일본 AV 재유통물)을 "성인물(에로)"가 아니라 "멜로/로맨스"·"드라마" 등으로
// 잘못 태깅해서 올리는 경우가 많다 (실사용 데이터 검증 결과 아래 패턴은 오탐 0건).
// 제목에 노골적인 단어가 그대로 들어가는 경우가 많아 제목 키워드로 보강 필터링한다.
const ADULT_TITLE_KEYWORDS = [
  '섹스', '무삭제', '19금', '유부녀', '불륜', '변태', '스와핑', '근친', '자위', '정욕', '색정', '에로',
]

export function isAdultTitle(movieNm?: string | null): boolean {
  if (!movieNm) return false
  return ADULT_TITLE_KEYWORDS.some(keyword => movieNm.includes(keyword))
}

// 장르="멜로/로맨스" 계열 + 관람등급="청소년관람불가" 조합. 정상적인 청불 로맨스/예술영화가
// 드물게 걸릴 수 있음을 감수하고, 장르 오분류로 새는 성인물(주로 일본 AV 재유통물)을 잡는다.
function isAdultRatedRomance(genreNm?: string | null, watchGradeNm?: string | null): boolean {
  return !!genreNm && genreNm.includes('멜로') && watchGradeNm === '청소년관람불가'
}

export function isAdultMovie(movie: { genreNm?: string | null; movieNm?: string | null; watchGradeNm?: string | null }): boolean {
  return isAdultGenre(movie.genreNm)
    || isAdultTitle(movie.movieNm)
    || isAdultRatedRomance(movie.genreNm, movie.watchGradeNm)
}

export function isLikelyRerelease(openDt: Date | null, productionYear: number | null): boolean {
  return !!openDt && productionYear != null
    && openDt.getUTCFullYear() - productionYear >= 2
}
