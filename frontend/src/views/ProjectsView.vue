<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu, UiDrawer,
  UiIcon, UiInput, UiButton, UiSelect, UiTextarea,
  openToast, openConfirm,
} from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef, TableColumn, SelectOption } from '@leechanyong/ispark-ui'
import draggable from 'vuedraggable'
import api from '../api/client'

const router = useRouter()

// 프로젝트
const projectLoading = ref(true)
const projects = ref<any[]>([])
const projectColumns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center', hideBelow: 640 },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center', hideBelow: 640 },
  { key: 'actions', label: '', width: '48px', align: 'center' },
]

const projectActionItems: DropdownMenuItemDef[] = [
  { label: '수정', value: 'edit', icon: 'icon-edit' },
  { label: '삭제', value: 'delete', icon: 'icon-trashcan', color: 'danger' },
]

// 프로젝트 Drawer
const projectDrawerOpen = ref(false)
const projectDrawerMode = ref<'create' | 'edit'>('create')
const projectForm = ref({ name: '', description: '', status: 'active' })
const projectFormLoading = ref(false)
const editingProjectId = ref<number | null>(null)

const statusSelectOptions: SelectOption[] = [
  { label: '진행중', value: 'active' },
  { label: '보류', value: 'hold' },
  { label: '완료', value: 'done' },
]

function openCreateProject() {
  projectDrawerMode.value = 'create'
  projectForm.value = { name: '', description: '', status: 'active' }
  editingProjectId.value = null
  projectDrawerOpen.value = true
}

function openEditProject(project: any) {
  projectDrawerMode.value = 'edit'
  projectForm.value = {
    name: project.name,
    description: project.description || '',
    status: project.status,
  }
  editingProjectId.value = project.id
  projectDrawerOpen.value = true
}

async function onProjectSave() {
  if (!projectForm.value.name.trim()) return
  projectFormLoading.value = true
  try {
    if (projectDrawerMode.value === 'create') {
      const { data } = await api.post('/projects', projectForm.value)
      projects.value.unshift(data)
      openToast({ message: '프로젝트가 생성되었습니다.', type: 'success' })
    } else {
      const { data } = await api.put(`/projects/${editingProjectId.value}`, projectForm.value)
      const idx = projects.value.findIndex(p => p.id === editingProjectId.value)
      if (idx > -1) Object.assign(projects.value[idx], data)
      openToast({ message: '프로젝트가 수정되었습니다.', type: 'success' })
    }
    projectDrawerOpen.value = false
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  } finally {
    projectFormLoading.value = false
  }
}

