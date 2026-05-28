# AI Tools 탭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ProjectsView에 AI Tools 탭을 추가하여 Claude Code 생태계 도구/스킬을 카드 형태로 관리하고 마크다운 상세 가이드를 제공한다.

**Architecture:** Prisma AiTool 모델 + Express CRUD API + Vue 3 컴포넌트 3개(AiToolsTab, AiToolCard, AiToolDrawer). 기존 Todos CRUD 패턴을 그대로 따른다.

**Tech Stack:** Prisma + Express + Vue 3 + ispark-ui + marked (마크다운 렌더링)

---

## 파일 구조

### 백엔드

| 파일 | 역할 |
|------|------|
| `backend/prisma/schema.prisma` | AiTool 모델 추가 |
| `backend/src/routes/aiTools.ts` | AI Tools CRUD 라우트 (새 파일) |
| `backend/src/app.ts` | aiTools 라우트 등록 |

### 프론트엔드

| 파일 | 역할 |
|------|------|
| `frontend/src/components/ai-tools/AiToolsTab.vue` | 카드 목록 + 필터 + 검색 (새 파일) |
| `frontend/src/components/ai-tools/AiToolCard.vue` | 개별 카드 (새 파일) |
| `frontend/src/components/ai-tools/AiToolDrawer.vue` | 상세/생성/수정 Drawer (새 파일) |
| `frontend/src/views/ProjectsView.vue` | AI Tools 탭 추가 + import |

---

## Task 1: Prisma AiTool 모델 추가 + 마이그레이션

**Files:**
- Modify: `backend/prisma/schema.prisma` (파일 끝에 추가)

- [ ] **Step 1: schema.prisma에 AiTool 모델 추가**

`backend/prisma/schema.prisma` 파일 끝에 추가:

```prisma
model AiTool {
  id          Int      @id @default(autoincrement())
  title       String
  description String
  content     String   @db.Text
  tags        String[]
  icon        String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  authorId    Int      @map("author_id")
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@map("ai_tools")
}
```

그리고 기존 `User` 모델에 relation 추가:

```prisma
// User 모델의 relations 부분에 추가
aiTools   AiTool[]
```

- [ ] **Step 2: 마이그레이션 생성 및 적용**

Run:
```bash
cd backend && npx prisma migrate dev --name add-ai-tools
```

Expected: `Migration add-ai-tools created and applied`

- [ ] **Step 3: Prisma Client 재생성 확인**

Run:
```bash
cd backend && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: 커밋**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: AiTool Prisma 모델 추가"
```

---

## Task 2: 백엔드 AI Tools CRUD 라우트

**Files:**
- Create: `backend/src/routes/aiTools.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: aiTools.ts 라우트 파일 생성**

`backend/src/routes/aiTools.ts`:

```typescript
import { Router } from 'express'
import prisma from '../prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// 목록 조회 (태그 필터 + 검색)
router.get('/', async (req, res) => {
  try {
    const tag = req.query.tag as string | undefined
    const search = req.query.search as string | undefined

    const where: Record<string, unknown> = {}
    if (tag) {
      where.tags = { has: tag }
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const data = await prisma.aiTool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.json({ data })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const tool = await prisma.aiTool.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    if (!tool) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }
    res.json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 생성
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, description, content, tags, icon } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '제목을 입력해주세요.' })
      return
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ message: '설명을 입력해주세요.' })
      return
    }

    const tool = await prisma.aiTool.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        content: content ?? '',
        tags: Array.isArray(tags) ? tags : [],
        icon: icon ?? null,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.status(201).json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 수정
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { title, description, content, tags, icon } = req.body

    const existing = await prisma.aiTool.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (description !== undefined) updateData.description = String(description).trim()
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (icon !== undefined) updateData.icon = icon || null

    const tool = await prisma.aiTool.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    res.json({ data: tool })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    const existing = await prisma.aiTool.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AI 도구를 찾을 수 없습니다.' })
      return
    }

    await prisma.aiTool.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
