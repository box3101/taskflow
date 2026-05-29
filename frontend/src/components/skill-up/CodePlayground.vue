<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiBadge } from '@leechanyong/ispark-ui'

type CodeExercise = {
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  code: string
  answers: string[]
  alternateAnswers?: string[][]
  explanation: string
}

const props = defineProps<{
  exercises: CodeExercise[]
  runnable: boolean
}>()

const emit = defineEmits<{ complete: [score: number] }>()

const activeIdx = ref(0)
const exercise = computed(() => props.exercises[activeIdx.value])

// 빈칸 입력값
const blanks = ref<Record<number, string[]>>({})
function getBlanks(idx: number): string[] {
  if (!blanks.value[idx]) {
    const count = (props.exercises[idx].code.match(/\{\{BLANK:[^}]+\}\}/g) || []).length
    blanks.value[idx] = new Array(count).fill('')
  }
  return blanks.value[idx]
}

// 코드 파싱: {{BLANK:힌트}} → 빈칸 인덱스 추출
function parseCode(code: string) {
  const parts: { type: 'text' | 'blank'; value: string; hint?: string; idx?: number }[] = []
  let blankIdx = 0
  const regex = /\{\{BLANK:([^}]+)\}\}/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: code.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'blank', value: '', hint: match[1], idx: blankIdx++ })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < code.length) {
    parts.push({ type: 'text', value: code.slice(lastIndex) })
  }
  return parts
}

// 실행 상태
const consoleOutput = ref<string[]>([])
const running = ref(false)
const runError = ref('')
const submitted = ref<Record<number, boolean>>({})
const results = ref<Record<number, boolean>>({})

// 정답 체크
function checkAnswer(exIdx: number): boolean {
  const ex = props.exercises[exIdx]
  const userBlanks = getBlanks(exIdx)
  return ex.answers.every((ans, i) => {
    const userAns = userBlanks[i]?.trim()
    if (userAns === ans) return true
    // 대체 정답 체크
    const alts = ex.alternateAnswers?.[i] || []
    return alts.some(alt => userAns === alt)
  })
}

// 코드 빌드 (빈칸을 사용자 입력으로 치환)
function buildCode(exIdx: number): string {
  const ex = props.exercises[exIdx]
  const userBlanks = getBlanks(exIdx)
  let code = ex.code
  let blankIdx = 0
  code = code.replace(/\{\{BLANK:[^}]+\}\}/g, () => {
    return userBlanks[blankIdx++]?.trim() || ''
  })
  return code
}

// eval 실행
async function runCode() {
  const idx = activeIdx.value
  consoleOutput.value = []
  runError.value = ''
  running.value = true
  submitted.value = { ...submitted.value, [idx]: true }

  const isCorrect = checkAnswer(idx)
  results.value = { ...results.value, [idx]: isCorrect }

  if (props.runnable && isCorrect) {
    try {
      const code = buildCode(idx)
      const logs: string[] = []
      const mockConsole = {
        log: (...args: unknown[]) => logs.push(args.map(a => {
          try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a) }
          catch { return String(a) }
        }).join(' ')),
        error: (...args: unknown[]) => logs.push('❌ ' + args.map(String).join(' ')),
        warn: (...args: unknown[]) => logs.push('⚠️ ' + args.map(String).join(' ')),
      }

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
      const fn = new AsyncFunction('console', 'fetch', code)
      await fn(mockConsole, window.fetch)
      consoleOutput.value = logs.length ? logs : ['(출력 없음)']
    } catch (e: any) {
      runError.value = e.message || String(e)
      consoleOutput.value = [`❌ Error: ${runError.value}`]
    }
  }

  running.value = false
  emitScoreIfDone()
}

// 정답 확인 (runnable: false)
function checkOnly() {
  const idx = activeIdx.value
  submitted.value = { ...submitted.value, [idx]: true }
  results.value = { ...results.value, [idx]: checkAnswer(idx) }
  emitScoreIfDone()
}

// 점수 계산 + emit
function emitScoreIfDone() {
  const scoreMap = { easy: 33, medium: 33, hard: 34 }
  let total = 0
  props.exercises.forEach((ex, i) => {
    if (results.value[i]) total += scoreMap[ex.difficulty]
  })
  emit('complete', total)
}

// 다시 풀기
function retry(idx: number) {
  blanks.value[idx] = new Array(getBlanks(idx).length).fill('')
  submitted.value = { ...submitted.value, [idx]: false }
  results.value = { ...results.value, [idx]: false }
  consoleOutput.value = []
  runError.value = ''
}

