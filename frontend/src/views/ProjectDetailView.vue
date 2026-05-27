<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiTab, UiTable, UiBadge, UiLoading, UiEmpty, UiButton, UiModal, UiInput, UiSelect, UiTextarea, UiToast, UiConfirm, openToast, openConfirm } from '@leechanyong/ispark-ui'
import type { TabItem, SelectOption, TableColumn } from '@leechanyong/ispark-ui'
import api from '../api/client'

const route = useRoute()
const router = useRouter()
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
const statusOptions: SelectOption[] = [
  { label: '할 일', value: 'todo' },
  { label: '진행중', value: 'doing' },
  { label: '완료', value: 'done' },
]
const priorityOptions: SelectOption[] = [
  { label: '높음', value: 'high' },
  { label: '보통', value: 'mid' },
  { label: '낮음', value: 'low' },
]
const memberOptions = computed<SelectOption[]>(() => [
  { label: '미배정', value: '' },
  ...members.value.map(m => ({ label: m.user.name, value: String(m.user.id) })),
])

// ── 필터 ──
const filterStatus = ref('')
const filterPriority = ref('')
const filterStatusOptions: SelectOption[] = [
  { label: '전체', value: '' },
  ...statusOptions,
]
const filterPriorityOptions: SelectOption[] = [
  { label: '전체', value: '' },
  ...priorityOptions,
]

const filteredIssues = computed(() => {
  return issues.value.filter(i => {
    if (filterStatus.value && i.status !== filterStatus.value) return false
    if (filterPriority.value && i.priority !== filterPriority.value) return false
    return true
  })
})

// ── 이슈 테이블 ──
const issueColumns: TableColumn[] = [
  { key: 'title', label: '제목', align: 'left' },
  { key: 'status', label: '상태', width: '110px', align: 'center' },
  { key: 'priority', label: '우선순위', width: '110px', align: 'center' },
  { key: 'assignee', label: '담당자', width: '130px', align: 'center' },
]

