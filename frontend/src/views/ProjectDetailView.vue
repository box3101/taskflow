<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiTab, UiTable, UiBadge, UiLoading, UiEmpty, UiButton, UiIcon, UiDrawer, UiDropdownMenu, UiDatePicker, UiModal, UiInput, UiSelect, UiTextarea, UiToast, UiConfirm, openToast, openConfirm } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption, TableColumn, DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import { CalendarDate, type DateValue } from '@internationalized/date'
import api from '../api/client'

const route = useRoute()
const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/?tab=projects')
  }
}
const projectId = route.params.id

const loading = ref(true)
const project = ref<any>(null)
const issues = ref<any[]>([])
const members = ref<any[]>([])
const activeTab = ref('board')

const tabs: TabItem[] = [
  { label: '이슈', value: 'board' },
  { label: '멤버', value: 'members' },
  { label: '개요', value: 'overview' },
]

// ── 옵션 정의 ──
const priorityOptions: SelectOption[] = [
  { label: '높음', value: 'high' },
  { label: '보통', value: 'mid' },
  { label: '낮음', value: 'low' },
]
const memberOptions = computed<SelectOption[]>(() => [
  { label: '미배정', value: '' },
  ...members.value.map(m => ({ label: m.user.name, value: String(m.user.id) })),
])

// ── 멀티 필터 (체크박스 중복 선택) ──
const statusFilterItems = [
  { label: '할 일', value: 'todo' },
  { label: '진행중', value: 'doing' },
  { label: '완료', value: 'done' },
]
const priorityFilterItems = [
  { label: '높음', value: 'high' },
  { label: '보통', value: 'mid' },
  { label: '낮음', value: 'low' },
]

const categoryFilterItems = [
  { label: '오류', value: 'bug' },
  { label: '개선', value: 'improvement' },
  { label: '확인', value: 'question' },
]

const dueFilterItems = [
  { label: '마감 있음', value: 'set' },
  { label: '미정', value: 'unset' },
  { label: '마감 초과', value: 'overdue' },
]

const checkedStatuses = ref<string[]>([])
const checkedPriorities = ref<string[]>([])
const showStatusDropdown = ref(false)
const showPriorityDropdown = ref(false)

function toggleFilter(arr: string[], val: string) {
  const idx = arr.indexOf(val)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(val)
  resetDisplay()
}

function filterLabel(checked: string[], items: { label: string; value: string }[]) {
  if (checked.length === 0 || checked.length === items.length) return '전체'
  return checked.map(v => items.find(i => i.value === v)?.label).join(', ')
}

const filteredIssues = computed(() => {
  return issues.value.filter(i => {
    if (checkedStatuses.value.length > 0 && !checkedStatuses.value.includes(i.status)) return false
    if (checkedPriorities.value.length > 0 && !checkedPriorities.value.includes(i.priority)) return false
    return true
  })
})

// 더보기 (초기 20건, 이후 20건씩 추가)
const PAGE_SIZE = 20
const displayCount = ref(PAGE_SIZE)
const displayedIssues = computed(() => filteredIssues.value.slice(0, displayCount.value))
const hasMore = computed(() => displayCount.value < filteredIssues.value.length)
function loadMore() { displayCount.value += PAGE_SIZE }
// 필터 변경 시 표시 건수 리셋
function resetDisplay() { displayCount.value = PAGE_SIZE }

