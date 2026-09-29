export type ExpertProvider = 'anthropic' | 'openai'
export function basicModel() {
  return { provider: 'anthropic' as const, model: process.env.FLOW_BASIC_MODEL || 'claude-sonnet-5', configured: Boolean(process.env.ANTHROPIC_API_KEY) }
}
export function expertModels() {
  return [
    { ...basicModel(), label: 'Claude Sonnet' },
    { provider: 'openai' as const, label: 'GPT Astra', model: process.env.FLOW_ASTRA_MODEL || 'gpt-6-astra', configured: Boolean(process.env.OPENAI_API_KEY) },
  ]
}

// Only fixed first-party endpoints receive server-side credentials.
export async function modelJson(provider: ExpertProvider, model: string, instructions: string, input: unknown, schema: object, maxOutputTokens = 8192, thinking?: 'disabled'): Promise<string> {
  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY
  if (!apiKey) throw Object.assign(new Error('AI API 키 설정이 필요합니다.'), { status: 401 })
  const anthropic = provider === 'anthropic'
  const response = await fetch(anthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/responses', {
    method: 'POST', signal: AbortSignal.timeout(110_000),
    headers: anthropic ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(anthropic ? {
      model, max_tokens: maxOutputTokens, system: instructions,
      ...(thinking ? { thinking: { type: thinking } } : {}),
      messages: [{ role: 'user', content: JSON.stringify(input) }],
      output_config: { format: { type: 'json_schema', schema } },
    } : {
      model, store: false, max_output_tokens: maxOutputTokens, reasoning: { effort: 'medium' }, instructions,
      input: JSON.stringify(input), text: { format: { type: 'json_schema', name: 'flow_analysis', strict: true, schema } },
    }),
  })
  if (!response.ok) throw Object.assign(new Error('AI 요청 실패'), { status: response.status })
  const body = await response.json() as any
  if (anthropic) {
    if (body.stop_reason === 'max_tokens') throw Object.assign(new Error('AI 출력 한도를 초과했습니다.'), { code: 'AI_OUTPUT_LIMIT', stopReason: body.stop_reason, outputTokens: body.usage?.output_tokens })
    if (body.stop_reason !== 'end_turn') throw new Error('AI 응답이 완료되지 않았습니다.')
    return body.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || ''
  }
  if (body.status === 'incomplete' && body.incomplete_details?.reason === 'max_output_tokens') throw Object.assign(new Error('AI 출력 한도를 초과했습니다.'), { code: 'AI_OUTPUT_LIMIT', stopReason: 'max_output_tokens', outputTokens: body.usage?.output_tokens })
  if (body.status !== 'completed') throw new Error('AI 응답이 완료되지 않았습니다.')
  return body.output?.filter((b: any) => b.type === 'message').flatMap((b: any) => b.content || []).filter((b: any) => b.type === 'output_text').map((b: any) => b.text).join('') || ''
}

export const judgmentSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    direction: { type: 'string', enum: ['up', 'down', 'neutral', 'wait'] }, summary: { type: 'string' },
    ...Object.fromEntries(['reasons', 'risks', 'invalidation', 'citations'].map(key => [key, { type: 'array', items: { type: 'string' } }])),
  }, required: ['direction', 'summary', 'reasons', 'risks', 'invalidation', 'citations'],
}
