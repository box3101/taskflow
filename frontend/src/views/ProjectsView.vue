<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiTable, UiBadge, UiLoading, UiEmpty, UiDropdownMenu } from '@leechanyong/ispark-ui'
import type { DropdownMenuItemDef } from '@leechanyong/ispark-ui'
import type { TableColumn } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'
import api from '../api/client'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const projects = ref<any[]>([])

const columns: TableColumn[] = [
  { key: 'name', label: '프로젝트명', align: 'left' },
  { key: 'status', label: '상태', width: '100px' },
  { key: '_count.members', label: '멤버', width: '80px', align: 'center' },
  { key: '_count.issues', label: '이슈', width: '80px', align: 'center' },
]

onMounted(async () => {
  try {
    const { data } = await api.get('/projects')
    projects.value = data.data
  } finally {
    loading.value = false
  }
})

function onRowClick(row: any) {
  router.push(`/projects/${row.id}`)
}

const userMenuItems: DropdownMenuItemDef[] = [
  { value: 'logout', label: '로그아웃', icon: 'icon-arrow-right', color: 'danger' },
]

function onUserMenuSelect(value: string) {
  if (value === 'logout') {
    auth.logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1 class="header-title">TaskFlow</h1>
      <div class="header-right">
        <UiDropdownMenu
          :items="userMenuItems"
          :title="auth.user?.name"
          align="end"
          @select="onUserMenuSelect"
        >
          <template #trigger>
            <button class="user-avatar-btn">
              <span class="user-avatar">{{ auth.user?.name?.charAt(0) }}</span>
            </button>
          </template>
        </UiDropdownMenu>
      </div>
    </header>

    <main class="main">
      <div class="page-top">
        <h2>프로젝트</h2>
      </div>

      <UiLoading v-if="loading" />
      <UiEmpty v-else-if="projects.length === 0" title="프로젝트가 없습니다." />
      <UiTable
        v-else
        :columns="columns"
        :data="projects"
        clickable
        @row-click="onRowClick"
      >
        <template #cell-status="{ row }">
          <UiBadge
            :variant="row.status === 'active' ? 'success' : row.status === 'done' ? 'primary' : 'default'"
            size="sm"
          >{{ row.status === 'active' ? '진행중' : row.status === 'done' ? '완료' : '보류' }}</UiBadge>
        </template>
        <template #cell-_count.members="{ row }">
          {{ row._count?.members ?? 0 }}명
        </template>
        <template #cell-_count.issues="{ row }">
          {{ row._count?.issues ?? 0 }}건
        </template>
      </UiTable>
    </main>
  </div>
</template>

<style scoped lang="scss">

.layout {
  min-height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e6e8ec;
}
.header-title {
  font-size: 18px;
  font-weight: 700;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-avatar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.15s;
  &:hover {
    background: #f3f4f6;
  }
}
.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f6af6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.main {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}
.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  h2 {
    font-size: 22px;
    font-weight: 700;
  }
}
</style>
