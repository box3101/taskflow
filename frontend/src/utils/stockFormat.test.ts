import { describe, it, expect } from 'vitest'
import { formatPct, pctColor } from './stockFormat'

describe('formatPct', () => {
  it('양수에 + 부호를 붙인다', () => {
    expect(formatPct(4.5555)).toBe('+4.56%')
  })

  it('음수는 부호를 그대로 둔다', () => {
    expect(formatPct(-1.3)).toBe('-1.30%')
  })

  it('0은 +로 표시한다', () => {
    expect(formatPct(0)).toBe('+0.00%')
  })
})

describe('pctColor', () => {
  it('상승은 빨강', () => {
    expect(pctColor(0.01)).toBe('#ef4444')
  })

  it('하락은 파랑', () => {
    expect(pctColor(-0.01)).toBe('#3b82f6')
  })

  it('보합은 회색', () => {
    expect(pctColor(0)).toBe('#6b7280')
  })
})
