<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { UiDrawer, UiButton, UiBadge, openToast } from '@leechanyong/ispark-ui'
import { marked } from 'marked'
import api from '../../api/client'
import type { SkillLevel } from './SkillCard.vue'
import CodePlayground from './CodePlayground.vue'

const props = defineProps<{
  open: boolean
  level: SkillLevel | null
  levels: SkillLevel[]
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

// 챌린지 타입
type QuizChallenge = {
  type: 'quiz'
  title: string
  questions: { q: string; options: string[]; answer: number }[]
}
type CodeChallenge = {
  type: 'code'
  title: string
  runnable: boolean
  exercises: {
    difficulty: 'easy' | 'medium' | 'hard'
    description: string
    code: string
    answers: string[]
    alternateAnswers?: string[][]
    explanation: string
  }[]
}
type Challenge = QuizChallenge | CodeChallenge

// 상세 데이터
const detail = ref<{
  content: string
  challenge: Challenge | null
  myProgress: { status: string; score: number | null; note: string | null } | null
} | null>(null)

const loading = ref(false)

// 퀴즈 상태
const quizAnswers = ref<Record<number, number>>({})
const quizSubmitted = ref(false)
const quizScore = ref(0)

// 이전/다음 레벨
const prevLevel = computed(() => {
  if (!props.level) return null
  return props.levels.find(l => l.order === props.level!.order - 1) ?? null
})
const nextLevel = computed(() => {
  if (!props.level) return null
  return props.levels.find(l => l.order === props.level!.order + 1) ?? null
})

watch(() => props.level, async (lv) => {
  if (!lv) { detail.value = null; return }
  loading.value = true
  quizAnswers.value = {}
  quizSubmitted.value = false
  quizScore.value = 0
  try {
    const { data } = await api.get(`/skill-up/levels/${lv.id}`)
    detail.value = data.data
    // 첫 진입 시 in_progress로 변경
    if (lv.status === 'locked') {
      await api.patch(`/skill-up/progress/${lv.id}`, { status: 'in_progress' })
      emit('updated')
    }
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
})

function selectAnswer(qIdx: number, optIdx: number) {
  if (quizSubmitted.value) return
  quizAnswers.value = { ...quizAnswers.value, [qIdx]: optIdx }
}

async function submitQuiz() {
  if (!detail.value?.challenge || !props.level) return
  const questions = detail.value.challenge.questions
  let correct = 0
  questions.forEach((q, i) => {
    if (quizAnswers.value[i] === q.answer) correct++
  })
  const score = Math.round((correct / questions.length) * 100)
  quizScore.value = score
  quizSubmitted.value = true

  // 60점 이상이면 완료 처리
  const status = score >= 60 ? 'completed' : 'in_progress'
  await api.patch(`/skill-up/progress/${props.level.id}`, { status, score })
  emit('updated')

  if (score >= 60) {
    openToast({ message: `🎉 ${score}점! 레벨 클리어!`, type: 'success' })
  } else {
    openToast({ message: `${score}점... 60점 이상이면 클리어!`, type: 'warning' })
  }
}

// 코드 챌린지 점수 처리
async function onCodeComplete(score: number) {
  if (!props.level) return
  const status = score >= 60 ? 'completed' : 'in_progress'
  await api.patch(`/skill-up/progress/${props.level.id}`, { status, score })
  emit('updated')
  if (score >= 60) {
    openToast({ message: `🎉 ${score}점! 레벨 클리어!`, type: 'success' })
  }
}

async function markComplete() {
  if (!props.level) return
  await api.patch(`/skill-up/progress/${props.level.id}`, { status: 'completed' })
  emit('updated')
  openToast({ message: '레벨 완료!', type: 'success' })
}

function renderMarkdown(md: string) {
  return marked(md)
}
</script>

<template>
  <UiDrawer :open="open" size="lg" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <template #header>
      <div v-if="level" class="drawer-header">
        <span class="drawer-header__level">Lv.{{ level.order }}</span>
        <span class="drawer-header__icon">{{ level.icon }}</span>
        <span class="drawer-header__title">{{ level.title }}</span>
      </div>
    </template>

    <div v-if="loading" style="text-align: center; padding: 40px; color: #9ca3af;">
      로딩 중...
    </div>

    <div v-else-if="detail" class="skill-detail">
      <!-- 학습 내용 -->
      <div class="skill-detail__content" v-html="renderMarkdown(detail.content)" />

      <!-- 코드 챌린지 -->
      <div v-if="detail.challenge?.type === 'code'" class="skill-quiz">
        <h3 class="skill-quiz__title">🎮 {{ detail.challenge.title }}</h3>
        <CodePlayground
          :exercises="(detail.challenge as CodeChallenge).exercises"
          :runnable="(detail.challenge as CodeChallenge).runnable"
          @complete="onCodeComplete"
        />
      </div>

      <!-- 퀴즈 챌린지 -->
      <div v-else-if="detail.challenge?.type === 'quiz'" class="skill-quiz">
        <h3 class="skill-quiz__title">🎮 {{ detail.challenge.title }}</h3>

        <div
          v-for="(q, qi) in (detail.challenge as QuizChallenge).questions"
          :key="qi"
          class="quiz-question"
        >
          <p class="quiz-question__text">{{ qi + 1 }}. {{ q.q }}</p>
          <div class="quiz-question__options">
            <button
              v-for="(opt, oi) in q.options"
              :key="oi"
              class="quiz-option"
              :class="{
                selected: quizAnswers[qi] === oi,
                correct: quizSubmitted && oi === q.answer,
                wrong: quizSubmitted && quizAnswers[qi] === oi && oi !== q.answer,
              }"
              @click="selectAnswer(qi, oi)"
            >{{ opt }}</button>
          </div>
        </div>

        <div class="quiz-actions">
          <UiButton
            v-if="!quizSubmitted"
            variant="primary"
            size="sm"
            :disabled="Object.keys(quizAnswers).length < (detail.challenge as QuizChallenge).questions.length"
            @click="submitQuiz"
          >제출하기</UiButton>

          <div v-if="quizSubmitted" class="quiz-result">
            <UiBadge :variant="quizScore >= 60 ? 'success' : 'danger'" size="md">
              {{ quizScore }}점 {{ quizScore >= 60 ? '🎉 클리어!' : '😅 다시 도전!' }}
            </UiBadge>
            <UiButton
              v-if="quizScore < 60"
              variant="outline"
              size="sm"
              @click="quizSubmitted = false; quizAnswers = {}"
            >다시 풀기</UiButton>
          </div>
        </div>
      </div>

      <!-- 챌린지 없는 레벨: 수동 완료 -->
      <div v-if="!detail.challenge && level?.status !== 'completed'" class="manual-complete">
        <UiButton variant="primary" @click="markComplete">✅ 학습 완료</UiButton>
      </div>

      <!-- 이전/다음 -->
      <div class="skill-nav">
        <UiButton
          v-if="prevLevel"
          variant="outline"
          size="sm"
          @click="$emit('close'); $nextTick(() => $emit('updated'))"
        >← Lv.{{ prevLevel.order }} {{ prevLevel.title }}</UiButton>
        <span v-else />
        <UiButton
          v-if="nextLevel"
          variant="outline"
          size="sm"
          @click="$emit('close'); $nextTick(() => $emit('updated'))"
        >Lv.{{ nextLevel.order }} {{ nextLevel.title }} →</UiButton>
      </div>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  align-items: center;
  gap: 8px;

  &__level {
    font-size: 12px;
    font-weight: 700;
    color: #3b82f6;
  }
  &__icon { font-size: 20px; }
  &__title { font-size: 16px; font-weight: 600; }
}

