export interface TodoFile {
  id: number
  todoId: number
  filename: string
  path: string
  mimetype: string
  size: number
}

export interface Todo {
  id: number
  title: string
  memo: string | null
  done: boolean
  dueDate: string | null
  startDate: string | null
  startTime: string | null
  endTime: string | null
  allDay: boolean
  repeatType: string | null
  repeatDay: number | null
  createdAt: string
  deletedAt?: string | null
  files?: TodoFile[]
}
