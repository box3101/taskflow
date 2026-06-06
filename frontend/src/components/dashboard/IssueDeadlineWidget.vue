<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UiBadge, UiIcon } from '@leechanyong/ispark-ui'
import api from '../../api/client'

const router = useRouter()
const issues = ref<any[]>([])

onMounted(async () => {
  try {
    // 모든 프로젝트의 이슈 가져오기
    const projectRes = await api.get('/projects')
    const projects = projectRes.data.data || []
    const allIssues: any[] = []
    for (const p of projects) {
      const issueRes = await api.get(`/projects/${p.id}/issues`)
      const items = Array.isArray(issueRes.data) ? issueRes.data : (issueRes.data.data || [])
      items.forEach((i: any) => { i._projectId = p.id; i._projectName = p.name })
      allIssues.push(...items)
    }
    issues.value = allIssues
  } catch { /* ignore */ }
})

const deadlineIssues = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return issues.value
    .filter(i => i.dueAt && i.status !== 'done')
    .map(i => {
      const due = new Date(i.dueAt)
      due.setHours(0, 0, 0, 0)
      const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { ...i, dday: diff }
    })
    .filter(i => i.dday <= 7) // 7일 이내 + 지난 것
    .sort((a, b) => a.dday - b.dday)
    .slice(0, 5)
})

function ddayLabel(dday: number) {
  if (dday < 0) return `D+${Math.abs(dday)}`
  if (dday === 0) return 'D-day'
  return `D-${dday}`
}

function ddayVariant(dday: number): string {
  if (dday < 0) return 'danger'
  if (dday === 0) return 'warning'
  if (dday <= 3) return 'warning'
  return 'default'
}

function goToIssue(issue: any) {
  router.push(`/projects/${issue._projectId}`)
}
</script>

<template>
  <div class="issue-deadline-widget">
    <div class="widget-header">
      <strong><UiIcon name="alarm-clock" :size="16" /> 이슈 마감</strong>
    </div>
    <div v-if="deadlineIssues.length === 0" class="widget-empty">
      마감 임박 이슈가 없습니다 👍
    </div>
    <ul v-else class="widget-list">
      <li
        v-for="issue in deadlineIssues"
        :key="issue.id"
        class="widget-item"
        @click="goToIssue(issue)"
      >
        <div class="widget-item__top">
          <span class="widget-item__title">{{ issue.title }}</span>
          <UiBadge :variant="ddayVariant(issue.dday)" size="sm">{{ ddayLabel(issue.dday) }}</UiBadge>
        </div>
        <span class="widget-item__project">{{ issue._projectName }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.issue-deadline-widget {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  min-height: 160px;
}
.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  font-size: 15px;
}
.widget-empty {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 24px 0;
}
.widget-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.widget-item {
  cursor: pointer;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.1s;
  &:last-child { border-bottom: none; }
  &:hover { background: #f9fafb; margin: 0 -6px; padding: 6px; border-radius: 6px; }
}
.widget-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.widget-item__title {
  font-size: 13px;
  font-weight: 500;
  color: #1a1f2b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.widget-item__project {
  font-size: 11px;
  color: #9ca3af;
}

:global([data-theme="dark"]) {
  .issue-deadline-widget { background: #1f2937; }
  .widget-item__title { color: #f3f4f6; }
  .widget-item { border-bottom-color: #374151; }
  .widget-item:hover { background: #374151; }
}
</style>
