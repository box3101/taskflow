<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UiIcon, UiInput, openToast } from '@leechanyong/ispark-ui'
import api from '../../api/client'

// 명언 fallback (API 실패 시 사용)
const fallbackQuotes = [
  { text: '성공은 매일 반복하는 작은 노력의 합이다.', author: '로버트 콜리어' },
  { text: '오늘 할 수 있는 일을 내일로 미루지 마라.', author: '벤저민 프랭클린' },
  { text: '시작이 반이다.', author: '아리스토텔레스' },
  { text: '실패는 성공의 어머니다.', author: '토마스 에디슨' },
  { text: '작은 기회로부터 종종 위대한 업적이 시작된다.', author: '데모스테네스' },
  { text: '행동은 모든 성공의 기초적인 열쇠이다.', author: '파블로 피카소' },
  { text: '배움에는 왕도가 없다.', author: '유클리드' },
  { text: '천 리 길도 한 걸음부터.', author: '노자' },
  { text: '꿈을 이루고자 하는 의지가 있는 자에게 불가능이란 없다.', author: '알렉산더 대왕' },
  { text: '오늘이 인생에서 가장 젊은 날이다.', author: '작자 미상' },
  { text: '위대한 일을 하는 유일한 방법은 하는 일을 사랑하는 것이다.', author: '스티브 잡스' },
  { text: '멈추지 않는 한, 얼마나 천천히 가는지는 중요하지 않다.', author: '공자' },
  { text: '인생은 자전거를 타는 것과 같다. 균형을 잡으려면 움직여야 한다.', author: '알베르트 아인슈타인' },
  { text: '할 수 있다고 믿는 사람은 결국 해낸다.', author: '샤를 드 골' },
  { text: '모든 성취의 시작점은 갈망이다.', author: '나폴레온 힐' },
  { text: '가장 큰 영광은 한 번도 실패하지 않음이 아니라, 실패할 때마다 다시 일어서는 것이다.', author: '공자' },
  { text: '나 자신에 대한 자신감을 잃으면, 온 세상이 나의 적이 된다.', author: '랄프 왈도 에머슨' },
  { text: '지금 하지 않으면 언제 하겠는가.', author: '탈무드' },
  { text: '꿈은 도망가지 않는다. 도망가는 것은 언제나 자기 자신이다.', author: '작자 미상' },
  { text: '노력한 자는 결코 배신당하지 않는다.', author: '작자 미상' },
  { text: '오늘의 나는 어제의 나보다 나아야 한다.', author: '작자 미상' },
  { text: '포기하지 않으면 실패는 없다.', author: '작자 미상' },
  { text: '생각이 바뀌면 행동이 바뀌고, 행동이 바뀌면 습관이 바뀐다.', author: '윌리엄 제임스' },
  { text: '지혜로운 자는 기회를 만들어내고, 그렇지 못한 자는 기회를 기다린다.', author: '프랜시스 베이컨' },
  { text: '뜻이 있는 곳에 길이 있다.', author: '속담' },
  { text: '용기란 두려움이 없는 것이 아니라, 두려움을 이겨내는 것이다.', author: '넬슨 만델라' },
  { text: '미래는 현재 우리가 무엇을 하는가에 달려 있다.', author: '마하트마 간디' },
  { text: '완벽을 두려워하지 마라. 완벽에 도달할 수 없으니까.', author: '살바도르 달리' },
  { text: '가장 어두운 밤도 끝나고, 해는 반드시 뜬다.', author: '빅토르 위고' },
  { text: '당신이 할 수 있다고 꿈꾸는 일은 무엇이든 시작하라.', author: '괴테' },
]

interface Quote {
  text: string
  author: string
}

interface Motto {
  id: number
  content: string
  date: string
}

const quote = ref<Quote>({ text: '', author: '' })
const motto = ref<Motto | null>(null)
const isEditing = ref(false)
const mottoInput = ref('')