```

- [ ] **Step 2: app.ts에 라우트 등록**

`backend/src/app.ts` 상단 import 추가:

```typescript
import aiToolRouter from './routes/aiTools'
```

라우트 등록 부분에 추가 (`app.use('/stock', stockRouter)` 아래):

```typescript
app.use('/ai-tools', aiToolRouter)
```

- [ ] **Step 3: 백엔드 빌드 확인**

Run:
```bash
cd backend && npm run build
```

Expected: 에러 없이 빌드 완료

- [ ] **Step 4: 커밋**

```bash
git add backend/src/routes/aiTools.ts backend/src/app.ts
git commit -m "feat: AI Tools CRUD API 추가"
```

---

## Task 3: 프론트엔드 marked 라이브러리 설치

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: marked 설치**

Run:
```bash
cd frontend && npm install marked
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: marked 라이브러리 추가 (마크다운 렌더링)"
```

---

## Task 4: AiToolCard.vue 컴포넌트

**Files:**
- Create: `frontend/src/components/ai-tools/AiToolCard.vue`

- [ ] **Step 1: AiToolCard.vue 생성**

`frontend/src/components/ai-tools/AiToolCard.vue`:

```vue
<template>
  <div class="ai-tool-card" @click="$emit('click')">
    <div class="ai-tool-card__icon">
      {{ tool.icon || '🔧' }}
    </div>
    <h3 class="ai-tool-card__title">{{ tool.title }}</h3>
    <p class="ai-tool-card__desc">{{ tool.description }}</p>
    <div class="ai-tool-card__tags">
      <UiBadge
        v-for="tag in tool.tags"
        :key="tag"
        :label="tag"
        variant="secondary"
        size="sm"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiBadge } from '@leechanyong/ispark-ui'

export interface AiTool {
  id: number
  title: string
  description: string
  content: string
  tags: string[]
  icon: string | null
  author: { id: number; name: string; email: string }
  createdAt: string
  updatedAt: string
}

defineProps<{ tool: AiTool }>()
defineEmits<{ click: [] }>()
</script>

<style scoped lang="scss">
.ai-tool-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  &__icon {
    font-size: 28px;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #1a1f2b;
    margin-bottom: 6px;
  }

  &__desc {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 12px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/ai-tools/AiToolCard.vue
git commit -m "feat: AiToolCard 컴포넌트 추가"
```

---

## Task 5: AiToolDrawer.vue 컴포넌트

**Files:**
- Create: `frontend/src/components/ai-tools/AiToolDrawer.vue`

- [ ] **Step 1: AiToolDrawer.vue 생성**

`frontend/src/components/ai-tools/AiToolDrawer.vue`:

```vue
<template>
  <UiDrawer
    :open="open"
    :title="isEditing ? (form.id ? '도구 수정' : '새 도구 추가') : form.title"
    width="560px"
    @close="$emit('close')"
  >
    <!-- 보기 모드 -->
    <template v-if="!isEditing">
      <div class="drawer-view">
        <div class="drawer-view__actions">
          <UiButton size="sm" variant="outline" @click="startEdit">수정</UiButton>
          <UiButton size="sm" variant="danger" @click="handleDelete">삭제</UiButton>
        </div>
        <div class="drawer-view__tags">
          <UiBadge
            v-for="tag in form.tags"
            :key="tag"
            :label="tag"
            variant="secondary"
            size="sm"
          />
        </div>
        <div class="drawer-view__content markdown-body" v-html="renderedContent"></div>
      </div>
    </template>

    <!-- 편집 모드 -->
    <template v-else>
      <div class="drawer-edit">
        <div class="drawer-edit__field">
          <label>제목</label>
          <UiInput v-model="form.title" placeholder="도구/스킬 이름" />
        </div>
        <div class="drawer-edit__field">
          <label>설명</label>
          <UiInput v-model="form.description" placeholder="한 줄 설명" />
        </div>
        <div class="drawer-edit__field">
          <label>태그 (콤마 구분)</label>
          <UiInput v-model="tagsInput" placeholder="superpowers, 계획, 배포" />
        </div>
        <div class="drawer-edit__field">
          <label>아이콘 (이모지)</label>
          <UiInput v-model="form.icon" placeholder="🔧" />
        </div>
        <div class="drawer-edit__field">
          <label>내용 (마크다운)</label>
          <UiTextarea v-model="form.content" placeholder="마크다운으로 상세 가이드 작성..." :rows="15" />
        </div>
        <div class="drawer-edit__actions">
          <UiButton variant="outline" @click="cancelEdit">취소</UiButton>
          <UiButton @click="handleSave" :disabled="!form.title.trim()">저장</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { UiDrawer, UiButton, UiBadge, UiInput, UiTextarea } from '@leechanyong/ispark-ui'
import type { AiTool } from './AiToolCard.vue'

const props = defineProps<{
  open: boolean
  tool: AiTool | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: Partial<AiTool>]
  delete: [id: number]
}>()

const isEditing = ref(false)
const form = ref({
  id: 0,
  title: '',
  description: '',
  content: '',
  tags: [] as string[],
  icon: '',
})

