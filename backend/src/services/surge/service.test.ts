import { afterEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ saved: null as any, writes: 0, events: [] as any[], now: 0 }))
vi.mock('../../prisma', () => {
  const db = {
    surgeDay: { findUnique: async () => m.saved ? structuredClone(m.saved) : null,
      upsert: async ({ create, update }: any) => { m.writes++; m.saved = { date: create.date, payload: structuredClone(update.payload) } } },
    spikeCloudDay: { findUnique: async () => null },
    surgeTrade: { upsert: async () => {} },
    surgeEvent: { upsert: async ({ create }: any) => { if (!m.events.some(e => e.id === create.id)) m.events.push(create) } },
    $queryRaw: async () => [{ locked: true }], $transaction: async (fn: any) => fn(db),
  }
  return { default: db }
})
vi.mock('../kisFlow', () => ({ kisConfigured: () => true, isKisTradingDay: async () => true }))
vi.mock('./universe', () => ({ prepareUniverse: async () => {}, expandIntraday: async () => ({ count: 3, complete: true }),
  loadUniverse: async () => ({ a: { name: 'A', themes: ['조선'] }, b: { name: 'B', themes: ['조선'] }, c: { name: 'C', themes: ['조선'] } }) }))
vi.mock('./market', () => ({ fetchQuotes: async (codes: string[]) => Object.fromEntries(codes.map(code => [code, {
  price: 100, high: 120, low: 90, dayPct: code === 'a' ? 10 : code === 'b' ? 5 : 0, value: 20e9,
  receivedAt: m.now, sourceAt: m.now, halted: false,
}])), executionStatus: async () => ({ vi: false, limitUp: false, halted: false, executionUnknown: false }) }))
vi.mock('./notifications', () => ({ drainNotifications: async () => {} }))
vi.mock('./context', () => ({ runContextWorker: async () => {}, contextConfig: () => ({}) }))
import { collectSurge } from './service'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); m.saved = null; m.writes = 0; m.events = [] })
describe('collector persistence', () => {
  it('persists every successive tick and emits a single durable entry after restart-style reloads', async () => {
    vi.stubEnv('SURGE_ENABLED', 'true'); vi.stubEnv('SURGE_LEGACY_ENABLED', 'false')
    vi.spyOn(Date, 'now').mockImplementation(() => m.now)
    const base = Date.parse('2026-10-06T09:05:00+09:00')
    for (let sec = 0; sec <= 180; sec += 10) { m.now = base + sec * 1000; await collectSurge(m.now) }
    expect(m.writes).toBe(19)
    expect(m.saved.payload.engine.lastAt).toBe(base + 180000)
    expect(m.saved.payload.engine.arms[0].trades).toHaveLength(1)
    expect(m.events.map(e => e.kind)).toEqual(['ENTRY'])
    m.now += 10000; await collectSurge(m.now)
    expect(m.events).toHaveLength(1)
  })
})
