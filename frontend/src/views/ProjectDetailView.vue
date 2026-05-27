<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiTab, UiBadge, UiLoading, UiEmpty, UiButton, UiModal, UiInput, UiSelect, UiToast, UiConfirm, openToast, openConfirm } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption } from '@leechanyong/ispark-ui'
import draggable from 'vuedraggable'
import api from '../api/client'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id

const loading = ref(true)
const project = ref<any>(null)
const issues = ref<any[]>([])
const activeTab = ref('board')

const tabs: TabItem[] = [
  { label: '보드', value: 'board' },
  { label: '멤버', value: 'members' },
  { label: '개요', value: 'overview' },
]

// 칸반 컬럼 정의
const kanbanColumns = [
  { key: 'todo', label: '할 일', color: '#6b7280' },
  { key: 'doing', label: '진행중', color: '#3b82f6' },
  { key: 'done', label: '완료', color: '#22c55e' },
]

// 상태별 이슈 분류 (ref — vuedraggable이 직접 수정 가능)
const issuesByStatus = ref<Record<string, any[]>>({ todo: [], doing: [], done: [] })

function syncIssuesByStatus() {
  const grouped: Record<string, any[]> = { todo: [], doing: [], done: [] }
  issues.value.forEach(issue => {
    if (grouped[issue.status]) grouped[issue.status].push(issue)
  })
  issuesByStatus.value = grouped
}

// 우선순위 색상 맵
const priorityMap: Record<string, { label: string; color: string; border: string }> = {
  high: { label: '높음', color: 'red', border: '#ef4444' },
  mid: { label: '보통', color: 'yellow', border: '#f59e0b' },
  low: { label: '낮음', color: 'gray', border: '#d1d5db' },
}

// 드래그 앤 드롭 (vuedraggable)
const isDragging = ref(false)

function onDragChange(colKey: string, evt: any) {
  if (evt.added) {
    const issue = evt.added.element
    const prevStatus = issue.status
    issue.status = colKey
    api.put(`/issues/${issue.id}`, { status: colKey }).catch(() => {
      issue.status = prevStatus
      syncIssuesByStatus()
    })
  }
}

// 이슈 생성 모달
const showCreateModal = ref(false)
const newIssue = ref({ title: '', priority: 'mid', assigneeId: '' })
const creating = ref(false)
const members = ref<any[]>([])
const createStatus = ref('todo')

const priorityOptions: SelectOption[] = [
  { label: '높음', value: 'high' },
  { label: '보통', value: 'mid' },
  { label: '낮음', value: 'low' },
]

const memberOptions = computed<SelectOption[]>(() => [
  { label: '미배정', value: '' },
  ...members.value.map(m => ({ label: m.user.name, value: String(m.user.id) })),
])

function openCreateModal(status = 'todo') {
  createStatus.value = status
  newIssue.value = { title: '', priority: 'mid', assigneeId: '' }
  showCreateModal.value = true
}

async function onCreateIssue() {
  if (!newIssue.value.title.trim()) return
  creating.value = true
  try {
    const { data } = await api.post(`/projects/${projectId}/issues`, {
      title: newIssue.value.title,
      priority: newIssue.value.priority,
      assigneeId: newIssue.value.assigneeId ? Number(newIssue.value.assigneeId) : null,
      status: createStatus.value,
    })
    issues.value.unshift(data)
    syncIssuesByStatus()
    showCreateModal.value = false
  } finally {
    creating.value = false
  }
}

// 이슈 상세/편집 모달 (하나로 통합)
const showDetailModal = ref(false)
const selectedIssue = ref<any>(null)
const editForm = ref({ title: '', status: 'todo', priority: 'mid', assigneeId: '' })
const saving = ref(false)
const deleting = ref(false)

const statusOptions: SelectOption[] = [
  { label: '할 일', value: 'todo' },
  { label: '진행중', value: 'doing' },
  { label: '완료', value: 'done' },
]

function openDetailModal(issue: any) {
  selectedIssue.value = issue
  editForm.value = {
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assigneeId ? String(issue.assigneeId) : '',
  }
  showDetailModal.value = true
}

