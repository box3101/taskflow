<template>
  <UiDrawer
    :open="open"
    :title="isEditing ? (form.id ? '도구 수정' : '새 도구 추가') : form.title"
    width="560px"
    @update:open="(v: boolean) => { if (!v) $emit('close') }"
  >
    <!-- 보기 모드 -->
    <template v-if="!isEditing">
      <div class="drawer-view">
        <div class="drawer-view__tags">
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            variant="info"
            size="sm"
          >{{ tag }}</UiBadge>
        </div>
        <div class="drawer-view__content markdown-body" v-html="renderedContent"></div>
      </div>
    </template>

    <!-- 편집 모드 -->
    <template v-else>
      <div class="drawer-edit">
        <div class="drawer-edit__field">
          <label>제목</label>
          <UiInput v-model="form.title" placeholder="도구/스킬 이름" />
        </div>
        <div class="drawer-edit__field">
          <label>설명</label>
          <UiInput v-model="form.description" placeholder="한 줄 설명" />
        </div>
        <div class="drawer-edit__field">
          <label>태그 (콤마 구분)</label>
          <UiInput v-model="tagsInput" placeholder="superpowers, 계획, 배포" />
        </div>
        <div class="drawer-edit__field">
          <label>아이콘 (이모지)</label>
          <UiInput v-model="form.icon" placeholder="🔧" />
        </div>
        <div class="drawer-edit__field">
          <label>내용 (마크다운)</label>
          <UiTextarea v-model="form.content" placeholder="마크다운으로 상세 가이드 작성..." :rows="15" />
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
          <UiButton @click="handleSave" :disabled="!form.title.trim()" :loading="saving">저장</UiButton>
        </template>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { UiDrawer, UiButton, UiBadge, UiInput, UiTextarea } from '@leechanyong/ispark-ui'
import type { AiTool } from './AiToolCard.vue'

const props = defineProps<{
  open: boolean
  tool: AiTool | null
  saving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [data: Partial<AiTool>]
  delete: [id: number]
}>()

const isEditing = ref(false)
const form = ref({
  id: 0,
  title: '',
  description: '',
  content: '',
  tags: [] as string[],
  icon: '',
})

const tagsInput = computed({
  get: () => form.value.tags.join(', '),
  set: (val: string) => {
    form.value.tags = val.split(',').map(t => t.trim()).filter(Boolean)
  },
})

const renderedContent = computed(() => {
  return marked(form.value.content || '*내용이 없습니다.*')
})

watch(() => props.tool, (tool) => {
  if (tool) {
    form.value = {
      id: tool.id,
      title: tool.title,
      description: tool.description,
      content: tool.content,
      tags: [...tool.tags],
      icon: tool.icon || '',
    }
    isEditing.value = false
  }
}, { immediate: true })

watch(() => props.open, (open) => {
  if (open && !props.tool) {
    form.value = { id: 0, title: '', description: '', content: '', tags: [], icon: '' }
    isEditing.value = true
  }
})

function startEdit() {
  isEditing.value = true
}

function cancelEdit() {
  if (props.tool) {
    form.value = {
      id: props.tool.id,
      title: props.tool.title,
      description: props.tool.description,
      content: props.tool.content,
      tags: [...props.tool.tags],
      icon: props.tool.icon || '',
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
    description: form.value.description.trim(),
    content: form.value.content,
    tags: form.value.tags,
    icon: form.value.icon || null,
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
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 20px;
  }

  &__content {
    line-height: 1.7;
    font-size: 14px;
    color: #374151;

    :deep(h1), :deep(h2), :deep(h3) {
      margin-top: 24px;
      margin-bottom: 8px;
      color: #1a1f2b;
    }

    :deep(h2) { font-size: 18px; }
    :deep(h3) { font-size: 16px; }

    :deep(pre) {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 12px 16px;
      overflow-x: auto;
      font-size: 13px;
      margin: 12px 0;
    }

    :deep(code) {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }

    :deep(pre code) {
      background: none;
      padding: 0;
    }

    :deep(ul), :deep(ol) {
      padding-left: 20px;
      margin: 8px 0;
      list-style: disc;
    }

    :deep(ol) {
      list-style: decimal;
    }

    :deep(li) {
      margin: 4px 0;
    }

    :deep(strong) {
      font-weight: 700;
    }

    :deep(blockquote) {
      border-left: 3px solid #3b82f6;
      padding-left: 12px;
      color: #6b7280;
      margin: 12px 0;
    }

    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 13px;
    }

    :deep(th), :deep(td) {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }

    :deep(th) {
      background: #f9fafb;
      font-weight: 600;
      color: #1a1f2b;
    }

    :deep(tr:hover) {
      background: #f9fafb;
    }
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
