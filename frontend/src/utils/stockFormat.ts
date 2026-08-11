// 주식 카드 공용 표시 포맷 — 수익률 문자열과 등락 색상

/** 수익률을 부호 붙은 퍼센트 문자열로 (예: +4.55%, -1.30%) */
export function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

/** 등락 색상 — 상승 빨강, 하락 파랑, 보합 회색 (국내 증시 관례) */
export function pctColor(v: number): string {
  if (v > 0) return '#ef4444'
  if (v < 0) return '#3b82f6'
  return '#6b7280'
}
