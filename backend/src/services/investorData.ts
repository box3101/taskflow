import prisma from '../prisma'

// 네이버 외국인/기관 매매동향 크롤링 + DB 캐시
// 과거 재현 백테스트를 위해 최대 260거래일까지 페이징 수집한다.

export interface InvestorRow {
  date: string          // YYYYMMDD
  close: number         // 종가
  changePct: number     // 일간 등락률 (%)
  volume: number        // 거래량 (전체)
  foreignVol: number    // 외국인 순매매량 (주)
  instVol: number       // 기관 순매매량 (주)
  foreignHold: number   // 외국인 보유주수
  foreignRatio: number  // 외국인 보유율 (%)
  listedShares: number  // 역산 상장주식수
}

// ===== 크롤링 =====

const PAGE_DELAY_MS = 350   // 네이버 연속 요청 방어
const MAX_PAGES = 120       // 안전 상한 (페이지당 20행 → 최대 2400일). 실제 종료는 days 도달/데이터 소진
const CACHE_TTL_MS = 10 * 60_000   // 캐시 신선도 10분 (장중 당일 데이터 갱신 대응)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const parseNum = (v: string): number => {
  if (!v) return 0
  return Number(v.replace(/,/g, '').replace(/\+/g, '').trim()) || 0
}

/** frgn 페이지 1장 파싱 */
function parsePage(html: string): InvestorRow[] {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
  const rows: InvestorRow[] = []
  let match

  while ((match = rowRegex.exec(html)) !== null) {
    const tds: string[] = []
    let tdMatch
    while ((tdMatch = tdRegex.exec(match[1])) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
    }
    // 컬럼: 날짜(0), 종가(1), 전일비(2), 등락률(3), 거래량(4), 기관(5), 외국인(6), 보유주수(7), 보유율(8)
    if (tds.length < 9 || !/^\d{4}\.\d{2}\.\d{2}$/.test(tds[0])) continue

    const foreignHold = parseNum(tds[7])
    const foreignRatio = parseFloat(tds[8].replace(/[%,]/g, '')) || 0
    // 보유율(%)로 상장주식수 역산 — 과거 시총 복원용 (보유율 0이면 산출 불가)
    const listedShares = foreignRatio > 0 ? Math.round(foreignHold / (foreignRatio / 100)) : 0

    rows.push({
      date: tds[0].replace(/\./g, ''),
      close: parseNum(tds[1]),
      changePct: parseFloat(tds[3].replace(/[+%,]/g, '')) || 0,
      volume: parseNum(tds[4]),
      foreignVol: parseNum(tds[6]),
      instVol: parseNum(tds[5]),
      foreignHold,
      foreignRatio,
      listedShares,
    })
  }
  return rows
}

/** 네이버에서 지정 거래일수만큼 페이징 수집 (날짜 기준 dedup) */
export async function crawlInvestor(code: string, days: number): Promise<InvestorRow[]> {
  const byDate = new Map<string, InvestorRow>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (byDate.size >= days) break

    const url = `https://finance.naver.com/item/frgn.naver?code=${code}&page=${page}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const rows = parsePage(await res.text())

    if (rows.length === 0) break   // 마지막 페이지 초과

    // 페이지 경계에서 행이 밀리거나, 마지막 페이지를 반복 응답하는 경우 방어
    let added = 0
    for (const r of rows) {
      if (!byDate.has(r.date)) {
        byDate.set(r.date, r)
        added++
      }
    }
    if (added === 0) break

    await sleep(PAGE_DELAY_MS)
  }

  return [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))   // 최신순
    .slice(0, days)
}

// ===== 액면분할/감자 감지 =====

/**
 * 상장주식수가 하루 만에 20% 넘게 변하면 액면분할·감자·증자 의심 구간.
 * 해당 날짜 이전 구간은 가격 연속성이 깨지므로 백테스트에서 제외해야 한다.
 * @returns 의심 날짜 배열 (YYYYMMDD, 최신순)
 */
export function detectShareDiscontinuity(rows: InvestorRow[]): string[] {
  const flagged: string[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const cur = rows[i].listedShares
    const prev = rows[i + 1].listedShares
    if (cur <= 0 || prev <= 0) continue
    if (Math.abs(cur - prev) / prev > 0.2) flagged.push(rows[i].date)
  }
  return flagged
}

// ===== DB 캐시 =====

/**
 * 캐시가 최신인지 — 마지막 수집 시각 기준 TTL.
 * 날짜 기준으로 판정하면 장중에 당일 행이 갱신돼도 캐시가 유지되므로 수집 시각을 쓴다.
 */
function isFresh(rows: { createdAt: Date }[]): boolean {
  if (rows.length === 0) return false
  return Date.now() - rows[0].createdAt.getTime() < CACHE_TTL_MS
}

/** 수집 결과를 DB에 저장 — 과거 행은 불변, 최근 3일만 갱신 */
async function saveRows(code: string, rows: InvestorRow[]): Promise<void> {
  if (rows.length === 0) return

  // 최근 3거래일은 장중 값이 바뀌므로 지우고 다시 넣는다
  const recent = rows.slice(0, 3).map(r => r.date)
  await prisma.investorDaily.deleteMany({ where: { code, date: { in: recent } } })

  await prisma.investorDaily.createMany({
    data: rows.map(r => ({ code, ...r })),
    skipDuplicates: true,
  })
}

/**
 * 외인/기관 일별 동향 조회 (read-through 캐시)
 * @param opts.refresh    캐시 무시하고 강제 재수집
 * @param opts.allowStale 신선도 무시하고 캐시 우선 (과거 재현 백테스트용 — 과거 행은 불변)
 */
export async function getInvestorRows(
  code: string,
  days: number,
  opts: { refresh?: boolean; allowStale?: boolean } = {},
): Promise<InvestorRow[]> {
  if (!opts.refresh) {
    const cached = await prisma.investorDaily.findMany({
      where: { code },
      orderBy: { date: 'desc' },
      take: days,
    })
    if (cached.length >= days && (opts.allowStale || isFresh(cached))) {
      return cached.map(c => ({
        date: c.date,
        close: c.close,
        changePct: c.changePct,
        volume: c.volume,
        foreignVol: c.foreignVol,
        instVol: c.instVol,
        foreignHold: c.foreignHold ?? 0,
        foreignRatio: c.foreignRatio ?? 0,
        listedShares: c.listedShares ?? 0,
      }))
    }
  }

  const fresh = await crawlInvestor(code, days)
  await saveRows(code, fresh)
  return fresh
}