const tagsInput = computed({
  get: () => form.value.tags.join(', '),
  set: (val: string) => {
    form.value.tags = val.split(',').map(t => t.trim()).filter(Boolean)
  },
})

const renderedContent = computed(() => {
  return marked(form.value.content || '*내용이 없습니다.*')
})

watch(() => props.tool, (tool) => {
  if (tool) {
    form.value = {
      id: tool.id,
      title: tool.title,
      description: tool.description,
      content: tool.content,
      tags: [...tool.tags],
      icon: tool.icon || '',
    }
    isEditing.value = false
  }
}, { immediate: true })

watch(() => props.open, (open) => {
  if (open && !props.tool) {
    // 새로 추가 모드
    form.value = { id: 0, title: '', description: '', content: '', tags: [], icon: '' }
    isEditing.value = true
  }
})

function startEdit() {
  isEditing.value = true
}

function cancelEdit() {
  if (props.tool) {
    form.value = {
      id: props.tool.id,
      title: props.tool.title,
      description: props.tool.description,
      content: props.tool.content,
      tags: [...props.tool.tags],
      icon: props.tool.icon || '',
    }
    isEditing.value = false
  } else {
    emit('close')
  }
}

function handleSave() {
  emit('save', {
    id: form.value.id || undefined,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    content: form.value.content,
    tags: form.value.tags,
    icon: form.value.icon || null,
  })
}

function handleDelete() {
  if (form.value.id) {
    emit('delete', form.value.id)
  }
}
</script>

<style scoped lang="scss">
.drawer-view {
  &__actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 20px;
  }

  &__content {
    line-height: 1.7;
    font-size: 14px;
    color: #374151;

    :deep(h1), :deep(h2), :deep(h3) {
      margin-top: 24px;
      margin-bottom: 8px;
      color: #1a1f2b;
    }

    :deep(h2) { font-size: 18px; }
    :deep(h3) { font-size: 16px; }

    :deep(pre) {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 12px 16px;
      overflow-x: auto;
      font-size: 13px;
      margin: 12px 0;
    }

    :deep(code) {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }

    :deep(pre code) {
      background: none;
      padding: 0;
    }

    :deep(ul), :deep(ol) {
      padding-left: 20px;
      margin: 8px 0;
    }

    :deep(blockquote) {
      border-left: 3px solid #3b82f6;
      padding-left: 12px;
      color: #6b7280;
      margin: 12px 0;
    }
  }
}

.drawer-edit {
  &__field {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 24px;
  }
}
</style>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/ai-tools/AiToolDrawer.vue
git commit -m "feat: AiToolDrawer 컴포넌트 추가"
```

---

## Task 6: AiToolsTab.vue 컴포넌트

**Files:**
- Create: `frontend/src/components/ai-tools/AiToolsTab.vue`

- [ ] **Step 1: AiToolsTab.vue 생성**

`frontend/src/components/ai-tools/AiToolsTab.vue`:

```vue
<template>
  <div class="ai-tools-tab">
    <UiLoading :loading="loading" overlay>
      <!-- 상단 바: 필터 + 검색 + 추가 -->
      <div class="ai-tools-tab__header">
        <div class="ai-tools-tab__filters">
          <button
            class="filter-chip"
            :class="{ active: !selectedTag }"
            @click="selectedTag = ''"
          >전체</button>
          <button
            v-for="tag in allTags"
            :key="tag"
            class="filter-chip"
            :class="{ active: selectedTag === tag }"
            @click="selectedTag = selectedTag === tag ? '' : tag"
          >{{ tag }}</button>
        </div>
        <div class="ai-tools-tab__actions">
          <UiInput
            v-model="searchQuery"
            placeholder="검색..."
            size="sm"
            style="width: 200px"
          />
          <UiButton size="sm" @click="openCreate">+ 새 도구</UiButton>
        </div>
      </div>

      <!-- 카드 그리드 -->
      <div v-if="filteredTools.length" class="ai-tools-tab__grid">
        <AiToolCard
          v-for="tool in filteredTools"
          :key="tool.id"
          :tool="tool"
          @click="openDetail(tool)"
        />
      </div>
      <UiEmpty v-else message="등록된 AI 도구가 없습니다." />

      <!-- Drawer -->
      <AiToolDrawer
        :open="drawerOpen"
        :tool="selectedTool"
        @close="closeDrawer"
        @save="handleSave"
        @delete="handleDelete"
      />
    </UiLoading>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiInput, UiEmpty, UiLoading, openToast, openConfirm } from '@leechanyong/ispark-ui'
import api from '../../api/client'
import AiToolCard from './AiToolCard.vue'
import AiToolDrawer from './AiToolDrawer.vue'
import type { AiTool } from './AiToolCard.vue'

