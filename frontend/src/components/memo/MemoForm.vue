<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiDrawer, UiInput, UiTextarea, UiButton, openToast } from '@leechanyong/ispark-ui'
import { MEMO_COLORS, type MemoEntry } from '../../composables/useMemo'

const props = defineProps<{
  open: boolean
  memo?: MemoEntry | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [memo: MemoEntry]
  deleted: [id: string]
}>()

const title = ref('')
const content = ref('')
const color = ref('yellow')

// 폼 초기화
watch(() => props.open, (open) => {
  if (open) {
    if (props.memo) {
      title.value = props.memo.title
      content.value = props.memo.content
      color.value = props.memo.color
    } else {
      title.value = ''
      content.value = ''
      color.value = 'yellow'
    }
  }
})

function selectColor(c: string) {
  color.value = c
}

async function handleSave() {
  if (!title.value.trim()) {
    openToast({ message: '제목을 입력해주세요.', type: 'warning' })
    return
  }
  emit('saved', {
    id: props.memo?.id || '',
    title: title.value.trim(),
    content: content.value.trim(),
    color: color.value,
    pinned: props.memo?.pinned || false,
    order: props.memo?.order || 0,
    createdAt: props.memo?.createdAt || '',
    updatedAt: props.memo?.updatedAt || '',
  })
}

function handleDelete() {
  if (props.memo?.id) {
    emit('deleted', props.memo.id)
  }
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="memo ? '메모 수정' : '새 메모'"
    @update:open="emit('update:open', $event)"
  >
    <div class="memo-form">
      <div class="memo-form__field">
        <label class="memo-form__label">제목</label>
        <UiInput
          v-model="title"
          placeholder="메모 제목"
          :maxlength="100"
        />
      </div>

      <div class="memo-form__field">
        <label class="memo-form__label">내용</label>
        <UiTextarea
          v-model="content"
          placeholder="내용을 입력하세요..."
          :rows="6"
          :maxlength="5000"
        />
      </div>

      <div class="memo-form__field">
        <label class="memo-form__label">색상</label>
        <div class="color-picker">
          <button
            v-for="c in MEMO_COLORS"
            :key="c.value"
            class="color-picker__item"
            :class="{ 'color-picker__item--active': color === c.value }"
            :style="{ background: c.bg }"
            :title="c.label"
            @click="selectColor(c.value)"
          />
        </div>
      </div>

      <div class="memo-form__actions">
        <UiButton
          v-if="memo"
          variant="danger"
          size="sm"
          @click="handleDelete"
        >
          삭제
        </UiButton>
        <div style="flex: 1" />
        <UiButton variant="secondary" size="sm" @click="emit('update:open', false)">
          취소
        </UiButton>
        <UiButton :variant="memo ? 'secondary' : 'primary'" size="sm" @click="handleSave">
          {{ memo ? '수정' : '저장' }}
        </UiButton>
      </div>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.memo-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.memo-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.memo-form__label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.color-picker {
  display: flex;
  gap: 8px;
}

.color-picker__item {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;

  &:hover {
    transform: scale(1.1);
  }

  &--active {
    border-color: #4f6af6;
    box-shadow: 0 0 0 2px rgba(79, 106, 246, 0.3);
  }
}

.memo-form__actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

:global([data-theme="dark"]) {
  .memo-form__label {
    color: #d1d5db;
  }
}
</style>