.skill-detail {
  &__content {
    line-height: 1.7;
    font-size: 14px;
    color: #374151;

    :deep(h1) { font-size: 20px; margin: 24px 0 12px; font-weight: 700; }
    :deep(h2) { font-size: 16px; margin: 20px 0 8px; font-weight: 600; color: #1f2937; }
    :deep(h3) { font-size: 14px; margin: 16px 0 6px; font-weight: 600; }
    :deep(code) {
      background: #f3f4f6; padding: 2px 6px; border-radius: 4px;
      font-size: 13px; color: #e11d48;
    }
    :deep(pre) {
      background: #1e293b; color: #e2e8f0; padding: 16px;
      border-radius: 8px; overflow-x: auto; margin: 12px 0;
      code { background: none; color: inherit; padding: 0; }
    }
    :deep(ul), :deep(ol) { padding-left: 20px; margin: 8px 0; }
    :deep(li) { margin: 4px 0; }
    :deep(strong) { color: #1f2937; }
  }
}

.skill-quiz {
  margin-top: 32px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;

  &__title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 16px;
  }
}

.quiz-question {
  margin-bottom: 16px;

  &__text {
    font-size: 14px;
    font-weight: 500;
    margin: 0 0 8px;
    color: #1f2937;
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
}

.quiz-option {
  text-align: left;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #3b82f6; background: #eff6ff; }
  &.selected { border-color: #3b82f6; background: #dbeafe; font-weight: 500; }
  &.correct { border-color: #22c55e; background: #dcfce7; }
  &.wrong { border-color: #ef4444; background: #fef2f2; }
}

.quiz-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.quiz-result {
  display: flex;
  align-items: center;
  gap: 12px;
}

.manual-complete {
  margin-top: 24px;
  text-align: center;
}

.skill-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
</style>
