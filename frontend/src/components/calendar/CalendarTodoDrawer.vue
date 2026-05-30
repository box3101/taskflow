<script setup lang="ts">
import { ref, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import {
  UiDrawer, UiInput, UiTextarea, UiDatePicker, UiButton, UiToggle,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import api from '../../api/client'
import type { Todo, TodoFile } from '../../types/todo'

const props = defineProps<{
  open: boolean
  todoId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const loading = ref(false)
const title = ref('')
const dueDate = ref<DateValue | undefined>(undefined)
const memo = ref('')
const done = ref(false)
const files = ref<TodoFile[]>([])
const fileUploading = ref(false)
const todo = ref<Todo | null>(null)

function toCalendarDate(iso: string | null): DateValue | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function fromCalendarDate(val: DateValue | undefined): string | null {
  if (!val) return null
  return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`
}

function getFileUrl(filePath: string) {
  return `http://localhost:4000/uploads/${filePath}`
}

function isImage(mimetype: string) {
  return mimetype.startsWith('image/')
}

watch(() => [props.open, props.todoId], async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  try {
    const { data } = await api.get(`/todos/${id}`)
    const t: Todo = data.data
    todo.value = t
    title.value = t.title
    dueDate.value = toCalendarDate(t.dueDate)
    memo.value = t.memo ?? ''
    done.value = t.done
    files.value = t.files ? [...t.files] : []
  } catch {
    openToast({ message: '할일을 불러오는데 실패했습니다.', type: 'error' })
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function onSave() {
  if (!todo.value) return
  const trimTitle = title.value.trim()
  if (!trimTitle) return

  const dueDateStr = fromCalendarDate(dueDate.value)
  const memoStr = memo.value.trim() || null

  const patch: Record<string, unknown> = {}
  if (trimTitle !== todo.value.title) patch.title = trimTitle
  if (dueDateStr !== todo.value.dueDate) patch.dueDate = dueDateStr
  if (memoStr !== (todo.value.memo ?? null)) patch.memo = memoStr

  if (Object.keys(patch).length === 0) {
    emit('update:open', false)
    return
  }

  try {
    await api.patch(`/todos/${todo.value.id}`, patch)
    emit('update:open', false)
    emit('saved')
    openToast({ message: '할일이 수정되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  }
}

async function onToggleDone(val: boolean) {
  if (!todo.value) return
  done.value = val
  try {
    await api.patch(`/todos/${todo.value.id}`, { done: val })
    emit('update:open', false)
    emit('saved')
    openToast({ message: val ? '완료 처리되었습니다.' : '할일로 복원되었습니다.', type: 'success' })
  } catch {
    done.value = !val
    openToast({ message: '상태 변경에 실패했습니다.', type: 'error' })
  }
}

async function onDelete() {
  if (!todo.value) return
  const confirmed = await openConfirm({
    title: '할일 삭제',
    message: `<strong>${todo.value.title}</strong>을(를) 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/todos/${todo.value.id}`)
    emit('update:open', false)
    emit('deleted')
    openToast({ message: '휴지통으로 이동했습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

async function onFileUpload(e: Event) {
  if (!todo.value) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(`/todos/${todo.value.id}/files`, formData)
    files.value.push(data.data)
  } catch {
    openToast({ message: '파일 업로드에 실패했습니다.', type: 'error' })
  } finally {
    fileUploading.value = false
    input.value = ''
  }
}

async function deleteFile(file: TodoFile) {
  if (!todo.value) return
  try {
    await api.delete(`/todos/${todo.value.id}/files/${file.id}`)
    files.value = files.value.filter(f => f.id !== file.id)
  } catch {
    openToast({ message: '파일 삭제에 실패했습니다.', type: 'error' })
  }
}
</script>

<template>
  <UiDrawer :open="open" title="할일 상세" max-width="100vw" @update:open="emit('update:open', $event)">
    <div v-if="loading" style="text-align:center; padding:40px; color:#9ca3af;">불러오는 중...</div>
    <form v-else class="drawer-form" @submit.prevent="onSave">
      <UiInput v-model="title" label="제목" placeholder="할일 제목" />
      <div class="drawer-field">
        <label class="drawer-field__label">마감일</label>
        <UiDatePicker v-model="dueDate" type="date" size="sm" />
      </div>
      <UiTextarea v-model="memo" label="메모" placeholder="메모를 입력하세요..." :rows="5" />

      <!-- 파일 첨부 -->
      <div class="drawer-field">
        <label class="drawer-field__label">첨부파일</label>
        <div class="drawer-files">
          <div v-for="file in files" :key="file.id" :class="isImage(file.mimetype) ? 'drawer-file drawer-file--image' : 'drawer-file'">
            <template v-if="isImage(file.mimetype)">
              <a :href="getFileUrl(file.path)" target="_blank" class="drawer-file__preview">
                <img :src="getFileUrl(file.path)" class="drawer-file__img" />
              </a>
              <div class="drawer-file__info">
                <span class="drawer-file__name">{{ file.filename }}</span>
                <button class="drawer-file__delete" @click="deleteFile(file)" type="button">
                  <i class="icon-close size-12" />
                </button>
              </div>
            </template>
            <template v-else>
              <span class="drawer-file__icon">📎</span>
              <a :href="getFileUrl(file.path)" target="_blank" class="drawer-file__name">{{ file.filename }}</a>
              <button class="drawer-file__delete" @click="deleteFile(file)" type="button">
                <i class="icon-close size-12" />
              </button>
            </template>
          </div>
          <label class="drawer-file-add" :class="{ 'drawer-file-add--disabled': fileUploading }">
            <input type="file" hidden @change="onFileUpload" :disabled="fileUploading" />
            {{ fileUploading ? '업로드 중...' : '+ 파일 추가' }}
          </label>
        </div>
      </div>
    </form>
    <template #footer>
      <div class="todo-drawer-footer">
        <div class="todo-drawer-footer__left">
          <UiButton variant="danger" size="sm" @click="onDelete">삭제</UiButton>
        </div>
        <div class="todo-drawer-footer__center">
          <span class="todo-drawer-footer__done-label" :class="{ 'todo-drawer-footer__done-label--active': done }">
            {{ done ? '완료됨' : '미완료' }}
          </span>
          <UiToggle :model-value="done" @update:model-value="onToggleDone" />
        </div>
        <div class="todo-drawer-footer__right">
          <UiButton variant="ghost" size="sm" @click="emit('update:open', false)">취소</UiButton>
          <UiButton variant="primary" size="sm" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.drawer-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.drawer-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drawer-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
  &--image {
    flex-direction: column;
    align-items: stretch;
  }
}
.drawer-file__preview {
  display: block;
  border-radius: 4px;
  overflow: hidden;
}
.drawer-file__img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 4px;
}
.drawer-file__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.drawer-file__icon {
  font-size: 16px;
}
.drawer-file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
.drawer-file__delete {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}
.drawer-file-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  &:hover { border-color: #3b82f6; color: #3b82f6; }
  &--disabled { opacity: 0.5; cursor: not-allowed; }
}
.todo-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.todo-drawer-footer__left,
.todo-drawer-footer__right {
  display: flex;
  gap: 8px;
}
.todo-drawer-footer__center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.todo-drawer-footer__done-label {
  font-size: 12px;
  color: #9ca3af;
  &--active { color: #22c55e; font-weight: 600; }
}
</style>
