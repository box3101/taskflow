import { afterEach, describe, expect, it, vi } from 'vitest'
import { basicModel, expertModels, judgmentSchema, modelJson } from './flowModels'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('tiered model transport', () => {
  it('uses Sonnet for basics even with the legacy Gemini configuration', () => {
    vi.stubEnv('FLOW_BASIC_MODEL', ''); vi.stubEnv('FLOW_AI_MODEL', 'gemini-2.5-flash')
    expect(basicModel().model).toBe('claude-sonnet-5')
    vi.stubEnv('OPENAI_API_KEY', '')
    expect(expertModels().find(m => m.provider === 'openai')?.configured).toBe(false)
  })
  it('sends Claude structured output requests and never accepts a truncated answer', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'fixture')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '{"ok":true}' }] })))
    vi.stubGlobal('fetch', fetcher)
    expect(await modelJson('anthropic', 'claude-sonnet-5', 'instructions', {}, judgmentSchema)).toBe('{"ok":true}')
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.output_config.format.schema).toEqual(judgmentSchema)
    fetcher.mockResolvedValue(new Response(JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{}' }] })))
    await expect(modelJson('anthropic', 'claude-opus-5-5', '', {}, judgmentSchema)).rejects.toThrow()
  })
  it('uses Responses with storage disabled for Astra, without Anthropic credentials', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-fixture')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] })))
    vi.stubGlobal('fetch', fetcher)
    expect(await modelJson('openai', 'gpt-6-astra', '', {}, judgmentSchema)).toBe('{}')
    expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses')
    expect(fetcher.mock.calls[0][1].headers['x-api-key']).toBeUndefined()
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ store: false, model: 'gpt-6-astra', text: { format: { strict: true } } })
  })
  it('does not send requests without keys and does not expose provider error bodies', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(modelJson('openai', 'gpt-6-astra', '', {}, judgmentSchema)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    vi.stubEnv('OPENAI_API_KEY', 'fixture')
    fetcher.mockResolvedValue(new Response('sensitive upstream details', { status: 401 }))
    await expect(modelJson('openai', 'gpt-6-astra', '', {}, judgmentSchema)).rejects.toMatchObject({ status: 401, message: 'AI 요청 실패' })
  })
})
