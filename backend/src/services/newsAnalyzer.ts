import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface NewsInput {
  title: string
  url: string
  time: string
}

interface AnalyzedNews {
  index: number
  importance: 'high' | 'medium' | 'low'
  summary: string
  reason: string
  eventDate?: string // YYYY-MM-DD (뉴스가 언급하는 이벤트 날짜)
}

export async function analyzeNews(
  stockName: string,
  stockCode: string,
  newsList: NewsInput[]
): Promise<AnalyzedNews[]> {
  if (newsList.length === 0) return []

  const newsText = newsList
    .map((n, i) => `[${i}] ${n.title}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 뉴스들이 ${stockName}(${stockCode}) 주가에 미치는 영향을 분류해주세요.

${newsText}

오늘 날짜: ${new Date().toISOString().split('T')[0]}

각 뉴스에 대해 JSON 배열로만 응답 (다른 텍스트 없이):
[{"index":0,"importance":"high","summary":"15자이내요약","reason":"이유한줄","eventDate":"2026-06-01"}]

기준:
- high: 실적 직접 영향 (수주, 계약, 실적, 규제, 소송, 대규모 투자, 주요인사 면담)
- medium: 업종/간접 영향 (경쟁사 동향, 산업 트렌드, 정책)
- low: 약한 관련 (인사, 단순 보도, 행사)

eventDate 규칙:
- 뉴스가 특정 미래 날짜의 이벤트를 언급하면 해당 날짜 (예: "6월 1일 면담" → "2026-06-01")
- 미래 날짜가 없으면 null

summary는 15자 이내. reason은 한 문장.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as AnalyzedNews[]
  } catch {
    console.warn('[newsAnalyzer] JSON 파싱 실패:', text.slice(0, 200))
    return []
  }
}
