import { describe, expect, it, vi } from 'vitest'
vi.mock('../../prisma', () => ({ default: {} }))
import { parseContext, resolveTheme, selectNews, formatContext } from './context'
const evidence = [{ id: 'n1', ticker: '000001', title: 'A기업 수주 공시', url: 'https://example.com/1', publishedAt: '2026-10-06T00:00:00Z', source: 'NEWS' as const }]
describe('document-only context', () => {
  it('accepts sourced summary and rejects fabricated citations/advice/schema', () => {
    expect(parseContext('{"summary":"수주 공시가 있습니다.","evidenceIds":["n1"]}', evidence).evidenceIds).toEqual(['n1'])
    for (const raw of ['{"summary":"수주","evidenceIds":["fake"]}', '{"summary":"매수 추천","evidenceIds":["n1"]}', '{"summary":"수주","evidenceIds":[]}', '{"summary":"","evidenceIds":[],"buy":true}', 'broken']) expect(() => parseContext(raw, evidence)).toThrow()
    expect(parseContext('{"summary":"","evidenceIds":[]}', [])).toEqual({ summary: '', evidenceIds: [] })
  })
  it('filters yesterday, future, unrelated and duplicate headlines', () => {
    const item = { title: '<b>A기업</b> 수주', originallink: 'https://example.com', pubDate: 'Tue, 06 Oct 2026 09:00:00 +0900' }
    const rows = selectNews([item, item, { ...item, title: 'B기업 수주' }, { ...item, pubDate: 'Mon, 05 Oct 2026 09:00:00 +0900' }, { ...item, pubDate: 'Tue, 06 Oct 2026 12:00:00 +0900' }], '000001', 'A기업', '2026-10-06', Date.parse('2026-10-06T10:00:00+09:00'))
    expect(rows).toHaveLength(1); expect(rows[0].title).toBe('A기업 수주')
  })
  it('keeps NAVER priority, filters confidence and expires LLM each day', () => {
    const rows = ['SECTOR', 'LLM', 'NAVER'].map(source => ({ themeId: source, themeName: source, source, validDate: '2026-10-06', evidence: { confidence: 'high' } }))
    expect(resolveTheme(rows, '2026-10-06', true)?.source).toBe('NAVER')
    expect(resolveTheme(rows.slice(0, 2), '2026-10-06')?.source).toBe('SECTOR')
    expect(resolveTheme(rows.slice(0, 2), '2026-10-06', true)?.source).toBe('LLM')
    rows[1].evidence.confidence = 'medium'
    expect(resolveTheme(rows.slice(0, 2), '2026-10-06', true)?.source).toBe('SECTOR')
    expect(resolveTheme(rows, '2026-10-07', true)).toBeUndefined()
  })
  it('escapes commentary and links and marks absent material', () => {
    expect(formatContext('<A>', { summary: '자료 & 근거', evidenceIds: ['n1'] }, evidence)).toContain('&lt;A&gt;')
    expect(formatContext('A', { summary: '', evidenceIds: [] }, [])).toContain('확인된 당일 재료 없음')
  })
})
