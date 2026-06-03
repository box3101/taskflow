export interface TechNote {
  id: number
  userId: number
  title: string
  category: string
  tags: string[]
  summary: string
  content: string
  createdAt: string
  updatedAt: string
}

export const CATEGORIES = [
  { value: 'frontend', label: '프론트엔드' },
  { value: 'backend', label: '백엔드' },
  { value: 'db', label: 'DB' },
  { value: 'devops', label: 'DevOps' },
  { value: 'etc', label: '기타' },
] as const
