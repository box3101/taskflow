<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiButton, UiIcon, UiTextarea, openToast, openConfirm } from '@leechanyong/ispark-ui'
import { fetchJournal, saveJournal, deleteJournal } from '../../api/stockApi'
import type { MarketJournalEntry } from '../../api/stockApi'

const props = defineProps<{
  selectedDate: string
}>()

const emit = defineEmits<{
  saved: [date: string]
}>()

const journal = ref<MarketJournalEntry | null>(null)
const content = ref('')
const summary = ref('')
const editing = ref(false)
const saving = ref(false)
const loading = ref(false)

// 날짜 변경 시 일지 로드
watch(() => props.selectedDate, async (date) => {
  if (!date) return
  loading.value = true
  editing.value = false
  journal.value = await fetchJournal(date)
  if (journal.value) {
    content.value = journal.value.content
    summary.value = journal.value.summary || ''
  } else {
    content.value = ''
    summary.value = ''
  }
  loading.value = false
}, { immediate: true })

function startEdit() {
  if (!journal.value) {
    content.value = ''
    summary.value = ''
  }
  editing.value = true
}

async function handleSave() {
  if (!content.value.trim()) {
    openToast({ message: '내용을 입력해주세요.', type: 'warning' })
    return
  }
  saving.value = true
  try {
    await saveJournal(props.selectedDate, content.value, summary.value)
    journal.value = {
      date: props.selectedDate,
      content: content.value,
      summary: summary.value || null,
      updatedAt: new Date().toISOString(),
    }
    editing.value = false
    emit('saved', props.selectedDate)
    openToast({ message: '저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '저장 실패', type: 'error' })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  const ok = await openConfirm({
    title: '일지 삭제',
    message: '이 날의 시황 일지를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!ok) return
  try {
    await deleteJournal(props.selectedDate)
    journal.value = null
    content.value = ''
    summary.value = ''
    editing.value = false
    emit('saved', props.selectedDate)
    openToast({ message: '삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제 실패', type: 'error' })
  }
}

function cancelEdit() {
  editing.value = false
  if (journal.value) {
    content.value = journal.value.content
    summary.value = journal.value.summary || ''
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}
</script>

<template>
  <div class="journal">
    <div class="journal__header">
      <div class="journal__title">
        <UiIcon name="notebook-pen" :size="15" />
        <span>시황 일지</span>
      </div>
      <div class="journal__actions">
        <template v-if="!editing">
          <UiButton
            variant="ghost"
            size="sm"
            icon-only
            @click="startEdit"
            :aria-label="journal ? '수정' : '작성'"
          >
            <template #icon-left>
              <UiIcon :name="journal ? 'pencil' : 'plus'" :size="14" />
            </template>
          </UiButton>
          <UiButton
            v-if="journal"
            variant="ghost"
            size="sm"
            icon-only
            aria-label="삭제"
            @click="handleDelete"
          >
            <template #icon-left>
              <UiIcon name="trash-2" :size="14" color="danger" />
            </template>
          </UiButton>
        </template>
      </div>
    </div>

    <!-- 읽기 모드 -->
    <template v-if="!editing">
      <div v-if="loading" class="journal__loading">
        <UiIcon name="loader" :size="16" />
      </div>
      <div v-else-if="journal" class="journal__content">
        <div v-if="journal.summary" class="journal__summary">
          {{ journal.summary }}
        </div>
        <div class="journal__body" v-html="renderContent(journal.content)"></div>
        <div class="journal__meta">
          {{ formatDate(journal.date) }} 작성
        </div>
      </div>
      <div v-else class="journal__empty" @click="startEdit">
        <UiIcon name="plus" :size="16" />
        <span>오늘의 시황 분석을 기록하세요</span>
      </div>
    </template>

    <!-- 편집 모드 -->
    <template v-else>
      <div class="journal__edit">
        <input
          v-model="summary"
          class="journal__summary-input"
          placeholder="한줄 요약 (예: 외국인 전환 1일차, CPI 부합)"
        />
        <UiTextarea
          v-model="content"
          placeholder="시황 분석을 작성하세요...

예시:
## 오늘의 이벤트
- CPI 4.2% 예상 부합
- 옵션만기일 + 외국인 순매수 전환

## SK하이닉스
- ADR 8월 상장 모멘텀
- 외국인 전환 1일차 (만기일 할인)

## 내일 체크포인트
- 비만기일 외국인 연속 매수 여부
- 204~215만 지지 확인"
          :rows="12"
        />
        <div class="journal__edit-actions">
          <UiButton variant="secondary" size="sm" @click="cancelEdit">
            취소
          </UiButton>
          <UiButton variant="primary" size="sm" :loading="saving" @click="handleSave">
            저장
          </UiButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
// 간단한 마크다운 → HTML 변환
function renderContent(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h5>$1</h5>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped lang="scss">
.journal {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.journal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.journal__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.journal__actions {
  display: flex;
  gap: 2px;
}

// 읽기
.journal__loading {
  text-align: center;
  padding: 16px;
  color: #9ca3af;
}

.journal__summary {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: #f0f5ff;
  border-radius: 6px;
  border-left: 3px solid #4f6af6;
}

.journal__body {
  font-size: 13px;
  color: #374151;
  line-height: 1.7;

  :deep(h4) {
    font-size: 13px;
    font-weight: 700;
    color: #1f2937;
    margin: 12px 0 4px 0;
  }

  :deep(h5) {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin: 8px 0 4px 0;
  }

  :deep(ul) {
    margin: 4px 0;
    padding-left: 16px;
  }

  :deep(li) {
    font-size: 13px;
    margin: 2px 0;
  }

  :deep(strong) {
    color: #1f2937;
    font-weight: 700;
  }
}

.journal__meta {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
}

.journal__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #4f6af6;
    color: #4f6af6;
    background: #f8f9ff;
  }
}

// 편집
.journal__edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.journal__summary-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;

  &:focus { border-color: #4f6af6; }
  &::placeholder { color: #c9cdd4; font-weight: 400; }
}

.journal__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

// 다크모드
:global([data-theme="dark"]) {
  .journal { border-top-color: #2d2f36; }
  .journal__summary { background: #1e2a4a; color: #e5e7eb; border-left-color: #4f6af6; }
  .journal__body { color: #d1d5db; }
  .journal__body :deep(h4) { color: #e5e7eb; }
  .journal__body :deep(strong) { color: #e5e7eb; }
  .journal__empty {
    border-color: #2d2f36;
    &:hover { background: #1e2028; }
  }
  .journal__summary-input {
    background: #1e2028;
    border-color: #2d2f36;
    color: #e5e7eb;
    &:focus { border-color: #4f6af6; }
  }
}
</style>
