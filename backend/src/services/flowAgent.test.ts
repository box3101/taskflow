import { describe, expect, it, vi } from 'vitest'
import { analyzeFlow, FlowSample } from './flowAnalysis'
import { AgentPayload, evaluatePrediction, parseJudgment, predictionMode, summarizePredictions, summarizeComparison } from './flowAgent'
import { chunkPages, extractPdf, retrieveEvidence } from './flowRag'

vi.mock('../prisma', () => ({ default: {} }))
function sample(minute: number): FlowSample {
  const at = new Date(Date.UTC(2026, 8, 22, 0, minute)).toISOString()
  return { date: '2026-09-22', observedAt: at, values: { cash: minute * 100, futures: minute * 20, nonArb: minute * 30, totalNonArb: minute * 50, kospi: 3000 + minute, kospiPct: 0 }, sources: Object.fromEntries(['cash', 'futures', 'nonArb', 'totalNonArb', 'kospi'].map(key => [key, { status: 'ok', fetchedAt: at, sourceAt: null, message: null }])) as FlowSample['sources'] }
}
const samples = Array.from({ length: 61 }, (_, i) => sample(i))
const judgment = { direction: 'up' as const, summary: '동반 유입', reasons: ['현물과 선물 동반 매수'], risks: ['지수 반응 약화'], invalidation: ['현물 순매도 전환'], citations: [] }
function prediction(mode = 'live', direction = judgment.direction as string) {
  const payload: AgentPayload = { record: { version: 1, sample: samples[15], analyses: { '15': analyzeFlow(samples[15], samples.slice(0, 15), 15) }, moneyUnits: { cash: 'eok', nonArb: 'eok' } }, judgment: { ...judgment, direction: direction as AgentPayload['judgment']['direction'] }, evidence: [], requestedAt: samples[15].observedAt, generatedAt: samples[16].observedAt, cutoff: samples[15].observedAt }
  return { id: 1, horizon: 15, mode, model: 'fixture', version: 'v1', payload, createdAt: new Date(payload.generatedAt) }
}

