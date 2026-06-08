<template>
  <div class="ai-tool-card" @click="$emit('click')">
    <div class="ai-tool-card__icon">
      <UiIcon :name="tool.icon || 'wrench'" :size="24" color="primary" />
    </div>
    <h3 class="ai-tool-card__title">{{ tool.title }}</h3>
    <p class="ai-tool-card__desc">{{ tool.description }}</p>
    <div class="ai-tool-card__tags">
      <UiBadge
        v-for="tag in tool.tags"
        :key="tag"
        variant="info"
        size="sm"
      >{{ tag }}</UiBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiBadge, UiIcon } from '@leechanyong/ispark-ui'

export interface AiTool {
  id: number
  title: string
  description: string
  content: string
  tags: string[]
  icon: string | null
  author: { id: number; name: string; email: string }
  createdAt: string
  updatedAt: string
}

defineProps<{ tool: AiTool }>()
defineEmits<{ click: [] }>()
</script>

<style scoped lang="scss">
.ai-tool-card {
  background: #fafbfc;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(79, 106, 246, 0.08);
    margin-bottom: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #1a1f2b;
    margin-bottom: 6px;
  }

  &__desc {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 12px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
