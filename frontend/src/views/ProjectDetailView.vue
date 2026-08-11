<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiTab, UiTable, UiBadge, UiLoading, UiEmpty, UiButton, UiIcon, UiChart, UiDrawer, UiDropdownMenu, UiDatePicker, UiDateRangePicker, UiModal, UiInput, UiSelect, UiMultiSelect, UiTextarea, UiFileList, UiFileUpload, UiToast, UiConfirm, UiAvatar, openToast, openConfirm } from '@leechanyong/ispark-ui'
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
const settingsOpen = ref(false)
const settingsExternalUrl = ref('')

watch(() => settingsOpen.value, (open) => {
  if (open && project.value) {
    settingsExternalUrl.value = project.value.externalUrl || ''
  }
})

async function saveExternalUrl() {
  if (!project.value) return
  try {
    const { data } = await api.put(`/projects/${project.value.id}`, { externalUrl: settingsExternalUrl.value.trim() })
    project.value.externalUrl = data.externalUrl
    openToast({ message: '외부 링크가 저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}

const tabs: TabItem[] = [
  { label: '이슈', value: 'board' },
  { label: '개요', value: 'overview' },
]
const activeTab = ref('board')

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
  { label: '컨펌중', value: 'confirm' },
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

const moduleFilterItems = [
  { label: '공통', value: '공통' },
  { label: '개인성과', value: '개인성과' },
  { label: '업무', value: '업무' },
  { label: '인사평가', value: '인사평가' },
]

const moduleSelectOptions: SelectOption[] = [
  { label: '공통', value: '공통' },
  { label: '개인성과', value: '개인성과' },
  { label: '업무', value: '업무' },
  { label: '인사평가', value: '인사평가' },
]

const dueFilterItems = [
  { label: '마감 있음', value: 'set' },
  { label: '미정', value: 'unset' },
  { label: '마감 초과', value: 'overdue' },
]

const searchQuery = ref('')

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000
}
const showFilters = ref(false)
const hasActiveFilter = computed(() =>
  checkedStatuses.value.length > 0 || filterModule.value !== '' || filterAssignee.value !== '' || filterDateFrom.value != null || filterDateTo.value != null
)
const checkedStatuses = ref<string[]>([])
const filterModule = ref('')
const filterAssignee = ref('')
const filterDateFrom = ref<DateValue | undefined>(undefined)
const filterDateTo = ref<DateValue | undefined>(undefined)
// 빠른 선택 프리셋 (달력 팝오버 상단에 칩으로 표시)
const datePresets = computed(() => {
  const now = new Date()
  const toCal = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const today = toCal(now)

  // 이번주 (월~일)
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)

  // 이번달 (1일~말일)
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // 최근 7일 / 30일
  const d7 = new Date(now)
  d7.setDate(now.getDate() - 6)
  const d30 = new Date(now)
  d30.setDate(now.getDate() - 29)

  return [
    { label: '오늘', start: today, end: today },
    { label: '이번주', start: toCal(mon), end: toCal(sun) },
    { label: '이번달', start: toCal(first), end: toCal(last) },
    { label: '최근 7일', start: toCal(d7), end: today },
    { label: '최근 30일', start: toCal(d30), end: today },
  ]
})

// UiDateRangePicker용 {start, end} 모델 — filterDateFrom/To와 양방향 연결
const dateRangeModel = computed<{ start: DateValue | undefined; end: DateValue | undefined }>({
  get: () => ({ start: filterDateFrom.value, end: filterDateTo.value }),
  set: (val) => {
    filterDateFrom.value = val?.start
    filterDateTo.value = val?.end
    resetDisplay()
  },
})

const assigneeFilterOptions = computed<SelectOption[]>(() => [
  { label: '전체', value: '' },
  { label: '미배정', value: 'none' },
  ...members.value.map((m: any) => ({ label: m.user.name, value: String(m.user.id) })),
])

const STATUS_ORDER: Record<string, number> = { doing: 0, todo: 1, confirm: 2, done: 3 }
const PRIORITY_ORDER: Record<string, number> = { high: 0, mid: 1, low: 2 }

const filteredIssues = computed(() => {
  return issues.value
    .filter((i: any) => {
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        const title = (i.title || '').toLowerCase()
        const desc = (i.description || '').toLowerCase()
        const extId = ((i as any).externalId || '').toLowerCase()
        if (!title.includes(q) && !desc.includes(q) && !extId.includes(q)) return false
      }
      if (checkedStatuses.value.length > 0 && !checkedStatuses.value.includes(i.status)) return false
      if (filterModule.value && (i as any).module !== filterModule.value) return false
      if (filterAssignee.value) {
        const assigneeVal = i.assigneeId ? String(i.assigneeId) : 'none'
        if (assigneeVal !== filterAssignee.value) return false
      }
      if (filterDateFrom.value || filterDateTo.value) {
        const d = new Date(i.createdAt)
        const created = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
        if (filterDateFrom.value && created.compare(filterDateFrom.value) < 0) return false
        if (filterDateTo.value && created.compare(filterDateTo.value) > 0) return false
      }
      return true
    })
    .sort((a: any, b: any) => {
      // 1차: 상태 (진행중 → 할일 → 완료)
      const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      if (s !== 0) return s
      // 2차: 우선순위 (높음 → 보통 → 낮음)
      const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      if (p !== 0) return p
      // 3차: 경과일 (오래된 순)
      const da = new Date(a.createdAt).getTime()
      const db = new Date(b.createdAt).getTime()
      return da - db
    })
})

// ── 오래된 컨펌중 접기 (설정 일수를 넘긴 컨펌중은 기본 숨김) ──
const STALE_CONFIRM_DAYS = 10
const showStaleConfirm = ref(false)
function isStaleConfirm(i: any): boolean {
  return i.status === 'confirm' && getElapsedDays(i.createdAt) > STALE_CONFIRM_DAYS
}
// 현재 필터 스코프 내에서 접힌(숨겨진) 오래된 컨펌중 건수
const staleConfirmCount = computed(() => filteredIssues.value.filter(isStaleConfirm).length)
// 표에 실제로 그려지는 목록 (펼침 상태면 전체, 아니면 오래된 컨펌중 제외)
const visibleIssues = computed(() =>
  showStaleConfirm.value ? filteredIssues.value : filteredIssues.value.filter((i: any) => !isStaleConfirm(i))
)

// 더보기 (초기 20건, 이후 20건씩 추가)
const PAGE_SIZE = 20
const displayCount = ref(PAGE_SIZE)
const displayedIssues = computed(() => visibleIssues.value.slice(0, displayCount.value))
const hasMore = computed(() => displayCount.value < visibleIssues.value.length)
function loadMore() { displayCount.value += PAGE_SIZE }
// 필터 변경 시 표시 건수 리셋
function resetDisplay() { displayCount.value = PAGE_SIZE }

// 담당자 컬럼 헤더 필터 (전체='' / 미배정='none' / 멤버=userId)
function onAssigneeFilter(val: string) {
  filterAssignee.value = val
  resetDisplay()
}

// ── 날짜 컬럼 모드 (프로젝트별 localStorage) ──
type DateColumnMode = 'elapsed' | 'updatedAt'
const dateColumnMode = ref<DateColumnMode>('elapsed')

function loadDateColumnMode() {
  const saved = localStorage.getItem(`project-${projectId}-dateColumn`)
  if (saved === 'updatedAt') dateColumnMode.value = 'updatedAt'
  else dateColumnMode.value = 'elapsed'
}

function saveDateColumnMode(mode: DateColumnMode) {
  dateColumnMode.value = mode
  localStorage.setItem(`project-${projectId}-dateColumn`, mode)
}

const dateColumnLabel = computed(() => dateColumnMode.value === 'updatedAt' ? '수정일' : '경과일')

// 경과일 계산 (생성일 기준)
function getElapsedDays(createdAt: string): number {
  const created = new Date(createdAt)
  const now = new Date()
  created.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

// 경과일 초과 기준 (이 일수 이상이면 빨강 강조)
const ELAPSED_OVERDUE_DAYS = 15

// ── 이슈 테이블 ──
const issueColumns = computed<TableColumn[]>(() => [
  { key: 'status', label: '상태', width: '70px', align: 'center', sortable: true },
  { key: 'category', label: '구분', width: '60px', align: 'center', sortable: true, hideBelow: 640 },
  { key: 'externalId', label: '번호', width: '70px', align: 'center', sortable: true, sortType: 'number', hideBelow: 640 },
  { key: 'title', label: '제목', align: 'left', sortable: true, sortType: 'string' },
  { key: 'priority', label: '우선순위', width: '80px', align: 'center', sortable: true, hideBelow: 640 },
  { key: dateColumnMode.value === 'elapsed' ? 'createdAt' : 'updatedAt', label: dateColumnLabel.value, width: '100px', align: 'center', sortable: true, sortType: 'date', hideBelow: 768 },
  { key: 'assignee', label: '담당자', width: '80px', align: 'center', hideBelow: 768 },
])

// 상태/우선순위 드롭다운 메뉴 아이템
const statusMenuItems: DropdownMenuItemDef[] = [
  { label: '할 일', value: 'todo' },
  { label: '진행중', value: 'doing' },
  { label: '컨펌중', value: 'confirm' },
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
  mid: { label: '보통', variant: 'default' },
  low: { label: '낮음', variant: 'default' },
}

// 날짜 포맷: ISO string → YYYY.M.D
function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
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
    if (panelIssue.value?.id === data.id) panelIssue.value = data
  } catch {
    issue.title = prev
    openToast({ message: '제목 수정에 실패했습니다.', type: 'error' })
  }
}

