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
        if (url.searchParams.get('FID_INPUT_ISCD') === 'KSP') return new Response(JSON.stringify({ rt_cd: '0', output: [{ frgn_ntby_tr_pbmn: '-32000', orgn_ntby_tr_pbmn: '12000', prsn_ntby_tr_pbmn: '20000', scrt_ntby_tr_pbmn: '-4500', fund_ntby_tr_pbmn: '0', ivtr_ntby_tr_pbmn: '8888' }] }))
        expect(url.searchParams.get('FID_INPUT_ISCD')).toBe('K2I')
        expect(url.searchParams.get('FID_INPUT_ISCD_2')).toBe('F001')
        return new Response(JSON.stringify({ rt_cd: '1', msg_cd: 'ERROR' }))
      }
      if (url.pathname.endsWith('/investor-program-trade-today')) {
        expect(url.searchParams.get('EXCH_DIV_CLS_CODE')).toBe('J')
        return new Response(JSON.stringify({ rt_cd: '0', output1: [{ invr_cls_name: '외국인', nabt_ntby_amt: '-700' }, { invr_cls_name: '전체', nabt_ntby_amt: '800' }] }))
      }
      if (url.pathname.endsWith('/comp-program-trade-today')) {
        expect(url.searchParams.get('FID_MRKT_CLS_CODE')).toBe('K')
        return new Response(JSON.stringify({ rt_cd: '0', output: [{ bsop_hour: '095900', nabt_smtn_ntby_tr_pbmn: '700' }, { bsop_hour: '100000', nabt_smtn_ntby_tr_pbmn: '800', whol_smtn_ntby_tr_pbmn: '9999' }] }))
      }
      return new Response(JSON.stringify({ rt_cd: '0', output: { bstp_nmix_prpr: '3000.15', bstp_nmix_prdy_ctrt: '-0.15' } }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const kis = await import('./kisFlow')
    const result = await kis.fetchKisFlow(new Date('2026-09-22T01:00:00Z'))
    expect(result.values).toMatchObject({ cash: -32000, futures: null, nonArb: -700, totalNonArb: 800, kospi: 3000.15 })
    expect(result.sources.futures.status).toBe('error')
    expect(result.values).toMatchObject({institutionCash:12000,individualCash:20000,institutionFutures:null,individualFutures:null,securitiesCash:-4500,fundCash:0})
    expect(result.sources.institutionCash?.status).toBe('ok')
    expect(result.sources.securitiesCash?.status).toBe('ok')
    expect(result.sources.fundCash?.status).toBe('ok')
    expect(result.sources.individualFutures?.status).toBe('error')
    expect(fetchMock.mock.calls.filter(c=>c[0].includes('inquire-investor-time-by-market'))).toHaveLength(2)
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

it('reads institution and individual futures contracts without substituting missing cash',async()=>{
 vi.stubEnv('KIS_APP_KEY','fixture-key');vi.stubEnv('KIS_APP_SECRET','fixture-secret')
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
 const u=new URL(input)
 if(u.pathname.endsWith('/tokenP'))return new Response(JSON.stringify({access_token:'fixture',expires_in:86400}))
 if(u.pathname.endsWith('/inquire-investor-time-by-market'))return new Response(JSON.stringify({rt_cd:'0',output:[u.searchParams.get('FID_INPUT_ISCD')==='K2I'?{frgn_ntby_qty:'-10',orgn_ntby_qty:'7',prsn_ntby_qty:'3'}:{frgn_ntby_tr_pbmn:'0'}]}))
 return new Response(JSON.stringify({rt_cd:'0',output:[],output1:[]}))
 }))
 const {fetchKisFlow}=await import('./kisFlow');const r=await fetchKisFlow()
 expect(r.values).toMatchObject({futures:-10,institutionFutures:7,individualFutures:3,institutionCash:null,individualCash:null})
 expect(r.values.securitiesCash).toBeNull();expect(r.values.fundCash).toBeNull();expect(r.sources.fundCash?.status).toBe('missing')
 expect(r.sources.institutionFutures?.status).toBe('ok');expect(r.sources.institutionCash?.status).toBe('missing')
})
