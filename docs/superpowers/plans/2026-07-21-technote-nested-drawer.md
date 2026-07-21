# 기술노트 단계형 뷰어 (중첩 Drawer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 긴 기술노트를 목차 → 단계 클릭 → 상세가 겹쳐 슬라이드되는 중첩 Drawer로 보여준다.

**Architecture:** 프론트엔드 전용. 노트 본문(마크다운)을 `## ` 제목 기준으로 분할하는 순수 함수 `parseNoteSections`를 만들고, `TechNoteDrawer.vue` 보기 모드에서 섹션이 2개 이상이면 목차형으로 렌더한다. 상세는 두 번째 `UiDrawer`를 겹쳐 띄운다. 데이터·백엔드·스키마 변경 없음.

**Tech Stack:** Vue 3 + TypeScript + SCSS, `@leechanyong/ispark-ui`(`UiDrawer`, `UiMarkdownEditor`).

> **테스트 관련:** 이 레포는 테스트 러너가 없다(frontend `package.json` 스크립트 = dev/build/preview). 기존 관례대로 `vue-tsc`(타입) + `vite build`(번들) + 브라우저 도그푸드로 검증한다. 순수 함수는 1회용 node sanity로 확인한다.

---

## 파일 구조

- **Create** `frontend/src/components/tech-notes/parseNoteSections.ts` — 마크다운을 `{ intro, sections[] }`로 분할하는 순수 함수. 단일 책임.
- **Modify** `frontend/src/components/tech-notes/TechNoteDrawer.vue` — 보기 모드에 목차형 분기 + 상세 중첩 Drawer.

기존 `types.ts`, `TechNoteTab.vue`, `TechNoteCard.vue`는 건드리지 않는다(카드 목록/편집 흐름 불변).

---

## Task 1: 섹션 파서 `parseNoteSections`

**Files:**
- Create: `frontend/src/components/tech-notes/parseNoteSections.ts`

- [ ] **Step 1: 파서 파일 작성**

```ts
// 노트 본문(마크다운)을 "## " 제목 기준으로 분할한다.
// - intro: 첫 "## " 이전 전체(# 제목, 리드 문단, 진행현황 등)
// - sections: 각 "## 제목"부터 다음 "##" 직전까지. title은 "## " 뒤 텍스트, body는 제목 제외한 마크다운
// - 코드펜스(```) 안의 "##"은 섹션으로 취급하지 않는다
export interface NoteSection {
  title: string
  body: string
}
export interface ParsedNote {
  intro: string
  sections: NoteSection[]
}

