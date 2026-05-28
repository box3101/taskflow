<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiLoading } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import SkillCard from './SkillCard.vue'
import SkillDrawer from './SkillDrawer.vue'
import type { SkillLevel } from './SkillCard.vue'

const levels = ref<SkillLevel[]>([])
const loading = ref(false)
const drawerOpen = ref(false)
const selectedLevel = ref<SkillLevel | null>(null)

// 진행률 요약
const summary = ref<{ id: number; name: string; total: number; completed: number; inProgress: number }[]>([])

const progressPct = computed(() => {
  const total = levels.value.length
  if (!total) return 0
  const done = levels.value.filter(l => l.status === 'completed').length
  return Math.round((done / total) * 100)
})

async function loadLevels() {
  loading.value = true
  try {
    const { data } = await api.get('/skill-up/levels')
    levels.value = data.data
  } catch {
    levels.value = []
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const { data } = await api.get('/skill-up/summary')
    summary.value = data.data
  } catch {
    summary.value = []
  }
}

function openLevel(level: SkillLevel) {
  selectedLevel.value = level
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  selectedLevel.value = null
}

async function onUpdated() {
  await Promise.all([loadLevels(), loadSummary()])
}

onMounted(async () => {
  await Promise.all([loadLevels(), loadSummary()])
})
</script>

<template>
  <div class="skill-up-tab">
    <UiLoading v-if="loading" overlay />
    <template v-else>
      <!-- 헤더: 진행률 + 팀 현황 -->
      <div class="skill-up-tab__header">
        <div class="progress-section">
          <h2 class="progress-title">🎮 프론트엔드 역량 로드맵</h2>
          <div class="progress-bar-wrap">
            <div class="progress-bar">
              <div class="progress-bar__fill" :style="{ width: progressPct + '%' }" />
            </div>
            <span class="progress-bar__text">{{ progressPct }}% 완료</span>
          </div>
        </div>

        <!-- 팀 현황 -->
        <div v-if="summary.length" class="team-summary">
          <div v-for="user in summary" :key="user.id" class="team-member">
            <span class="team-member__avatar">{{ user.name.charAt(0) }}</span>
            <span class="team-member__name">{{ user.name }}</span>
            <span class="team-member__progress">
              {{ user.completed }}/{{ user.total }}
            </span>
          </div>
        </div>
      </div>

      <!-- 레벨 카드 그리드 -->
      <div class="skill-up-tab__grid">
        <SkillCard
          v-for="level in levels"
          :key="level.id"
          :level="level"
          @click="openLevel(level)"
        />
      </div>

      <p v-if="levels.length === 0" class="empty-msg">
        아직 레벨이 없습니다. 시드 데이터를 실행해주세요.
      </p>
    </template>

    <!-- Drawer -->
    <SkillDrawer
      :open="drawerOpen"
      :level="selectedLevel"
      :levels="levels"
      @close="closeDrawer"
      @updated="onUpdated"
    />
  </div>
</template>

<style scoped lang="scss">
.skill-up-tab {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-wrap: wrap;
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

.progress-section {
  flex: 1;
  min-width: 200px;
}

.progress-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #1f2937;
}

.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  max-width: 300px;

  &__fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  &__text {
    font-size: 13px;
    font-weight: 600;
    color: #3b82f6;
    white-space: nowrap;
  }
}

.team-summary {
  display: flex;
  gap: 12px;
}

.team-member {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;

  &__avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
  }

  &__name {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }

  &__progress {
    font-size: 12px;
    color: #6b7280;
    font-weight: 600;
  }
}

.empty-msg {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 40px;
}
</style>
