import { afterEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ events: vi.fn(), lookup: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), notify: vi.fn(), model: vi.fn(), lock: vi.fn() }))
vi.mock('../flowModels', () => ({ modelJson: m.model }))
vi.mock('../../prisma', () => {
  const db = { surgeEvent: { findMany: m.events }, surgeLlmRun: { findUnique: m.lookup, count: m.count, create: m.create, update: m.update },
    notificationLog: { upsert: m.notify }, $queryRaw: m.lock, $transaction: async (fn: any) => fn(db) }
  return { default: db }
})
import { runContextWorker } from './context'
import { variantId } from './config'
const now = Date.parse('2026-10-06T10:00:00+09:00')
function setup() {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  m.lock.mockResolvedValue([{ locked: true }])
  vi.stubEnv('SURGE_LLM_ENABLED', 'true'); vi.stubEnv('ANTHROPIC_API_KEY', 'fake')
  vi.stubEnv('NAVER_CLIENT_ID', 'fake'); vi.stubEnv('NAVER_CLIENT_SECRET', 'fake'); vi.stubEnv('DART_API_KEY', '')
  vi.stubEnv('NOTIFY_ENABLED', 'false')
  m.events.mockResolvedValue([{ id: 'e', payload: { id: 'e', tradeId: 't', variant: variantId(10e9, 180), trade: { code: '000001', name: 'A기업' } } }])
  m.lookup.mockResolvedValue(null); m.count.mockResolvedValue(0); m.create.mockResolvedValue({}); m.update.mockResolvedValue({})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ title: 'A기업 수주', originallink: 'https://example.com', pubDate: 'Tue, 06 Oct 2026 09:00:00 +0900' }] }) }))
}
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('LLM subscriber isolation', () => {
  it('reserves budget then sends only documents and identity to mocked Sonnet', async () => {
    setup(); m.model.mockResolvedValue('{"summary":"수주 관련 제목이 있습니다.","drivers":[],"outlook":[],"risks":[],"evidenceIds":["NEWS:000001:0"]}')
    await runContextWorker(now)
    expect(m.create).toHaveBeenCalledOnce(); expect(m.model).toHaveBeenCalledOnce()
    const input = m.model.mock.calls[0][3]
    expect(Object.keys(input).sort()).toEqual(['date', 'documents', 'purpose', 'stocks', 'webResearch'])
    expect(m.model.mock.calls[0][1]).toBe('claude-sonnet-5')
    expect(m.update.mock.calls.at(-1)?.[0].data.parsedOk).toBe(true)
  })
  it('stores malformed model output as failure and does not throw into strategy', async () => {
    setup(); m.model.mockResolvedValue('not json')
    await expect(runContextWorker(now)).resolves.toBeUndefined()
    expect(m.update.mock.calls.at(-1)?.[0].data.error).toBe('CONTEXT_FAILED')
    expect(m.notify).not.toHaveBeenCalled()
  })
  it('does not repeat an event or exceed the daily call cap', async () => {
    setup(); m.lookup.mockResolvedValue({ id: 'already-processed' })
    await runContextWorker(now); expect(m.model).not.toHaveBeenCalled()
    m.lookup.mockResolvedValue(null); m.count.mockResolvedValue(10)
    await runContextWorker(now); expect(m.create).not.toHaveBeenCalled()
  })
})
