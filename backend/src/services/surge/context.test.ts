import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../prisma', () => ({ default: {} }))
import { collectEvidence, parseContext, resolveTheme, selectNews, formatContext } from './context'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('API HUB news integration', () => {
  it('uses HUB credentials and preserves same-day evidence filtering', async () => {
    vi.stubEnv('NAVER_CLIENT_ID', 'test-id')
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('DART_API_KEY', '')
    const now = new Date()
    const date = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [
      { title: 'Example announcement', link: 'https://example.com/news', pubDate: now.toUTCString() },
    ] }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await collectEvidence('000001', 'Example', date)
    expect(result.evidence).toHaveLength(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(new URL(url).origin + new URL(url).pathname).toBe('https://naverapihub.apigw.ntruss.com/search/v1/news')
    expect(new URL(url).searchParams.get('query')).toBe('"Example"')
    expect(options.headers).toEqual({ 'X-NCP-APIGW-API-KEY-ID': 'test-id', 'X-NCP-APIGW-API-KEY': 'test-secret' })
  })
  it('isolates authorization failures and timeouts without leaking credentials', async () => {
    vi.stubEnv('NAVER_CLIENT_ID', 'test-id')
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('DART_API_KEY', '')
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockRejectedValueOnce(new Error('timeout test-secret'))
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 2; i++) {
      const result = await collectEvidence('000001', 'Example', '2026-10-06')
      expect(result.evidence).toEqual([])
      expect(result.errors).toContain('NEWS_UNAVAILABLE')
      expect(JSON.stringify(result)).not.toContain('test-secret')
    }
  })
})
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
