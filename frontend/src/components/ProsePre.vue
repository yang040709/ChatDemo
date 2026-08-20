<script setup lang="ts">
import { ref } from 'vue'

const preRef = ref<HTMLPreElement | null>(null)
const copied = ref(false)

async function onCopy() {
  const text = preRef.value?.textContent ?? ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    // ignore
  }
}
</script>

<template>
  <div class="code-block">
    <div class="code-toolbar">
      <span class="code-lang">code</span>
      <button type="button" class="code-copy" :class="{ copied }" @click="onCopy">
        {{ copied ? '已复制' : '复制' }}
      </button>
    </div>
    <pre ref="preRef" class="code-pre"><slot /></pre>
  </div>
</template>

<style scoped>
.code-block {
  margin: 0.75em 0;
  border-radius: 10px;
  overflow: hidden;
  background: #0d1117;
  border: 1px solid #21262d;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
}

.code-lang {
  font-size: 0.72rem;
  color: #8b949e;
}

.code-copy {
  border: 0;
  background: transparent;
  color: #c9d1d9;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
}

.code-copy:hover {
  background: #21262d;
}

.code-copy.copied {
  color: #3fb950;
}

.code-pre {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
  background: transparent;
  font-size: 0.85rem;
  line-height: 1.55;
}
</style>
