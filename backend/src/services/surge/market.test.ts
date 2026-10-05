import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ kisGet: vi.fn() }))
vi.mock('../kisFlow', async importOriginal => ({ ...await importOriginal<typeof import('../kisFlow')>(), kisGet: mock.kisGet }))
import { securityStatus } from './market'

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
