<template>
  <div class="tech-note-tab">
    <UiLoading v-if="loading" overlay />
    <template v-else>
      <!-- 상단 바: 카테고리 필터 + 검색 + 추가 -->
      <div class="tech-note-tab__header">
        <div class="tech-note-tab__filters">
          <div class="filter-chips">
            <button
              class="filter-chip"
              :class="{ active: !selectedCategory }"
              @click="selectedCategory = ''"
            >전체</button>
            <button
              v-for="cat in CATEGORIES"
              :key="cat.value"
              class="filter-chip"
              :class="{ active: selectedCategory === cat.value }"
              @click="selectedCategory = selectedCategory === cat.value ? '' : cat.value"
            >{{ cat.label }}</button>
          </div>
        </div>
        <div class="tech-note-tab__actions">
          <UiInput
            v-model="searchQuery"
            placeholder="검색..."
            size="sm"
            class="tech-note-tab__search"
          />
        </div>
      </div>

      <!-- 카드 그리드 -->
      <div v-if="filteredNotes.length" class="tech-note-tab__grid">
        <TechNoteCard
          v-for="note in filteredNotes"
          :key="note.id"
          :note="note"
          @click="openDetail(note)"
        />
      </div>
      <UiEmpty v-else message="등록된 기술 노트가 없습니다." />
    </template>

    <!-- FAB: 추가 버튼 -->
    <button class="fab" aria-label="노트 추가" @click="openCreate">
      <UiIcon name="plus" :size="22" />
    </button>

    <!-- Drawer -->
    <TechNoteDrawer
      :open="drawerOpen"
      :note="selectedNote"
      :saving="saving"
      @close="closeDrawer"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiIcon, UiInput, UiEmpty, UiLoading, openToast, openConfirm } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import { useCachedFetch } from '../../composables/useCachedFetch'
import TechNoteCard from './TechNoteCard.vue'
import TechNoteDrawer from './TechNoteDrawer.vue'
import type { TechNote } from './types'
import { CATEGORIES } from './types'

const searchQuery = ref('')
const selectedCategory = ref('')
// 캐시: 재진입 시 이전 노트 목록 즉시 표시 → 백그라운드 갱신
const { data: notes, loading, load: loadNotes } = useCachedFetch<TechNote[]>(
  'tech-notes',
  async () => {
    const params: Record<string, string> = {}
    if (selectedCategory.value) params.category = selectedCategory.value
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    return (await api.get('/tech-notes', { params })).data.data
  },
  [],
  () => openToast({ message: '노트 목록을 불러오지 못했습니다.', type: 'error' }),
)
const drawerOpen = ref(false)
const selectedNote = ref<TechNote | null>(null)
const saving = ref(false)

// 필터링된 목록
const filteredNotes = computed(() => {
  let result = notes.value
  if (selectedCategory.value) {
    result = result.filter(n => n.category === selectedCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q)
    )
  }
  return result
})

function openCreate() {
  selectedNote.value = null
  drawerOpen.value = true
}

function openDetail(note: TechNote) {
  selectedNote.value = note
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  selectedNote.value = null
}

async function handleSave(data: Partial<TechNote>) {
  saving.value = true
  try {
    if (data.id) {
      await api.patch(`/tech-notes/${data.id}`, data)
      openToast({ message: '수정되었습니다.', type: 'success' })
    } else {
      await api.post('/tech-notes', data)
      openToast({ message: '추가되었습니다.', type: 'success' })
    }
    closeDrawer()
    await loadNotes()
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  const confirmed = await openConfirm({
    title: '삭제 확인',
    message: '이 노트를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!confirmed) return

  try {
    await api.delete(`/tech-notes/${id}`)
    openToast({ message: '삭제되었습니다.', type: 'success' })
    closeDrawer()
    await loadNotes()
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

onMounted(loadNotes)
</script>

<style scoped lang="scss">
.tech-note-tab {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 24px;
  }

  &__filters {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;

    @media (max-width: 640px) {
      width: 100%;

      .ui-input {
        flex: 1;
      }
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  }
}

.tech-note-tab__search {
  width: 200px;

  @media (max-width: 640px) {
    width: 100%;
  }
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

  @media (max-width: 640px) {
    bottom: 68px;
    right: 16px;
    width: 48px;
    height: 48px;
  }
}

.filter-chip {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  &.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}
</style>
