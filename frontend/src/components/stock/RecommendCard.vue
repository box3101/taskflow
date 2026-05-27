<script setup lang="ts">
import { UiBadge } from '@leechanyong/ispark-ui'

defineProps<{
  recommendations: {
    code: string
    name: string
    theme: string
    chg20: number
    chg5: number
    score: number
  }[]
  loading: boolean
}>()

const emit = defineEmits<{ loadData: [] }>()

function onToggle(e: Event) {
  const details = e.target as HTMLDetailsElement
  if (details.open) emit('loadData')
}
</script>

<template>
  <details class="recommend-card" @toggle="onToggle">
    <summary class="card-header">
      <h3>🤖 AI 종목 추천</h3>
      <span class="card-desc">테마 모멘텀 기반 TOP 10</span>
    </summary>

    <div class="card-body">
      <p class="disclaimer">
        20일 상승률 +10%↑ & 5일 양수인 종목을 모멘텀 점수로 정렬합니다.
        투자 판단의 참고 자료일 뿐, 매수 추천이 아닙니다.
      </p>

      <div v-if="recommendations.length === 0 && !loading" class="empty">
        {{ loading ? '분석 중...' : '테마 동향을 먼저 로드하세요.' }}
      </div>

      <div v-else class="rec-table">
        <div class="rec-row rec-row--header">
          <span class="col-rank">#</span>
          <span class="col-name">종목명</span>
          <span class="col-theme">테마</span>
          <span class="col-chg">5일</span>
          <span class="col-chg">20일</span>
          <span class="col-score">점수</span>
        </div>
        <div
          v-for="(rec, i) in recommendations"
          :key="rec.code"
          class="rec-row"
          :class="{ 'rec-row--top3': i < 3 }"
        >
          <span class="col-rank">
            <span v-if="i === 0">🥇</span>
            <span v-else-if="i === 1">🥈</span>
            <span v-else-if="i === 2">🥉</span>
            <span v-else>{{ i + 1 }}</span>
          </span>
          <span class="col-name">{{ rec.name }}</span>
          <span class="col-theme">
            <UiBadge variant="default" size="sm">{{ rec.theme }}</UiBadge>
          </span>
          <span class="col-chg">
            <UiBadge variant="danger" size="sm">+{{ rec.chg5.toFixed(1) }}%</UiBadge>
          </span>
          <span class="col-chg">
            <UiBadge variant="danger" size="sm">+{{ rec.chg20.toFixed(1) }}%</UiBadge>
          </span>
          <span class="col-score">{{ rec.score.toFixed(1) }}</span>
        </div>
      </div>
    </div>
  </details>
</template>

<style lang="scss" scoped>
.recommend-card {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  overflow: hidden;

  &[open] { border-color: #fbbf24; }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;

  h3 { font-size: 16px; font-weight: 700; margin: 0; }
  &:hover { background: #fffbeb; }
  &::marker { color: #f59e0b; }
}
.card-desc { font-size: 12px; color: #9ca3af; }

.card-body { padding: 0 20px 20px; }

.disclaimer {
  font-size: 12px;
  color: #9ca3af;
  background: #fffbeb;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.empty { text-align: center; padding: 20px; color: #9ca3af; }

.rec-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 70px 70px 50px;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #f0f1f3;

  &:last-child { border-bottom: none; }

  &--header {
    font-weight: 600;
    color: #6b7280;
    font-size: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  &--top3 {
    background: #fffbeb;
    border-radius: 6px;
    padding: 8px 4px;
  }
}
.col-rank { text-align: center; }
.col-name { color: #374151; font-weight: 500; }
.col-theme { text-align: center; }
.col-chg { text-align: center; }
.col-score { text-align: right; font-weight: 700; color: #f59e0b; }
</style>
