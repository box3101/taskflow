import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import prisma from '../../prisma'
import { clock, Pool } from '../spikeCloudRules'
import { resolveTheme } from './context'
import { securityStatus, intradayHigh, turnoverRanking } from './market'
import { isKisTradingDay, kisConfigured } from '../kisFlow'
const exec = promisify(execFile)
export async function pythonBatch(mode: 'prepare' | 'history', date: string) {
  const { stdout } = await exec(process.env.PYTHON_BIN || 'python', [path.resolve(process.cwd(), 'scripts/surge_batch.py'), mode, date], {
    windowsHide: true, timeout: Number(process.env.SURGE_BATCH_TIMEOUT_MS || 900000), maxBuffer: 20 * 1024 * 1024,
  })
  return JSON.parse(stdout)
}
// Keep only the Python exception class/message line; never store raw stderr.
export function batchError(stage: string, error: unknown) {
  const e = error as { killed?: boolean; signal?: string; stderr?: string; message?: string }
  if (e?.killed || e?.signal === 'SIGTERM') return `${stage}:TIMEOUT`
  const line = String(e?.stderr || '').trim().split('\n').reverse().find(l => /^\w+(Error|Exception)\b/.test(l.trim()))
  return `${stage}:${(line || (error instanceof Error ? error.message : 'UNKNOWN')).trim().slice(0, 160)}`
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
// KIS rejects bursts; one transient failure must not discard the whole universe.
async function statusWithRetry(ticker: string) {
  const attempts = Number(process.env.SURGE_STATUS_ATTEMPTS || 3), delay = Number(process.env.SURGE_STATUS_DELAY_MS || 80)
  for (let i = 1; ; i++) {
    try { return await securityStatus(ticker) } catch (error) {
      if (i >= attempts) throw error
      await sleep(delay * 10 * i)
    }
  }
}
export async function importHistory(date: string) {
  const data = await pythonBatch('history', date)
  await prisma.$transaction(async tx => {
    for (const r of data.rows) await tx.surgeHistory.upsert({ where: { ticker_date: { ticker: r.ticker, date } },
      create: { ticker: r.ticker, date, value: BigInt(r.value), chgRate: r.chgRate }, update: { value: BigInt(r.value), chgRate: r.chgRate } })
    await tx.surgeBatch.upsert({ where: { date: `history:${date}` }, create: { date: `history:${date}`, status: 'ready', payload: { rows: data.rows.length } }, update: { status: 'ready', payload: { rows: data.rows.length } } })
  }, { timeout: 60000 })
}
let backfilling = false
// History was only ever filled by a manual backfill command; fill missing completed dates a
// little each evening (newest first) so the 3-year surge list builds up without console work.
export async function backfillHistory(today = clock(Date.now()).slice(0, 10), limit = Number(process.env.SURGE_BACKFILL_DAYS || 120)) {
  if (backfilling || !process.env.KRX_ID || !process.env.KRX_PW || !kisConfigured()) return { saved: 0, failed: 0 }
  backfilling = true
  let saved = 0, failed = 0
  try {
    const start = new Date(`${today}T00:00:00Z`); start.setUTCFullYear(start.getUTCFullYear() - Number(process.env.SURGE_HISTORY_YEARS || 3))
    const done = new Set((await prisma.surgeBatch.findMany({ where: { date: { startsWith: 'history:' } }, select: { date: true } })).map(b => b.date.slice(8)))
    for (let at = Date.parse(today) - 86400000; at >= start.getTime() && saved + failed < limit; at -= 86400000) {
      const date = new Date(at).toISOString().slice(0, 10), day = new Date(at).getUTCDay()
      if (day === 0 || day === 6 || done.has(date)) continue
      try {
        if (!await isKisTradingDay(date)) continue
        await importHistory(date); saved++
      } catch (error) {
        failed++; console.warn('[surge-history] backfill failed', date, batchError('PYTHON_HISTORY', error))
      }
      await sleep(Number(process.env.SURGE_BATCH_DELAY_SECONDS || 1) * 1000)
    }
    if (saved || failed) console.log(`[surge-history] backfill saved=${saved} failed=${failed}`)
    return { saved, failed }
  } finally { backfilling = false }
}
let preparing = false
export async function prepareUniverse(date = clock(Date.now()).slice(0, 10)) {
  if (preparing) return
  preparing = true
  let stage = 'PYTHON_PREPARE'
  try {
    if (!process.env.KRX_ID || !process.env.KRX_PW) throw new Error('KRX_LOGIN_REQUIRED')
    if ((await prisma.surgeBatch.findUnique({ where: { date } }))?.status === 'ready') return
    const data = await pythonBatch('prepare', date)
    stage = 'PYTHON_HISTORY'
    await importHistory(data.previousDate)
    stage = 'SECURITY_STATUS'
    const cutoff = new Date(`${date}T00:00:00Z`); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number(process.env.SURGE_HISTORY_YEARS || 3))
    const history = await prisma.surgeHistory.findMany({ where: { date: { gte: cutoff.toISOString().slice(0, 10), lt: date } }, distinct: ['ticker'], select: { ticker: true } })
    const historyCodes = new Set(history.map(r => r.ticker)), top = Number(process.env.SURGE_BASE_TOP || 400)
    const securities = data.securities.filter((r: any) => r.rank <= top || historyCodes.has(r.ticker))
    const accepted: any[] = []
    let unknown = 0
    // Verify security status before inclusion; no guessed eligibility for managed/suspended names.
    // A name whose status stays unavailable after retries is left out, not assumed eligible.
    for (const r of securities) {
      try { if (!(await statusWithRetry(r.ticker)).excluded) accepted.push(r) } catch { unknown++ }
      await sleep(Number(process.env.SURGE_STATUS_DELAY_MS || 80))
    }
    if (!accepted.length) throw new Error(unknown ? 'UNIVERSE_EMPTY_STATUS_UNAVAILABLE' : 'UNIVERSE_EMPTY')
    const warnings = unknown ? [...data.warnings, `SECURITY_STATUS_UNKNOWN:${unknown}`] : data.warnings
    stage = 'DB_SAVE'
    const mapsByTicker = new Map<string, any[]>()
    for (const m of data.maps) {
      if (!mapsByTicker.has(m.ticker)) mapsByTicker.set(m.ticker, [])
      mapsByTicker.get(m.ticker)!.push(m)
    }
    const universe = accepted.map(r => {
      const map = resolveTheme(mapsByTicker.get(r.ticker) || [], date)
      return { date, ticker: r.ticker, name: r.name, source: 'BASE' as const, addedAt: new Date(), rankAtAdd: r.rank,
        themeId: map?.themeId || `UNMAPPED:${r.ticker}`, themeName: map?.themeName || `UNMAPPED:${r.ticker}`, highReady: true }
    })
    // Bulk insert (ON CONFLICT DO NOTHING): row-by-row upserts of thousands of maps exceeded the transaction timeout.
    const chunk = 1000
    await prisma.$transaction(async tx => {
      for (let i = 0; i < data.maps.length; i += chunk) await tx.themeMap.createMany({ data: data.maps.slice(i, i + chunk), skipDuplicates: true })
      for (let i = 0; i < universe.length; i += chunk) await tx.universeDay.createMany({ data: universe.slice(i, i + chunk), skipDuplicates: true })
      await tx.surgeBatch.upsert({ where: { date }, create: { date, status: 'ready', payload: { count: accepted.length, warnings, previousDate: data.previousDate } },
        update: { status: 'ready', payload: { count: accepted.length, warnings, previousDate: data.previousDate } } })
    }, { timeout: 120000 })
  } catch (error) {
    const code = error instanceof Error && error.message === 'KRX_LOGIN_REQUIRED' ? 'KRX_LOGIN_REQUIRED' : batchError(stage, error)
    const failedAt = new Date().toISOString()
    await prisma.surgeBatch.upsert({ where: { date }, create: { date, status: 'failed', payload: { error: code, failedAt } }, update: { status: 'failed', payload: { error: code, failedAt } } }).catch(() => {})
    console.warn('[surge-universe] batch failed; expanded universe not ready:', code)
    throw new Error(code)
  } finally { preparing = false }
}
export async function expandIntraday(date: string, at: number) {
  const batch = await prisma.surgeBatch.findUnique({ where: { date } })
  if (batch?.status !== 'ready') return { count: 0, complete: false, error: 'THEME_BATCH_REQUIRED' }
  const ranked = await turnoverRanking()
  for (const r of ranked.rows) {
    if (/스팩|SPAC|우(?:B|C)?$|ETF|ETN/i.test(r.name)) continue
    if (await prisma.universeDay.findUnique({ where: { date_ticker: { date, ticker: r.ticker } } })) continue
    if ((await securityStatus(r.ticker)).excluded) continue
    const maps = await prisma.themeMap.findMany({ where: { ticker: r.ticker, validDate: date } })
    const map = resolveTheme(maps, date)
    await prisma.universeDay.create({ data: { date, ticker: r.ticker, name: r.name, source: 'INTRADAY', addedAt: new Date(at), rankAtAdd: r.rank,
      themeId: map?.themeId || `UNMAPPED:${r.ticker}`, themeName: map?.themeName || `UNMAPPED:${r.ticker}` } })
  }
  const missing = await prisma.universeDay.findMany({ where: { date, source: 'INTRADAY', highReady: false } })
  for (const r of missing) {
    try { await prisma.universeDay.update({ where: { date_ticker: { date, ticker: r.ticker } }, data: { dayHigh: await intradayHigh(r.ticker, at), highReady: true } }) } catch { /* Retry next broad cycle; breakout variants stay blocked. */ }
  }
  return { count: ranked.rows.length, complete: ranked.complete, target: ranked.target }
}
export async function loadUniverse(date: string): Promise<Pool> {
  const rows = await prisma.universeDay.findMany({ where: { date } })
  return Object.fromEntries(rows.map(r => [r.ticker, { name: r.name, themes: [r.themeName] }]))
}