describe('point-in-time PDF retrieval', () => {
  const base = { id: 1, filename: 'flow.pdf', date: '2026-09-22', createdAt: new Date(samples[0].observedAt), ragChunks: [{ page: 3, text: '외국인 현물 선물 동반 매수와 비차익 유입 관찰' }] }
  it('retrieves relevant pages and excludes later uploads and future reference dates', () => {
    const result = retrieveEvidence([base, { ...base, id: 2, createdAt: new Date(samples[30].observedAt) }, { ...base, id: 3, date: '2026-09-23' }, { ...base, id: 4, ragChunks: [{ page: 1, text: '반도체 제품 설명서' }] }], '외국인 현물 매수 비차익', '2026-09-22', new Date(samples[15].observedAt))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '1:0', reportId: 1, page: 3 })
  })
  it('returns no fabricated context for unrelated PDFs', () => {
    expect(retrieveEvidence([base], 'weather clouds', '2026-09-22', new Date(samples[15].observedAt))).toEqual([])
  })
  it('chunks with page attribution and bounds context size', () => {
    const chunks = chunkPages([{ num: 7, text: '현물 '.repeat(200000) }])
    expect(chunks).toHaveLength(400)
    expect(chunks.every(c => c.page === 7 && c.text.length <= 1100)).toBe(true)
  })
  it('rejects unreadable PDF data without treating it as an indexed document', async () => {
    await expect(extractPdf(Buffer.from('%PDF-1.4\nbroken'))).rejects.toThrow()
  }, 25_000)
  it('extracts searchable text with an actual PDF page number', async () => {
    const stream = 'BT /F1 12 Tf 50 750 Td (Foreign cash futures and non arbitrage flow research.) Tj ET'
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n` })
    const xref = pdf.length
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    const chunks = await extractPdf(Buffer.from(pdf))
    expect(chunks[0].page).toBe(1)
    expect(chunks[0].text).toContain('Foreign cash futures')
  }, 25_000)
})

describe('AI response validation', () => {
  it('requires valid output and citations from retrieved evidence', () => {
    expect(parseJudgment(JSON.stringify(judgment), [])).toEqual(judgment)
    expect(() => parseJudgment(JSON.stringify({ ...judgment, citations: ['999:0'] }), [])).toThrow()
    expect(() => parseJudgment(JSON.stringify({ ...judgment, direction: 'buy' }), [])).toThrow()
    expect(() => parseJudgment(JSON.stringify({ ...judgment, reasons: [] }), [])).toThrow()
    expect(() => parseJudgment('not JSON', [])).toThrow()
  })
})

describe('honest forward evaluation', () => {
  it('compares matched pairs, retains abstentions and excludes no-PDF pairs and replay', () => {
    const make = (variant: string, direction: string, pdf: boolean, mode = 'live') => {
      const p = { ...prediction(mode, direction), variant }
      p.payload.comparisonId = pdf ? 'pair1' : 'pair2'
      if (variant === 'rag' && pdf) p.payload.evidence = [{ id: '1:0', reportId: 1, filename: 'r.pdf', date: sample(0).date, page: 1, text: '근거' }]
      return evaluatePrediction(p, samples, new Date(samples[60].observedAt))
    }
    const rows = [make('flow', 'up', true), make('rag', 'wait', true), make('flow', 'up', false), make('rag', 'down', false), make('flow', 'up', true, 'replay')]
    const result = summarizeComparison(rows)[0]
    expect(result).toMatchObject({ totalPairs: 2, observedPairs: 2, noPdfPairs: 1, commonDirectional: 0 })
    expect(result.methods[1]).toMatchObject({ evaluated: 1, accuracy: 100, coverage: 100 })
    expect(result.methods[2]).toMatchObject({ evaluated: 0, accuracy: null, abstentionRate: 100 })
    expect(summarizeComparison([rows[0]])[0].totalPairs).toBe(0)
    expect(summarizeComparison([rows[0], { ...rows[1], model: 'other' }])[0].totalPairs).toBe(0)
  })
  it('classifies historical, stale, delayed and future observations as replay', () => {
    expect(predictionMode(samples[15], new Date(samples[15].observedAt), new Date(samples[16].observedAt))).toBe('live')
    expect(predictionMode(samples[15], new Date(samples[30].observedAt), new Date(samples[31].observedAt))).toBe('replay')
    expect(predictionMode(samples[15], new Date(samples[15].observedAt), new Date(samples[19].observedAt))).toBe('replay')
    expect(predictionMode(samples[15], new Date(samples[14].observedAt), new Date(samples[16].observedAt))).toBe('replay')
  })
  it('does not read future outcomes before the horizon', () => {
    const row = evaluatePrediction(prediction(), samples, new Date(samples[29].observedAt))
    expect(row.review.state).toBe('pending')
    expect(summarizePredictions([row])[0].accuracy).toBeNull()
  })
  it('starts evaluation after generation, excluding movement during model latency', () => {
    const row = evaluatePrediction(prediction(), samples, new Date(samples[60].observedAt))
    expect(row.evaluationAt).toBe(samples[16].observedAt)
    expect(row.review.outcomeAt).toBe(samples[31].observedAt)
    expect(row.review.returnPct).toBeCloseTo((3031 / 3016 - 1) * 100)
  })
  it('excludes replay and abstentions; compares the same directional sample with rules', () => {
    const rows = [prediction(), prediction('live', 'down'), prediction('live', 'wait'), prediction('replay')].map(p => evaluatePrediction(p, samples, new Date(samples[60].observedAt)))
    expect(summarizePredictions(rows)[0]).toMatchObject({ total: 4, live: 3, replay: 1, evaluated: 2, abstained: 1, accuracy: 50, paired: 2, pairedAiAccuracy: 50, ruleAccuracy: 100 })
  })
  it('does not score missing observations or predictions completed after the target', () => {
    const missing = evaluatePrediction(prediction(), [], new Date(samples[60].observedAt))
    expect(missing.review.state).toBe('missing')
    const late = prediction(); late.payload.generatedAt = samples[31].observedAt
    expect(evaluatePrediction(late, samples, new Date(samples[60].observedAt)).eligible).toBe(false)
    expect(summarizePredictions([missing])[0]).toMatchObject({ missing: 1, evaluated: 0, accuracy: null })
  })
})