const difficultyConfig = {
  easy: { label: 'Easy', color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  hard: { label: 'Hard', color: '#ef4444' },
}
</script>

<template>
  <div class="code-playground">
    <!-- 난이도 탭 -->
    <div class="difficulty-tabs">
      <button
        v-for="(ex, i) in exercises"
        :key="i"
        class="diff-tab"
        :class="{ active: activeIdx === i, passed: results[i] }"
        :style="{ '--diff-color': difficultyConfig[ex.difficulty].color }"
        @click="activeIdx = i"
      >
        <span v-if="results[i]">✅</span>
        {{ difficultyConfig[ex.difficulty].label }}
      </button>
    </div>

    <!-- 문제 설명 -->
    <p class="exercise-desc">{{ exercise.description }}</p>

    <!-- 코드 영역 -->
    <div class="code-area">
      <pre class="code-block"><template
        v-for="(part, pi) in parseCode(exercise.code)"
        :key="pi"
      ><span v-if="part.type === 'text'" class="code-text">{{ part.value }}</span><input
          v-else
          class="code-blank"
          :class="{
            correct: submitted[activeIdx] && results[activeIdx] && part.idx !== undefined,
            wrong: submitted[activeIdx] && !results[activeIdx] && part.idx !== undefined,
          }"
          :placeholder="part.hint"
          :value="getBlanks(activeIdx)[part.idx!]"
          :disabled="submitted[activeIdx] && results[activeIdx]"
          :style="{ width: Math.max(80, (exercise.answers[part.idx!]?.length || 6) * 10) + 'px' }"
          @input="(e) => { getBlanks(activeIdx)[part.idx!] = (e.target as HTMLInputElement).value }"
        /></template></pre>
    </div>

    <!-- 실행/확인 버튼 -->
    <div class="action-row">
      <template v-if="!submitted[activeIdx] || !results[activeIdx]">
        <UiButton
          v-if="runnable"
          variant="primary"
          size="sm"
          :disabled="running || getBlanks(activeIdx).some(b => !b.trim())"
          @click="runCode"
        >▶ Run</UiButton>
        <UiButton
          v-else
          variant="primary"
          size="sm"
          :disabled="getBlanks(activeIdx).some(b => !b.trim())"
          @click="checkOnly"
        >정답 확인</UiButton>
      </template>

      <UiButton
        v-if="submitted[activeIdx] && !results[activeIdx]"
        variant="outline"
        size="sm"
        @click="retry(activeIdx)"
      >다시 풀기</UiButton>
    </div>

    <!-- 콘솔 출력 (runnable만) -->
    <div v-if="runnable && consoleOutput.length" class="console-output">
      <div class="console-header">Console Output</div>
      <pre class="console-body"><span v-for="(line, li) in consoleOutput" :key="li">{{ line }}
</span></pre>
    </div>

    <!-- 결과 -->
    <div v-if="submitted[activeIdx]" class="result-area">
      <div v-if="results[activeIdx]" class="result result--pass">
        <UiBadge variant="success" size="sm">✅ 정답!</UiBadge>
        <p class="explanation">{{ exercise.explanation }}</p>
      </div>
      <div v-else class="result result--fail">
        <UiBadge variant="danger" size="sm">❌ 다시 시도해보세요</UiBadge>
        <p class="hint">힌트: {{ exercise.explanation.split('.')[0] }}.</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.code-playground {
  margin-top: 24px;
}

.difficulty-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.diff-tab {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    border-color: var(--diff-color);
    background: color-mix(in srgb, var(--diff-color) 10%, white);
    color: var(--diff-color);
    font-weight: 600;
  }

  &.passed {
    border-color: #22c55e;
    background: #f0fdf4;
  }
}

.exercise-desc {
  font-size: 14px;
  color: #374151;
  margin: 0 0 12px;
  font-weight: 500;
}

.code-area {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

.code-block {
  margin: 0;
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-text {
  color: #e2e8f0;
}

.code-blank {
  font-family: inherit;
  font-size: inherit;
  background: #334155;
  border: 1px dashed #60a5fa;
  border-radius: 4px;
  padding: 2px 6px;
  color: #fbbf24;
  outline: none;
  vertical-align: baseline;

  &::placeholder { color: #64748b; font-style: italic; }
  &:focus { border-color: #3b82f6; background: #1e3a5f; }
  &.correct { border-color: #22c55e; background: #14532d; color: #86efac; }
  &.wrong { border-color: #ef4444; background: #450a0a; color: #fca5a5; }
  &:disabled { opacity: 0.8; cursor: default; }
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.console-output {
  margin-top: 12px;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
}

.console-header {
  background: #334155;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  text-transform: uppercase;
}

.console-body {
  background: #0f172a;
  color: #22c55e;
  padding: 12px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.result-area {
  margin-top: 12px;
}

.result {
  padding: 12px;
  border-radius: 8px;

  &--pass { background: #f0fdf4; border: 1px solid #86efac; }
  &--fail { background: #fef2f2; border: 1px solid #fca5a5; }
}

.explanation {
  font-size: 13px;
  color: #374151;
  margin: 8px 0 0;
  line-height: 1.5;
}

.hint {
  font-size: 13px;
  color: #6b7280;
  margin: 8px 0 0;
  font-style: italic;
}
</style>