function onTitleKeydown(e: KeyboardEvent, issue: any) {
  if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(issue) }
  if (e.key === 'Escape') { editingTitleId.value = null }
}

// 완료 코멘트 모달
const doneModalOpen = ref(false)
const doneComment = ref('')
const doneTargetIssue = ref<any>(null)

async function confirmDone() {
  if (!doneComment.value.trim()) {
    openToast({ message: '완료 코멘트를 입력해주세요.', type: 'warning' })
    return
  }
  const issue = doneTargetIssue.value
  if (!issue) return
  try {
    // 상태 변경
    const { data } = await api.put(`/issues/${issue.id}`, { status: 'done' })
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
    if (panelIssue.value?.id === data.id) panelIssue.value = data
    // 코멘트 추가
    await api.post(`/issues/${issue.id}/comments`, { content: `✅ 완료: ${doneComment.value.trim()}` })
    // 패널이 열려있으면 댓글 목록 갱신
    if (panelOpen.value && panelIssue.value?.id === issue.id) {
      await loadComments(issue.id)
    }
    doneModalOpen.value = false
    doneComment.value = ''
    doneTargetIssue.value = null
    openToast({ message: '완료 처리되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '완료 처리에 실패했습니다.', type: 'error' })
  }
}

// 인라인 편집: 셀에서 바로 변경
async function onInlineChange(issue: any, field: string, val: string | number) {
  // 완료로 변경 시 코멘트 필수
  if (field === 'status' && val === 'done') {
    doneTargetIssue.value = issue
    doneComment.value = ''
    doneModalOpen.value = true
    return
  }

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
    // 패널 열려있으면 동기화
    if (panelIssue.value?.id === data.id) panelIssue.value = data
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
const isProjectOwner = computed(() => {
  if (!project.value?.members) return false
  return project.value.members.some((m: any) => m.user.id === currentUser.id && m.role === 'owner')
})

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
    const res = await api.get(`/issues/${issueId}/comments`)
    comments.value = res.data.data
    // 목록 행의 댓글 수 배지도 동기화 (추가/삭제 후 stale 방지)
    const idx = issues.value.findIndex((i: any) => i.id === issueId)
    if (idx >= 0) {
      if (!issues.value[idx]._count) issues.value[idx]._count = { comments: 0 }
      issues.value[idx]._count.comments = comments.value.length
    }
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

// 이슈 첨부파일
const panelFiles = ref<any[]>([])
const issueFileUploading = ref(false)

async function loadIssueFiles(issueId: number) {
  try {
    const res = await api.get(`/issues/${issueId}/files`)
    panelFiles.value = res.data.data
  } catch {
    panelFiles.value = []
  }
}

function getIssueFileUrl(path: string) {
  const base = import.meta.env.VITE_API_URL || ''
  return `${base}/uploads/${path}`
}

async function onIssueFileSelect(file: File) {
  if (!panelIssue.value || !file) return
  issueFileUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await api.post(`/issues/${panelIssue.value.id}/files`, formData)
    await loadIssueFiles(panelIssue.value.id)
  } catch {
    openToast({ message: '파일 업로드에 실패했습니다.', type: 'error' })
  } finally {
    issueFileUploading.value = false
  }
}

async function deleteIssueFile(file: any) {
  if (!panelIssue.value) return
  try {
    await api.delete(`/issues/${panelIssue.value.id}/files/${file.id}`)
    await loadIssueFiles(panelIssue.value.id)
    openToast({ message: '파일이 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '파일 삭제에 실패했습니다.', type: 'error' })
  }
}
const panelEditingExtId = ref(false)
const panelExtIdText = ref('')

async function saveExtId() {
  if (!panelIssue.value) return
  try {
    const { data } = await api.put(`/issues/${panelIssue.value.id}`, { externalId: panelExtIdText.value.trim() || null })
    const idx = issues.value.findIndex(i => i.id === data.id)
    if (idx > -1) issues.value[idx] = data
    panelIssue.value = data
    panelEditingExtId.value = false
  } catch {
    openToast({ message: '관리번호 수정에 실패했습니다.', type: 'error' })
  }
}

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
  panelEditingExtId.value = false
  panelOpen.value = true
  loadComments(issue.id)
  loadIssueFiles(issue.id)
}

function closePanel() {
  panelOpen.value = false
  panelIssue.value = null
  comments.value = []
  commentContent.value = ''
  editingCommentId.value = null
  editingCommentContent.value = ''
  panelFiles.value = []
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
const createForm = ref({ title: '', priority: 'mid', assigneeId: '', module: '개인성과', category: 'improvement', externalId: '' })
const creatingLoading = ref(false)

function startCreate() {
  createForm.value = { title: '', priority: 'mid', assigneeId: '', module: '개인성과', category: 'improvement', externalId: '' }
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
      module: createForm.value.module,
      category: createForm.value.category,
      externalId: createForm.value.externalId || null,
    })
    issues.value.unshift(data)
    openToast({ message: '이슈가 추가되었습니다.', type: 'success' })
    createDrawerOpen.value = false
  } finally {
    creatingLoading.value = false
  }
}

// ── 엑셀 붙여넣기로 추가 ──
const pasteModalOpen = ref(false)
const pasteText = ref('')
const pasteLoading = ref(false)

// 탭 구분 TSV 파싱 (따옴표로 감싼 멀티라인 셀 지원 — 엑셀/구글시트 복사 형식)
function parseTsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } // 이스케이프된 따옴표
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === '\t') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  // 완전히 빈 행 제거
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// 구분(category) 사전 — 이 단어가 든 칸을 "기준점"으로 삼아 그 다음 칸을 내용으로 본다
const CATEGORY_MAP: Record<string, string> = {
  '오류': 'bug', '버그': 'bug', 'bug': 'bug',
  '확인': 'question', '문의': 'question', '질문': 'question',
  '개선': 'improvement', '개선요청': 'improvement', '요청': 'improvement',
}