async function onSaveEdit() {
  if (!selectedIssue.value || !editForm.value.title.trim()) return
  saving.value = true
  try {
    const { data } = await api.put(`/issues/${selectedIssue.value.id}`, {
      title: editForm.value.title,
      status: editForm.value.status,
      priority: editForm.value.priority,
      assigneeId: editForm.value.assigneeId ? Number(editForm.value.assigneeId) : null,
    })
    Object.assign(selectedIssue.value, data)
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
    syncIssuesByStatus()
    showDetailModal.value = false
    openToast({ message: '수정되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

// 개요 탭 통계
const issueStats = computed(() => ({
  total: issues.value.length,
  todo: issues.value.filter(i => i.status === 'todo').length,
  doing: issues.value.filter(i => i.status === 'doing').length,
  done: issues.value.filter(i => i.status === 'done').length,
}))

async function onDeleteIssue() {
  if (!selectedIssue.value) return
  const confirmed = await openConfirm({
    title: '이슈 삭제',
    message: `<strong>${selectedIssue.value.title}</strong> 이슈를 삭제하시겠습니까?<br>삭제된 이슈는 복구할 수 없습니다.`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  deleting.value = true
  try {
    await api.delete(`/issues/${selectedIssue.value.id}`)
    issues.value = issues.value.filter(i => i.id !== selectedIssue.value.id)
    syncIssuesByStatus()
    showDetailModal.value = false
    openToast({ message: '이슈가 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  } finally {
    deleting.value = false
  }
}

// 담당자 이니셜 색상
const avatarColors = ['#4f6af6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
function getAvatarColor(name: string) {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

onMounted(async () => {
  try {
    const [projRes, issueRes] = await Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/issues`),
    ])
    project.value = projRes.data
    issues.value = issueRes.data
    members.value = projRes.data.members || []
    syncIssuesByStatus()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <UiButton variant="ghost" size="sm" @click="router.push('/')">← 목록</UiButton>
        <h1 class="header-title">{{ project?.name || '...' }}</h1>
      </div>
      <UiButton v-if="!loading" variant="primary" size="sm" @click="openCreateModal()">+ 이슈 추가</UiButton>
    </header>

    <main class="main">
      <UiLoading v-if="loading" />
      <template v-else>
        <UiTab v-model="activeTab" :tabs="tabs" />

        <!-- 칸반보드 탭 -->
        <div v-if="activeTab === 'board'" class="tab-content">
          <div class="kanban">
            <div
              v-for="col in kanbanColumns"
              :key="col.key"
              class="kanban-col"
            >
              <div class="kanban-col-header">
                <span class="kanban-col-dot" :style="{ background: col.color }" />
                <span class="kanban-col-title">{{ col.label }}</span>
                <span class="kanban-col-count">{{ issuesByStatus[col.key]?.length || 0 }}</span>
                <button class="kanban-col-add" @click="openCreateModal(col.key)" title="이슈 추가">+</button>
              </div>

              <draggable
                :list="issuesByStatus[col.key]"
                group="kanban"
                item-key="id"
                class="kanban-col-body"
                ghost-class="kanban-card--ghost"
                drag-class="kanban-card--drag"
                :animation="200"
                @start="isDragging = true"
                @end="isDragging = false"
                @change="onDragChange(col.key, $event)"
              >
                <template #item="{ element: issue }">
                  <div
                    class="kanban-card"
                    :style="{ borderLeftColor: priorityMap[issue.priority]?.border || '#d1d5db' }"
                    @click="openDetailModal(issue)"
                  >
                    <p class="kanban-card-title">{{ issue.title }}</p>
                    <div class="kanban-card-meta">
                      <span
                        v-if="issue.assignee"
                        class="kanban-card-avatar"
                        :style="{ background: getAvatarColor(issue.assignee.name) }"
                        :title="issue.assignee.name"
                      >
                        {{ issue.assignee.name.charAt(0) }}
                      </span>
                      <span
                        v-else
                        class="kanban-card-avatar kanban-card-avatar--empty"
                        title="미배정"
                      >?</span>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </div>

        <!-- 멤버 탭 -->
        <div v-if="activeTab === 'members'" class="tab-content">
          <UiEmpty v-if="!project.members?.length" title="멤버가 없습니다." />
          <ul v-else class="member-list">
            <li v-for="m in project.members" :key="m.id" class="member-item">
              <span class="member-avatar" :style="{ background: getAvatarColor(m.user.name) }">
                {{ m.user.name.charAt(0) }}
              </span>
              <div class="member-info">
                <strong>{{ m.user.name }}</strong>
                <span>{{ m.user.email }}</span>
              </div>
              <UiBadge variant="primary" size="sm">{{ m.role }}</UiBadge>
            </li>
          </ul>
        </div>

        <!-- 개요 탭 -->
        <div v-if="activeTab === 'overview'" class="tab-content">
          <p class="overview-desc">{{ project.description || '설명 없음' }}</p>

          <!-- 이슈 통계 -->
          <div class="overview-stats">
            <div class="stat-card">
              <span class="stat-value">{{ issueStats.total }}</span>
              <span class="stat-label">전체 이슈</span>
            </div>
            <div class="stat-card stat-card--todo">
              <span class="stat-value">{{ issueStats.todo }}</span>
              <span class="stat-label">할 일</span>
            </div>
            <div class="stat-card stat-card--doing">
              <span class="stat-value">{{ issueStats.doing }}</span>
              <span class="stat-label">진행중</span>
            </div>
            <div class="stat-card stat-card--done">
              <span class="stat-value">{{ issueStats.done }}</span>
              <span class="stat-label">완료</span>
            </div>
          </div>

          <!-- 진행률 바 -->
          <div v-if="issueStats.total > 0" class="overview-progress">
            <div class="progress-header">
              <span>진행률</span>
              <span>{{ Math.round((issueStats.done / issueStats.total) * 100) }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${(issueStats.done / issueStats.total) * 100}%` }" />
            </div>
          </div>

          <!-- 멤버 수 -->
          <div class="overview-meta">
            <span>멤버 {{ project.members?.length || 0 }}명</span>
            <span>·</span>
            <span>생성일 {{ new Date(project.createdAt).toLocaleDateString('ko-KR') }}</span>
          </div>
        </div>
      </template>
    </main>

    <!-- 이슈 상세 모달 (바로 편집 가능 + 저장) -->
    <UiModal v-model:open="showDetailModal" title="이슈 상세" size="sm">
      <form v-if="selectedIssue" class="create-form" @submit.prevent="onSaveEdit">
        <UiInput
          v-model="editForm.title"
          label="제목"
          placeholder="이슈 제목을 입력하세요"
          clearable
        />
        <div class="detail-row">
          <UiSelect
            v-model="editForm.status"
            label="상태"
            :options="statusOptions"
          />
          <UiSelect
            v-model="editForm.priority"
            label="우선순위"
            :options="priorityOptions"
          />
        </div>
        <UiSelect
          v-model="editForm.assigneeId"
          label="담당자"
          :options="memberOptions"
        />
        <div class="detail-actions">
          <UiButton variant="danger" size="sm" :loading="deleting" @click.prevent="onDeleteIssue">삭제</UiButton>
          <div class="detail-actions-right">
            <UiButton variant="ghost" size="md" @click.prevent="showDetailModal = false">취소</UiButton>
            <UiButton variant="primary" size="md" type="submit" :loading="saving">저장</UiButton>
          </div>
        </div>
      </form>
    </UiModal>

    <!-- 전역 Confirm + Toast (앱 루트에 한 번) -->
    <UiConfirm />
    <UiToast />

    <!-- 이슈 생성 모달 -->
    <UiModal v-model:open="showCreateModal" title="이슈 추가" size="sm">
      <form class="create-form" @submit.prevent="onCreateIssue">
        <UiInput
          v-model="newIssue.title"
          label="제목"
          placeholder="이슈 제목을 입력하세요"
        />
        <UiSelect
          v-model="newIssue.priority"
          label="우선순위"
          :options="priorityOptions"
        />
        <UiSelect
          v-model="newIssue.assigneeId"
          label="담당자"
          :options="memberOptions"
        />
        <div class="create-form-actions">
          <UiButton variant="ghost" size="md" @click="showCreateModal = false">취소</UiButton>
          <UiButton variant="primary" size="md" type="submit" :loading="creating">추가</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.layout { min-height: 100vh; }
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e6e8ec;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-title { font-size: 18px; font-weight: 700; }
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
}
.tab-content { margin-top: 24px; }

// 칸반보드
.kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.kanban-col {
  background: #f9fafb;
  border-radius: 10px;
  padding: 16px;
  min-height: 300px;
  transition: background 0.2s, box-shadow 0.2s;

}
.kanban-col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}
.kanban-col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.kanban-col-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.kanban-col-count {
  font-size: 12px;
  color: #9ca3af;
  background: #e5e7eb;
  padding: 1px 7px;
  border-radius: 10px;
}
.kanban-col-add {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #9ca3af;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #eff6ff;
  }
}
.kanban-col-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
}

// 칸반 카드 — 왼쪽 우선순위 라인
.kanban-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-left: 3px solid #d1d5db;
  border-radius: 8px;
  padding: 14px;
  cursor: grab;
  transition: box-shadow 0.15s, transform 0.15s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
  &:active {
    cursor: grabbing;
  }
  // vuedraggable ghost (원래 자리 표시)
  &--ghost {
    opacity: 0.3;
    background: #eff6ff;
    border: 2px dashed #3b82f6;
  }
  // vuedraggable drag (잡고 있는 카드)
  &--drag {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: rotate(2deg);
    cursor: grabbing;
  }
}
.kanban-card-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 10px;
}
.kanban-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kanban-card-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4f6af6;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  &--empty {
    background: #d1d5db;
    color: #6b7280;
  }
}

// 멤버
.member-list {
  list-style: none;
  padding: 0;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #eef0f3;
}
.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  strong { font-size: 14px; }
  span { font-size: 13px; color: #6b7280; }
}

// 이슈 생성 폼
.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}
.create-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.overview-desc {
  font-size: 15px;
  line-height: 1.7;
  color: #4b5563;
}

// 이슈 상세 모달
.detail-row {
  display: flex;
  gap: 16px;
  > * { flex: 1; }
}
.detail-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  margin-top: 8px;
}
.detail-actions-right {
  display: flex;
  gap: 8px;
}

// 개요 탭 통계
.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 24px;
}
.stat-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  border-top: 3px solid #d1d5db;
  &--todo { border-top-color: #6b7280; }
  &--doing { border-top-color: #3b82f6; }
  &--done { border-top-color: #22c55e; }
}
.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}
.stat-label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}
.overview-progress {
  margin-top: 24px;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #22c55e;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.overview-meta {
  margin-top: 20px;
  font-size: 13px;
  color: #9ca3af;
  display: flex;
  gap: 8px;
}

</style>
