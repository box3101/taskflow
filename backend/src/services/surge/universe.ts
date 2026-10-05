import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import prisma from '../../prisma'
import { clock, Pool } from '../spikeCloudRules'
import { resolveTheme } from './context'
import { securityStatus, intradayHigh, turnoverRanking } from './market'
const exec = promisify(execFile)
export async function pythonBatch(mode: 'prepare' | 'history', date: string) {
  const { stdout } = await exec(process.env.PYTHON_BIN || 'python', [path.resolve(process.cwd(), 'scripts/surge_batch.py'), mode, date], {
    windowsHide: true, timeout: Number(process.env.SURGE_BATCH_TIMEOUT_MS || 900000), maxBuffer: 20 * 1024 * 1024,
  })
  return JSON.parse(stdout)
}
export async function importHistory(date: string) {
  const data = await pythonBatch('history', date)
  await prisma.$transaction(async tx => {
    for (const r of data.rows) await tx.surgeHistory.upsert({ where: { ticker_date: { ticker: r.ticker, date } },
      create: { ticker: r.ticker, date, value: BigInt(r.value), chgRate: r.chgRate }, update: { value: BigInt(r.value), chgRate: r.chgRate } })
    await tx.surgeBatch.upsert({ where: { date: `history:${date}` }, create: { date: `history:${date}`, status: 'ready', payload: { rows: data.rows.length } }, update: { status: 'ready', payload: { rows: data.rows.length } } })
  }, { timeout: 60000 })
}
let preparing = false
export async function prepareUniverse(date = clock(Date.now()).slice(0, 10)) {
  if (preparing) return
  preparing = true
  try {
    if (!process.env.KRX_ID || !process.env.KRX_PW) throw new Error('KRX_LOGIN_REQUIRED')
    if ((await prisma.surgeBatch.findUnique({ where: { date } }))?.status === 'ready') return
    const data = await pythonBatch('prepare', date)
    await importHistory(data.previousDate)
    const cutoff = new Date(`${date}T00:00:00Z`); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number(process.env.SURGE_HISTORY_YEARS || 3))
    const history = await prisma.surgeHistory.findMany({ where: { date: { gte: cutoff.toISOString().slice(0, 10), lt: date } }, distinct: ['ticker'], select: { ticker: true } })
    const historyCodes = new Set(history.map(r => r.ticker)), top = Number(process.env.SURGE_BASE_TOP || 400)
    const securities = data.securities.filter((r: any) => r.rank <= top || historyCodes.has(r.ticker))
    const accepted: any[] = []
    // Verify security status before inclusion; no guessed eligibility for managed/suspended names.
    for (const r of securities) {
      if (!(await securityStatus(r.ticker)).excluded) accepted.push(r)
    }
    if (!accepted.length) throw new Error('UNIVERSE_EMPTY')
    await prisma.$transaction(async tx => {
      for (const row of data.maps) await tx.themeMap.upsert({ where: { ticker_themeId_source_validDate: {
        ticker: row.ticker, themeId: row.themeId, source: row.source, validDate: date,
      } }, create: row, update: {} })
      for (const r of accepted) {
        const map = resolveTheme(data.maps.filter((m: any) => m.ticker === r.ticker), date)
        const create = { date, ticker: r.ticker, name: r.name, source: 'BASE' as const, addedAt: new Date(), rankAtAdd: r.rank,
          themeId: map?.themeId || `UNMAPPED:${r.ticker}`, themeName: map?.themeName || `UNMAPPED:${r.ticker}`, highReady: true }
        await tx.universeDay.upsert({ where: { date_ticker: { date, ticker: r.ticker } }, create, update: {} })
      }
      await tx.surgeBatch.upsert({ where: { date }, create: { date, status: 'ready', payload: { count: accepted.length, warnings: data.warnings, previousDate: data.previousDate } },
        update: { status: 'ready', payload: { count: accepted.length, warnings: data.warnings, previousDate: data.previousDate } } })
    }, { timeout: 120000 })
  } catch (error) {
    const code = error instanceof Error && error.message === 'KRX_LOGIN_REQUIRED' ? 'KRX_LOGIN_REQUIRED' : 'UNIVERSE_PREPARATION_FAILED'
    await prisma.surgeBatch.upsert({ where: { date }, create: { date, status: 'failed', payload: { error: code } }, update: { status: 'failed', payload: { error: code } } }).catch(() => {})
    console.warn('[surge-universe] batch failed; expanded universe not ready')
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
