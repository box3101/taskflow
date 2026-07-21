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
          <UiBadge v-if="!isMine" variant="warning" size="sm">{{ authorName }}</UiBadge>
          <UiBadge v-else-if="form.isPublic" variant="success" size="sm">공유중</UiBadge>
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            variant="default"
            size="sm"
          >{{ tag }}</UiBadge>
        </div>
        <p v-if="form.summary" class="drawer-view__summary">{{ form.summary }}</p>

        <!-- 섹션 1개 이하: 기존 통짜 렌더 -->
        <div v-if="!useSectioned" class="drawer-view__content">
          <UiMarkdownEditor :model-value="form.content" :editable="false" />
        </div>

        <!-- 섹션 2개 이상: 목차형 -->
        <template v-else>
          <div v-if="parsed.intro" class="drawer-view__intro">
            <UiMarkdownEditor :model-value="parsed.intro" :editable="false" />
          </div>
          <div class="note-toc">
            <button
              v-for="(sec, i) in parsed.sections"
              :key="i"
              class="note-toc__item"
              @click="openSection(sec)"
            >
              <span class="note-toc__title">{{ sec.title }}</span>
              <span class="note-toc__chev">›</span>
            </button>
          </div>
        </template>
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
        <div class="drawer-edit__field">
          <UiToggle v-model="form.isPublic" label="전체 공개 (다른 사용자가 읽을 수 있음)" />
        </div>
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="drawer-footer">
        <!-- 남의 공개 노트는 읽기 전용 -->
        <template v-if="!isEditing">
          <template v-if="isMine">
            <UiButton variant="outline" @click="startEdit">수정</UiButton>
            <UiButton variant="danger" @click="handleDelete">삭제</UiButton>
          </template>
          <UiButton v-else variant="outline" @click="$emit('close')">닫기</UiButton>
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

    <!-- 상세: 중첩 Drawer (목차 위에 겹쳐 슬라이드) -->
    <UiDrawer
      :open="!!activeSection"
      :title="activeSection?.title || ''"
      width="640px"
      @update:open="(v: boolean) => { if (!v) closeSection() }"
    >
      <div class="note-detail">
        <UiMarkdownEditor :model-value="activeSection?.body || ''" :editable="false" />
      </div>
      <template #footer>
        <div class="drawer-footer">
          <UiButton variant="outline" @click="closeSection">‹ 목차로</UiButton>
        </div>
      </template>
    </UiDrawer>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiDrawer, UiButton, UiBadge, UiInput, UiSelect, UiToggle, UiMarkdownEditor } from '@leechanyong/ispark-ui'
import type { SelectOption } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../../stores/auth'
import type { TechNote } from './types'
import { CATEGORIES } from './types'
import { parseNoteSections, type NoteSection } from './parseNoteSections'

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

const auth = useAuthStore()

const isEditing = ref(false)
const form = ref({
  id: 0,
  title: '',
  category: '',
  tags: [] as string[],
  summary: '',
  content: '',
  isPublic: false,
})

// 새 노트(note === null)는 항상 내 것. 남의 공개 노트는 읽기 전용
const isMine = computed(() => !props.note || auth.user?.id === props.note.userId)
const authorName = computed(() => props.note?.user?.name ?? '공유 노트')

// 상세(중첩 drawer) 대상 섹션
const activeSection = ref<NoteSection | null>(null)

// 본문을 "## " 기준 분할. 섹션 2개 이상이면 목차형으로 표시
const parsed = computed(() => parseNoteSections(form.value.content))
const useSectioned = computed(() => parsed.value.sections.length >= 2)

function openSection(sec: NoteSection) {
  activeSection.value = sec
}
function closeSection() {
  activeSection.value = null
}

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
      isPublic: note.isPublic ?? false,
    }
    isEditing.value = false
    activeSection.value = null
  }
}, { immediate: true })

// 새 노트 생성 시
watch(() => props.open, (open) => {
  if (open && !props.note) {
    form.value = { id: 0, title: '', category: '', tags: [], summary: '', content: '', isPublic: false }
    isEditing.value = true
  }
})

function startEdit() {
  activeSection.value = null
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
      isPublic: props.note.isPublic ?? false,
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
    isPublic: form.value.isPublic,
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

  &__intro {
    margin-bottom: 12px;
  }
}

.note-toc {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note-toc__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.note-toc__title { font-size: 14px; font-weight: 600; color: #1f2937; }
.note-toc__chev { color: #9ca3af; font-size: 18px; }

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
