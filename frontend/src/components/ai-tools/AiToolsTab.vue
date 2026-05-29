<template>
  <div class="ai-tools-tab">
    <UiLoading v-if="loading" overlay />
    <template v-else>
      <!-- 상단 바: 카테고리 세그먼트 + 기능 칩 + 검색 + 추가 -->
      <div class="ai-tools-tab__header">
        <div class="ai-tools-tab__filters">
          <!-- 카테고리 세그먼트 -->
          <div class="segment">
            <button
              class="segment__btn"
              :class="{ active: !selectedCategory }"
              @click="selectedCategory = ''"
            >전체</button>
            <button
              class="segment__btn"
              :class="{ active: selectedCategory === 'superpowers' }"
              @click="selectedCategory = selectedCategory === 'superpowers' ? '' : 'superpowers'"
            >⚡ Superpowers</button>
            <button
              class="segment__btn"
              :class="{ active: selectedCategory === 'gstack' }"
              @click="selectedCategory = selectedCategory === 'gstack' ? '' : 'gstack'"
            >🛠️ gstack</button>
            <button
              class="segment__btn"
              :class="{ active: selectedCategory === 'codex' }"
              @click="selectedCategory = selectedCategory === 'codex' ? '' : 'codex'"
            >🤖 Codex</button>
          </div>
          <!-- 기능 태그 칩 -->
          <div class="filter-chips">
            <button
              class="filter-chip"
              :class="{ active: !selectedTag }"
              @click="selectedTag = ''"
            >전체</button>
            <button
              v-for="tag in functionTags"
              :key="tag"
              class="filter-chip"
              :class="{ active: selectedTag === tag }"
              @click="selectedTag = selectedTag === tag ? '' : tag"
            >{{ tag }}</button>
          </div>
        </div>
        <div class="ai-tools-tab__actions">
          <UiInput
            v-model="searchQuery"
            placeholder="검색..."
            size="sm"
            style="width: 200px"
          />
          <UiButton size="sm" @click="openCreate">+ 새 도구</UiButton>
        </div>
      </div>

      <!-- 카드 그리드 -->
      <div v-if="filteredTools.length" class="ai-tools-tab__grid">
        <AiToolCard
          v-for="tool in filteredTools"
          :key="tool.id"
          :tool="tool"
          @click="openDetail(tool)"
        />
      </div>
      <UiEmpty v-else message="등록된 AI 도구가 없습니다." />
    </template>

    <!-- Drawer -->
    <AiToolDrawer
      :open="drawerOpen"
      :tool="selectedTool"
      @close="closeDrawer"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiInput, UiEmpty, UiLoading, openToast, openConfirm } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import AiToolCard from './AiToolCard.vue'
import AiToolDrawer from './AiToolDrawer.vue'
import type { AiTool } from './AiToolCard.vue'

const tools = ref<AiTool[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedTag = ref('')
const drawerOpen = ref(false)
const selectedTool = ref<AiTool | null>(null)

// 카테고리 태그 (세그먼트로 분리)
const categoryTags = ['superpowers', 'gstack', 'codex']
const hiddenTags = ['개요']
const tagOrder = ['계획', '실행', '테스트', '브라우저', '배포', '디버깅', '워크플로우']

// 기능 태그 목록 (카테고리/숨김 제외, 우선순위 정렬)
const functionTags = computed(() => {
  const tagSet = new Set<string>()
  // 카테고리 필터가 적용된 도구에서 태그 추출
  const source = selectedCategory.value
    ? tools.value.filter(t => t.tags.includes(selectedCategory.value))
    : tools.value
  source.forEach(t => t.tags.forEach(tag => tagSet.add(tag)))
  return Array.from(tagSet)
    .filter(tag => !categoryTags.includes(tag) && !hiddenTags.includes(tag))
    .sort((a, b) => {
      const ai = tagOrder.indexOf(a)
      const bi = tagOrder.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
})

// 필터링된 목록 (카테고리 + 기능 태그 조합)
const filteredTools = computed(() => {
  let result = tools.value
  if (selectedCategory.value) {
    result = result.filter(t => t.tags.includes(selectedCategory.value))
  }
  if (selectedTag.value) {
    result = result.filter(t => t.tags.includes(selectedTag.value))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }
  return result
})

async function loadTools() {
  loading.value = true
  try {
    const res = await api.get('/ai-tools')
    tools.value = res.data.data
  } catch {
    openToast({ message: '도구 목록을 불러오지 못했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  selectedTool.value = null
  drawerOpen.value = true
}

function openDetail(tool: AiTool) {
  selectedTool.value = tool
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  selectedTool.value = null
}

async function handleSave(data: Partial<AiTool>) {
  try {
    if (data.id) {
      await api.put(`/ai-tools/${data.id}`, data)
      openToast({ message: '수정되었습니다.', type: 'success' })
    } else {
      await api.post('/ai-tools', data)
      openToast({ message: '추가되었습니다.', type: 'success' })
    }
    closeDrawer()
    await loadTools()
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}

async function handleDelete(id: number) {
  const confirmed = await openConfirm({
    title: '삭제 확인',
    message: '이 도구를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!confirmed) return

  try {
    await api.delete(`/ai-tools/${id}`)
    openToast({ message: '삭제되었습니다.', type: 'success' })
    closeDrawer()
    await loadTools()
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

onMounted(loadTools)

defineExpose({ loadTools })
</script>

<style scoped lang="scss">
.ai-tools-tab {
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
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
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

.segment {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  overflow-x: auto;

  &__btn {
    padding: 6px 16px;
    border-radius: 6px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.15s;

    &.active {
      background: #fff;
      color: #1a1f2b;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
