import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ kisGet: vi.fn() }))
vi.mock('../kisFlow', async importOriginal => ({ ...await importOriginal<typeof import('../kisFlow')>(), kisGet: mock.kisGet }))
import { securityStatus, fetchQuotes } from './market'

const normal = { iscd_stat_cls_code: '55', temp_stop_yn: 'N', mang_issu_cls_code: 'N', sltr_yn: 'N', stck_prpr: '100', stck_mxpr: '130' }
beforeEach(() => mock.kisGet.mockReset())
describe('KIS security eligibility', () => {
  it('accepts a normal stock with status 55 returned by the live API', async () => {
    mock.kisGet.mockResolvedValue({ output: normal })
    expect((await securityStatus('005930')).excluded).toBe(false)
  })
  it.each(['temp_stop_yn', 'mang_issu_cls_code', 'sltr_yn'])('excludes %s and does not guess missing flags', async flag => {
    for (const value of ['Y', undefined]) {
      mock.kisGet.mockResolvedValue({ output: { ...normal, [flag]: value } })
      expect((await securityStatus('005930')).excluded).toBe(true)
    }
  })
})
describe('quote collection', () => {
  it('reports codes the provider answered without a usable quote, but not codes of a failed request', async () => {
    const at = '2026-10-06T10:00:00+09:00'
    const item = (itemCode: string, low = '90') => ({ itemCode, closePrice: '100', fluctuationsRatio: '1', localTradedAt: at,
      integratedPriceInfo: { highPrice: '110', lowPrice: low, accumulatedTradingValueRaw: '1000' } })
    vi.stubEnv('SURGE_QUOTE_BATCH_SIZE', '2')
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ datas: [item('a'), item('b', '0')] }) })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetch)
    const absent: string[] = []
    const quotes = await fetchQuotes(['a', 'b', 'c', 'd'], absent)
    expect(Object.keys(quotes)).toEqual(['a']); expect(absent).toEqual(['b'])
    vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })
})
