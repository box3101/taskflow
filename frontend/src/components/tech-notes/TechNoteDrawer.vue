<template>
  <UiDrawer
    :open="open"
    :title="isEditing ? (form.id ? '노트 수정' : '새 노트 추가') : form.title"
    width="640px"
    @update:open="(v: boolean) => { if (!v) $emit('close') }"
  >
    <!-- 보기 모드 -->
    <template v-if="!isEditing">
      <div class="drawer-view">
        <div class="drawer-view__meta">
          <UiBadge variant="info" size="sm">{{ categoryLabel }}</UiBadge>
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            variant="default"
            size="sm"
          >{{ tag }}</UiBadge>
        </div>
        <p class="drawer-view__summary">{{ form.summary }}</p>
        <div class="drawer-view__content">
          <UiMarkdownEditor :model-value="form.content" :editable="false" />
        </div>
      </div>
    </template>

    <!-- 편집 모드 -->
    <template v-else>
      <div class="drawer-edit">
        <div class="drawer-edit__field">
          <label>제목</label>
          <UiInput v-model="form.title" placeholder="노트 제목" />
        </div>
        <div class="drawer-edit__field">
          <label>카테고리</label>
          <UiSelect v-model="form.category" :options="categoryOptions" placeholder="카테고리 선택" />
        </div>
        <div class="drawer-edit__field">
          <label>태그 (콤마 구분)</label>
          <UiInput v-model="tagsInput" placeholder="Vue, TypeScript, 성능" />
        </div>
        <div class="drawer-edit__field">
          <label>요약</label>
          <UiInput v-model="form.summary" placeholder="한 줄 요약" />
        </div>
        <div class="drawer-edit__field">
          <label>내용</label>
          <UiMarkdownEditor v-model="form.content" placeholder="마크다운으로 내용 작성..." />
        </div>
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="drawer-footer">
        <template v-if="!isEditing">
          <UiButton variant="outline" @click="startEdit">수정</UiButton>
          <UiButton variant="danger" @click="handleDelete">삭제</UiButton>
        </template>
        <template v-else>
          <UiButton variant="outline" @click="cancelEdit">취소</UiButton>
          <UiButton
            @click="handleSave"
            :disabled="!form.title.trim() || !form.category"
            :loading="saving"
          >저장</UiButton>
        </template>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiDrawer, UiButton, UiBadge, UiInput, UiSelect, UiMarkdownEditor } from '@leechanyong/ispark-ui'
import type { SelectOption } from '@leechanyong/ispark-ui'
import type { TechNote } from './types'
import { CATEGORIES } from './types'

const props = defineProps<{
  open: boolean
  note: TechNote | null
  saving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [data: Partial<TechNote>]
  delete: [id: number]
}>()

const isEditing = ref(false)
const form = ref({
  id: 0,
  title: '',
  category: '',
  tags: [] as string[],
  summary: '',
  content: '',
})

// 카테고리 셀렉트 옵션
const categoryOptions: SelectOption[] = CATEGORIES.map(c => ({
  label: c.label,
  value: c.value,
}))

// 카테고리 라벨
const categoryLabel = computed(() => {
  const cat = CATEGORIES.find(c => c.value === form.value.category)
  return cat ? cat.label : form.value.category
})

// 태그 입력 (콤마 구분)
const tagsInput = computed({
  get: () => form.value.tags.join(', '),
  set: (val: string) => {
    form.value.tags = val.split(',').map(t => t.trim()).filter(Boolean)
  },
})

// 노트 데이터 반영
watch(() => props.note, (note) => {
  if (note) {
    form.value = {
      id: note.id,
      title: note.title,
      category: note.category,
      tags: [...note.tags],
      summary: note.summary,
      content: note.content,
    }
    isEditing.value = false
  }
}, { immediate: true })

// 새 노트 생성 시
watch(() => props.open, (open) => {
  if (open && !props.note) {
    form.value = { id: 0, title: '', category: '', tags: [], summary: '', content: '' }
    isEditing.value = true
  }
})

function startEdit() {
  isEditing.value = true
}

function cancelEdit() {
  if (props.note) {
    form.value = {
      id: props.note.id,
      title: props.note.title,
      category: props.note.category,
      tags: [...props.note.tags],
      summary: props.note.summary,
      content: props.note.content,
    }
    isEditing.value = false
  } else {
    emit('close')
  }
}

function handleSave() {
  emit('save', {
    id: form.value.id || undefined,
    title: form.value.title.trim(),
    category: form.value.category,
    tags: form.value.tags,
    summary: form.value.summary.trim(),
    content: form.value.content,
  })
}

function handleDelete() {
  if (form.value.id) {
    emit('delete', form.value.id)
  }
}
</script>

<style scoped lang="scss">
.drawer-view {
  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 16px;
  }

  &__summary {
    font-size: 14px;
    color: #374151;
    line-height: 1.5;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  &__content {
    // UiMarkdownEditor readonly 모드
  }
}

.drawer-edit {
  &__field {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }
  }
}

.drawer-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
