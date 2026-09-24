import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiNumber, foreignProgramRow } from './kisFlow'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules() })
describe('KIS response normalization', () => {
  it('preserves signed numbers and rejects blank or malformed data', () => {
    expect(apiNumber('-1,234.5')).toBe(-1234.5)
    expect(apiNumber('0')).toBe(0)
    for (const value of ['', ' ', null, undefined, {}, '--', 'NaN', 'Infinity']) expect(apiNumber(value)).toBeNull()
  })
  it('selects foreigners rather than totals or other foreigners', () => {
    const row = foreignProgramRow([{ invr_cls_name: '전체', nabt_ntby_amt: '9900' }, { invr_cls_name: '기타외국인', nabt_ntby_amt: '50' }, { invr_cls_name: '외국인', nabt_ntby_amt: '-320' }])
    expect(row?.nabt_ntby_amt).toBe('-320')
    expect(foreignProgramRow([{ invr_cls_name: '전체', nabt_ntby_amt: '9900' }])).toBeUndefined()
    expect(foreignProgramRow([{ invr_cls_code: '9100', nabt_ntby_amt: '-320' }])?.nabt_ntby_amt).toBe('-320')
    expect(foreignProgramRow([{ invr_cls_code: '9100', invr_cls_name: '기타외국인' }])).toBeUndefined()
  })
  it('uses market-wide KSP/K2I codes and isolates one source failure', async () => {
    vi.stubEnv('KIS_APP_KEY', 'fixture-key'); vi.stubEnv('KIS_APP_SECRET', 'fixture-secret')
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input)
      if (url.pathname.endsWith('/tokenP')) return new Response(JSON.stringify({ access_token: 'fixture-token', expires_in: 86400 }))
      if (url.pathname.endsWith('/inquire-investor-time-by-market')) {
        if (url.searchParams.get('FID_INPUT_ISCD') === 'KSP') return new Response(JSON.stringify({ rt_cd: '0', output: [{ frgn_ntby_tr_pbmn: '-32000' }] }))
        expect(url.searchParams.get('FID_INPUT_ISCD')).toBe('K2I')
        expect(url.searchParams.get('FID_INPUT_ISCD_2')).toBe('F001')
        return new Response(JSON.stringify({ rt_cd: '1', msg_cd: 'ERROR' }))
      }
      if (url.pathname.endsWith('/investor-program-trade-today')) {
        expect(url.searchParams.get('EXCH_DIV_CLS_CODE')).toBe('J')
        return new Response(JSON.stringify({ rt_cd: '0', output1: [{ invr_cls_name: '외국인', nabt_ntby_amt: '-700' }, { invr_cls_name: '전체', nabt_ntby_amt: '800' }] }))
      }
      return new Response(JSON.stringify({ rt_cd: '0', output: { bstp_nmix_prpr: '3000.15', bstp_nmix_prdy_ctrt: '-0.15' } }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const kis = await import('./kisFlow')
    const result = await kis.fetchKisFlow(new Date('2026-09-22T01:00:00Z'))
    expect(result.values).toMatchObject({ cash: -32000, futures: null, nonArb: -700, totalNonArb: 800, kospi: 3000.15 })
    expect(result.sources.futures.status).toBe('error')
    expect(result.sources.cash.sourceAt).toBeNull()
    expect(JSON.stringify(result)).not.toContain('fixture-secret')
    expect(fetchMock.mock.calls.filter(c => c[0].endsWith('/tokenP'))).toHaveLength(1)
  })
  it('does not query KIS without credentials', async () => {
    vi.stubEnv('KIS_APP_KEY', ''); vi.stubEnv('KIS_APP_SECRET', '')
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const kis = await import('./kisFlow')
    expect(kis.kisConfigured()).toBe(false)
    await expect(kis.kisGet('/unused', 'unused', {})).rejects.toThrow('KIS_NOT_CONFIGURED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
