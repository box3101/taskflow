// 노트 본문(마크다운)을 "## " 제목 기준으로 분할한다.
// - intro: 첫 "## " 이전 전체(# 제목, 리드 문단, 진행현황 등)
// - sections: 각 "## 제목"부터 다음 "##" 직전까지. title은 "## " 뒤 텍스트, body는 제목 제외한 마크다운
// - 코드펜스(```) 안의 "##"은 섹션으로 취급하지 않는다
export interface NoteSection {
  title: string
  body: string
}
export interface ParsedNote {
  intro: string
  sections: NoteSection[]
}

export function parseNoteSections(content: string): ParsedNote {
  const lines = (content ?? '').split('\n')
  const introLines: string[] = []
  const sections: NoteSection[] = []
  let current: { title: string; bodyLines: string[] } | null = null
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    const isH2 = !inFence && /^##\s+/.test(line) // 정확히 "## "만 (### 이상은 제외)

    if (isH2) {
      current = { title: line.replace(/^##\s+/, '').trim(), bodyLines: [] }
      sections.push({ title: current.title, body: '' })
    } else if (current) {
      current.bodyLines.push(line)
      sections[sections.length - 1].body = current.bodyLines.join('\n').trim()
    } else {
      introLines.push(line)
    }
  }

  return { intro: introLines.join('\n').trim(), sections }
}
