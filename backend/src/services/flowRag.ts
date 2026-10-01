import { spawn } from 'node:child_process'

export interface RagChunk { page: number; text: string }
export interface Evidence extends RagChunk { usage?: 'historical-reference'; id: string; reportId: number; filename: string; date: string }
export interface RagDocument { id: number; filename: string; date: string; createdAt: Date; ragChunks: unknown }

export function chunkPages(pages: { num: number; text: string }[]): RagChunk[] {
  const chunks: RagChunk[] = []
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' ').trim()
    for (let start = 0; start < text.length; start += 900) {
      const part = text.slice(start, start + 1100)
      if (part.length >= 30) chunks.push({ page: page.num, text: part })
      if (chunks.length >= 400) return chunks
    }
  }
  return chunks
}

// A separate process also isolates native PDF dependencies from the API process.
export function extractPdf(content: Uint8Array): Promise<RagChunk[]> {
  return new Promise((resolve, reject) => {
    const script = `
      console.log = () => {};
      const { PDFParse } = require(process.argv[1]);
      const buffers = [];
      process.stdin.on('data', b => buffers.push(b));
      process.stdin.on('end', async () => {
        const parser = new PDFParse({ data: new Uint8Array(Buffer.concat(buffers)) });
        let output;
        try {
          const info = await parser.getInfo();
          if (info.total > 100) throw new Error('too many pages');
          const result = await parser.getText({ first: 100 });
          if (result.text.length > 350000) throw new Error('too much text');
          output = { pages: result.pages };
        } catch { output = { error: true }; }
        finally { await parser.destroy(); }
        process.stdout.write(JSON.stringify(output));
      });
    `
    const child = spawn(process.execPath, ['--max-old-space-size=192', '-e', script, require.resolve('pdf-parse')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
    const buffers: Buffer[] = []
    let size = 0
    const timer = setTimeout(() => { child.kill(); reject(new Error('PDF 처리 시간이 초과되었습니다.')); }, 20_000)
    child.stdout.on('data', (buffer: Buffer) => {
      size += buffer.length
      if (size > 3_000_000) { child.kill(); reject(new Error('PDF 텍스트가 너무 큽니다.')); return }
      buffers.push(buffer)
    })
    child.once('close', code => {
      clearTimeout(timer)
      if (code !== 0) { reject(new Error('PDF 처리가 중단되었습니다.')); return }
      let result
      try { result = JSON.parse(Buffer.concat(buffers).toString('utf8')) }
      catch { reject(new Error('PDF 처리 결과를 읽을 수 없습니다.')); return }
      if (result.error) { reject(new Error('PDF를 읽지 못했습니다. 암호화 여부와 100페이지 제한을 확인하세요.')); return }
      const chunks = chunkPages(result.pages)
      if (!chunks.length) { reject(new Error('검색 가능한 텍스트가 없습니다. 스캔 PDF는 문자 인식 후 첨부하세요.')); return }
      resolve(chunks)
    })
    child.once('error', () => { clearTimeout(timer); reject(new Error('PDF 처리에 실패했습니다.')); })
    child.stdin.on('error', () => { /* child close/error reports the failure */ })
    child.stdin.end(content)
  })
}

function terms(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
  // Korean bigrams allow 조사/복합명사 matches without a remote embedding service.
  return words.flatMap(w => /[가-힣]/.test(w) && w.length > 2 ? Array.from({ length: w.length - 1 }, (_, i) => w.slice(i, i + 2)) : [w])
}

export function retrieveEvidence(documents: RagDocument[], query: string, date: string, cutoff: Date, limit = 6): Evidence[] {
  const candidates = documents.filter(d => d.date === date && d.createdAt <= cutoff).flatMap(doc =>
    (Array.isArray(doc.ragChunks) ? doc.ragChunks as RagChunk[] : []).map((chunk, i) => ({
      ...chunk, id: `${doc.id}:${i}`, reportId: doc.id, filename: doc.filename, date: doc.date,
    })))
  return rankEvidence(candidates, query, limit)
}

function rankEvidence(candidates: Evidence[], query: string, limit: number): Evidence[] {
  const tokenized = candidates.map(c => terms(c.text))
  const queryTerms = [...new Set(terms(query))]
  const average = tokenized.reduce((sum, ts) => sum + ts.length, 0) / (tokenized.length || 1)
  const frequencies = new Map(queryTerms.map(t => [t, tokenized.filter(ts => ts.includes(t)).length]))
  return candidates.map((chunk, index) => {
    const ts = tokenized[index]
    const score = queryTerms.reduce((sum, t) => {
      const tf = ts.filter(v => v === t).length
      const df = frequencies.get(t) || 0
      return sum + Math.log(1 + (candidates.length - df + .5) / (df + .5)) * tf * 2.2 / (tf + 1.2 * (.25 + .75 * ts.length / (average || 1)))
    }, 0)
    return { chunk, score }
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, limit).map(c => c.chunk)
}

// Conservative extraction: keep qualitative past cases / analysis frameworks only.
// Omit numeric sentences, trading thresholds, forecasts and unverified event schedules.
export function retrieveHistoricalEvidence(documents: RagDocument[], query: string, date: string, cutoff: Date, limit = 2): Evidence[] {
  const candidates = documents.filter(d => d.date < date && d.createdAt <= cutoff).flatMap(doc =>
    (Array.isArray(doc.ragChunks) ? doc.ragChunks as RagChunk[] : []).flatMap((chunk, i) => {
      const text = chunk.text.split(/(?<=[.!?。])\s+|[\n;]+/).map(s => s.trim()).filter(s =>
        s.length >= 15 && !/[0-9０-９%％₩$]|억원|만원|조원|달러|퍼센트|이상|이하|미만|초과|목표|손절|진입|매수하|매도하|전망|예상|예정|발표|휴장|연휴|내일/.test(s)
        && /사례|패턴|집중됐|집중되었|몰렸|나타났|보였|했던|확인됐|확인되었|판별|판단 순서|확인 순서|분석 순서|우선 확인|교차 확인/.test(s)
      ).join(' ').slice(0, 600)
      return text ? [{id:doc.id+':'+i+':history',reportId:doc.id,filename:doc.filename,date:doc.date,page:chunk.page,text,usage:'historical-reference' as const}] : []
    }))
  return rankEvidence(candidates, query, limit)
}

export const HISTORICAL_REFERENCE_INSTRUCTIONS = 'historicalReferences는 과거 사례·판단 틀 참고 전용이며 오늘 신호나 검증된 규칙이 아니다. 오늘 가격·수급을 우선한다. 사용할 때 자료 날짜와 오늘의 유사점·차이점을 밝힌다. 과거 가격·환율·수급 임계값과 매매 조건을 오늘 기준으로 재사용하거나 과거 사례만으로 방향을 결정하지 않는다. 과거 문서의 일정은 최신 확인이 없으므로 사용하지 않는다. 당일 evidence가 없으면 오늘 장전 리포트 근거 없음이라고 밝힌다. citations에는 evidence와 historicalReferences의 제공된 id만 사용한다.'

export function historicalPolicy(evidence: Evidence[], enabled = true) {
 return {version: enabled ? 'historical-v1-on' : 'historical-v1-off', enabled, count: evidence.filter(e => e.usage === 'historical-reference').length, limit:2}
}
