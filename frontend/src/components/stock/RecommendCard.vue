<script setup lang="ts">
import { ref } from 'vue'
import { UiBadge, UiTab } from '@leechanyong/ispark-ui'

type RecItem = {
  code: string
  name: string
  theme: string
  chg20: number
  chg5: number
  score: number
  reason: string
}

defineProps<{
  momentum: RecItem[]
  laggard: RecItem[]
  overheat: RecItem[]
  loading: boolean
}>()

const emit = defineEmits<{ loadData: [] }>()

const activeTab = ref('momentum')
const tabs = [
  { label: '🚀 모멘텀 초기', value: 'momentum' },
  { label: '🔍 테마 낙오주', value: 'laggard' },
  { label: '🔥 과열 경보', value: 'overheat' },
]

const loaded = ref(false)
function onToggle(e: Event) {
  const el = e.target as HTMLDetailsElement
  if (el.open && !loaded.value) {
    loaded.value = true
    emit('loadData')
  }
}

const tabDescriptions: Record<string, string> = {
  momentum: '20일 +10~50% 구간에서 가속이 시작되는 종목. 과열 전 진입 기회.',
  laggard: '같은 테마 평균보다 덜 오른 종목. 후발주자 기회.',
  overheat: '20일 +80% 이상 과열 종목. 매수 금지, 보유자는 익절 검토.',
}
</script>

<template>
  <details class="recommend-card" @toggle="onToggle">
    <summary class="card-header">
      <h3>🤖 AI 종목 분석</h3>
      <span class="card-desc">3가지 전략 분석</span>
    </summary>

    <div class="card-body">
      <UiTab v-model="activeTab" :tabs="tabs" size="sm" alignment="left" />

      <p class="tab-desc">{{ tabDescriptions[activeTab] }}</p>

      <!-- 모멘텀 초기 -->
      <div v-if="activeTab === 'momentum'" class="rec-list">
        <div v-if="momentum.length === 0" class="empty">
          {{ loading ? '분석 중...' : '조건에 맞는 종목이 없습니다.' }}
        </div>
        <div v-else>
          <div class="rec-row rec-row--header">
            <span class="col-rank">#</span>
            <span class="col-name">종목명</span>
            <span class="col-theme">테마</span>
            <span class="col-chg">5일</span>
            <span class="col-chg">20일</span>
            <span class="col-reason">가속도</span>
          </div>
          <div v-for="(r, i) in momentum" :key="r.code" class="rec-row rec-row--momentum">
            <span class="col-rank">{{ i + 1 }}</span>
            <span class="col-name">{{ r.name }}</span>
            <span class="col-theme"><UiBadge variant="default" size="sm">{{ r.theme }}</UiBadge></span>
            <span class="col-chg"><UiBadge variant="danger" size="sm">+{{ r.chg5.toFixed(1) }}%</UiBadge></span>
            <span class="col-chg"><UiBadge variant="danger" size="sm">+{{ r.chg20.toFixed(1) }}%</UiBadge></span>
            <span class="col-reason reason-momentum">{{ r.reason }}</span>
          </div>
        </div>
      </div>

      <!-- 테마 낙오주 -->
      <div v-if="activeTab === 'laggard'" class="rec-list">
        <div v-if="laggard.length === 0" class="empty">
          {{ loading ? '분석 중...' : '조건에 맞는 종목이 없습니다.' }}
        </div>
        <div v-else>
          <div class="rec-row rec-row--header">
            <span class="col-rank">#</span>
            <span class="col-name">종목명</span>
            <span class="col-theme">테마</span>
            <span class="col-chg">5일</span>
            <span class="col-chg">20일</span>
            <span class="col-reason">괴리</span>
          </div>
          <div v-for="(r, i) in laggard" :key="r.code" class="rec-row rec-row--laggard">
            <span class="col-rank">{{ i + 1 }}</span>
            <span class="col-name">{{ r.name }}</span>
            <span class="col-theme"><UiBadge variant="default" size="sm">{{ r.theme }}</UiBadge></span>
            <span class="col-chg">
              <UiBadge :variant="r.chg5 >= 0 ? 'danger' : 'primary'" size="sm">
                {{ r.chg5 >= 0 ? '+' : '' }}{{ r.chg5.toFixed(1) }}%
              </UiBadge>
            </span>
            <span class="col-chg">
              <UiBadge :variant="r.chg20 >= 0 ? 'danger' : 'primary'" size="sm">
                {{ r.chg20 >= 0 ? '+' : '' }}{{ r.chg20.toFixed(1) }}%
              </UiBadge>
            </span>
            <span class="col-reason reason-laggard">{{ r.reason }}</span>
          </div>
        </div>
      </div>

      <!-- 과열 경보 -->
      <div v-if="activeTab === 'overheat'" class="rec-list">
        <div v-if="overheat.length === 0" class="empty">
          {{ loading ? '분석 중...' : '과열 종목이 없습니다 (좋은 신호!).' }}
        </div>
        <div v-else>
          <p class="overheat-warning">아래 종목은 매수하지 마세요. 보유 중이면 익절을 검토하세요.</p>
          <div class="rec-row rec-row--header">
            <span class="col-rank">#</span>
            <span class="col-name">종목명</span>
            <span class="col-theme">테마</span>
            <span class="col-chg">5일</span>
            <span class="col-chg">20일</span>
            <span class="col-reason">위험도</span>
          </div>
          <div v-for="(r, i) in overheat" :key="r.code" class="rec-row rec-row--overheat">
            <span class="col-rank">{{ i + 1 }}</span>
            <span class="col-name">{{ r.name }}</span>
            <span class="col-theme"><UiBadge variant="default" size="sm">{{ r.theme }}</UiBadge></span>
            <span class="col-chg"><UiBadge variant="danger" size="sm">+{{ r.chg5.toFixed(1) }}%</UiBadge></span>
            <span class="col-chg"><UiBadge variant="danger" size="sm">+{{ r.chg20.toFixed(1) }}%</UiBadge></span>
            <span class="col-reason reason-overheat">
              <UiBadge :variant="r.reason === '극단 과열' ? 'danger' : 'warning'" size="sm">
                {{ r.reason }}
              </UiBadge>
            </span>
          </div>
        </div>
      </div>

      <p class="disclaimer">
        연기금/외인 연속 매수 데이터는 Phase 2에서 추가 예정. 현재는 모멘텀 + 테마 기반 분석만 제공합니다. 투자 판단의 참고 자료일 뿐, 매수/매도 추천이 아닙니다.
      </p>
    </div>
  </details>
