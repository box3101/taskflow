import { ref, type Ref } from 'vue'

/**
 * stale-while-revalidate 캐시
 *
 * 같은 key로 호출하면 이전에 받아둔 데이터를 즉시 보여주고(빈 화면 X),
 * 백그라운드에서 최신 데이터로 갱신한다. 백엔드가 느려도 메뉴 전환은 즉시.
 *
 * 핵심: 캐시는 "데이터 스냅샷"이 아니라 "ref 자체"를 보관한다.
 * → 모든 화면이 같은 ref를 공유하므로, 목록을 직접 수정(unshift/splice 등)해도
 *   캐시와 어긋날 일이 없다 (데이터 소스가 하나뿐). stale-data 규칙 자동 충족.
 */
const cache = new Map<string, Ref<unknown>>()

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  initial: T,
  onError?: (e: unknown) => void,
) {
  const isCached = cache.has(key)
  if (!isCached) {
    cache.set(key, ref(initial) as Ref<unknown>)
  }
  const data = cache.get(key) as Ref<T>

  // 캐시가 있으면 로딩 표시 없이 곧바로 이전 데이터를 보여준다 (첫 진입 때만 로딩)
  const loading = ref(!isCached)

  async function load() {
    try {
      data.value = await fetcher()
    } catch (e) {
      // 실패해도 기존(stale) 데이터는 유지 — 갱신만 실패한 것뿐
      if (onError) onError(e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, load }
}

/** 동적 key 캐시 (캘린더 월별 등). 저장된 값을 즉시 꺼내 쓸 때 사용 */
export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.value as T | undefined
}

export function setCached<T>(key: string, value: T) {
  const existing = cache.get(key)
  if (existing) existing.value = value
  else cache.set(key, ref(value) as Ref<unknown>)
}

/** 특정 key 캐시를 무효화 (로그아웃 등에서 사용) */
export function invalidateCache(key?: string) {
  if (key) cache.delete(key)
  else cache.clear()
}