function categoryLabel(c: string): string {
  return c === 'bug' ? '오류' : c === 'question' ? '확인' : '개선'
}

// YY.MM.DD → ISO(YYYY-MM-DD), 실패 시 null
function parseKDate(s: string): string | null {
  const m = (s || '').trim().match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/)
  if (!m) return null
  return `20${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// 파싱 미리보기: 행마다 열 개수가 달라(6열/9열 등) "구분(개선)" 칸을 기준점으로 잡는다.
// 번호 … [모듈들] … 구분(개선) … 내용 … 요청자 … 요청일 … 담당자
const pastePreview = computed(() => {
  return parseTsv(pasteText.value).map(cols => {
    const trimmed = cols.map(c => (c || '').trim())

    // 번호: 첫 칸이 숫자면 사용
    const externalId = /^\d+$/.test(trimmed[0] || '') ? trimmed[0] : ''

    // 구분: 사전에 매칭되는 칸을 찾아 기준점(catIdx)으로
    let category = 'improvement'
    let catIdx = -1
    for (let i = 0; i < trimmed.length; i++) {
      const hit = CATEGORY_MAP[trimmed[i]]
      if (hit) { category = hit; catIdx = i; break }
    }

    // 내용: 구분 바로 다음 칸 (구분 못 찾으면 가장 긴 칸으로 폴백)
    let cell = ''
    if (catIdx >= 0 && cols[catIdx + 1] !== undefined) {
      cell = cols[catIdx + 1]
    } else {
      for (const c of cols) if ((c || '').length > cell.length) cell = c || ''
    }
    const description = cell.trim() // 전체 = 내용
    // 제목: 첫 줄 (단, "[퍼블]"처럼 태그만 있는 줄이면 다음 줄까지 합침)
    const lines = cell.split('\n').map(l => l.trim()).filter(Boolean)
    let title = lines[0] || ''
    if (/^\[[^\]]*\]$/.test(title) && lines[1]) title = `${title} ${lines[1]}`

    // 모듈: 번호 다음 ~ 구분 이전 칸들 (화면/메뉴명)
    let moduleVal = '공통'
    if (catIdx > 1) {
      const mods = trimmed.slice(1, catIdx).filter(Boolean)
      if (mods.length) moduleVal = mods.join(' / ')
    }

    // 요청일: YY.MM.DD 형식 칸
    let requestedAt: string | null = null
    for (const c of trimmed) { const d = parseKDate(c); if (d) { requestedAt = d; break } }

    // 담당자: 자동 배정하지 않음(미배정) — 요청자/담당자 구분이 행마다 달라 오배정 위험이 큼. 생성 후 수동 지정.
    const assigneeId: number | null = null

    const existing = externalId ? issues.value.find(i => String(i.externalId) === externalId) : null
    return {
      externalId,
      module: moduleVal,
      category,
      title,
      description,
      requestedAt,
      assigneeId,
      assigneeName: '',
      mode: existing ? '갱신' : '신규',
      existingId: existing ? existing.id : null,
      valid: !!description, // 내용 없으면 무시
    }
  })
})

const pasteValidCount = computed(() => pastePreview.value.filter(p => p.valid).length)

// 미리보기 확인 후 일괄 생성/갱신 (externalId 기준 upsert)
async function doPasteSubmit() {
  const items = pastePreview.value.filter(p => p.valid)
  if (items.length === 0) {
    openToast({ message: '추가할 행이 없습니다. "개선/오류/확인" 구분과 그 다음 내용 칸을 확인하세요.', type: 'error' })
    return
  }
  pasteLoading.value = true
  let created = 0, updated = 0, failed = 0
  for (const it of items) {
    const payload: Record<string, unknown> = {
      title: it.title,
      description: it.description,
      module: it.module,
      category: it.category,
      assigneeId: it.assigneeId,
      externalId: it.externalId || null,
      status: 'todo', // 붙여넣기로 만든 건 항상 할일
    }
    if (it.requestedAt) payload.requestedAt = it.requestedAt
    try {
      if (it.existingId) {
        const { data } = await api.put(`/issues/${it.existingId}`, payload)
        const idx = issues.value.findIndex(i => i.id === data.id)
        if (idx > -1) issues.value[idx] = data
        updated++
      } else {
        const { data } = await api.post(`/projects/${projectId}/issues`, payload)
        issues.value.unshift(data)
        created++
      }
    } catch {
      failed++
    }
  }
  pasteLoading.value = false
  openToast({
    message: `완료 — 신규 ${created} · 갱신 ${updated}${failed ? ` · 실패 ${failed}` : ''}`,
    type: failed ? 'error' : 'success',
  })
  if (!failed) {
    pasteModalOpen.value = false
    pasteText.value = ''
  }
}

// ── 개요 탭 ──
// 개요 월 스코프 (등록일 createdAt 기준). scope='all'이면 전 기간
const overviewScope = ref<'month' | 'all'>('month')
const overviewMonth = ref<{ year: number; month: number }>({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
})

// 다음 달 버튼 비활성 판단용 (이번 달까지만 이동)
const isCurrentMonth = computed(() => {
  const now = new Date()
  return overviewMonth.value.year === now.getFullYear() && overviewMonth.value.month === now.getMonth() + 1
})

// 월 라벨 (예: 2026년 6월)
const overviewMonthLabel = computed(() => `${overviewMonth.value.year}년 ${overviewMonth.value.month}월`)

// 개요 스코프 이슈 (전체 or 해당 월 등록분)
const scopedIssues = computed(() => {
  if (overviewScope.value === 'all') return issues.value
  const { year, month } = overviewMonth.value
  return issues.value.filter(i => {
    const d = new Date(i.createdAt)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
})

// 이전/다음 달 이동 (다음은 이번 달까지만). 이동 시 자동으로 월 스코프로 전환
function prevOverviewMonth() {
  overviewScope.value = 'month'
  const { year, month } = overviewMonth.value
  overviewMonth.value = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
function nextOverviewMonth() {
  if (isCurrentMonth.value) return
  overviewScope.value = 'month'
  const { year, month } = overviewMonth.value
  overviewMonth.value = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

const issueStats = computed(() => ({
  total: scopedIssues.value.length,
  todo: scopedIssues.value.filter(i => i.status === 'todo').length,
  doing: scopedIssues.value.filter(i => i.status === 'doing').length,
  confirm: scopedIssues.value.filter(i => i.status === 'confirm').length,
  done: scopedIssues.value.filter(i => i.status === 'done').length,
}))

// 컨펌중 + 관리번호(externalId) 보유 이슈 (현재 스코프 내) — 일괄 시트 열기 대상
const SHEET_URL_BASE =
  'https://script.google.com/macros/s/AKfycbwTDrTn456l1q5rT_fECsRLkrErRBEovRFib4WGZtSrkP4jE1YuSizei13UfDhuHVlS/exec'
const confirmSheetIssues = computed(() =>
  scopedIssues.value.filter(i => i.status === 'confirm' && (i as any).externalId),
)

// 시트 일괄 열기 모달
const sheetModalOpen = ref(false)
const sheetModalCount = computed(() => confirmSheetIssues.value.length)

// 담당자별 그룹 (컨펌중 + 관리번호 보유) — 담당자마다 따로 열 수 있도록
const confirmSheetGroups = computed(() => {
  const map = new Map<string, { key: string; name: string; issues: any[] }>()
  for (const i of confirmSheetIssues.value) {
    const key = (i as any).assigneeId ? String((i as any).assigneeId) : 'none'
    const name = (i as any).assignee?.name || '미배정'
    if (!map.has(key)) map.set(key, { key, name, issues: [] })
    map.get(key)!.issues.push(i)
  }
  // 건수 많은 담당자 먼저
  return Array.from(map.values()).sort((a, b) => b.issues.length - a.issues.length)
})

// 컨펌중 시트 일괄 열기 진입 (5건 이상이면 담당자별 모달, 미만이면 바로 전체 열기)
function openConfirmSheets() {
  const targets = confirmSheetIssues.value
  const noIdCount = scopedIssues.value.filter(i => i.status === 'confirm' && !(i as any).externalId).length
  if (targets.length === 0) {
    openToast({
      message: noIdCount > 0 ? `컨펌중 ${noIdCount}건 모두 관리번호가 없어 열 수 없습니다.` : '컨펌중 이슈가 없습니다.',
      type: 'warning',
    })
    return
  }
  if (targets.length >= 5) {
    sheetModalOpen.value = true
    return
  }
  openSheets(targets)
}

// 주어진 이슈들의 시트 행을 새 탭으로 오픈 (버튼 클릭 직접 제스처 → 팝업차단에 유리)
function openSheets(list: any[]) {
  list.forEach(i => window.open(`${SHEET_URL_BASE}?id=${(i as any).externalId}`, '_blank'))
}

// 전체 열기 (모달 닫음)
function openAllConfirmSheets() {
  openSheets(confirmSheetIssues.value)
  sheetModalOpen.value = false
  const noIdCount = scopedIssues.value.filter(i => i.status === 'confirm' && !(i as any).externalId).length
  if (noIdCount > 0) {
    openToast({ message: `관리번호 없는 ${noIdCount}건은 제외했습니다.`, type: 'warning' })
  }
}

// 이슈 상태 분포 도넛 차트 (색상은 상태 뱃지와 통일: 할일=회색/진행중=파랑/컨펌중=노랑/완료=초록)
const issueStatusChart = computed(() => ({
  style: 'taskStatus',
  valueMode: 'raw',
  items: [
    { name: '할 일', value: issueStats.value.todo },
    { name: '진행중', value: issueStats.value.doing },
    { name: '컨펌중', value: issueStats.value.confirm },
    { name: '완료', value: issueStats.value.done },
  ],
  labelColor: ['#6b7280', '#3b82f6', '#f59e0b', '#22c55e'],
}))

// 전체 진행률 (완료 / 전체)
const donePercent = computed(() =>
  issueStats.value.total === 0 ? 0 : Math.round((issueStats.value.done / issueStats.value.total) * 100),
)

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
  loadDateColumnMode()
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
        <UiBadge v-if="project" :variant="project.status === 'active' ? 'success' : project.status === 'done' ? 'primary' : 'default'" size="sm">
          {{ project.status === 'active' ? '진행중' : project.status === 'done' ? '완료' : '보류' }}
        </UiBadge>
      </div>
      <div class="header-actions">
        <UiButton v-if="project?.externalUrl" variant="outline" size="sm" as="a" :href="project.externalUrl" target="_blank">
          <template #icon-left><UiIcon name="external-link" :size="14" /></template>
          원본 시트
        </UiButton>
        <UiButton v-if="project" variant="ghost" size="sm" icon-only aria-label="프로젝트 설정" @click="settingsOpen = true">
          <template #icon-left><UiIcon name="settings" :size="18" /></template>
        </UiButton>
      </div>
    </div>

    <UiLoading v-if="loading" overlay />
        <template v-else>
          <UiTab v-model="activeTab" :tabs="tabs" align="left" class="detail-tabs" />

          <!-- 이슈 -->
          <div v-if="activeTab === 'board'" class="tab-content">
            <!-- 검색 + 필터 토글 -->
            <div class="search-bar">
              <UiInput
                v-model="searchQuery"
                placeholder="검색..."
                size="sm"
                clearable
                class="search-input"
              >
                <template #icon-left><UiIcon name="search" :size="14" /></template>
              </UiInput>
              <button
                class="filter-toggle-btn"
                :class="{ 'is-active': showFilters || hasActiveFilter }"
                @click="showFilters = !showFilters"
              >
                <UiIcon name="sliders-horizontal" :size="16" />
                <span v-if="hasActiveFilter" class="filter-dot" />
              </button>
              <span class="filter-count-inline">{{ filteredIssues.length }}건</span>
            </div>

            <!-- 필터 바 (토글) -->
            <div v-if="showFilters" class="filter-bar">
              <UiMultiSelect v-model="checkedStatuses" :options="statusFilterItems" all-label="상태 전체" size="sm" placeholder="상태" class="filter-status" @update:model-value="resetDisplay" />
              <UiSelect v-model="filterModule" :options="[{ label: '모듈 전체', value: '' }, ...moduleSelectOptions]" size="sm" placeholder="모듈" class="filter-module" />
              <div class="filter-date-range">
                <UiDateRangePicker v-model="dateRangeModel" :presets="datePresets" size="sm" />
              </div>

            </div>

            <!-- 오래된 컨펌중 접기 배너 -->
            <div v-if="staleConfirmCount > 0" class="stale-confirm-bar">
              <span class="stale-confirm-text">
                {{ STALE_CONFIRM_DAYS }}일 넘게 컨펌중인 이슈 <strong>{{ staleConfirmCount }}건</strong>이 {{ showStaleConfirm ? '표시됨' : '숨겨짐' }}
              </span>
              <button class="stale-confirm-toggle" @click="showStaleConfirm = !showStaleConfirm">
                {{ showStaleConfirm ? '다시 접기' : '펼쳐 보기' }}
              </button>
            </div>

            <UiEmpty v-if="filteredIssues.length === 0" title="이슈가 없습니다." />
            <UiTable
              v-else-if="visibleIssues.length > 0"
              :columns="issueColumns"
              :data="(displayedIssues as any)"
              size="sm"
            >
              <template #header-assignee="{ column }: any">
                <div class="th-filter">
                  <span>{{ column.label }}</span>
                  <UiDropdownMenu :items="(assigneeFilterOptions as any)" @select="onAssigneeFilter">
                    <template #trigger>
                      <button
                        class="th-filter-btn"
                        :class="{ 'is-active': filterAssignee !== '' }"
                        aria-label="담당자 필터"
                        @click.stop
                      >
                        <UiIcon name="sliders-horizontal" :size="12" />
                      </button>
                    </template>
                  </UiDropdownMenu>
                </div>
              </template>
              <template #cell-category="{ row }: any">
                <UiBadge
                  :variant="row.category === 'bug' ? 'danger' : 'default'"
                  size="sm"
                >{{ row.category === 'bug' ? '오류' : row.category === 'question' ? '확인' : '개선' }}</UiBadge>
              </template>
              <template #cell-externalId="{ row }: any">
                <a
                  v-if="row.externalId"
                  class="issue-external-id issue-external-id--link"
                  :href="`https://script.google.com/macros/s/AKfycbwTDrTn456l1q5rT_fECsRLkrErRBEovRFib4WGZtSrkP4jE1YuSizei13UfDhuHVlS/exec?id=${row.externalId}`"
                  target="_blank"
                  @click.stop
                >#{{ row.externalId }}</a>
                <span v-else class="issue-external-id issue-external-id--empty">-</span>
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
                    <span v-if="isNew(row.createdAt)" class="issue-new-badge">NEW</span>
                    <!-- 외부 링크가 있으면 제목 클릭 시 새 탭으로 이동 (없으면 기존대로 패널 열기) -->
                    <a
                      v-if="row.externalUrl"
                      class="issue-title issue-title--link"
                      :href="row.externalUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="row.externalUrl"
                      @click.stop
                      @dblclick.stop.prevent="startTitleEdit(row)"
                    >
                      {{ row.title }}
                      <UiIcon name="external-link" :size="12" />
                    </a>
                    <span v-else class="issue-title" @click="openPanel(row)" @dblclick.stop="startTitleEdit(row)">{{ row.title }}</span>
                    <span
                      v-if="row._count?.comments"
                      class="issue-comment-count"
                      :title="`피드백 ${row._count.comments}건`"
                      @click.stop="openPanel(row)"
                    >
                      <UiIcon name="message-circle" :size="13" />{{ row._count.comments }}
                    </span>
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
                          :variant="row.status === 'done' ? 'success' : row.status === 'confirm' ? 'warning' : row.status === 'doing' ? 'primary' : 'default'"
                          size="sm"
                        >{{ row.status === 'done' ? '완료' : row.status === 'confirm' ? '컨펌중' : row.status === 'doing' ? '진행중' : '할 일' }}</UiBadge>
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
              <template #cell-createdAt="{ row }: any">
                <span
                  class="cell-elapsed"
                  :class="{ 'cell-elapsed--overdue': getElapsedDays(row.createdAt) >= ELAPSED_OVERDUE_DAYS }"
                >{{ getElapsedDays(row.createdAt) }}일</span>
              </template>
              <template #cell-updatedAt="{ row }: any">
                <span class="cell-date-text">{{ formatDate(row.updatedAt || row.createdAt) }}</span>
              </template>
              <template #cell-assignee="{ row }: any">
                <div @click.stop>
                  <UiDropdownMenu
                    :items="assigneeMenuItems"
                    @select="(val: string) => onInlineChange(row, 'assigneeId', val)"
                  >
                    <template #trigger>
                      <button class="cell-badge-btn">
                        <UiAvatar v-if="row.assignee" :name="row.assignee.name" size="xs" />
                        <span v-else class="cell-assignee cell-assignee--empty">미배정</span>
                      </button>
                    </template>
                  </UiDropdownMenu>
                </div>
              </template>
            </UiTable>
            <div v-if="hasMore" class="load-more">
              <button class="load-more-btn" @click="loadMore">
                더보기 ({{ displayedIssues.length }} / {{ visibleIssues.length }})
              </button>
            </div>
          </div>

          <!-- 개요 -->
          <div v-else-if="activeTab === 'overview'" class="tab-content">
            <!-- 월 네비게이터 + 컨펌중 일괄 시트 열기 -->
            <div class="overview-header">
              <div class="overview-month-nav">
                <UiButton variant="ghost" size="sm" icon-only aria-label="이전 달" @click="prevOverviewMonth">
                  <template #icon-left><UiIcon name="chevron-left" :size="18" /></template>
                </UiButton>
                <span class="overview-month-label">{{ overviewScope === 'all' ? '전체 기간' : overviewMonthLabel }}</span>
                <UiButton variant="ghost" size="sm" icon-only aria-label="다음 달" :disabled="isCurrentMonth" @click="nextOverviewMonth">
                  <template #icon-left><UiIcon name="chevron-right" :size="18" /></template>
                </UiButton>
                <UiButton :variant="overviewScope === 'all' ? 'primary' : 'outline'" size="sm" @click="overviewScope = overviewScope === 'all' ? 'month' : 'all'">전체</UiButton>
              </div>
              <UiButton variant="outline" size="sm" :disabled="confirmSheetIssues.length === 0" @click="openConfirmSheets">
                <template #icon-left><UiIcon name="external-link" :size="14" /></template>
                컨펌중 시트 열기 ({{ confirmSheetIssues.length }}건)
              </UiButton>
            </div>

            <UiEmpty v-if="issueStats.total === 0" :title="overviewScope === 'all' ? '등록된 이슈가 없습니다.' : '이 달 등록된 이슈가 없습니다.'" />
            <template v-else>
              <div class="overview-top">
                <div class="overview-card overview-chart-card">
                  <h4 class="overview-card-title">이슈 상태 분포</h4>
                  <div class="overview-chart-wrap">
                    <UiChart type="pie" :config="issueStatusChart" :show-legend="true" />
                  </div>
                </div>
                <div class="overview-card overview-progress-card">
                  <h4 class="overview-card-title">전체 진행률</h4>
                  <div class="overview-progress-body">
                    <div class="progress-percent">{{ donePercent }}<span class="progress-percent-unit">%</span></div>
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: donePercent + '%' }" />
                    </div>
                    <p class="overview-progress-sub">완료 {{ issueStats.done }}건 / 전체 {{ issueStats.total }}건</p>
                  </div>
                </div>
              </div>

              <div class="overview-stats">
                <div class="stat-card stat-card--todo">
                  <span class="stat-value">{{ issueStats.todo }}</span>
                  <span class="stat-label">할 일</span>
                </div>
                <div class="stat-card stat-card--doing">
                  <span class="stat-value">{{ issueStats.doing }}</span>
                  <span class="stat-label">진행중</span>
                </div>
                <div class="stat-card stat-card--confirm">
                  <span class="stat-value">{{ issueStats.confirm }}</span>
                  <span class="stat-label">컨펌중</span>
                </div>
                <div class="stat-card stat-card--done">
                  <span class="stat-value">{{ issueStats.done }}</span>
                  <span class="stat-label">완료</span>
                </div>
              </div>
            </template>
          </div>

        </template>

    <!-- 설정 드로어 -->
    <UiDrawer :open="settingsOpen" title="프로젝트 설정" @update:open="settingsOpen = $event">
      <div class="settings-section">
        <div class="settings-header">
          <h4 class="settings-label">멤버 ({{ project?.members?.length || 0 }}명)</h4>
          <UiButton v-if="isProjectOwner" variant="outline" size="sm" @click="showAddMemberModal = true">+ 멤버 추가</UiButton>
        </div>
        <ul v-if="project?.members?.length" class="member-list">
          <li v-for="m in project.members" :key="m.id" class="member-item">
            <UiAvatar :name="m.user.name" size="sm" />
            <div class="member-info">
              <strong>{{ m.user.name }}</strong>
              <span>{{ m.user.email }}</span>
            </div>
            <div class="member-actions">
              <template v-if="isProjectOwner">
                <div class="member-role-select">
                  <UiSelect :model-value="m.role" :options="roleOptions" size="sm" @change="(val: string | number) => onChangeRole(m, val)" />
                </div>
                <button class="member-delete-btn" @click="onRemoveMember(m)">&times;</button>
              </template>
              <span v-else class="member-role-text">{{ m.role }}</span>
            </div>
          </li>
        </ul>
      </div>
      <hr class="settings-divider" />
      <div class="settings-section">
        <h4 class="settings-label">설명</h4>
        <p class="settings-desc">{{ project?.description || '설명 없음' }}</p>
      </div>
      <hr class="settings-divider" />
      <div class="settings-section">
        <h4 class="settings-label">외부 링크</h4>
        <div style="display:flex;gap:8px;">
          <UiInput
            v-model="settingsExternalUrl"
            placeholder="https://docs.google.com/spreadsheets/..."
            size="sm"
            style="flex:1;"
          />
          <UiButton variant="secondary" size="sm" @click="saveExternalUrl">저장</UiButton>
        </div>
      </div>
      <hr class="settings-divider" />
      <div class="settings-section">
        <h4 class="settings-label">날짜 컬럼</h4>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <UiSelect
            :model-value="dateColumnMode"
            :options="[{ label: '경과일', value: 'elapsed' }, { label: '수정일', value: 'updatedAt' }]"
            size="sm"
            style="flex:1;"
            @change="(v: string | number) => saveDateColumnMode(v as DateColumnMode)"
          />
          <UiButton variant="secondary" size="sm" @click="saveDateColumnMode(dateColumnMode)">저장</UiButton>
        </div>
      </div>
    </UiDrawer>

    <!-- 완료 코멘트 모달 -->
    <UiModal :open="doneModalOpen" title="완료 처리" @update:open="doneModalOpen = $event">
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">완료 내용을 간단히 기록해주세요.</p>
      <UiTextarea v-model="doneComment" placeholder="예: 로그인 오류 수정, 재현 확인 완료, 6/6 배포 예정" :rows="3" />
      <template #footer>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <UiButton variant="secondary" size="sm" @click="doneModalOpen = false">취소</UiButton>
          <UiButton variant="primary" size="sm" @click="confirmDone">완료 처리</UiButton>
        </div>
      </template>
    </UiModal>

    <!-- 컨펌중 시트 일괄 열기 (담당자별) -->
    <UiModal v-model:open="sheetModalOpen" title="시트 일괄 열기" size="sm">
      <p class="sheet-modal-desc">컨펌중 <strong>{{ sheetModalCount }}건</strong> · 담당자별로 열거나 전체를 한 번에 열 수 있어요.</p>
      <ul class="sheet-group-list">
        <li v-for="g in confirmSheetGroups" :key="g.key" class="sheet-group-item">
          <div class="sheet-group-info">
            <span class="sheet-group-name">{{ g.name }}</span>
            <span class="sheet-group-count">{{ g.issues.length }}건</span>
          </div>
          <UiButton variant="outline" size="sm" @click="openSheets(g.issues)">열기</UiButton>
        </li>
      </ul>
      <template #footer>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <UiButton variant="secondary" size="sm" @click="sheetModalOpen = false">닫기</UiButton>
          <UiButton variant="primary" size="sm" @click="openAllConfirmSheets">전체 열기 ({{ sheetModalCount }}건)</UiButton>
        </div>
      </template>
    </UiModal>

    <!-- 엑셀 붙여넣기 추가 버튼 -->
    <button v-if="!loading" class="fab-paste" @click="pasteModalOpen = true">엑셀 붙여넣기</button>

    <!-- FAB: 이슈 추가 -->
    <button v-if="!loading" class="fab" aria-label="이슈 추가" @click="startCreate">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 엑셀 붙여넣기 추가 모달 -->
    <UiModal v-model:open="pasteModalOpen" title="엑셀 붙여넣기로 추가" size="lg">
      <p class="paste-desc">
        엑셀/구글시트에서 행을 복사해 붙여넣으세요. 행마다 열 개수가 달라도 <strong>"개선/오류/확인" 구분 칸</strong>을 기준으로 자동 인식합니다.<br>
        <span class="paste-cols">번호 · 구분(개선/오류/확인) · 내용 · 요청자 · 요청일 · 담당자 순 — 모두 <strong>할일</strong>로 생성됩니다.</span>
      </p>
      <UiTextarea v-model="pasteText" :rows="6" placeholder="여기에 붙여넣기 (여러 행 가능)" />

      <div v-if="pastePreview.length" class="paste-preview">
        <div class="paste-preview-head">
          미리보기 {{ pastePreview.length }}건 —
          신규 {{ pastePreview.filter(p => p.mode === '신규' && p.valid).length }} ·
          갱신 {{ pastePreview.filter(p => p.mode === '갱신' && p.valid).length }}
          <span v-if="pastePreview.some(p => !p.valid)" class="paste-ignored">· 무시 {{ pastePreview.filter(p => !p.valid).length }}</span>
        </div>
        <div class="paste-table-wrap">
          <table class="paste-table">
            <thead>
              <tr><th>처리</th><th>번호</th><th>제목</th><th>모듈</th><th>구분</th><th>담당자</th><th>요청일</th></tr>
            </thead>
            <tbody>
              <tr v-for="(p, idx) in pastePreview" :key="idx" :class="{ 'row-invalid': !p.valid }">
                <td><UiBadge :variant="!p.valid ? 'default' : p.mode === '갱신' ? 'warning' : 'primary'" size="sm">{{ p.valid ? p.mode : '무시' }}</UiBadge></td>
                <td>{{ p.externalId || '-' }}</td>
                <td class="td-title">{{ p.title || '(제목 없음)' }}</td>
                <td>{{ p.module }}</td>
                <td>{{ categoryLabel(p.category) }}</td>
                <td>{{ p.assigneeName || '-' }}</td>
                <td>{{ p.requestedAt || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <UiButton variant="secondary" size="sm" @click="pasteModalOpen = false">취소</UiButton>
          <UiButton variant="primary" size="sm" :loading="pasteLoading" :disabled="pasteValidCount === 0" @click="doPasteSubmit">
            {{ pasteValidCount }}건 추가/갱신
          </UiButton>
        </div>
      </template>
    </UiModal>

    <!-- 이슈 생성 Drawer -->
    <UiDrawer v-model:open="createDrawerOpen" title="이슈 추가" width="420px" max-width="600px">
      <form class="drawer-form" @submit.prevent="onCreateIssue">
        <UiInput v-model="createForm.title" label="제목" placeholder="이슈 제목" />
        <UiInput v-model="createForm.externalId" label="관리번호" placeholder="미입력 시 자동 채번" />
        <UiSelect v-model="createForm.module" label="모듈" :options="moduleSelectOptions" />
        <UiSelect v-model="createForm.category" label="구분" :options="[{ label: '오류', value: 'bug' }, { label: '개선', value: 'improvement' }, { label: '확인', value: 'question' }]" />
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
    <UiDrawer v-model:open="panelOpen" :title="panelIssue ? `#${panelIssue.externalId || panelIssue.id} ${panelIssue.title}` : '이슈 상세'" width="480px" max-width="700px" :confirm-before-close="false">
      <div v-if="panelIssue" class="panel-detail">
        <!-- 속성 테이블 -->
        <div class="panel-props">
          <div class="panel-prop">
            <span class="panel-prop-label">상태</span>
            <UiDropdownMenu :items="statusMenuItems" @select="(val: string) => onInlineChange(panelIssue, 'status', val)">
              <template #trigger>
                <button class="cell-badge-btn">
                  <UiBadge :variant="panelIssue.status === 'done' ? 'success' : panelIssue.status === 'confirm' ? 'warning' : panelIssue.status === 'doing' ? 'primary' : 'default'" size="sm">
                    {{ panelIssue.status === 'done' ? '완료' : panelIssue.status === 'confirm' ? '컨펌중' : panelIssue.status === 'doing' ? '진행중' : '할 일' }}
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
            <span class="panel-prop-label">관리번호</span>
            <span
              v-if="!panelEditingExtId"
              class="panel-prop-value panel-prop-clickable"
              @click="panelEditingExtId = true; panelExtIdText = panelIssue.externalId || ''"
            >{{ panelIssue.externalId ? '#' + panelIssue.externalId : '없음' }}</span>
            <div v-else style="display:flex;gap:4px;align-items:center;">
              <input
                v-model="panelExtIdText"
                class="issue-title-input"
                placeholder="예: 2146"
                style="width:80px;"
                @keydown.enter="saveExtId"
                @keydown.escape="panelEditingExtId = false"
                @vue:mounted="($event: any) => $event.el.focus()"
              />
              <button class="issue-title-save" @mousedown.prevent="saveExtId">✓</button>
              <button class="issue-title-cancel" @mousedown.prevent="panelEditingExtId = false">✕</button>
            </div>
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

        <!-- 첨부파일 -->
        <div class="panel-files">
          <div class="panel-files__header">
            <span class="panel-files__label"><UiIcon name="paperclip" :size="16" /> 첨부파일 ({{ panelFiles.length }})</span>
            <UiFileUpload :loading="issueFileUploading" @upload="onIssueFileSelect" />
          </div>
          <UiFileList v-if="panelFiles.length" :files="panelFiles" :get-url="getIssueFileUrl" @delete="deleteIssueFile" />
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
.header-actions { display: flex; align-items: center; gap: 8px; }
.header-title { font-size: 18px; font-weight: 700; }
.tab-content { margin-top: 16px; }

.settings-section { padding: 4px 0; }
.settings-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.settings-label { font-size: 14px; font-weight: 600; color: #374151; margin: 0; }
.settings-desc { font-size: 13px; color: #6b7280; }
.settings-divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }

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
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.search-input {
  max-width: 300px;
}
.filter-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: none;
  color: #6b7280;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover { background: #f3f4f6; color: #374151; }
  &.is-active { color: #4f6af6; border-color: #4f6af6; }
}
.filter-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
}
.filter-count-inline {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
  margin-left: auto;
}
@media (max-width: 640px) {
  .search-input { max-width: 100%; flex: 1; }
}
.filter-module {
  width: 110px;
  min-width: 110px;
  max-width: 110px;
}
.filter-assignee {
  width: 100px;
  min-width: 100px;
  max-width: 100px;
  flex-shrink: 0;
  flex-grow: 0;
}
.filter-status {
  width: 130px;
  min-width: 130px;
  max-width: 130px;
}
.filter-date-range {
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.filter-count {
  font-size: 13px;
  color: #9ca3af;
  margin-left: auto;
}

// ── 이슈 테이블 ──
// 담당자 컬럼 헤더 필터
.th-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.th-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: none;
  color: #9ca3af;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: #4b5563;
    background: #f3f4f6;
  }
  &.is-active {
    color: var(--color-primary, #3b82f6);
  }
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
// 테이블 스타일 오버라이드
:deep(.ui-table thead th) {
  background: #f8f9fa !important;
  font-size: 12px;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb !important;
}
:deep(.ui-table tbody td) {
  height: auto !important;
  padding: 4px 12px !important;
}
:deep(.ui-table tbody tr) {
  &:hover { background: #f9fafb; }
}
// 완료 행 톤다운
:deep(.ui-table tbody tr):has(td .ui-badge--success) {
  opacity: 0.55;
  &:hover { opacity: 0.8; }
}
.issue-new-badge {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: #ef4444;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1.2;
}
.cell-date-text {
  font-size: 13px;
  color: #6b7280;
}
.cell-elapsed {
  font-size: 13px;
  color: #6b7280;
  &--overdue {
    color: #ef4444;
    font-weight: 600;
  }
}
.stale-confirm-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}
.stale-confirm-text { flex: 1; }
.stale-confirm-toggle {
  border: none;
  background: none;
  color: #4f6af6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  &:hover { text-decoration: underline; }
}

.issue-external-id {
  font-size: 12px;
  color: #4f6af6;
  font-weight: 600;
  &--link {
    text-decoration: none;
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }
  &--empty { color: #d1d5db; font-weight: 400; }
}
.panel-files__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.panel-files__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.panel-prop-clickable {
  cursor: pointer;
  &:hover { color: #4f6af6; }
}
.issue-category-badge {
  flex-shrink: 0;
}
.issue-title-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
// 외부 링크가 걸린 제목 — 새 탭으로 이동
.issue-title--link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
.issue-comment-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  color: #6b7280;
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

// 멤버 추가 모달: Select 드롭다운이 잘리지 않도록
:deep(.ui-modal-content) { overflow: visible; }
.create-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

// ── 개요 ──
.detail-tabs { margin-bottom: 4px; }
.overview-desc { font-size: 15px; line-height: 1.7; color: #4b5563; }

// 개요 헤더: 월 네비게이터(좌) + 컨펌중 일괄 열기(우)
.overview-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px; margin: 8px 0 4px;
}
.overview-month-nav { display: flex; align-items: center; gap: 4px; }
.overview-month-label {
  min-width: 96px; text-align: center; font-size: 15px; font-weight: 600; color: #1f2937;
}

// 시트 일괄 열기 모달 — 담당자별 그룹
.sheet-modal-desc { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
.sheet-group-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.sheet-group-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
}
.sheet-group-info { flex: 1; display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.sheet-group-name { font-size: 14px; font-weight: 600; color: #1f2937; }
.sheet-group-count { font-size: 13px; color: #6b7280; }

// 개요 상단: 도넛 차트 + 진행률 (2단)
.overview-top {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; margin-top: 8px;
}
.overview-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;
}
.overview-card-title { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px; }
.overview-chart-wrap { height: 200px; }
// UiChart 내부 기본 min-height(260px) 해제 → 카드 안에 맞게 축소
.overview-chart-wrap :deep(.ui-chart-canvas-wrap) { min-height: 0; }
.overview-progress-card { display: flex; flex-direction: column; }
.overview-progress-body {
  flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px;
}
.progress-percent {
  font-size: 32px; font-weight: 700; color: #22c55e; line-height: 1;
}
.progress-percent-unit { font-size: 18px; font-weight: 600; margin-left: 2px; }
.overview-progress-card .progress-bar { height: 12px; margin-top: 0; }
.overview-progress-sub { margin-top: 0; font-size: 13px; color: #6b7280; }

@media (max-width: 640px) {
  .overview-top { grid-template-columns: 1fr; }
  .overview-stats { grid-template-columns: repeat(2, 1fr); }
}
.overview-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px;
}
.stat-card {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 16px; text-align: center; border-top: 3px solid #d1d5db;
  &--todo { border-top-color: #6b7280; }
  &--doing { border-top-color: #3b82f6; }
  &--confirm { border-top-color: #f59e0b; }
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

// 엑셀 붙여넣기 버튼 (FAB 위에 배치)
.fab-paste {
  position: fixed;
  bottom: 140px;
  right: 24px;
  z-index: 50;
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: #fff;
  color: #4f6af6;
  border: 1px solid #4f6af6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.2);
  transition: background 0.15s, box-shadow 0.2s;
  &:hover { background: #f5f7ff; box-shadow: 0 6px 16px rgba(79, 106, 246, 0.3); }
}

// 엑셀 붙여넣기 모달
.paste-desc { font-size: 13px; color: #6b7280; margin: 0 0 10px; line-height: 1.5; }
.paste-cols { font-size: 12px; color: #9ca3af; }
.paste-preview { margin-top: 14px; }
.paste-preview-head { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; }
.paste-ignored { color: #9ca3af; font-weight: 400; }
.paste-table-wrap { max-height: 320px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
.paste-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
  th { background: #f9fafb; color: #6b7280; font-weight: 600; position: sticky; top: 0; }
  .td-title { white-space: normal; max-width: 280px; color: #1f2937; }
  .row-invalid { opacity: 0.5; }
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
  .fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
  .fab-paste { bottom: 124px; right: 16px; }
}
</style>