const priorityMap: Record<string, { label: string }> = {
  high: { label: '높음' },
  mid: { label: '보통' },
  low: { label: '낮음' },
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

// ── 사이드 패널 ──
const panelOpen = ref(false)
const panelIssue = ref<any>(null)
const panelForm = ref({ title: '', description: '', status: 'todo', priority: 'mid', assigneeId: '' })
const panelSaving = ref(false)
const panelDeleting = ref(false)

function openPanel(issue: any) {
  panelIssue.value = issue
  panelForm.value = {
    title: issue.title,
    description: issue.description || '',
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assigneeId ? String(issue.assigneeId) : '',
  }
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
  panelIssue.value = null
}

async function onPanelSave() {
  if (!panelIssue.value || !panelForm.value.title.trim()) return
  panelSaving.value = true
  try {
    const { data } = await api.put(`/issues/${panelIssue.value.id}`, {
      title: panelForm.value.title,
      description: panelForm.value.description || null,
      status: panelForm.value.status,
      priority: panelForm.value.priority,
      assigneeId: panelForm.value.assigneeId ? Number(panelForm.value.assigneeId) : null,
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
const isCreating = ref(false)
const createForm = ref({ title: '', priority: 'mid', assigneeId: '' })
const creatingLoading = ref(false)

function startCreate() {
  createForm.value = { title: '', priority: 'mid', assigneeId: '' }
  isCreating.value = true
  panelOpen.value = true
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
    isCreating.value = false
    panelOpen.value = false
  } finally {
    creatingLoading.value = false
  }
}

// 패널 닫을 때 생성 모드 해제
watch(panelOpen, (v) => {
  if (!v) isCreating.value = false
})

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
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <UiButton variant="ghost" size="sm" @click="router.push('/')">← 목록</UiButton>
        <h1 class="header-title">{{ project?.name || '...' }}</h1>
      </div>
      <UiButton v-if="!loading" variant="primary" size="sm" @click="startCreate">+ 이슈 추가</UiButton>
    </header>

    <div class="content-wrapper" :class="{ 'panel-open': panelOpen }">
      <main class="main">
        <UiLoading v-if="loading" />
        <template v-else>
          <UiTab v-model="activeTab" :tabs="tabs" />

          <!-- 이슈 탭 -->
          <div v-if="activeTab === 'board'" class="tab-content">
            <!-- 필터 바 -->
            <div class="filter-bar">
              <div class="filter-item">
                <span class="filter-label">상태</span>
                <UiSelect v-model="filterStatus" :options="filterStatusOptions" size="sm" />
              </div>
              <div class="filter-item">
                <span class="filter-label">우선순위</span>
                <UiSelect v-model="filterPriority" :options="filterPriorityOptions" size="sm" />
              </div>
              <span class="filter-count">{{ filteredIssues.length }}건</span>
            </div>

            <UiEmpty v-if="filteredIssues.length === 0" title="이슈가 없습니다." />
            <UiTable
              v-else
              :columns="issueColumns"
              :data="(filteredIssues as any)"
              size="sm"
            >
              <template #cell-title="{ row }">
                <span class="issue-title" @click="openPanel(row)">{{ row.title }}</span>
              </template>
              <template #cell-status="{ row }">
                <div @click.stop>
                  <UiSelect
                    :model-value="row.status"
                    :options="statusOptions"
                    size="sm"
                    @change="(val: string | number) => onInlineChange(row, 'status', val)"
                  />
                </div>
              </template>
              <template #cell-priority="{ row }">
                <div @click.stop>
                  <UiSelect
                    :model-value="row.priority"
                    :options="priorityOptions"
                    size="sm"
                    @change="(val: string | number) => onInlineChange(row, 'priority', val)"
                  />
                </div>
              </template>
              <template #cell-assignee="{ row }">
                <div @click.stop>
                  <UiSelect
                    :model-value="row.assigneeId ? String(row.assigneeId) : ''"
                    :options="memberOptions"
                    size="sm"
                    @change="(val: string | number) => onInlineChange(row, 'assigneeId', val)"
                  />
                </div>
              </template>
            </UiTable>
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
      </main>

      <!-- 사이드 패널 -->
      <Transition name="slide">
        <aside v-if="panelOpen" class="side-panel">
          <!-- 생성 모드 -->
          <template v-if="isCreating">
            <div class="panel-header">
              <h3>이슈 추가</h3>
              <button class="panel-close" @click="closePanel">&times;</button>
            </div>
            <form class="panel-body" @submit.prevent="onCreateIssue">
              <UiInput v-model="createForm.title" label="제목" placeholder="이슈 제목" />
              <UiSelect v-model="createForm.priority" label="우선순위" :options="priorityOptions" />
              <UiSelect v-model="createForm.assigneeId" label="담당자" :options="memberOptions" />
              <div class="panel-actions">
                <UiButton variant="ghost" size="md" @click="closePanel">취소</UiButton>
                <UiButton variant="primary" size="md" type="submit" :loading="creatingLoading">추가</UiButton>
              </div>
            </form>
          </template>

          <!-- 상세/편집 모드 -->
          <template v-else-if="panelIssue">
            <div class="panel-header">
              <h3>이슈 상세</h3>
              <button class="panel-close" @click="closePanel">&times;</button>
            </div>
            <form class="panel-body" @submit.prevent="onPanelSave">
              <UiInput v-model="panelForm.title" label="제목" placeholder="이슈 제목" />
              <div class="panel-row">
                <UiSelect v-model="panelForm.status" label="상태" :options="statusOptions" />
                <UiSelect v-model="panelForm.priority" label="우선순위" :options="priorityOptions" />
              </div>
              <UiSelect v-model="panelForm.assigneeId" label="담당자" :options="memberOptions" />
              <UiTextarea v-model="panelForm.description" label="설명" placeholder="이슈에 대한 메모를 작성하세요..." :rows="5" />
              <div class="panel-actions">
                <UiButton variant="danger" size="sm" :loading="panelDeleting" @click.prevent="onPanelDelete">삭제</UiButton>
                <div class="panel-actions-right">
                  <UiButton variant="ghost" size="md" @click.prevent="closePanel">취소</UiButton>
                  <UiButton variant="primary" size="md" type="submit" :loading="panelSaving">저장</UiButton>
                </div>
              </div>
            </form>
          </template>
        </aside>
      </Transition>
    </div>

    <!-- 오버레이 (패널 외부 클릭으로 닫기) -->
    <div v-if="panelOpen" class="panel-overlay" @click="closePanel" />

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
.layout { min-height: 100vh; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px; background: #fff; border-bottom: 1px solid #e6e8ec;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-title { font-size: 18px; font-weight: 700; }

// 컨텐츠 + 사이드 패널 레이아웃
.content-wrapper {
  display: flex;
  transition: all 0.3s ease;
}
.main {
  flex: 1;
  min-width: 0;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  transition: max-width 0.3s ease;
  .panel-open & {
    max-width: 100%;
    padding-right: 16px;
  }
}
.tab-content { margin-top: 24px; }

// ── 필터 바 ──
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 8px 0;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 160px;
}
.filter-label {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
}
.filter-count {
  font-size: 13px;
  color: #9ca3af;
  margin-left: auto;
}

// ── 이슈 테이블 ──
.issue-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  word-break: break-word;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  &:hover { background: #eff6ff; color: #2563eb; }
}

// ── 사이드 패널 ──
.side-panel {
  width: 420px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  height: calc(100vh - 56px);
  position: sticky;
  top: 56px;
  overflow-y: auto;
  z-index: 10;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f0f1f3;
  h3 { font-size: 16px; font-weight: 700; }
}
.panel-close {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; background: none;
  border-radius: 6px; cursor: pointer; font-size: 20px; color: #9ca3af;
  &:hover { background: #f3f4f6; color: #374151; }
}
.panel-body {
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.panel-row {
  display: flex; gap: 12px;
  > * { flex: 1; }
}
.panel-actions {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 16px; border-top: 1px solid #e5e7eb; margin-top: 8px;
}
.panel-actions-right { display: flex; gap: 8px; }

.panel-overlay {
  display: none;
}

// 슬라이드 애니메이션
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
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
</style>
