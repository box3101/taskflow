import 'dotenv/config'
import prisma from '../prisma'
import { clock } from '../services/spikeCloudRules'
import { surgeConfig } from '../services/surge/config'
import { resolveTheme } from '../services/surge/context'
import { summarize } from '../services/surge/engine'
import { fetchDayBars, replayDay, replayClock, DayBars } from '../services/surge/replay'
import { annotatePool, pythonBatch } from '../services/surge/universe'
import { kisGet } from '../services/kisFlow'

// Usage (after the close, same day): npm run surge:replay -- [YYYY-MM-DD]
// Read-only: fetches today's minute bars and prints what the checklist rules would have done.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const reasons: Record<string, string> = { ENTRY: '진입', STOP_LOSS: '손절', THEME_DROP: '테마 이탈', LEADER_CHANGE: '대장 교체', CLOSE: '마감' }
async function main() {
  const date = process.argv[2] || clock(Date.now()).slice(0, 10)
  const universe = await prisma.universeDay.findMany({ where: { date } })
  if (!universe.length) throw new Error('NO_UNIVERSE_FOR_DATE')
  console.log(`[1/4] ${date} 모집단 ${universe.length}종목 · 네이버 테마·60일 고가 수집 (수 분 소요)`)
  const inputs = await pythonBatch('replay', date)
  const pool = await annotatePool(universe.map(r => {
    const map = resolveTheme((inputs.maps as any[]).filter(m => m.ticker === r.ticker), date)
    return { ticker: r.ticker, name: r.name, themeName: map?.themeName || r.themeName, high60: Number(inputs.highs?.[r.ticker]) > 0 ? Number(inputs.highs[r.ticker]) : null }
  }), date)
  const naver = Object.values(pool).filter(p => !p.themes[0].startsWith('UNMAPPED') && (inputs.maps as any[]).some(m => m.themeName === p.themes[0])).length
  console.log(`      네이버 테마 매핑 ${naver}/${universe.length} · 실패 테마 ${inputs.failedThemes} · 60일 고가 ${Object.values(pool).filter(p => p.high60).length}종목 · 급등 이력 ${Object.values(pool)[0]?.historyReady ? '있음' : '없음(핫 테마·대장 이력 미적용)'}`)

  console.log('[2/4] KIS 1분봉 수집')
  const data: Record<string, DayBars> = {}, codes = Object.keys(pool), failed: string[] = []
  const concurrency = Number(process.env.SURGE_REPLAY_CONCURRENCY || 3)
  let next = 0, done = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < codes.length) {
      const code = codes[next++]
      for (let attempt = 1; ; attempt++) {
        try { data[code] = await fetchDayBars(code, date, async (...args) => { await sleep(150); return kisGet(...args) }); break }
        catch { if (attempt >= 4) { failed.push(code); break } await sleep(1000 * attempt) }
      }
      if (++done % 50 === 0) console.log(`      ${done}/${codes.length}`)
    }
  }))
  console.log(`      완료 ${Object.keys(data).length}종목 · 실패 ${failed.length}`)

  console.log('[3/4] 체크리스트 규칙으로 1분 단위 재현')
  // 1-minute steps: widen the 10-second collector's freshness/gap limits accordingly.
  const config = { ...surgeConfig(), checklist: true, gapMs: 120_000, executionAgeMs: 90_000, quoteAgeMs: 180_000 }
  const result = replayDay(date, pool, data, config, ['0930', '1000', '1100', '1300', '1430'])

  console.log('[4/4] 결과')
  for (const s of result.snapshots) console.log(`  ${s.hhmm.slice(0, 2)}:${s.hhmm.slice(2)} 상위 테마: ${s.themes.map(t => `${t.name}(${Math.round(t.turnover / 1e8).toLocaleString()}억${t.leader ? `·대장 ${t.leader}` : ''})`).join(' / ') || '없음'}`)
  for (const arm of result.state.arms) {
    console.log(`\n  ■ ${Math.round(arm.gate / 1e8)}억 게이트`)
    for (const e of result.events.filter(e => e.variant === arm.variant)) {
      const t = e.trade
      console.log(`    ${replayClock(e.at)} ${reasons[e.kind]} ${t.name}(${t.code}) · ${t.themeName} · ${e.kind === 'ENTRY' ? `${t.entry.toLocaleString()}원 · 등락 ${t.dayPct.toFixed(2)}%` : `${t.exit?.toLocaleString()}원 · 순수익 ${t.netPct?.toFixed(2)}%`}`)
    }
    const s = summarize([arm])[0]
    console.log(`    → 진입 ${s.count}회 · 완료 ${s.completed}건${s.mean !== null ? ` · 평균 순수익 ${s.mean.toFixed(2)}%` : ''}`)
  }
  const actual = await prisma.surgeTrade.findMany({ where: { date }, orderBy: { entryAt: 'asc' } })
  console.log('\n  ■ 실제 오늘 기록(기존 규칙)')
  for (const t of actual) {
    const p = t.payload as any
    console.log(`    ${replayClock(t.entryAt.getTime())} ${t.variant.split('_')[1] ? `${Math.round(Number(t.variant.split('_')[1]) / 1e8)}억` : ''} ${p.name}(${t.ticker}) · ${p.themeName} · ${t.netPct === null ? '보유' : `${t.netPct.toFixed(2)}%`}${t.excluded ? ' · 집계 제외' : ''}`)
  }
}
main().catch(error => { console.error('재현 실패:', error instanceof Error ? error.message : error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
