import { describe, expect, it } from 'vitest'
import { isAdultGenre, isLikelyRerelease } from './movieMetadata'

describe('isAdultGenre', () => {
  it.each(['성인물(에로)', '드라마,에로', '성인물'])('%s를 제외한다', genre => {
    expect(isAdultGenre(genre)).toBe(true)
  })
  it.each(['드라마', '멜로/로맨스', null])('%s는 유지한다', genre => {
    expect(isAdultGenre(genre)).toBe(false)
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
