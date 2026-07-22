import { describe, expect, it } from 'vitest'
import { isAdultGenre, isAdultMovie, isAdultTitle, isLikelyRerelease } from './movieMetadata'

describe('isAdultGenre', () => {
  it.each(['성인물(에로)', '드라마,에로', '성인물'])('%s를 제외한다', genre => {
    expect(isAdultGenre(genre)).toBe(true)
  })
  it.each(['드라마', '멜로/로맨스', null])('%s는 유지한다', genre => {
    expect(isAdultGenre(genre)).toBe(false)
  })
})

describe('isAdultTitle', () => {
  it.each(['유부녀들 : 홍콩 가는 날', '두근두근 그녀의 섹스 무삭제판', '19금 마사지클럽'])(
    '"%s"는 제목 키워드로 걸러낸다',
    title => {
      expect(isAdultTitle(title)).toBe(true)
    },
  )
  it.each(['기생충', '헤어질 결심', null])('"%s"는 유지한다', title => {
    expect(isAdultTitle(title)).toBe(false)
  })
})

describe('isAdultMovie', () => {
  it('genreNm에 성인물 태그가 있으면 제외한다', () => {
    expect(isAdultMovie({ genreNm: '성인물(에로)', movieNm: '아무개' })).toBe(true)
  })

  it('genreNm이 정상 태그여도 제목에 성인물 키워드가 있으면 제외한다 (KOBIS 오분류 대응)', () => {
    expect(isAdultMovie({ genreNm: '멜로/로맨스', movieNm: '두근두근 그녀의 섹스' })).toBe(true)
  })

  it('일반적인 영화는 유지한다', () => {
    expect(isAdultMovie({ genreNm: '드라마', movieNm: '기생충' })).toBe(false)
    expect(isAdultMovie({ genreNm: '멜로/로맨스', movieNm: '지금, 만나러 갑니다' })).toBe(false)
  })

  it('멜로/로맨스 + 청소년관람불가 조합은 제외한다', () => {
    expect(isAdultMovie({ genreNm: '멜로/로맨스', movieNm: '거유녀의 가슴 온기', watchGradeNm: '청소년관람불가' })).toBe(true)
    expect(isAdultMovie({ genreNm: '멜로/로맨스,드라마', movieNm: '아무개', watchGradeNm: '청소년관람불가' })).toBe(true)
  })

  it('멜로/로맨스여도 청소년관람불가가 아니면 유지한다', () => {
    expect(isAdultMovie({ genreNm: '멜로/로맨스', movieNm: '아무개', watchGradeNm: '15세이상관람가' })).toBe(false)
    expect(isAdultMovie({ genreNm: '멜로/로맨스', movieNm: '아무개', watchGradeNm: null })).toBe(false)
  })

  it('청소년관람불가여도 멜로/로맨스가 아니면 유지한다', () => {
    expect(isAdultMovie({ genreNm: '스릴러', movieNm: '아무개', watchGradeNm: '청소년관람불가' })).toBe(false)
  })
})

describe('isLikelyRerelease', () => {
  it('제작 2년 뒤 개봉이면 재개봉으로 추정한다', () => {
    expect(isLikelyRerelease(new Date('2026-07-01T00:00:00Z'), 2024)).toBe(true)
  })
  it('1년 차이거나 값이 없으면 false다', () => {
    expect(isLikelyRerelease(new Date('2026-07-01T00:00:00Z'), 2025)).toBe(false)
    expect(isLikelyRerelease(null, 2020)).toBe(false)
  })
})
