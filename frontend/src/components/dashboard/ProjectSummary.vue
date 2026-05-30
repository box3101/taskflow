<script setup lang="ts">
import { UiBadge, UiIcon, UiEmpty } from '@leechanyong/ispark-ui'

defineProps<{
  projects: any[]
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [project: any]
  navigateAll: []
}>()

function statusBadge(status: string) {
  switch (status) {
    case 'active': return { label: '진행중', variant: 'success' as const }
    case 'done': return { label: '완료', variant: 'info' as const }
    default: return { label: '보류', variant: 'warning' as const }
  }
}
</script>

<template>
  <div class="project-summary">
    <div class="project-summary__header">
      <span class="project-summary__title">프로젝트</span>
      <button class="project-summary__link" @click="emit('navigateAll')">
        전체보기
        <UiIcon name="arrow-right" :size="14" />
      </button>
    </div>

    <UiEmpty v-if="projects.length === 0" title="프로젝트가 없습니다." />

    <div v-else class="project-summary__list">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-summary__item"
        @click="emit('select', project)"
      >
        <div class="project-summary__info">
          <span class="project-summary__name">{{ project.name }}</span>
          <span class="project-summary__meta">
            <UiIcon name="circle-dot" :size="12" />
            {{ project._count?.issues ?? 0 }}개
            <UiIcon name="users" :size="12" style="margin-left: 6px;" />
            {{ project._count?.members ?? 0 }}명
          </span>
        </div>
        <UiBadge
          :variant="statusBadge(project.status).variant"
          size="xs"
        >
          {{ statusBadge(project.status).label }}
        </UiBadge>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-summary {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.project-summary__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.project-summary__title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.project-summary__link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #3c69db;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

.project-summary__list {
  display: flex;
  flex-direction: column;
}

.project-summary__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #fafbfc;
    margin: 0 -16px;
    padding: 10px 16px;
  }
}

.project-summary__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-summary__name {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.project-summary__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
