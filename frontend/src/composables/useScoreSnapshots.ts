import { ref } from 'vue'
import { fetchSnapshotList, fetchSnapshotByDate, fetchPrice, fetchDailyMarks } from '../api/stockApi'
import type { ScoreSnapshotFull, ScoreDailyMark } from '../api/stockApi'

// 캐시 유효 시간 — 탭을 오래 비웠다 돌아오면 시세를 다시 받는다
const CACHE_TTL_MS = 90_000

// ===== 상태 변수 (모듈 스코프 — 카드 간 공유) =====
const snapshots = ref<ScoreSnapshotFull[]>([])
const prices = ref<Record<string, number>>({})   // 미확정 종목 현재가
const marks = ref<ScoreDailyMark[]>([])           // 일별 종가 마크 (자산곡선 일 단위 계산용)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')

let inflight: Promise<void> | null = null
let loadedAt = 0
let generation = 0   // 뒤늦게 끝난 옛 요청이 최신 결과를 덮어쓰지 못하게 하는 세대 번호

// ===== 조회 =====
const loadOnce = async () => {
  const gen = ++generation
  loading.value = true
  error.value = ''
  try {
    const [list, markList] = await Promise.all([fetchSnapshotList(), fetchDailyMarks()])
    const fulls: ScoreSnapshotFull[] = []
    for (const s of list) {
      const full = await fetchSnapshotByDate(s.date)
      if (full && Array.isArray(full.data)) fulls.push(full)
    }

    // 미확정 종목 현재가는 코드 중복 제거 후 1회만 조회
    const pendingCodes = [...new Set(
      fulls.flatMap(f => f.data.filter(i => i.exitPrice == null).map(i => i.code))
    )]
    const priceMap: Record<string, number> = {}
    if (pendingCodes.length > 0) {
      const res = await fetchPrice(pendingCodes)
      for (const [code, q] of Object.entries(res)) priceMap[code] = q.price || 0
    }

    if (gen !== generation) return   // 더 새 요청이 시작됨 — 이 결과는 버린다

    snapshots.value = fulls
    prices.value = priceMap
    marks.value = markList
    loaded.value = true
    loadedAt = Date.now()
  } catch (e) {
    if (gen !== generation) return
    error.value = '스냅샷 로드 실패'
    console.error(e)
  } finally {
    if (gen === generation) loading.value = false
  }
}

const startLoad = () => {
  const p = loadOnce().finally(() => { if (inflight === p) inflight = null })
  inflight = p
  return p
}

const isFresh = () => loaded.value && Date.now() - loadedAt < CACHE_TTL_MS

// 캐시가 신선하면 즉시 반환, 진행 중이면 그 요청을 공유한다
const handleLoadSnapshots = async () => {
  if (isFresh()) return
  await (inflight ?? startLoad())
}

// 항상 새 로드를 시작한다 — 진행 중인 옛 요청에 편승하지 않는다
const handleRefreshSnapshots = async () => {
  await startLoad()
}

export const useScoreSnapshots = () => {
  return { snapshots, prices, marks, loading, loaded, error, handleLoadSnapshots, handleRefreshSnapshots }
}
