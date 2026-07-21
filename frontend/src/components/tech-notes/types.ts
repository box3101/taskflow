export interface TechNote {
  id: number
  userId: number
  title: string
  category: string
  tags: string[]
  summary: string
  content: string
  isPublic: boolean
  user?: { name: string } // 목록/상세 조회 시 포함되는 작성자 정보
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
