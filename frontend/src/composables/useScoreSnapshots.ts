import { ref } from 'vue'
import { fetchSnapshotList, fetchSnapshotByDate, fetchPrice } from '../api/stockApi'
import type { ScoreSnapshotFull } from '../api/stockApi'

// ===== 상태 변수 (모듈 스코프 — 카드 간 공유) =====
const snapshots = ref<ScoreSnapshotFull[]>([])
const prices = ref<Record<string, number>>({})   // 미확정 종목 현재가
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let inflight: Promise<void> | null = null

// ===== 조회 =====
const loadOnce = async () => {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchSnapshotList()
    const fulls: ScoreSnapshotFull[] = []
    for (const s of list) {
      const full = await fetchSnapshotByDate(s.date)
      if (full && Array.isArray(full.data)) fulls.push(full)
    }
    snapshots.value = fulls

    // 미확정 종목 현재가는 코드 중복 제거 후 1회만 조회
    const pendingCodes = [...new Set(
      fulls.flatMap(f => f.data.filter(i => i.exitPrice == null).map(i => i.code))
    )]
    if (pendingCodes.length > 0) {
      const res = await fetchPrice(pendingCodes)
      const map: Record<string, number> = {}
      for (const [code, q] of Object.entries(res)) map[code] = q.price || 0
      prices.value = map
    } else {
      prices.value = {}
    }
    loaded.value = true
  } catch (e) {
    error.value = '스냅샷 로드 실패'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 이미 로드됐으면 즉시 반환, 진행 중이면 그 Promise를 공유한다
const handleLoadSnapshots = async () => {
  if (loaded.value) return
  if (!inflight) inflight = loadOnce().finally(() => { inflight = null })
  await inflight
}

// 캐시를 버리고 다시 받는다 (두 카드 모두 갱신됨)
const handleRefreshSnapshots = async () => {
  loaded.value = false
  if (!inflight) inflight = loadOnce().finally(() => { inflight = null })
  await inflight
}

export const useScoreSnapshots = () => {
  return { snapshots, prices, loading, loaded, error, handleLoadSnapshots, handleRefreshSnapshots }
}
