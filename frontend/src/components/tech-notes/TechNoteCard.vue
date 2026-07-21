<template>
  <div class="tech-note-card" @click="$emit('click')">
    <div class="tech-note-card__category">
      <UiBadge variant="info" size="sm">{{ categoryLabel }}</UiBadge>
      <!-- 남의 공개 노트면 작성자명, 내가 공개한 노트면 '공유중' -->
      <UiBadge v-if="!isMine" variant="warning" size="sm">{{ authorName }}</UiBadge>
      <UiBadge v-else-if="note.isPublic" variant="success" size="sm">공유중</UiBadge>
    </div>
    <h3 class="tech-note-card__title">{{ note.title }}</h3>
    <p class="tech-note-card__summary">{{ note.summary }}</p>
    <div class="tech-note-card__tags">
      <UiBadge
        v-for="tag in note.tags"
        :key="tag"
        variant="default"
        size="sm"
      >{{ tag }}</UiBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../../stores/auth'
import { CATEGORIES } from './types'
import type { TechNote } from './types'

const props = defineProps<{ note: TechNote }>()
defineEmits<{ click: [] }>()

const auth = useAuthStore()

// 내 노트 여부 — 남의 공개 노트는 작성자를 표시한다
const isMine = computed(() => auth.user?.id === props.note.userId)
const authorName = computed(() => props.note.user?.name ?? '공유 노트')

const categoryLabel = computed(() => {
  const cat = CATEGORIES.find(c => c.value === props.note.category)
  return cat ? cat.label : props.note.category
})
</script>

<style scoped lang="scss">
.tech-note-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  &__category {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #1a1f2b;
    margin-bottom: 6px;
  }

  &__summary {
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