export function parseNoteSections(content: string): ParsedNote {
  const lines = (content ?? '').split('\n')
  const introLines: string[] = []
  const sections: NoteSection[] = []
  let current: { title: string; bodyLines: string[] } | null = null
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    const isH2 = !inFence && /^##\s+/.test(line) // 정확히 "## "만 (### 이상은 제외)

    if (isH2) {
      current = { title: line.replace(/^##\s+/, '').trim(), bodyLines: [] }
      sections.push({ title: current.title, body: '' })
    } else if (current) {
      current.bodyLines.push(line)
      sections[sections.length - 1].body = current.bodyLines.join('\n').trim()
    } else {
      introLines.push(line)
    }
  }

  return { intro: introLines.join('\n').trim(), sections }
}
```

- [ ] **Step 2: 1회용 sanity 확인 (node)**

Run(프로젝트 루트에서):
```bash
node --input-type=module -e '
const src = `# 제목\n리드\n## A\n에이\n\`\`\`\n## 코드안 (무시)\n\`\`\`\n## B\n비\n### 하위(제외)\n끝`;
// 파서 로직을 인라인 복제해 검증(파일은 TS라 직접 import 안 함)
const lines = src.split("\n"); const intro=[]; const secs=[]; let cur=null; let f=false;
for (const l of lines){ if(/^\s*```/.test(l)) f=!f; const h=!f&&/^##\s+/.test(l);
  if(h){cur={t:l.replace(/^##\s+/,"").trim(),b:[]}; secs.push(cur);} else if(cur){cur.b.push(l);} else {intro.push(l);} }
console.log("intro:", JSON.stringify(intro.join("\n").trim()));
console.log("sections:", secs.map(s=>s.t));
'
```
Expected 출력:
```
intro: "# 제목\n리드"
sections: [ 'A', 'B' ]
```
(코드펜스 안 `## 코드안`과 `### 하위`가 섹션에 없으면 통과)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/tech-notes/parseNoteSections.ts
git commit -m "feat: 기술노트 섹션 파서 parseNoteSections 추가"
```

---

## Task 2: 보기 모드 목차형 렌더 (마스터)

`TechNoteDrawer.vue` 보기 모드에서 섹션 2개 이상이면 intro + 단계 리스트를 렌더한다. 섹션 1개 이하면 기존 통짜 렌더 유지.

**Files:**
- Modify: `frontend/src/components/tech-notes/TechNoteDrawer.vue`

- [ ] **Step 1: script에 파서·상태 추가**

`import` 구역에 추가 (기존 `import { ref, computed, watch } from 'vue'` 아래):
```ts
import { parseNoteSections, type NoteSection } from './parseNoteSections'
```

`form` ref 정의 아래에 추가:
```ts
// 상세(중첩 drawer) 대상 섹션
const activeSection = ref<NoteSection | null>(null)

// 본문을 "## " 기준 분할. 섹션 2개 이상이면 목차형으로 표시
const parsed = computed(() => parseNoteSections(form.value.content))
const useSectioned = computed(() => parsed.value.sections.length >= 2)

function openSection(sec: NoteSection) {
  activeSection.value = sec
}
function closeSection() {
  activeSection.value = null
}
```

기존 `watch(() => props.note, ...)` 콜백 마지막 줄(`isEditing.value = false` 다음)에 상세 초기화 추가:
```ts
    activeSection.value = null
```

- [ ] **Step 2: 보기 모드 템플릿 교체**

기존 보기 모드 블록 전체
```html
    <!-- 보기 모드 -->
    <template v-if="!isEditing">
      <div class="drawer-view">
        <div class="drawer-view__meta">
          <UiBadge variant="info" size="sm">{{ categoryLabel }}</UiBadge>
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            variant="default"
            size="sm"
          >{{ tag }}</UiBadge>
        </div>
        <p class="drawer-view__summary">{{ form.summary }}</p>
        <div class="drawer-view__content">
          <UiMarkdownEditor :model-value="form.content" :editable="false" />
        </div>
      </div>
    </template>
```
을 아래로 교체:
```html
    <!-- 보기 모드 -->
    <template v-if="!isEditing">
      <div class="drawer-view">
        <div class="drawer-view__meta">
          <UiBadge variant="info" size="sm">{{ categoryLabel }}</UiBadge>
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            variant="default"
            size="sm"
          >{{ tag }}</UiBadge>
        </div>
        <p v-if="form.summary" class="drawer-view__summary">{{ form.summary }}</p>

        <!-- 섹션 1개 이하: 기존 통짜 렌더 -->
        <div v-if="!useSectioned" class="drawer-view__content">
          <UiMarkdownEditor :model-value="form.content" :editable="false" />
        </div>

        <!-- 섹션 2개 이상: 목차형 -->
        <template v-else>
          <div v-if="parsed.intro" class="drawer-view__intro">
            <UiMarkdownEditor :model-value="parsed.intro" :editable="false" />
          </div>
          <div class="note-toc">
            <button
              v-for="(sec, i) in parsed.sections"
              :key="i"
              class="note-toc__item"
              @click="openSection(sec)"
            >
              <span class="note-toc__title">{{ sec.title }}</span>
              <span class="note-toc__chev">›</span>
            </button>
          </div>
        </template>
      </div>
    </template>
```

- [ ] **Step 3: 목차 스타일 추가**

`<style scoped lang="scss">`의 `.drawer-view { ... }` 블록 안에 추가:
```scss
  &__intro {
    margin-bottom: 12px;
  }
```
그리고 `.drawer-view { ... }` 블록 바깥(같은 style 안)에 추가:
```scss
.note-toc {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note-toc__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
}
.note-toc__title { font-size: 14px; font-weight: 600; color: #1f2937; }
.note-toc__chev { color: #9ca3af; font-size: 18px; }
```

- [ ] **Step 4: 타입체크 + 빌드**

Run:
```bash
cd frontend && npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep -iE "tech-notes|parseNoteSections" ; echo "=== 위에 내 파일 에러 없으면 통과 ===" && npm run build 2>&1 | tail -3
```
Expected: tech-notes/parseNoteSections 관련 에러 없음, 빌드 `built in ...` (exit 0). (레포에 기존 타입 에러가 있으나 내 파일과 무관)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/tech-notes/TechNoteDrawer.vue
git commit -m "feat: 기술노트 보기 모드 목차형 렌더(섹션 2개 이상)"
```

---

## Task 3: 상세 중첩 Drawer (겹쳐 슬라이드)

목차 위에 두 번째 `UiDrawer`를 겹쳐 상세를 띄운다. `UiDrawer`가 슬라이드/배경/ESC를 제공한다.

**Files:**
- Modify: `frontend/src/components/tech-notes/TechNoteDrawer.vue`

- [ ] **Step 1: 상세 Drawer 마크업 추가**

바깥쪽 `<UiDrawer ...>` 닫는 태그(`</UiDrawer>`) **직전**(Footer `</template>` 다음)에 추가:
```html
    <!-- 상세: 중첩 Drawer (목차 위에 겹쳐 슬라이드) -->
    <UiDrawer
      :open="!!activeSection"
      :title="activeSection?.title || ''"
      width="640px"
      @update:open="(v: boolean) => { if (!v) closeSection() }"
    >
      <div class="note-detail">
        <UiMarkdownEditor :model-value="activeSection?.body || ''" :editable="false" />
      </div>
      <template #footer>
        <div class="drawer-footer">
          <UiButton variant="outline" @click="closeSection">‹ 목차로</UiButton>
        </div>
      </template>
    </UiDrawer>
```

- [ ] **Step 2: 타입체크 + 빌드**

Run:
```bash
cd frontend && npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep -iE "tech-notes|parseNoteSections" ; echo "=== 내 파일 에러 없으면 통과 ===" && npm run build 2>&1 | tail -3
```
Expected: 내 파일 에러 없음, 빌드 성공.

- [ ] **Step 3: 브라우저 도그푸드**

준비: 백엔드/프론트 dev 서버 기동(`cd backend && npm run dev`, `cd frontend && npm run dev`), 로그인 후 기술노트 → "기타" → `[상영캘린더] v2 단계별 설계` 노트(#7, `##` 6개) 열기.
확인:
- 노트 열면 상단 intro(진행현황) + **단계 리스트**(진행현황/아키텍처/1·줄거리·포스터/2/3/4)가 뜬다.
- 단계 클릭 → 상세 Drawer가 **겹쳐 슬라이드**로 열리고 그 섹션 본문이 보인다.
- `‹ 목차로`/배경/ESC로 닫으면 목차로 복귀.
- `##` 1개 이하 노트(예: 짧은 노트)는 기존처럼 통짜로 뜬다.

> **만약 두 Drawer가 z-index로 안 겹치면(폴백):** 상세를 별도 Drawer 대신 `.drawer-view` 내부 오버레이 패널로 구현. `.drawer-view { position: relative }` 후 `.note-detail`을 `position:absolute; inset:0; background:#fff; z-index:2;` 로 두고, 상단에 `‹ 목차로` 버튼 + 제목 + 본문을 배치. `<Transition name="slide">`로 오른쪽에서 슬라이드. 이 경우 위 Step 1의 `<UiDrawer>` 대신 `.drawer-view` 안에 패널을 넣는다.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/tech-notes/TechNoteDrawer.vue
git commit -m "feat: 기술노트 상세 중첩 Drawer(겹쳐 슬라이드) 추가"
```

---

## Task 4: 마감 (편집 모드 초기화 + 모바일 확인)

**Files:**
- Modify: `frontend/src/components/tech-notes/TechNoteDrawer.vue`

- [ ] **Step 1: 편집 진입 시 상세 닫기**

`startEdit` 함수 본문을 수정:
```ts
function startEdit() {
  activeSection.value = null
  isEditing.value = true
}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run:
```bash
cd frontend && npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep -iE "tech-notes|parseNoteSections" ; echo "=== 통과 ===" && npm run build 2>&1 | tail -3
```
Expected: 내 파일 에러 없음, 빌드 성공.

- [ ] **Step 3: 모바일 폭 도그푸드**

브라우저 개발자도구에서 폭 375px로 축소 후 노트 열기 → 목차/상세 Drawer가 화면을 벗어나지 않고 상세가 전체폭 근처로 덮이는지 확인. 뒤로/배경 탭 닫힘 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/tech-notes/TechNoteDrawer.vue
git commit -m "feat: 편집 진입 시 상세 초기화 + 모바일 확인"
```

---

## 자기검토 결과

- **스펙 커버리지:** 목차형(Task 2) / 중첩 Drawer 겹쳐 슬라이드(Task 3) / `##` 분할·intro·펜스 무시(Task 1) / 자동 적용 조건 `>=2`(Task 2 `useSectioned`) / 편집 모드 유지(Task 4) / 모바일(Task 4) — 모두 태스크로 매핑됨.
- **플레이스홀더:** 없음. 각 스텝에 실제 코드/명령/기대값 포함.
- **타입 일관성:** `NoteSection{title,body}`, `parseNoteSections`, `activeSection`, `openSection`/`closeSection`, `useSectioned`, `parsed` — Task 1~4에서 이름·시그니처 일치.
- 알려진 리스크(`UiDrawer` 중첩) → Task 3에 폴백 명시.
