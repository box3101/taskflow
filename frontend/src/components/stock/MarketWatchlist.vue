<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiButton, UiIcon, UiDrawer, UiTextarea, openToast } from '@leechanyong/ispark-ui'
import { fetchWatchlist, saveWatchlist } from '../../api/stockApi'

const content = ref('')
const savedContent = ref('')
const drawerOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const hasData = ref(false)

onMounted(async () => {
  const data = await fetchWatchlist()
  if (data) {
    content.value = data.content
    savedContent.value = data.content
    hasData.value = true
  }
})

function openDrawer(edit?: boolean) {
  editing.value = !!edit
  drawerOpen.value = true
}

async function handleSave() {
  if (!content.value.trim()) {
    openToast({ message: '내용을 입력해주세요.', type: 'warning' })
    return
  }
  saving.value = true
  try {
    await saveWatchlist(content.value)
    savedContent.value = content.value
    hasData.value = true
    editing.value = false
    openToast({ message: '저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '저장 실패', type: 'error' })
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  content.value = savedContent.value
  editing.value = false
}

// 섹션 아이콘
const sectionIcons: Record<string, string> = {
  '호재': '🟢', '악재': '🔴', '경보': '🚨', '감시': '👁️',
  '요령': '💡', '판독': '💡', '상태': '📍', '현재': '📍',
  '관전': '🎯', '포인트': '🎯', '다음': '📌', '워치': '👀',
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

  html = html.replace(/^## (.+)$/gm, (_m, title) => {
    const icon = getSectionIcon(title)
    return `</div><div class="j-section"><div class="j-section__head">${icon} ${title}</div><div class="j-section__body">`
  })

  html = html.replace(/^### (.+)$/gm, '<div class="j-sub">$1</div>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/^- (.+)$/gm, '<div class="j-li">$1</div>')
  html = html.replace(/\n{2,}/g, '<div class="j-gap"></div>')
  html = html.replace(/\n/g, '')
  html = html.replace(/^<\/div>/, '') + '</div></div>'
  html = html.replace(/<div class="j-section"><\/div><\/div>$/, '')

  return html
}
</script>

<template>
  <!-- FAB 버튼 -->
  <button class="watchlist-fab" @click="openDrawer()" aria-label="워치리스트">
    <UiIcon name="radar" :size="20" />
  </button>

  <!-- 드로어 -->
  <UiDrawer
    :open="drawerOpen"
    @update:open="drawerOpen = $event"
    position="right"
    width="520px"
    title="워치리스트"
  >
    <div class="watchlist-drawer">
      <!-- 읽기 모드 -->
      <template v-if="!editing">
        <div v-if="hasData" class="watchlist-drawer__read">
          <div class="watchlist-drawer__body" v-html="renderContent(savedContent)"></div>
          <div class="watchlist-drawer__footer">
            <UiButton variant="secondary" size="sm" @click="editing = true">수정</UiButton>
          </div>
        </div>
        <div v-else class="watchlist-drawer__empty">
          <p>상시 경보 목록, 판독 요령, 관전 포인트 등을 기록하세요.</p>
          <UiButton variant="primary" size="sm" @click="editing = true">작성하기</UiButton>
        </div>
      </template>

      <!-- 편집 모드 -->
      <template v-if="editing">
        <div class="watchlist-drawer__edit">
          <UiTextarea
            v-model="content"
            placeholder="## 호재 — 언제든 가능
- 삼성, 구글 TPU 수주 확정
- 하닉 ADR 일정 확정
- 빅테크 HBM 추가 대량 발주

## 악재 — 감시 대상
- 메모리 현물가 급락
- 반도체 공급과잉 리포트

## 판독 요령
- 돈이 누구에게서 누구로
- 출처 등급: 익명 < 외신 단독 < 공시
- 첫 질문: 논리가 깨졌나?

## 다음 관전 포인트
- 월요일: 외인 3일 연속 매수
- 수요일: FOMC 점도표"
            :rows="20"
          />
          <div class="watchlist-drawer__edit-actions">
            <UiButton variant="secondary" size="sm" @click="cancelEdit">취소</UiButton>
            <UiButton variant="primary" size="sm" :loading="saving" @click="handleSave">저장</UiButton>
          </div>
        </div>
      </template>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.watchlist-fab {
  position: fixed;
  right: 76px;
  bottom: 76px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #1f2937;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s;
  z-index: 50;

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.95); }
}

.watchlist-drawer {
  &__read {
    display: flex;
    flex-direction: column;
    gap: 12px;
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

    :deep(.j-gap) { height: 4px; }

    :deep(strong) {
      color: #4f6af6;
      font-weight: 700;
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  &__empty {
    text-align: center;
    padding: 32px 16px;
    color: #9ca3af;

    p { margin-bottom: 12px; font-size: 14px; }
  }

  &__edit {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

// 다크모드
:global([data-theme="dark"]) {
  .watchlist-drawer {
    &__body { color: #d1d5db; }
    &__body :deep(.j-section) { background: #1a1c22; }
    &__body :deep(.j-section__head) { background: #22252d; color: #e5e7eb; border-bottom-color: #2d2f36; }
    &__body :deep(strong) { color: #6b8aff; }
    &__footer { border-top-color: #2d2f36; }
  }
}
</style>