async function onDeleteProject(project: any) {
  const confirmed = await openConfirm({
    title: '프로젝트 삭제',
    message: `<strong>${project.name}</strong>을(를) 삭제하시겠습니까?<br>모든 이슈와 멤버가 함께 삭제됩니다.`,
    confirmText: '삭제',
  })
  if (!confirmed) return
  try {
    await api.delete(`/projects/${project.id}`)
    projects.value = projects.value.filter(p => p.id !== project.id)
    openToast({ message: '프로젝트가 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

function onProjectAction(project: any, action: string) {
  if (action === 'edit') openEditProject(project)
  if (action === 'delete') onDeleteProject(project)
}

function onRowClick(row: any) {
  router.push(`/projects/${row.id}`)
}

async function onDragEnd() {
  const items = projects.value.map((p, i) => ({ id: p.id, order: i }))
  try {
    await api.put('/projects/reorder', { items })
  } catch {
    openToast({ message: '순서 저장에 실패했습니다.', type: 'error' })
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/projects')
    projects.value = data.data
  } finally {
    projectLoading.value = false
  }
})
</script>

<template>
  <div class="projects-page">
    <UiLoading v-if="projectLoading" overlay />
    <UiEmpty v-else-if="projects.length === 0" title="프로젝트가 없습니다." />
    <div v-else class="project-list">
      <div class="project-list__header">
        <span class="project-list__col project-list__col--name">프로젝트명</span>
        <span class="project-list__col project-list__col--status">상태</span>
        <span class="project-list__col project-list__col--count">멤버</span>
        <span class="project-list__col project-list__col--count">이슈</span>
        <span class="project-list__col project-list__col--action" />
      </div>
      <draggable
        v-model="projects"
        item-key="id"
        handle=".drag-handle"
        ghost-class="drag-ghost"
        @end="onDragEnd"
      >
        <template #item="{ element: row }">
          <div class="project-list__row" @click="onRowClick(row)">
            <span class="drag-handle" @click.stop>⠿</span>
            <span class="project-list__col project-list__col--name">{{ row.name }}</span>
            <span class="project-list__col project-list__col--status">
              <UiBadge
                :variant="row.status === 'active' ? 'success' : row.status === 'done' ? 'primary' : 'default'"
                size="sm"
              >{{ row.status === 'active' ? '진행중' : row.status === 'done' ? '완료' : '보류' }}</UiBadge>
            </span>
            <span class="project-list__col project-list__col--count">{{ row._count?.members ?? 0 }}명</span>
            <span class="project-list__col project-list__col--count">{{ row._count?.issues ?? 0 }}건</span>
            <span class="project-list__col project-list__col--action" @click.stop>
              <UiDropdownMenu
                :items="projectActionItems"
                @select="(val: string) => onProjectAction(row, val)"
              >
                <template #trigger>
                  <button class="project-action-btn">⋮</button>
                </template>
              </UiDropdownMenu>
            </span>
          </div>
        </template>
      </draggable>
    </div>

    <!-- FAB: 프로젝트 추가 -->
    <button class="fab" aria-label="프로젝트 추가" @click="openCreateProject">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- 프로젝트 추가/수정 Drawer -->
    <UiDrawer v-model:open="projectDrawerOpen" :title="projectDrawerMode === 'create' ? '프로젝트 추가' : '프로젝트 수정'">
      <form class="drawer-form" @submit.prevent="onProjectSave">
        <UiInput v-model="projectForm.name" label="프로젝트명" placeholder="프로젝트 이름을 입력하세요" />
        <UiTextarea v-model="projectForm.description" label="설명" placeholder="프로젝트 설명 (선택)" :rows="3" />
        <UiSelect v-model="projectForm.status" label="상태" :options="statusSelectOptions" />
      </form>
      <template #footer>
        <div class="drawer-footer">
          <UiButton variant="ghost" size="md" @click="projectDrawerOpen = false">취소</UiButton>
          <UiButton variant="primary" size="md" :loading="projectFormLoading" @click="onProjectSave">
            {{ projectDrawerMode === 'create' ? '추가' : '저장' }}
          </UiButton>
        </div>
      </template>
    </UiDrawer>
  </div>
</template>

<style scoped lang="scss">
.projects-page { position: relative; }

.project-list__header {
  display: flex;
  align-items: center;
  padding: 10px 16px 10px 44px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.project-list__row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f9fafb; }
}

.project-list__col--name { flex: 1; font-size: 14px; font-weight: 500; color: #1a1f2b; }
.project-list__col--status { width: 100px; text-align: center; }
.project-list__col--count { width: 80px; text-align: center; font-size: 13px; color: #6b7280; }
.project-list__col--action { width: 48px; text-align: center; }

.drag-handle {
  cursor: grab;
  color: #d1d5db;
  font-size: 16px;
  margin-right: 12px;
  user-select: none;
  &:hover { color: #9ca3af; }
  &:active { cursor: grabbing; }
}

.drag-ghost {
  opacity: 0.4;
  background: #eef2ff;
}

@media (max-width: 640px) {
  .project-list__col--count { display: none; }
  .project-list__header { padding-left: 36px; }
}

.fab {
  position: fixed; bottom: 76px; right: 24px; z-index: 50;
  width: 52px; height: 52px; border-radius: 50%;
  background: #4f6af6; color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 106, 246, 0.4);
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(79, 106, 246, 0.5); }
  &:active { transform: scale(0.95); }
}

.project-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none;
  border-radius: 6px; cursor: pointer; font-size: 18px; color: #9ca3af;
  letter-spacing: 1px;
  &:hover { background: #f3f4f6; color: #374151; }
}

.drawer-form { display: flex; flex-direction: column; gap: 16px; }
.drawer-footer {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}

@media (max-width: 640px) {
  .fab { bottom: 68px; right: 16px; width: 48px; height: 48px; }
}
</style>