</template>

<style lang="scss" scoped>
.recommend-card {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  overflow: hidden;
  &[open] { border-color: #c7d2fe; }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
  &:hover { background: #fafbfc; }
  &::marker { color: #9ca3af; }
}
.card-desc { font-size: 12px; color: #9ca3af; }

.card-body { padding: 0 20px 20px; }

.tab-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 12px 0;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  line-height: 1.5;
}

.overheat-warning {
  font-size: 13px;
  color: #dc2626;
  background: #fef2f2;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-weight: 600;
}

.empty { text-align: center; padding: 24px; color: #9ca3af; font-size: 14px; }

.rec-row {
  display: grid;
  grid-template-columns: 36px 1fr 80px 68px 68px 100px;
  gap: 6px;
  align-items: center;
  padding: 7px 4px;
  font-size: 13px;
  border-bottom: 1px solid #f0f1f3;
  &:last-child { border-bottom: none; }

  &--header {
    font-weight: 600; color: #6b7280; font-size: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  &--momentum:nth-child(-n+4) { background: #f0fdf4; border-radius: 4px; }
  &--laggard:nth-child(-n+4) { background: #eff6ff; border-radius: 4px; }
  &--overheat { background: #fef2f2; border-radius: 4px; }
}

.col-rank { text-align: center; color: #9ca3af; font-weight: 600; }
.col-name { color: #374151; font-weight: 500; }
.col-theme { text-align: center; }
.col-chg { text-align: center; }
.col-reason { text-align: center; font-size: 12px; }

.reason-momentum { color: #16a34a; font-weight: 600; }
.reason-laggard { color: #2563eb; font-weight: 600; }
.reason-overheat { }

.disclaimer {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 12px;
  line-height: 1.5;
}
</style>
