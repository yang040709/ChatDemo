<script setup lang="ts">
import { computed } from 'vue'
import { Markdown } from '@comark/vue'
import math, { Math as KatexMath } from '@comark/vue/plugins/math'
import shiki from '@comark/vue/plugins/shiki'
import githubDark from 'shiki/themes/github-dark.mjs'
import { stabilizeStreamingMarkdown } from '@/utils/markdown'
import ProsePre from '@/components/ProsePre.vue'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const plugins = [
  math(),
  shiki({
    themes: {
      dark: githubDark,
      light: githubDark,
    },
  }),
]

const components = {
  Math: KatexMath,
  pre: ProsePre,
  ProsePre,
}

/**
 * 流式时：
 * 1) stabilizeStreamingMarkdown 补全未闭合 fence / 行尾换行（列表识别依赖）
 * 2) Comark streaming + autoClose 补全粗体/链接等半截语法
 * 这样有序/无序列表在输出中与输出后结构一致
 */
const value = computed(() =>
  stabilizeStreamingMarkdown(props.content, props.streaming === true),
  // props.content,
)
</script>

<template>
  <Suspense>
    <Markdown
      class="app-markdown"
      :value="value"
      :streaming="streaming === true"
      :caret="streaming === true"
      :plugins="plugins"
      :components="components"
      :options="{ autoClose: true, linkify: true }"
    />
    <template #fallback>
      <div class="md-fallback plain">{{ content }}</div>
    </template>
  </Suspense>
</template>

<style scoped>
.md-fallback {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Comark 输出样式：列表间距对齐 DeepSeek 类产品，避免 li>p 双倍留白导致「流式中/结束后」观感跳动 */
:deep(.app-markdown) {
  word-break: break-word;
  line-height: 1.55;
  font-size: 0.95rem;
}

:deep(.app-markdown > *:first-child) {
  margin-top: 0;
}

:deep(.app-markdown > *:last-child) {
  margin-bottom: 0;
}

:deep(.app-markdown h1),
:deep(.app-markdown h2),
:deep(.app-markdown h3),
:deep(.app-markdown h4) {
  margin: 0.85em 0 0.45em;
  line-height: 1.3;
  font-weight: 650;
}

:deep(.app-markdown h1) { font-size: 1.35rem; }
:deep(.app-markdown h2) { font-size: 1.2rem; }
:deep(.app-markdown h3) { font-size: 1.08rem; }

:deep(.app-markdown p) {
  margin: 0.5em 0;
}

:deep(.app-markdown ul),
:deep(.app-markdown ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

:deep(.app-markdown li) {
  margin: 0.2em 0;
  padding-left: 0.15em;
}

:deep(.app-markdown li > p) {
  margin: 0.15em 0;
}

:deep(.app-markdown li > p:first-child) {
  margin-top: 0;
}

:deep(.app-markdown li > p:last-child) {
  margin-bottom: 0;
}

:deep(.app-markdown ul ul),
:deep(.app-markdown ul ol),
:deep(.app-markdown ol ul),
:deep(.app-markdown ol ol) {
  margin: 0.2em 0;
}

:deep(.app-markdown blockquote) {
  margin: 0.6em 0;
  padding: 0.2em 0.85em;
  border-left: 3px solid #cbd5e1;
  color: #475569;
}

:deep(.app-markdown a) {
  color: #2563eb;
  text-decoration: underline;
}

:deep(.app-markdown hr) {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}

:deep(.app-markdown :not(pre) > code) {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.88em;
  background: #f1f5f9;
  padding: 0.12em 0.35em;
  border-radius: 4px;
}

:deep(.app-markdown .katex-display) {
  margin: 0.75em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

:deep(.app-markdown table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.7em 0;
  font-size: 0.9rem;
  display: block;
  overflow-x: auto;
}

:deep(.app-markdown th),
:deep(.app-markdown td) {
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  text-align: left;
}

:deep(.app-markdown th) {
  background: #f8fafc;
  font-weight: 600;
}

/* Comark caret */
:deep(.app-markdown .comark-caret),
:deep(.app-markdown [data-caret]) {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: #2563eb;
  vertical-align: -0.1em;
  animation: caret-blink 1s steps(1) infinite;
}

@keyframes caret-blink {
  50% { opacity: 0; }
}
</style>
