<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiButton, UiIcon, UiDrawer, UiTextarea, openToast, openConfirm } from '@leechanyong/ispark-ui'
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
const drawerOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const loading = ref(false)

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const dateLabel = ref('')

watch(() => props.selectedDate, async (date) => {
  if (!date) return
  const d = new Date(date)
  dateLabel.value = `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`
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

function openDrawer(edit?: boolean) {
  if (edit || !journal.value) {
    if (!journal.value) {
      content.value = ''
      summary.value = ''
    }
    editing.value = true
  } else {
    editing.value = false
  }
  drawerOpen.value = true
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
    drawerOpen.value = false
    emit('saved', props.selectedDate)
    openToast({ message: '삭제되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '삭제 실패', type: 'error' })
  }
}

function cancelEdit() {
  if (journal.value) {
    content.value = journal.value.content
    summary.value = journal.value.summary || ''
    editing.value = false
  } else {
    drawerOpen.value = false
  }
}

// 섹션 아이콘 매핑
const sectionIcons: Record<string, string> = {
  '이벤트': '📋', '핵심': '🔑', '결과': '📊',
  '하이닉스': '💎', 'SK': '💎', '삼성': '🏭', '현대': '🚗',
  '수급': '🌊', '외국인': '🌊', '매매': '🌊',
  '오라클': '☁️', '영향': '⚡', '반영': '⚡',
  '가격': '📍', '레벨': '📍', '지지': '📍',
  '체크': '✅', '포인트': '✅', '내일': '📌', '대응': '🎯',
  '시장': '📈', '반응': '📈', '코스피': '🇰🇷',
}

function getSectionIcon(title: string): string {
  for (const [key, icon] of Object.entries(sectionIcons)) {
    if (title.includes(key)) return icon
  }
  return '📌'
}

function renderContent(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // ## 헤더 → 섹션 카드 헤더
  html = html.replace(/^## (.+)$/gm, (_m, title) => {
    const icon = getSectionIcon(title)
    return `</div><div class="j-section"><div class="j-section__head">${icon} ${title}</div><div class="j-section__body">`
  })

  // ### 서브헤더
  html = html.replace(/^### (.+)$/gm, '<div class="j-sub">$1</div>')

  // **볼드**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 리스트
  html = html.replace(/^- (.+)$/gm, '<div class="j-li">$1</div>')

  // 줄바꿈
  html = html.replace(/\n{2,}/g, '<div class="j-gap"></div>')
  html = html.replace(/\n/g, '')

  // 첫 빈 div 제거 + 마지막 div 닫기
  html = html.replace(/^<\/div>/, '') + '</div></div>'
  html = html.replace(/<div class="j-section"><\/div><\/div>$/, '')

  return html
}
</script>

<template>
  <div class="journal-mini">
    <div class="journal-mini__header">
      <UiIcon name="notebook-pen" :size="15" />
      <span class="journal-mini__title">시황 일지</span>
    </div>

    <!-- 일지 있으면 요약 카드 -->
    <div v-if="journal" class="journal-mini__card" @click="openDrawer()">
      <div class="journal-mini__summary">{{ journal.summary || '(요약 없음)' }}</div>
      <UiIcon name="chevron-right" :size="14" />
    </div>

    <!-- 없으면 작성 버튼 -->
    <div v-else class="journal-mini__empty" @click="openDrawer(true)">
      <UiIcon name="plus" :size="14" />
      <span>시황 분석 작성</span>
    </div>
  </div>

  <!-- 드로어 -->
  <UiDrawer
    :open="drawerOpen"
    @update:open="drawerOpen = $event"
    position="right"
    width="480px"
  >
    <template #title>
      <div class="drawer-title">
        <UiIcon name="notebook-pen" :size="18" />
        <span>{{ dateLabel }} 시황 일지</span>
      </div>
    </template>

    <div class="journal-drawer">
      <!-- 읽기 모드 -->
      <template v-if="!editing">
        <div v-if="journal" class="journal-drawer__read">
          <div v-if="journal.summary" class="journal-drawer__summary">
            {{ journal.summary }}
          </div>
          <div class="journal-drawer__body" v-html="renderContent(journal.content)"></div>
          <div class="journal-drawer__footer">
            <UiButton variant="secondary" size="sm" @click="editing = true">
              <template #icon-left><UiIcon name="pencil" :size="14" /></template>
              수정
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="handleDelete">
              <template #icon-left><UiIcon name="trash-2" :size="14" color="danger" /></template>
              삭제
            </UiButton>
          </div>
        </div>
      </template>

      <!-- 편집 모드 -->
      <template v-if="editing">
        <div class="journal-drawer__edit">
          <div class="field">
            <label>한줄 요약</label>
            <input
              v-model="summary"
              class="journal-drawer__summary-input"
              placeholder="예: 외국인 전환 1일차, CPI 부합, 하닉 ADR 모멘텀"
            />
          </div>
          <div class="field">
            <label>분석 내용</label>
            <UiTextarea
              v-model="content"
              placeholder="## 오늘의 이벤트
- CPI 4.2% 예상 부합

## SK하이닉스
- ADR 8월 상장 모멘텀
- 외국인 전환 1일차 (만기일 할인)

## 내일 체크포인트
- 비만기일 외국인 연속 매수 여부"
              :rows="16"
            />
          </div>
          <div class="journal-drawer__edit-actions">
            <UiButton variant="secondary" size="sm" @click="cancelEdit">취소</UiButton>
            <UiButton variant="primary" size="sm" :loading="saving" @click="handleSave">저장</UiButton>
          </div>
        </div>
      </template>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
// 사이드패널 미니 카드
.journal-mini {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
  }

  &__card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f0f5ff;
    border-radius: 8px;
    border-left: 3px solid #4f6af6;
    cursor: pointer;
    transition: background 0.15s;

    &:hover { background: #e8eeff; }
  }

  &__summary {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 14px;
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
}

// 드로어 타이틀
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
}

// 드로어 내용
.journal-drawer {
  &__read {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__summary {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    padding: 8px 12px;
    background: #f0f5ff;
    border-radius: 8px;
    border-left: 3px solid #4f6af6;
  }

  &__body {
    font-size: 13px;
    color: #374151;
    line-height: 1.7;
    display: flex;
    flex-direction: column;
    gap: 10px;

    :deep(.j-section) {
      background: #f9fafb;
      border-radius: 10px;
      overflow: hidden;
    }

    :deep(.j-section__head) {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      padding: 8px 12px;
      background: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
    }

    :deep(.j-section__body) {
      padding: 8px 12px 10px;
    }

    :deep(.j-sub) {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      margin: 6px 0 2px;
    }

    :deep(.j-li) {
      position: relative;
      padding-left: 14px;
      font-size: 13px;
      line-height: 1.7;
      margin: 3px 0;

      &::before {
        content: '•';
        position: absolute;
        left: 2px;
        color: #9ca3af;
      }
    }

    :deep(.j-gap) {
      height: 4px;
    }

    :deep(strong) {
      color: #4f6af6;
      font-weight: 700;
    }
  }

  &__footer {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  // 편집
  &__edit {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__summary-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    outline: none;
    box-sizing: border-box;

    &:focus { border-color: #4f6af6; }
    &::placeholder { color: #c9cdd4; font-weight: 400; }
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }
}

// 다크모드
:global([data-theme="dark"]) {
  .journal-mini {
    border-top-color: #2d2f36;
    &__card { background: #1e2a4a; &:hover { background: #253560; } }
    &__summary { color: #e5e7eb; }
    &__empty { border-color: #2d2f36; &:hover { background: #1e2028; } }
  }
  .journal-drawer {
    &__summary { background: #1e2a4a; color: #e5e7eb; }
    &__body { color: #d1d5db; }
    &__body :deep(.j-section) { background: #1a1c22; }
    &__body :deep(.j-section__head) { background: #22252d; color: #e5e7eb; border-bottom-color: #2d2f36; }
    &__body :deep(strong) { color: #6b8aff; }
    &__footer { border-top-color: #2d2f36; }
    &__summary-input {
      background: #1e2028; border-color: #2d2f36; color: #e5e7eb;
      &:focus { border-color: #4f6af6; }
    }
  }
}
</style>
