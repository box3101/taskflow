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
  sentiment: 'positive' | 'negative' | 'neutral'
  summary: string
  reason: string
  explain: string
  eventDate?: string
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
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `다음 뉴스들이 ${stockName}(${stockCode}) 주가에 미치는 영향을 분류해주세요.

${newsText}

오늘 날짜: ${new Date().toISOString().split('T')[0]}

각 뉴스에 대해 JSON 배열로만 응답 (다른 텍스트 없이):
[{"index":0,"importance":"high","sentiment":"positive","summary":"15자이내요약","reason":"이유한줄","explain":"초보 투자자도 이해할 수 있게 2~3문장으로 쉽게 설명","eventDate":"2026-06-01"}]

importance 기준:
- high: 실적 직접 영향 (수주, 계약, 실적, 규제, 소송, 대규모 투자, 주요인사 면담)
- medium: 업종/간접 영향 (경쟁사 동향, 산업 트렌드, 정책)
- low: 약한 관련 (인사, 단순 보도, 행사)

sentiment 기준:
- positive: 주가에 좋은 뉴스 (호재)
- negative: 주가에 나쁜 뉴스 (악재)
- neutral: 판단 어려움 또는 양방향

eventDate: 뉴스가 특정 미래 날짜를 언급하면 해당 날짜, 없으면 null

explain: 주식 초보도 이해할 수 있게 "이게 왜 좋은(나쁜) 건지" 쉽게 설명. "쉽게 말해..." 스타일.
summary는 15자 이내. reason은 한 문장.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn('[newsAnalyzer] JSON 배열 없음. 응답:', text.slice(0, 300))
      return []
    }
    const parsed = JSON.parse(jsonMatch[0]) as AnalyzedNews[]
    console.log(`[newsAnalyzer] ${parsed.length}건 파싱 성공`)
    return parsed
  } catch (e) {
    console.warn('[newsAnalyzer] JSON 파싱 실패:', text.slice(0, 300))
    return []
  }
}
