import { afterEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ batch: null as any, universe: [] as any[], status: {} as Record<string, number>, python: null as any }))
vi.mock('node:child_process', () => ({ execFile: (_bin: string, args: string[], _opts: unknown, cb: any) => {
  const mode = args[1]
  if (m.python && mode === 'prepare') return cb(m.python)
  const out = mode === 'prepare'
    ? { previousDate: '2026-10-05', warnings: [], maps: [], securities: ['a', 'b', 'c'].map((ticker, i) => ({ ticker, name: ticker.toUpperCase(), rank: i + 1 })) }
    : { rows: [] }
  cb(null, { stdout: JSON.stringify(out), stderr: '' })
} }))
vi.mock('../../prisma', () => {
  const db: any = {
    surgeBatch: { findUnique: async () => m.batch, upsert: async ({ create }: any) => { m.batch = create } },
    surgeHistory: { upsert: async () => {}, findMany: async () => [] },
    themeMap: { upsert: async () => {} },
    universeDay: { upsert: async ({ create }: any) => { m.universe.push(create) } },
    $transaction: async (fn: any) => fn(db),
  }
  return { default: db }
})
vi.mock('./market', () => ({ securityStatus: async (ticker: string) => {
  m.status[ticker] = (m.status[ticker] || 0) + 1
  if (ticker === 'b') throw new Error('KIS_QUERY_FAILED')
  if (ticker === 'c' && m.status.c === 1) throw new Error('KIS_QUERY_FAILED')
  return { excluded: false }
}, intradayHigh: async () => 0, turnoverRanking: async () => ({ rows: [] }) }))
import { batchError, prepareUniverse } from './universe'
afterEach(() => { vi.unstubAllEnvs(); m.batch = null; m.universe = []; m.status = {}; m.python = null })
describe('universe batch', () => {
  it('retries transient status failures and skips only names that stay unavailable', async () => {
    vi.stubEnv('KRX_ID', 'id'); vi.stubEnv('KRX_PW', 'pw'); vi.stubEnv('SURGE_STATUS_DELAY_MS', '0')
    await prepareUniverse('2026-10-06')
    expect(m.universe.map(r => r.ticker)).toEqual(['a', 'c'])
    expect(m.status).toEqual({ a: 1, b: 3, c: 2 })
    expect(m.batch).toMatchObject({ status: 'ready', payload: { count: 2, warnings: ['SECURITY_STATUS_UNKNOWN:1'] } })
  })
  it('records the failing stage and Python exception line', async () => {
    vi.stubEnv('KRX_ID', 'id'); vi.stubEnv('KRX_PW', 'pw')
    m.python = Object.assign(new Error('Command failed'), { stderr: 'Traceback\n  File "x"\nRuntimeError: UNIVERSE_DATA_MISSING\n' })
    await expect(prepareUniverse('2026-10-06')).rejects.toThrow('PYTHON_PREPARE:RuntimeError: UNIVERSE_DATA_MISSING')
    expect(m.batch).toMatchObject({ status: 'failed', payload: { error: 'PYTHON_PREPARE:RuntimeError: UNIVERSE_DATA_MISSING' } })
  })
  it('marks timeouts', () => {
    expect(batchError('PYTHON_PREPARE', { killed: true, signal: 'SIGTERM' })).toBe('PYTHON_PREPARE:TIMEOUT')
  })
})