// 날짜 기반 fallback 명언 선택
function getFallbackQuote(): Quote {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  return fallbackQuotes[dayOfYear % fallbackQuotes.length]
}

// 외부 API로 명언 가져오기
async function fetchQuote() {
  try {
    const res = await fetch('https://korean-advice-open-api.vercel.app/api/advice')
    const data = await res.json()
    if (data.message && data.author) {
      quote.value = { text: data.message, author: data.author }
      return
    }
  } catch {
    // API 실패 시 fallback
  }
  quote.value = getFallbackQuote()
}

// 오늘의 각오 조회
async function fetchMotto() {
  try {
    const { data } = await api.get('/daily-motto/today')
    motto.value = data.data
  } catch {
    // 조회 실패 시 무시
  }
}

// 각오 저장
async function saveMotto() {
  const content = mottoInput.value.trim()
  if (!content) return
  try {
    const { data } = await api.post('/daily-motto', { content })
    motto.value = data.data
    isEditing.value = false
    openToast({ message: '각오가 저장되었습니다.', type: 'success' })
  } catch {
    openToast({ message: '각오 저장에 실패했습니다.', type: 'error' })
  }
}

// 각오 삭제
async function deleteMotto() {
  if (!motto.value) return
  try {
    await api.delete(`/daily-motto/${motto.value.id}`)
    motto.value = null
    mottoInput.value = ''
  } catch {
    openToast({ message: '각오 삭제에 실패했습니다.', type: 'error' })
  }
}

// 편집 시작
function startEdit() {
  mottoInput.value = ''
  isEditing.value = true
}

// 편집 취소
function cancelEdit() {
  isEditing.value = false
  mottoInput.value = ''
}

onMounted(() => {
  fetchQuote()
  fetchMotto()
})
</script>

<template>
  <div class="daily-quote">
    <!-- 명언 -->
    <div class="daily-quote__text">
      <span class="daily-quote__mark">❝</span>
      <p class="daily-quote__content">{{ quote.text }}</p>
      <span class="daily-quote__author">— {{ quote.author }}</span>
    </div>

    <!-- 각오 -->
    <div class="daily-quote__motto">
      <template v-if="motto && !isEditing">
        <UiIcon name="pencil" :size="14" class="daily-quote__motto-icon" />
        <span class="daily-quote__motto-text">오늘의 각오: {{ motto.content }}</span>
        <button class="daily-quote__motto-delete" @click="deleteMotto">
          <UiIcon name="x" :size="14" />
        </button>
      </template>
      <template v-else-if="isEditing">
        <form class="daily-quote__motto-form" @submit.prevent="saveMotto">
          <UiInput
            v-model="mottoInput"
            placeholder="오늘의 각오를 입력하세요..."
            size="sm"
            autofocus
            @keyup.escape="cancelEdit"
          />
        </form>
      </template>
      <template v-else>
        <button class="daily-quote__motto-add" @click="startEdit">
          + 오늘의 각오 작성...
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.daily-quote {
  background: #f8f5f0;
  border-radius: 12px;
  padding: 20px;
}

.daily-quote__text {
  position: relative;
}

.daily-quote__mark {
  font-size: 32px;
  color: #d4c5a9;
  line-height: 1;
  display: block;
  margin-bottom: 4px;
}

.daily-quote__content {
  font-size: 15px;
  font-style: italic;
  color: #4a4a4a;
  line-height: 1.6;
  margin: 0;
}

.daily-quote__author {
  display: block;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}

.daily-quote__motto {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.daily-quote__motto-icon {
  color: #9ca3af;
  flex-shrink: 0;
}

.daily-quote__motto-text {
  flex: 1;
  font-size: 13px;
  color: #374151;
}

.daily-quote__motto-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #ef4444;
  }
}

.daily-quote__motto-form {
  flex: 1;
}

.daily-quote__motto-add {
  background: none;
  border: none;
  font-size: 13px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: #3c69db;
  }
}
</style>
