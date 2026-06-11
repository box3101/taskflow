export interface CalendarEvent {
  id: number
  type: 'event' | 'todo' | 'issue'
  title: string
  date: string       // "YYYY-MM-DD" (범위 항목은 해당 날짜로 확장됨)
  startTime: string | null
  endTime: string | null
  allDay?: boolean
  span?: 'single' | 'start' | 'middle' | 'end'  // 다일 항목 막대 위치
  srcStart?: string       // 원본 시작일 "YYYY-MM-DD" (편집 시 범위 복원용)
  srcEnd?: string | null  // 원본 종료일 (단일 날짜면 null)
  color: string
  memo: string | null
  location: string | null
  projectId?: number
  projectName?: string
}

// 시간 select 옵션 (30분 단위, 00:00 ~ 23:30)
export const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const arr: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      arr.push({ value: v, label: v })
    }
  }
  return arr
})()

export const COLOR_PRESETS = [
  { label: '파랑', value: '#3b82f6' },
  { label: '빨강', value: '#ef4444' },
  { label: '초록', value: '#22c55e' },
  { label: '노랑', value: '#f59e0b' },
  { label: '보라', value: '#8b5cf6' },
  { label: '분홍', value: '#ec4899' },
  { label: '회색', value: '#6b7280' },
] as const
