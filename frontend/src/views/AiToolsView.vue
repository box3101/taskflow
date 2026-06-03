<script setup lang="ts">
import { ref } from 'vue'
import { UiTab } from '@leechanyong/ispark-ui'
import type { TabItem } from '@leechanyong/ispark-ui'
import AiToolsTab from '../components/ai-tools/AiToolsTab.vue'
import TechNoteTab from '../components/tech-notes/TechNoteTab.vue'

const activeTab = ref('tools')

const tabs: TabItem[] = [
  { label: '도구 가이드', value: 'tools' },
  { label: '기술 노트', value: 'notes' },
]
</script>

<template>
  <div class="ai-tools-view">
    <UiTab v-model="activeTab" :tabs="tabs" align="left" />
    <div class="ai-tools-view__content">
      <AiToolsTab v-if="activeTab === 'tools'" />
      <TechNoteTab v-if="activeTab === 'notes'" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-tools-view {
  &__content {
    padding-top: 24px;
  }
}
</style>