// 바깥 클릭 시 드롭다운 닫기
function onClickOutside(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.multi-filter')) {
    showStatusDropdown.value = false
    showPriorityDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', onClickOutside))

// ── 이슈 테이블 ──
const issueColumns: TableColumn[] = [
  { key: 'category', label: '구분', width: '80px', align: 'center', sortable: true },
  { key: 'title', label: '제목', align: 'left', sortable: true, sortType: 'string' },
  { key: 'status', label: '상태', width: '90px', align: 'center', sortable: true },
  { key: 'priority', label: '우선순위', width: '100px', align: 'center', sortable: true },
  { key: 'requestedAt', label: '요청일', width: '150px', align: 'center', sortable: true, sortType: 'date', hideBelow: 768 },
  { key: 'dueAt', label: '마감일', width: '150px', align: 'center', sortable: true, sortType: 'date', hideBelow: 768 },
  { key: 'assignee', label: '담당자', width: '100px', align: 'center', hideBelow: 768 },
]

// 상태/우선순위 드롭다운 메뉴 아이템
const statusMenuItems: DropdownMenuItemDef[] = [
  { label: '할 일', value: 'todo' },
  { label: '진행중', value: 'doing' },
  { label: '완료', value: 'done' },
]
const priorityMenuItems: DropdownMenuItemDef[] = [
  { label: '긴급', value: 'urgent' },
  { label: '높음', value: 'high' },
  { label: '보통', value: 'mid' },
  { label: '낮음', value: 'low' },
]
const assigneeMenuItems = computed<DropdownMenuItemDef[]>(() => [
  { label: '미배정', value: '' },
  ...members.value.map(m => ({ label: m.user.name, value: String(m.user.id) })),
])

const priorityMap: Record<string, { label: string; variant: string }> = {
  urgent: { label: '긴급', variant: 'danger' },
  high: { label: '높음', variant: 'warning' },
  mid: { label: '보통', variant: 'primary' },
  low: { label: '낮음', variant: 'default' },
}

// 날짜 변환: ISO string → CalendarDate
function toCalendarDateOrUndef(d: string | null | undefined): DateValue | undefined {
  if (!d) return undefined
  const date = new Date(d)
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

// CalendarDate → ISO string
function fromDateValue(d: DateValue | undefined): string | null {
  if (!d) return null
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

function isOverdue(d: string | null) {
  if (!d) return false
  return new Date(d) < new Date() && new Date(d).toDateString() !== new Date().toDateString()
}

// 인라인 제목 편집
const editingTitleId = ref<number | null>(null)
const editingTitleText = ref('')

function startTitleEdit(issue: any) {
  editingTitleId.value = issue.id
  editingTitleText.value = issue.title
}

async function saveTitleEdit(issue: any) {
  const title = editingTitleText.value.trim()
  editingTitleId.value = null
  if (!title || title === issue.title) return
  const prev = issue.title
  issue.title = title
  try {
    const { data } = await api.put(`/issues/${issue.id}`, { title })
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
  } catch {
    issue.title = prev
    openToast({ message: '제목 수정에 실패했습니다.', type: 'error' })
  }
}

function onTitleKeydown(e: KeyboardEvent, issue: any) {
  if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(issue) }
  if (e.key === 'Escape') { editingTitleId.value = null }
}

// 인라인 편집: 셀에서 바로 변경
async function onInlineChange(issue: any, field: string, val: string | number) {
  const prev = issue[field]
  const updateData: Record<string, unknown> = {}

  if (field === 'assigneeId') {
    const newVal = val ? Number(val) : null
    if (newVal === issue.assigneeId) return
    updateData.assigneeId = newVal
    issue.assigneeId = newVal
  } else {
    if (val === prev) return
    updateData[field] = val
    issue[field] = val
  }

  try {
    const { data } = await api.put(`/issues/${issue.id}`, updateData)
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
  } catch {
    // 롤백
    issue[field] = prev
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  }
}

// ── 댓글 ──
interface IssueComment {
  id: number
  content: string
  createdAt: string
  updatedAt: string
  user: { id: number; name: string }
}

const comments = ref<IssueComment[]>([])
const commentContent = ref('')
const commentSaving = ref(false)
const editingCommentId = ref<number | null>(null)
const editingCommentContent = ref('')
const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

async function loadComments(issueId: number) {
  try {
    const { data } = await api.get(`/issues/${issueId}/comments`)
    comments.value = data
  } catch {
    comments.value = []
  }
}

async function addComment() {
  if (!panelIssue.value || !commentContent.value.trim()) return
  commentSaving.value = true
  try {
    await api.post(`/issues/${panelIssue.value.id}/comments`, { content: commentContent.value.trim() })
    commentContent.value = ''
    await loadComments(panelIssue.value.id)
  } catch {
    openToast({ message: '댓글 등록에 실패했습니다.', type: 'error' })
  } finally {
    commentSaving.value = false
  }
}

function startEditComment(comment: IssueComment) {
  editingCommentId.value = comment.id
  editingCommentContent.value = comment.content
}

function cancelEditComment() {
  editingCommentId.value = null
  editingCommentContent.value = ''
}

async function saveEditComment(commentId: number) {
  if (!panelIssue.value || !editingCommentContent.value.trim()) return
  try {
    await api.patch(`/issues/${panelIssue.value.id}/comments/${commentId}`, { content: editingCommentContent.value.trim() })
    editingCommentId.value = null
    editingCommentContent.value = ''
    await loadComments(panelIssue.value.id)
  } catch {
    openToast({ message: '댓글 수정에 실패했습니다.', type: 'error' })
  }
}

async function deleteComment(commentId: number) {
  if (!panelIssue.value) return
  const confirmed = await openConfirm({
    title: '댓글 삭제',
    message: '이 댓글을 삭제하시겠습니까?',
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/issues/${panelIssue.value.id}/comments/${commentId}`)
    await loadComments(panelIssue.value.id)
    openToast({ message: '댓글이 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '댓글 삭제에 실패했습니다.', type: 'error' })
  }
}

// ── 사이드 패널 ──
const panelOpen = ref(false)
const panelIssue = ref<any>(null)
const panelForm = ref({ description: '' })
const panelSaving = ref(false)
const panelDeleting = ref(false)
const panelEditingDesc = ref(false)

function formatDesc(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^(현상|수정|재현|담당의견):/gm, '<strong style="color:#4f6af6">$1:</strong>')
    .replace(/\n/g, '<br>')
}

function openPanel(issue: any) {
  panelIssue.value = issue
  panelForm.value = {
    description: issue.description || '',
  }
  panelEditingDesc.value = false
  panelOpen.value = true
  loadComments(issue.id)
}

function closePanel() {
  panelOpen.value = false
  panelIssue.value = null
  comments.value = []
  commentContent.value = ''
  editingCommentId.value = null
  editingCommentContent.value = ''
}

async function onPanelSave() {
  if (!panelIssue.value) return
  panelSaving.value = true
  try {
    const { data } = await api.put(`/issues/${panelIssue.value.id}`, {
      description: panelForm.value.description || null,
    })
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
    openToast({ message: '저장되었습니다.', type: 'success' })
    closePanel()
  } catch {
    openToast({ message: '수정에 실패했습니다.', type: 'error' })
  } finally {
    panelSaving.value = false
  }
}

async function onPanelDelete() {
  if (!panelIssue.value) return
  const confirmed = await openConfirm({
    title: '이슈 삭제',
    message: `<strong>${panelIssue.value.title}</strong> 이슈를 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  panelDeleting.value = true
  try {
    await api.delete(`/issues/${panelIssue.value.id}`)
    issues.value = issues.value.filter(i => i.id !== panelIssue.value.id)
    openToast({ message: '삭제되었습니다.', type: 'success' })
    closePanel()
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  } finally {
    panelDeleting.value = false
  }
}

// ── 이슈 생성 (간단히 사이드 패널 재활용) ──
const createDrawerOpen = ref(false)
const createForm = ref({ title: '', priority: 'mid', assigneeId: '' })
const creatingLoading = ref(false)

function startCreate() {
  createForm.value = { title: '', priority: 'mid', assigneeId: '' }
  createDrawerOpen.value = true
}

async function onCreateIssue() {
  if (!createForm.value.title.trim()) return
  creatingLoading.value = true
  try {
    const { data } = await api.post(`/projects/${projectId}/issues`, {
      title: createForm.value.title,
      priority: createForm.value.priority,
      assigneeId: createForm.value.assigneeId ? Number(createForm.value.assigneeId) : null,
    })
    issues.value.unshift(data)
    openToast({ message: '이슈가 추가되었습니다.', type: 'success' })
    createDrawerOpen.value = false
  } finally {
    creatingLoading.value = false
  }
}

// ── 개요 탭 ──
const issueStats = computed(() => ({
  total: issues.value.length,
  todo: issues.value.filter(i => i.status === 'todo').length,
  doing: issues.value.filter(i => i.status === 'doing').length,
  done: issues.value.filter(i => i.status === 'done').length,
}))

// ── 담당자 색상 ──
const avatarColors = ['#4f6af6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
function getAvatarColor(name: string) {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// ── 멤버 관리 ──
const roleOptions: SelectOption[] = [
  { label: 'Owner', value: 'owner' },
  { label: 'Dev', value: 'dev' },
  { label: 'Viewer', value: 'viewer' },
]
const showAddMemberModal = ref(false)
const addMemberEmail = ref('')
const addMemberRole = ref('dev')
const addingMember = ref(false)

async function onAddMember() {
  const email = addMemberEmail.value.trim()
  if (!email) return
  addingMember.value = true
  try {
    const { data } = await api.post(`/projects/${projectId}/members`, { email, role: addMemberRole.value })
    project.value.members.push(data)
    members.value = project.value.members
    showAddMemberModal.value = false
    addMemberEmail.value = ''
    addMemberRole.value = 'dev'
    openToast({ message: '멤버가 추가되었습니다.', type: 'success' })
  } catch (err: any) {
    openToast({ message: err.response?.data?.message || '멤버 추가에 실패했습니다.', type: 'error' })
  } finally {
    addingMember.value = false
  }
}

async function onChangeRole(member: any, val: string | number) {
  const role = String(val)
  if (role === member.role) return
  try {
    const { data } = await api.put(`/projects/${projectId}/members/${member.id}`, { role })
    member.role = data.role
    openToast({ message: '역할이 변경되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '역할 변경에 실패했습니다.', type: 'error' })
  }
}

async function onRemoveMember(member: any) {
  const confirmed = await openConfirm({
    title: '멤버 삭제',
    message: `<strong>${member.user.name}</strong>을(를) 프로젝트에서 삭제하시겠습니까?`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/projects/${projectId}/members/${member.id}`)
    project.value.members = project.value.members.filter((m: any) => m.id !== member.id)
    members.value = project.value.members
    openToast({ message: '멤버가 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '멤버 삭제에 실패했습니다.', type: 'error' })
  }
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
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="project-detail">
    <div class="project-detail__header">
      <div class="header-left">
        <UiButton variant="ghost" size="sm" @click="goBack">← 목록</UiButton>
        <h1 class="header-title">{{ project?.name || '...' }}</h1>
      </div>
    </div>

    <UiLoading v-if="loading" overlay />
        <template v-else>
          <UiTab v-model="activeTab" :tabs="tabs" />

          <!-- 이슈 탭 -->
          <div v-if="activeTab === 'board'" class="tab-content">
            <!-- 멀티 필터 바 -->
            <div class="filter-bar">
              <div class="multi-filter" @click.stop>
                <button class="multi-filter-btn" @click="showStatusDropdown = !showStatusDropdown; showPriorityDropdown = false">
                  <span class="multi-filter-label">상태</span>
                  <span class="multi-filter-value">{{ filterLabel(checkedStatuses, statusFilterItems) }}</span>
                  <span class="multi-filter-arrow" :class="{ 'is-open': showStatusDropdown }">▾</span>
                </button>
                <div v-if="showStatusDropdown" class="multi-filter-dropdown">
                  <label
                    v-for="item in statusFilterItems"
                    :key="item.value"
                    class="multi-filter-option"
                    :class="{ 'is-checked': checkedStatuses.includes(item.value) }"
                  >
                    <input
                      type="checkbox"
                      :checked="checkedStatuses.includes(item.value)"
                      @change="toggleFilter(checkedStatuses, item.value)"
                    />
                    <span>{{ item.label }}</span>
                    <span v-if="checkedStatuses.includes(item.value)" class="multi-filter-check">✓</span>
                  </label>
                </div>
              </div>

              <div class="multi-filter" @click.stop>
                <button class="multi-filter-btn" @click="showPriorityDropdown = !showPriorityDropdown; showStatusDropdown = false">
                  <span class="multi-filter-label">우선순위</span>
                  <span class="multi-filter-value">{{ filterLabel(checkedPriorities, priorityFilterItems) }}</span>
                  <span class="multi-filter-arrow" :class="{ 'is-open': showPriorityDropdown }">▾</span>
                </button>
                <div v-if="showPriorityDropdown" class="multi-filter-dropdown">
                  <label
                    v-for="item in priorityFilterItems"
                    :key="item.value"
                    class="multi-filter-option"
                    :class="{ 'is-checked': checkedPriorities.includes(item.value) }"
                  >
                    <input
                      type="checkbox"
                      :checked="checkedPriorities.includes(item.value)"
                      @change="toggleFilter(checkedPriorities, item.value)"
                    />
                    <span>{{ item.label }}</span>
                    <span v-if="checkedPriorities.includes(item.value)" class="multi-filter-check">✓</span>
                  </label>
                </div>
              </div>

              <span class="filter-count">{{ filteredIssues.length }}건{{ filteredIssues.length !== issues.length ? ` / 전체 ${issues.length}건` : '' }}</span>
            </div>

            <UiEmpty v-if="filteredIssues.length === 0" title="이슈가 없습니다." />
            <UiTable
              v-else
              :columns="issueColumns"
              :data="(displayedIssues as any)"
              size="sm"
            >
              <template #cell-category="{ row }: any">
                <UiBadge
                  :variant="row.category === 'bug' ? 'danger' : row.category === 'question' ? 'warning' : 'default'"
                  size="sm"
                >{{ row.category === 'bug' ? '오류' : row.category === 'question' ? '확인' : '개선' }}</UiBadge>
              </template>
              <template #cell-title="{ row }: any">
                <div v-if="editingTitleId === row.id" class="issue-title-cell is-editing">
                  <input
                    v-model="editingTitleText"
                    class="issue-title-input"
                    @blur="editingTitleId = null"
                    @keydown="(e: KeyboardEvent) => onTitleKeydown(e, row)"
                    @vue:mounted="($event: any) => $event.el.focus()"
                  />
                  <button class="issue-title-save" @mousedown.prevent="saveTitleEdit(row)" title="저장">✓</button>
                  <button class="issue-title-cancel" @mousedown.prevent="editingTitleId = null" title="취소">✕</button>
                </div>
                <div v-else class="issue-title-cell">
                    <span class="issue-title" @click="openPanel(row)" @dblclick.stop="startTitleEdit(row)">{{ row.title }}</span>
                    <button class="issue-title-edit" @click.stop="startTitleEdit(row)" title="제목 수정">
                      <i class="icon-edit size-12" />
                    </button>
                </div>
              </template>
              <template #cell-status="{ row }: any">
                <div @click.stop>
                  <UiDropdownMenu
                    :items="statusMenuItems"
                    @select="(val: string) => onInlineChange(row, 'status', val)"
                  >
                    <template #trigger>
                      <button class="cell-badge-btn">
                        <UiBadge
                          :variant="row.status === 'done' ? 'success' : row.status === 'doing' ? 'primary' : 'default'"
                          size="sm"
                        >{{ row.status === 'done' ? '완료' : row.status === 'doing' ? '진행중' : '할 일' }}</UiBadge>
                      </button>
                    </template>
                  </UiDropdownMenu>
                </div>
              </template>
              <template #cell-priority="{ row }: any">
                <div @click.stop>
                  <UiDropdownMenu
                    :items="priorityMenuItems"
                    @select="(val: string) => onInlineChange(row, 'priority', val)"
                  >
                    <template #trigger>
                      <button class="cell-badge-btn">
                        <UiBadge
                          :variant="(priorityMap[row.priority]?.variant || 'default') as any"
                          size="sm"
                        >{{ priorityMap[row.priority]?.label || '낮음' }}</UiBadge>
                      </button>
                    </template>
                  </UiDropdownMenu>
                </div>
              </template>
              <template #cell-requestedAt="{ row }: any">
                <div @click.stop class="cell-datepicker">
                  <UiDatePicker
                    :model-value="toCalendarDateOrUndef(row.requestedAt)"
                    size="xs"
                    placeholder="미정"
                    @update:model-value="(v: DateValue | undefined) => onInlineChange(row, 'requestedAt', fromDateValue(v) || '')"
                  />
                </div>
              </template>
              <template #cell-dueAt="{ row }: any">
                <div @click.stop class="cell-datepicker" :class="{ 'is-overdue': isOverdue(row.dueAt) }">
                  <UiDatePicker
                    :model-value="toCalendarDateOrUndef(row.dueAt)"
                    size="xs"
                    placeholder="미정"
                    @update:model-value="(v: DateValue | undefined) => onInlineChange(row, 'dueAt', fromDateValue(v) || '')"
                  />
                </div>
              </template>
              <template #cell-assignee="{ row }: any">
                <div @click.stop>
                  <UiDropdownMenu
                    :items="assigneeMenuItems"
                    @select="(val: string) => onInlineChange(row, 'assigneeId', val)"
                  >
                    <template #trigger>
                      <button class="cell-badge-btn">
                        <span v-if="row.assignee" class="cell-assignee">{{ row.assignee.name }}</span>
                        <span v-else class="cell-assignee cell-assignee--empty">미배정</span>
                      </button>
                    </template>
                  </UiDropdownMenu>
                </div>
              </template>
            </UiTable>
            <div v-if="hasMore" class="load-more">
              <button class="load-more-btn" @click="loadMore">
                더보기 ({{ displayedIssues.length }} / {{ filteredIssues.length }})
              </button>
            </div>
          </div>

          <!-- 멤버 탭 -->
          <div v-if="activeTab === 'members'" class="tab-content">
            <div class="member-header">
              <span class="member-count">{{ project.members?.length || 0 }}명</span>
              <UiButton variant="primary" size="sm" @click="showAddMemberModal = true">+ 멤버 추가</UiButton>
            </div>
            <UiEmpty v-if="!project.members?.length" title="멤버가 없습니다." />
            <ul v-else class="member-list">
              <li v-for="m in project.members" :key="m.id" class="member-item">
                <span class="member-avatar" :style="{ background: getAvatarColor(m.user.name) }">{{ m.user.name.charAt(0) }}</span>
                <div class="member-info">
                  <strong>{{ m.user.name }}</strong>
                  <span>{{ m.user.email }}</span>
                </div>
                <div class="member-actions">
                  <div class="member-role-select">
                    <UiSelect :model-value="m.role" :options="roleOptions" size="sm" @change="(val: string | number) => onChangeRole(m, val)" />
                  </div>
                  <button class="member-delete-btn" @click="onRemoveMember(m)">&times;</button>
                </div>
              </li>
            </ul>
          </div>

          <!-- 개요 탭 -->
          <div v-if="activeTab === 'overview'" class="tab-content">
            <p class="overview-desc">{{ project.description || '설명 없음' }}</p>
            <div class="overview-stats">
              <div class="stat-card"><span class="stat-value">{{ issueStats.total }}</span><span class="stat-label">전체 이슈</span></div>
              <div class="stat-card stat-card--todo"><span class="stat-value">{{ issueStats.todo }}</span><span class="stat-label">할 일</span></div>
              <div class="stat-card stat-card--doing"><span class="stat-value">{{ issueStats.doing }}</span><span class="stat-label">진행중</span></div>
              <div class="stat-card stat-card--done"><span class="stat-value">{{ issueStats.done }}</span><span class="stat-label">완료</span></div>
            </div>
            <div v-if="issueStats.total > 0" class="overview-progress">
              <div class="progress-header"><span>진행률</span><span>{{ Math.round((issueStats.done / issueStats.total) * 100) }}%</span></div>
              <div class="progress-bar"><div class="progress-fill" :style="{ width: `${(issueStats.done / issueStats.total) * 100}%` }" /></div>
            </div>
            <div class="overview-meta">
              <span>멤버 {{ project.members?.length || 0 }}명</span><span>·</span>
              <span>생성일 {{ new Date(project.createdAt).toLocaleDateString('ko-KR') }}</span>
            </div>
          </div>
        </template>

    <!-- FAB: 이슈 추가 -->
    <button v-if="!loading" class="fab" aria-label="이슈 추가" @click="startCreate">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 이슈 생성 Drawer -->
    <UiDrawer v-model:open="createDrawerOpen" title="이슈 추가" width="420px" max-width="600px">
      <form class="drawer-form" @submit.prevent="onCreateIssue">
        <UiInput v-model="createForm.title" label="제목" placeholder="이슈 제목" />
        <UiSelect v-model="createForm.priority" label="우선순위" :options="priorityOptions" />
        <UiSelect v-model="createForm.assigneeId" label="담당자" :options="memberOptions" />
      </form>
      <template #footer>
        <div class="drawer-footer">
          <UiButton variant="ghost" size="md" @click="createDrawerOpen = false">취소</UiButton>
          <UiButton variant="primary" size="md" :loading="creatingLoading" @click="onCreateIssue">추가</UiButton>
        </div>
      </template>
    </UiDrawer>

    <!-- 이슈 상세 Drawer -->
    <UiDrawer v-model:open="panelOpen" :title="panelIssue?.title || '이슈 상세'" width="480px" max-width="700px">
      <div v-if="panelIssue" class="panel-detail">
        <!-- 속성 테이블 -->
        <div class="panel-props">
          <div class="panel-prop">
            <span class="panel-prop-label">상태</span>
            <UiDropdownMenu :items="statusMenuItems" @select="(val: string) => onInlineChange(panelIssue, 'status', val)">
              <template #trigger>
                <button class="cell-badge-btn">
                  <UiBadge :variant="panelIssue.status === 'done' ? 'success' : panelIssue.status === 'doing' ? 'primary' : 'default'" size="sm">
                    {{ panelIssue.status === 'done' ? '완료' : panelIssue.status === 'doing' ? '진행중' : '할 일' }}
                  </UiBadge>
                </button>
              </template>
            </UiDropdownMenu>
          </div>
          <div class="panel-prop">
            <span class="panel-prop-label">우선순위</span>
            <UiDropdownMenu :items="priorityMenuItems" @select="(val: string) => onInlineChange(panelIssue, 'priority', val)">
              <template #trigger>
                <button class="cell-badge-btn">
                  <UiBadge :variant="(priorityMap[panelIssue.priority]?.variant || 'default') as any" size="sm">
                    {{ priorityMap[panelIssue.priority]?.label || '낮음' }}
                  </UiBadge>
                </button>
              </template>
            </UiDropdownMenu>
          </div>
          <div class="panel-prop">
            <span class="panel-prop-label">담당자</span>
            <UiDropdownMenu :items="assigneeMenuItems" @select="(val: string) => onInlineChange(panelIssue, 'assigneeId', val)">
              <template #trigger>
                <button class="cell-badge-btn">
                  <span v-if="panelIssue.assignee">{{ panelIssue.assignee.name }}</span>
                  <span v-else style="color:#9ca3af">미배정</span>
                </button>
              </template>
            </UiDropdownMenu>
          </div>
          <div class="panel-prop">
            <span class="panel-prop-label">요청일</span>
            <div class="panel-prop-date">
              <UiDatePicker
                :model-value="toCalendarDateOrUndef(panelIssue.requestedAt)"
                size="sm"
                @update:model-value="(v: any) => onInlineChange(panelIssue, 'requestedAt', fromDateValue(v) || '')"
              />
            </div>
          </div>
          <div class="panel-prop">
            <span class="panel-prop-label">마감일</span>
            <div class="panel-prop-date">
              <UiDatePicker
                :model-value="toCalendarDateOrUndef(panelIssue.dueAt)"
                size="sm"
                @update:model-value="(v: any) => onInlineChange(panelIssue, 'dueAt', fromDateValue(v) || '')"
              />
            </div>
          </div>
          <div class="panel-prop">
            <span class="panel-prop-label">생성일</span>
            <span class="panel-prop-value">{{ new Date(panelIssue.createdAt).toLocaleDateString('ko-KR') }}</span>
          </div>
        </div>

        <!-- 구분선 -->
        <hr class="panel-divider" />

        <!-- 설명 -->
        <div class="panel-desc-section">
          <div class="panel-desc-header">
            <span class="panel-desc-label">설명</span>
            <button class="panel-desc-edit-btn" @click="panelEditingDesc = !panelEditingDesc">
              <UiIcon :name="panelEditingDesc ? 'eye' : 'pencil'" :size="14" />
            </button>
          </div>
          <div v-if="!panelEditingDesc && panelForm.description" class="panel-desc-view" v-html="formatDesc(panelForm.description)" />
          <div v-else-if="!panelEditingDesc && !panelForm.description" class="panel-desc-empty">설명이 없습니다.</div>
          <form v-else class="drawer-form" @submit.prevent="onPanelSave">
            <UiTextarea v-model="panelForm.description" placeholder="이슈에 대한 메모를 작성하세요..." :rows="8" />
          </form>
        </div>

        <!-- 구분선 -->
        <hr class="panel-divider" />

        <!-- 댓글 -->
        <div class="panel-comments">
          <div class="panel-comments__header">
            <span class="panel-comments__label"><UiIcon name="message-circle" :size="16" /> 댓글 ({{ comments.length }})</span>
          </div>

          <!-- 댓글 목록 -->
          <div v-if="comments.length" class="panel-comments__list">
            <div v-for="c in comments" :key="c.id" class="panel-comment">
              <!-- 수정 모드 -->
              <template v-if="editingCommentId === c.id">
                <div class="panel-comment__edit">
                  <UiTextarea v-model="editingCommentContent" :rows="2" />
                  <div class="panel-comment__edit-actions">
                    <UiButton size="xs" variant="ghost" @click="cancelEditComment">취소</UiButton>
                    <UiButton size="xs" @click="saveEditComment(c.id)" :disabled="!editingCommentContent.trim()">확인</UiButton>
                  </div>
                </div>
              </template>

              <!-- 보기 모드 -->
              <template v-else>
                <div class="panel-comment__header">
                  <span class="panel-comment__author">{{ c.user.name }}</span>
                  <span class="panel-comment__time">{{ timeAgo(c.createdAt) }}</span>
                  <span v-if="c.updatedAt !== c.createdAt" class="panel-comment__edited">(수정됨)</span>
                  <div class="panel-comment__actions">
                    <button v-if="c.user.id === currentUser.id" class="panel-comment__btn" title="수정" @click="startEditComment(c)">
                      <UiIcon name="pencil" :size="12" />
                    </button>
                    <button v-if="c.user.id === currentUser.id || currentUser.role === 'admin'" class="panel-comment__btn panel-comment__btn--delete" title="삭제" @click="deleteComment(c.id)">
                      <UiIcon name="trash-2" :size="12" />
                    </button>
                  </div>
                </div>
                <p class="panel-comment__content">{{ c.content }}</p>
              </template>
            </div>
          </div>
          <div v-else class="panel-comments__empty">아직 댓글이 없습니다.</div>

          <!-- 댓글 입력 -->
          <div class="panel-comments__input">
            <UiTextarea v-model="commentContent" :rows="2" placeholder="댓글을 입력하세요..." />
            <UiButton size="sm" :loading="commentSaving" :disabled="!commentContent.trim()" @click="addComment">등록</UiButton>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="drawer-footer-between">
          <UiButton variant="danger" size="sm" :loading="panelDeleting" @click="onPanelDelete">삭제</UiButton>
          <div class="drawer-footer">
            <UiButton variant="ghost" size="md" @click="panelOpen = false">취소</UiButton>
            <UiButton variant="primary" size="md" :loading="panelSaving" @click="onPanelSave">저장</UiButton>
          </div>
        </div>
      </template>
    </UiDrawer>

    <UiConfirm />
    <UiToast />

    <!-- 멤버 추가 모달 (멤버 탭 전용) -->
    <UiModal v-model:open="showAddMemberModal" title="멤버 추가" size="sm">
      <form class="create-form" @submit.prevent="onAddMember">
        <UiInput v-model="addMemberEmail" label="이메일" placeholder="추가할 사용자의 이메일을 입력하세요" />
        <UiSelect v-model="addMemberRole" label="역할" :options="roleOptions" />
        <div class="create-form-actions">
          <UiButton variant="ghost" size="md" @click="showAddMemberModal = false">취소</UiButton>
          <UiButton variant="primary" size="md" type="submit" :loading="addingMember">추가</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.project-detail__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-title { font-size: 18px; font-weight: 700; }
.tab-content { margin-top: 24px; }

// ── Drawer 폼 ──
.drawer-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.drawer-row {
  display: flex;
  gap: 12px;
  > * { flex: 1; }
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.drawer-footer-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

// ── 멀티 필터 ──
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.filter-count {
  font-size: 13px;
  color: #9ca3af;
  margin-left: auto;
}
.multi-filter {
  position: relative;
}
.multi-filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s;
  &:hover { border-color: #3b82f6; }
}
.multi-filter-label {
  color: #6b7280;
  font-weight: 500;
}
.multi-filter-value {
  color: #1f2937;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.multi-filter-arrow {
  font-size: 10px;
  color: #9ca3af;
  transition: transform 0.15s;
  &.is-open { transform: rotate(180deg); }
}
.multi-filter-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 140px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  padding: 4px 0;
  z-index: 100;
}
.multi-filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: background 0.1s;
  &:hover { background: #f3f4f6; }
  &.is-checked {
    color: #2563eb;
    font-weight: 600;
  }
  input[type="checkbox"] { display: none; }
}
.multi-filter-check {
  margin-left: auto;
  color: #2563eb;
  font-weight: 700;
}

// ── 이슈 테이블 ──
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
.cell-assignee {
  font-size: 13px;
  color: #374151;
  &--empty { color: #9ca3af; }
}
// ── 패널 상세 ──
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
.panel-prop-date {
  flex: 1;
}
.panel-divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}
.panel-desc-section {
  margin-top: 4px;
}
.panel-desc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.panel-desc-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.panel-desc-edit-btn {
  font-size: 12px;
  color: #4f6af6;
  background: none;
  border: none;
  cursor: pointer;
  &:hover { text-decoration: underline; }
}
.panel-desc-view {
  font-size: 13px;
  line-height: 1.8;
  color: #374151;
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px 14px;
}
.panel-desc-empty {
  font-size: 13px;
  color: #9ca3af;
}

.cell-datepicker {
  &.is-overdue :deep(.ui-datepicker-segments) {
    color: #ef4444;
    font-weight: 600;
  }
}
:deep(.ui-table tbody td) {
  height: auto !important;
  padding: 4px 12px !important;
}
.issue-title-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  &.is-editing { display: flex; width: 100%; }
  &:hover .issue-title-edit { opacity: 1; }
}
.issue-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  word-break: break-word;
  cursor: pointer;
  &:hover { color: #2563eb; }
}
.issue-title-input {
  font-size: 14px;
  font-weight: 500;
  padding: 4px 8px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.issue-title-save,
.issue-title-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.15s;
}
.issue-title-save {
  background: #eff6ff;
  color: #2563eb;
  &:hover { background: #dbeafe; }
}
.issue-title-cancel {
  background: #f3f4f6;
  color: #6b7280;
  &:hover { background: #e5e7eb; }
}
.issue-title-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  color: #9ca3af;
  flex-shrink: 0;
  &:hover { background: #f3f4f6; color: #374151; }
}

// ── 멤버 ──
.member-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.member-count { font-size: 14px; color: #6b7280; }
.member-list { list-style: none; padding: 0; }
.member-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eef0f3;
  &:hover .member-delete-btn { opacity: 1; }
}
.member-avatar {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  color: #fff; font-size: 13px; font-weight: 600; flex-shrink: 0;
}
.member-info {
  display: flex; flex-direction: column; gap: 2px; flex: 1;
  strong { font-size: 14px; }
  span { font-size: 13px; color: #6b7280; }
}
.member-actions { display: flex; align-items: center; gap: 8px; }
.member-role-select { width: 100px; }
.member-delete-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none;
  border-radius: 6px; cursor: pointer; opacity: 0;
  transition: opacity 0.15s, background 0.15s; font-size: 18px; color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}

// ── 폼 ──
.create-form { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
.create-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

// ── 개요 ──
.overview-desc { font-size: 15px; line-height: 1.7; color: #4b5563; }
.overview-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px;
}
.stat-card {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 16px; text-align: center; border-top: 3px solid #d1d5db;
  &--todo { border-top-color: #6b7280; }
  &--doing { border-top-color: #3b82f6; }
  &--done { border-top-color: #22c55e; }
}
.stat-value { display: block; font-size: 28px; font-weight: 700; color: #1f2937; }
.stat-label { display: block; font-size: 13px; color: #6b7280; margin-top: 4px; }
.overview-progress { margin-top: 24px; }
.progress-header {
  display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;
}
.progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: #22c55e; border-radius: 4px; transition: width 0.3s ease; }
.overview-meta { margin-top: 20px; font-size: 13px; color: #9ca3af; display: flex; gap: 8px; }
// 더보기
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
.load-more-btn {
  padding: 8px 24px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #eff6ff;
  }
}

.fab {
  position: fixed;
  bottom: 76px;
  right: 24px;
  z-index: 50;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #4f6af6;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(79, 106, 246, 0.5);
  }
}

// ── 댓글 ──
.panel-comments {
  margin-top: 8px;
  &__header { margin-bottom: 12px; }
  &__label { font-size: 14px; font-weight: 600; color: #1f2937; }
  &__list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  &__empty { font-size: 13px; color: #9ca3af; text-align: center; padding: 20px 0; margin-bottom: 16px; }
  &__input {
    display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
    :deep(.ui-textarea) { width: 100%; }
  }
}

.panel-comment {
  padding: 10px 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6;
  &__header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  &__author { font-size: 13px; font-weight: 600; color: #374151; }
  &__time { font-size: 11px; color: #9ca3af; }
  &__edited { font-size: 11px; color: #9ca3af; font-style: italic; }
  &__actions { margin-left: auto; display: flex; gap: 4px; }
  &__btn {
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border: none; background: transparent;
    border-radius: 4px; color: #9ca3af; cursor: pointer;
    &:hover { background: #e5e7eb; color: #374151; }
    &--delete:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  }
  &__content { font-size: 13px; color: #374151; line-height: 1.5; white-space: pre-wrap; margin: 0; }
  &__edit { display: flex; flex-direction: column; gap: 6px; }
  &__edit-actions { display: flex; gap: 4px; justify-content: flex-end; }
}

@media (max-width: 768px) {
  .main { padding: 16px 12px; }
  .filter-bar { flex-wrap: wrap; }
  .fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}
</style>

