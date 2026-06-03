<script setup lang="ts">
import { computed } from 'vue'
import { UiIcon } from '@leechanyong/ispark-ui'
import { MEMO_COLORS, type MemoEntry } from '../../composables/useMemo'

const props = defineProps<{
  memo: MemoEntry
}>()

const emit = defineEmits<{
  edit: [memo: MemoEntry]
  pin: [id: string]
  delete: [id: string]
}>()

const bgColor = computed(() => {
  const c = MEMO_COLORS.find(c => c.value === props.memo.color)
  return c?.bg || '#fef9c3'
})

// 날짜 포맷 (6/3 화)
function formatDate(iso: string) {
  const d = new Date(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} ${days[d.getDay()]}`
}
</script>

<template>
  <div
    class="memo-card"
    :style="{ background: bgColor }"
    @click="emit('edit', memo)"
  >
    <!-- 상단: 핀 + 삭제 -->
    <div class="memo-card__actions">
      <button
        class="memo-card__pin"
        :class="{ 'memo-card__pin--active': memo.pinned }"
        @click.stop="emit('pin', memo.id)"
        title="고정"
      >
        <UiIcon name="pin" :size="14" />
      </button>
      <button
        class="memo-card__delete"
        @click.stop="emit('delete', memo.id)"
        title="삭제"
      >
        <UiIcon name="trash-2" :size="14" />
      </button>
    </div>

    <!-- 제목 -->
    <h3 class="memo-card__title">{{ memo.title }}</h3>

    <!-- 내용 미리보기 -->
    <p v-if="memo.content" class="memo-card__content">{{ memo.content }}</p>

    <!-- 날짜 -->
    <span class="memo-card__date">{{ formatDate(memo.updatedAt) }}</span>
  </div>
</template>

<style scoped lang="scss">
.memo-card {
  position: relative;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.memo-card__actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.memo-card__pin,
.memo-card__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #374151;
  }
}

.memo-card__pin--active {
  color: #4f6af6;
  background: rgba(79, 106, 246, 0.15);
}

.memo-card__delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.memo-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1f2b;
  margin: 0 0 6px;
  word-break: break-word;
}

.memo-card__content {
  font-size: 13px;
  color: #4b5563;
  margin: 0;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.memo-card__date {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 10px;
}
</style>
