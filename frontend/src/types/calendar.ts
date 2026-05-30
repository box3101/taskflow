export interface CalendarEvent {
  id: number
  type: 'event' | 'todo' | 'issue'
  title: string
  date: string       // "YYYY-MM-DD"
  startTime: string | null
  endTime: string | null
  color: string
  memo: string | null
  location: string | null
  projectId?: number
  projectName?: string
}

export const COLOR_PRESETS = [
  { label: '파랑', value: '#3b82f6' },
  { label: '빨강', value: '#ef4444' },
  { label: '초록', value: '#22c55e' },
  { label: '노랑', value: '#f59e0b' },
  { label: '보라', value: '#8b5cf6' },
  { label: '분홍', value: '#ec4899' },
  { label: '회색', value: '#6b7280' },
] as const
