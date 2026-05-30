<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  UiDrawer, UiButton, UiTextarea, UiBadge, UiDropdownMenu,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import api from '../../api/client'

interface Issue {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  assignee: { id: number; name: string } | null
  assigneeId: number | null
  requestedAt: string | null
  dueAt: string | null
  createdAt: string
  projectId: number
}

const props = defineProps<{
  open: boolean
  issueId: number | null
  projectId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const loading = ref(false)
const issue = ref<Issue | null>(null)
const description = ref('')
const saving = ref(false)
const deleting = ref(false)

const statusMenuItems: DropdownMenuItemDef[] = [
  { value: 'todo', label: '할 일' },
  { value: 'doing', label: '진행중' },
  { value: 'done', label: '완료' },
]

const priorityMenuItems: DropdownMenuItemDef[] = [
  { value: 'high', label: '높음' },
  { value: 'mid', label: '보통' },
  { value: 'low', label: '낮음' },
]

const priorityMap: Record<string, { label: string; variant: string }> = {
  high: { label: '높음', variant: 'danger' },
  mid: { label: '보통', variant: 'warning' },
  low: { label: '낮음', variant: 'default' },
}

watch(() => [props.open, props.issueId], async ([open, id]) => {
  if (!open || !id) return
  loading.value = true
  try {
    const { data } = await api.get(`/issues/${id}`)
    issue.value = data.data
    description.value = data.data.description || ''
  } catch {
    openToast({ message: '이슈를 불러오는데 실패했습니다.', type: 'error' })
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function onInlineChange(field: string, val: string) {
  if (!issue.value) return
  const prev = (issue.value as any)[field]
  ;(issue.value as any)[field] = val

  const updateData: Record<string, unknown> = { [field]: val }
  if (field === 'assigneeId') {
    updateData.assigneeId = val ? Number(val) : null
  }

  try {
    // PUT /issues/:id는 data 래핑 없이 반환
    const { data } = await api.put(`/issues/${issue.value.id}`, updateData)
    issue.value = data
    emit('saved')
  } catch {
    ;(issue.value as any)[field] = prev
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  }
}

async function onSave() {
  if (!issue.value) return
  saving.value = true
  try {
    const { data } = await api.put(`/issues/${issue.value.id}`, {
      description: description.value.trim() || null,
    })
    issue.value = data
    emit('update:open', false)
    emit('saved')
    openToast({ message: '저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!issue.value) return
  const confirmed = await openConfirm({
    title: '이슈 삭제',
    message: `<strong>${issue.value.title}</strong> 이슈를 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  deleting.value = true
  try {
    await api.delete(`/issues/${issue.value.id}`)
    emit('update:open', false)
    emit('deleted')
    openToast({ message: '삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  } finally {
    deleting.value = false
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR')
}
</script>

<template>
  <UiDrawer :open="open" :title="issue?.title || '이슈 상세'" width="480px" max-width="700px" @update:open="emit('update:open', $event)">
    <div v-if="loading" style="text-align:center; padding:40px; color:#9ca3af;">불러오는 중...</div>
    <div v-else-if="issue" class="panel-detail">
      <!-- 속성 테이블 -->
      <div class="panel-props">
        <div class="panel-prop">
          <span class="panel-prop-label">상태</span>
          <UiDropdownMenu :items="statusMenuItems" @select="(val: string) => onInlineChange('status', val)">
            <template #trigger>
              <button class="cell-badge-btn">
                <UiBadge :variant="issue.status === 'done' ? 'success' : issue.status === 'doing' ? 'primary' : 'default'" size="sm">
                  {{ issue.status === 'done' ? '완료' : issue.status === 'doing' ? '진행중' : '할 일' }}
                </UiBadge>
              </button>
            </template>
          </UiDropdownMenu>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">우선순위</span>
          <UiDropdownMenu :items="priorityMenuItems" @select="(val: string) => onInlineChange('priority', val)">
            <template #trigger>
              <button class="cell-badge-btn">
                <UiBadge :variant="(priorityMap[issue.priority]?.variant || 'default') as any" size="sm">
                  {{ priorityMap[issue.priority]?.label || '낮음' }}
                </UiBadge>
              </button>
            </template>
          </UiDropdownMenu>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">담당자</span>
          <span v-if="issue.assignee" class="panel-prop-value">{{ issue.assignee.name }}</span>
          <span v-else class="panel-prop-value" style="color:#9ca3af">미배정</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">요청일</span>
          <span class="panel-prop-value">{{ formatDate(issue.requestedAt) }}</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">마감일</span>
          <span class="panel-prop-value">{{ formatDate(issue.dueAt) }}</span>
        </div>
        <div class="panel-prop">
          <span class="panel-prop-label">생성일</span>
          <span class="panel-prop-value">{{ formatDate(issue.createdAt) }}</span>
        </div>
      </div>

      <hr class="panel-divider" />

      <!-- 설명 -->
      <form class="drawer-form" @submit.prevent="onSave">
        <UiTextarea v-model="description" label="설명" placeholder="이슈에 대한 메모를 작성하세요..." :rows="6" />
      </form>
    </div>
    <template #footer>
      <div class="drawer-footer-between">
        <UiButton variant="danger" size="sm" :loading="deleting" @click="onDelete">삭제</UiButton>
        <div class="drawer-footer">
          <UiButton variant="ghost" size="md" @click="emit('update:open', false)">취소</UiButton>
          <UiButton variant="primary" size="md" :loading="saving" @click="onSave">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<style scoped lang="scss">
.panel-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.panel-props {
  display: flex;
  flex-direction: column;
}
.panel-prop {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.panel-prop-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}
.panel-prop-value {
  font-size: 13px;
  color: #374151;
}
.panel-divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}
.cell-badge-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.1s;
  &:hover { background: #f3f4f6; }
}
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.drawer-footer-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
