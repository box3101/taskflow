<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiInput, UiIcon, UiLoading, UiEmpty, UiBadge, UiBadgeGroup, openToast, openConfirm } from '@leechanyong/ispark-ui'
import MemoCard from '../components/memo/MemoCard.vue'
import MemoForm from '../components/memo/MemoForm.vue'
import { useMemo, type MemoEntry } from '../composables/useMemo'

const { memos, loading, fetchMemos, addMemo, updateMemo, togglePin, deleteMemo } = useMemo()

const searchQuery = ref('')
const activeFilter = ref('all')

const colorCategories = [
  { key: 'all', label: '전체', color: '' },
  { key: 'yellow', label: '메모/명령어', color: '#f59e0b' },
  { key: 'green', label: '계정/정보', color: '#22c55e' },
  { key: 'pink', label: 'AI 사용법', color: '#ec4899' },
  { key: 'blue', label: '주식', color: '#3b82f6' },
  { key: 'purple', label: '기타', color: '#8b5cf6' },
]

const filteredMemos = computed(() => {
  if (activeFilter.value === 'all') return memos.value
  return memos.value.filter(m => m.color === activeFilter.value)
})
const formOpen = ref(false)
const editingMemo = ref<MemoEntry | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  fetchMemos().catch(() => {})
})

// 검색 debounce
function onSearch(val: string) {
  searchQuery.value = val
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchMemos(val || undefined).catch(() => {})
  }, 300)
}

function openNew() {
  editingMemo.value = null
  formOpen.value = true
}

function openEdit(memo: MemoEntry) {
  editingMemo.value = memo
  formOpen.value = true
}

async function handleSaved(memo: MemoEntry) {
  try {
    if (editingMemo.value?.id) {
      await updateMemo(editingMemo.value.id, {
        title: memo.title,
        content: memo.content,
        color: memo.color,
      })
      openToast({ message: '메모가 수정되었습니다.', type: 'success' })
    } else {
      await addMemo({ title: memo.title, content: memo.content, color: memo.color })
      openToast({ message: '메모가 추가되었습니다.', type: 'success' })
    }
    formOpen.value = false
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}

async function handlePin(id: string) {
  try {
    await togglePin(id)
  } catch {
    openToast({ message: '핀 변경에 실패했습니다.', type: 'error' })
  }
}

async function handleDelete(id: string) {
  const ok = await openConfirm({
    title: '메모 삭제',
    message: '이 메모를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!ok) return
  try {
    await deleteMemo(id)
    formOpen.value = false
    openToast({ message: '메모가 삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}
</script>

<template>
  <div class="memos-view">
    <!-- 헤더 -->
    <div class="memos-view__header">
      <h1 class="memos-view__title">메모</h1>
    </div>

    <!-- 검색 -->
    <div class="memos-view__search">
      <UiInput
        :model-value="searchQuery"
        placeholder="메모 검색..."
        @update:model-value="onSearch"
      >
        <template #prefix>
          <UiIcon name="search" :size="16" />
        </template>
      </UiInput>
    </div>

    <!-- 카테고리 필터 -->
    <UiBadgeGroup :gap="6" class="memos-view__filters">
      <UiBadge
        v-for="c in colorCategories"
        :key="c.key"
        :color-hex="c.color || undefined"
        :variant="c.key === 'all' ? 'default' : undefined"
        size="sm"
        class="memo-filter"
        :class="{ 'memo-filter--active': activeFilter === c.key }"
        @click="activeFilter = c.key"
      >
        {{ c.label }}
      </UiBadge>
    </UiBadgeGroup>

    <!-- 로딩 -->
    <UiLoading v-if="loading" />

    <!-- 빈 상태 -->
    <UiEmpty
      v-else-if="filteredMemos.length === 0"
      :title="activeFilter !== 'all' ? '해당 카테고리의 메모가 없습니다' : searchQuery ? '검색 결과가 없습니다' : '메모가 없습니다'"
      :description="activeFilter !== 'all' ? '다른 카테고리를 선택해보세요.' : searchQuery ? '다른 키워드로 검색해보세요.' : '새 메모를 추가해보세요!'"
    />

    <!-- 메모 그리드 -->
    <div v-else class="memos-view__grid">
      <MemoCard
        v-for="memo in filteredMemos"
        :key="memo.id"
        :memo="memo"
        @edit="openEdit"
        @pin="handlePin"
        @delete="handleDelete"
      />
    </div>

    <!-- FAB 버튼 -->
    <button class="fab" @click="openNew" aria-label="새 메모">
      <UiIcon name="plus" :size="24" />
    </button>

    <!-- 메모 폼 -->
    <MemoForm
      :open="formOpen"
      :memo="editingMemo"
      @update:open="formOpen = $event"
      @saved="handleSaved"
      @deleted="handleDelete"
    />
  </div>
</template>

<style scoped lang="scss">
.memos-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.memos-view__title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1f2b;
  margin: 0;
}

.memos-view__search {
  margin-bottom: 12px;
  max-width: 400px;
}

.memos-view__filters {
  margin-bottom: 16px;
}

.memo-filter {
  cursor: pointer;
  transition: opacity 0.15s;
  &:not(.memo-filter--active) { opacity: 0.4; }
  &:hover { opacity: 0.8; }
}

.memos-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .memos-view__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .memos-view__search {
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .memos-view__grid {
    grid-template-columns: 1fr;
  }
}

.fab {
  position: fixed;
  right: 24px;
  bottom: 80px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #4f6af6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 106, 246, 0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 50;

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(79, 106, 246, 0.5);
  }

  &:active {
    transform: scale(0.95);
  }
}

:global([data-theme="dark"]) {
  .memos-view__title {
    color: #f3f4f6;
  }
}
</style>
