import 'dotenv/config'
import prisma from '../prisma'
import { importHistory, prepareUniverse } from '../services/surge/universe'
import { clock } from '../services/spikeCloudRules'
import { isKisTradingDay } from '../services/kisFlow'

async function main() {
  const [mode, start, end] = process.argv.slice(2)
  if (mode === 'prepare') return prepareUniverse(start || clock(Date.now()).slice(0, 10))
  if (mode !== 'backfill' || !/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) throw new Error('Usage: surge:batch prepare [YYYY-MM-DD] | backfill START END')
  if (start > end || end >= clock(Date.now()).slice(0, 10)) throw new Error('Backfill only completed dates')
  for (let at = Date.parse(start); at <= Date.parse(end); at += 86400000) {
    const date = new Date(at).toISOString().slice(0, 10), day = new Date(at).getUTCDay()
    if (day === 0 || day === 6 || await prisma.surgeBatch.findUnique({ where: { date: `history:${date}` } })) continue
    if (!await isKisTradingDay(date)) continue
    await importHistory(date)
    console.log(`Saved history ${date}`)
    await new Promise(resolve => setTimeout(resolve, Number(process.env.SURGE_BATCH_DELAY_SECONDS || 1) * 1000))
  }
}
main().catch(() => { console.error('Surge batch failed; completed dates are checkpointed. Verify Python/KRX/KIS and DB configuration.'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