const tools = ref<AiTool[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedTag = ref('')
const drawerOpen = ref(false)
const selectedTool = ref<AiTool | null>(null)

// 전체 태그 목록 (중복 제거)
const allTags = computed(() => {
  const tagSet = new Set<string>()
  tools.value.forEach(t => t.tags.forEach(tag => tagSet.add(tag)))
  return Array.from(tagSet).sort()
})

// 필터링된 목록
const filteredTools = computed(() => {
  let result = tools.value
  if (selectedTag.value) {
    result = result.filter(t => t.tags.includes(selectedTag.value))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }
  return result
})

async function loadTools() {
  loading.value = true
  try {
    const res = await api.get('/ai-tools')
    tools.value = res.data.data
  } catch {
    openToast({ message: '도구 목록을 불러오지 못했습니다.', type: 'error' })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  selectedTool.value = null
  drawerOpen.value = true
}

function openDetail(tool: AiTool) {
  selectedTool.value = tool
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  selectedTool.value = null
}

async function handleSave(data: Partial<AiTool>) {
  try {
    if (data.id) {
      await api.put(`/ai-tools/${data.id}`, data)
      openToast({ message: '수정되었습니다.', type: 'success' })
    } else {
      await api.post('/ai-tools', data)
      openToast({ message: '추가되었습니다.', type: 'success' })
    }
    closeDrawer()
    await loadTools()
  } catch {
    openToast({ message: '저장에 실패했습니다.', type: 'error' })
  }
}

async function handleDelete(id: number) {
  const confirmed = await openConfirm({
    title: '삭제 확인',
    message: '이 도구를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
  })
  if (!confirmed) return

  try {
    await api.delete(`/ai-tools/${id}`)
    openToast({ message: '삭제되었습니다.', type: 'success' })
    closeDrawer()
    await loadTools()
  } catch {
    openToast({ message: '삭제에 실패했습니다.', type: 'error' })
  }
}

onMounted(loadTools)

defineExpose({ loadTools })
</script>

<style scoped lang="scss">
.ai-tools-tab {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
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

.filter-chip {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  &.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}
</style>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/ai-tools/AiToolsTab.vue
git commit -m "feat: AiToolsTab 컴포넌트 추가"
```

---

## Task 7: ProjectsView에 AI Tools 탭 연결

**Files:**
- Modify: `frontend/src/views/ProjectsView.vue`

- [ ] **Step 1: import 추가**

`ProjectsView.vue` 상단 import 영역에 추가:

```typescript
import AiToolsTab from '../components/ai-tools/AiToolsTab.vue'
```

- [ ] **Step 2: 탭 배열에 AI Tools 추가**

기존 `mainTabs` 배열 수정:

```typescript
const mainTabs: TabItem[] = [
  { label: '프로젝트', value: 'projects' },
  { label: '개인할일', value: 'todos' },
  { label: 'AI Tools', value: 'ai-tools' },
  { label: '주식', value: 'stock', disabled: true },
]
```

- [ ] **Step 3: onTabChange에 ai-tools 처리 추가**

`onTabChange` 함수는 수정 불필요 — AiToolsTab이 `onMounted`에서 자동 로드하므로 별도 lazy load 처리 없음.

- [ ] **Step 4: template에 AI Tools 탭 콘텐츠 추가**

Stock 탭 `<div v-if="activeTab === 'stock'">` 위에 추가:

```vue
<!-- AI Tools 탭 -->
<div v-if="activeTab === 'ai-tools'" class="tab-content">
  <AiToolsTab />
</div>
```

- [ ] **Step 5: 로컬 dev 서버에서 확인**

Run:
```bash
cd frontend && npm run dev
```

브라우저에서 `http://localhost:5173` 접속 → 로그인 → "AI Tools" 탭 클릭 → 빈 상태 확인 → "새 도구" 버튼으로 추가 테스트

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/views/ProjectsView.vue
git commit -m "feat: ProjectsView에 AI Tools 탭 연결"
```

---

## Task 8: 전체 빌드 확인 및 최종 커밋

- [ ] **Step 1: 백엔드 빌드**

Run:
```bash
cd backend && npm run build
```

Expected: 에러 없이 완료

- [ ] **Step 2: 프론트엔드 빌드**

Run:
```bash
cd frontend && npm run build
```

Expected: 에러 없이 완료

- [ ] **Step 3: 최종 push (Railway 자동 배포)**

Run:
```bash
git push origin main
```

Expected: Railway에서 자동 배포 트리거
