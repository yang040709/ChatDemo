<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore, type LocalMessage } from '@/stores/chat'
import AppMarkdown from '@/components/AppMarkdown.vue'

const NEAR_BOTTOM_PX = 96

const store = useChatStore()
const {
  conversations,
  currentId,
  messages,
  streaming,
  loadingList,
  loadingMessages,
  error,
  systemPrompt,
  canRegenerate,
} = storeToRefs(store)

const input = ref('')
const listRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const stickToBottom = ref(true)
const showJumpBottom = ref(false)
const copiedId = ref<number | string | null>(null)
const showPromptModal = ref(false)
const promptDraft = ref('')
let scrollRaf = 0
let copyTimer = 0

const lastAssistant = computed(() => {
  const list = messages.value
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m?.role === 'assistant') return m
  }
  return null
})

const isWaitingFirstToken = computed(
  () => streaming.value && !!lastAssistant.value?.pending && !lastAssistant.value.content,
)

function isLastAssistant(m: LocalMessage) {
  return lastAssistant.value?.id === m.id
}

function openPromptModal() {
  promptDraft.value = systemPrompt.value
  showPromptModal.value = true
}

function closePromptModal() {
  showPromptModal.value = false
}

function savePrompt() {
  store.setSystemPrompt(promptDraft.value)
  showPromptModal.value = false
}

async function copyMessage(m: LocalMessage) {
  const text = m.content
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = m.id
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copiedId.value = null
    }, 1200)
  } catch {
    // ignore
  }
}

function distanceFromBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function updateStickFromScroll() {
  const el = listRef.value
  if (!el) return
  const near = distanceFromBottom(el) <= NEAR_BOTTOM_PX
  stickToBottom.value = near
  showJumpBottom.value = !near && messages.value.length > 0
}

function scrollToBottom(force = false, behavior: ScrollBehavior = 'auto') {
  const el = listRef.value
  if (!el) return
  if (!force && !stickToBottom.value) {
    showJumpBottom.value = true
    return
  }
  el.scrollTo({ top: el.scrollHeight, behavior })
  stickToBottom.value = true
  showJumpBottom.value = false
}

function scheduleFollowScroll() {
  if (!stickToBottom.value) {
    showJumpBottom.value = true
    return
  }
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrollToBottom(false, 'auto')
  })
}

function onMessagesScroll() {
  updateStickFromScroll()
}

function jumpToBottom() {
  stickToBottom.value = true
  scrollToBottom(true, 'smooth')
}

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

watch(messages, () => {
  void nextTick(() => scheduleFollowScroll())
}, { deep: true })

watch(currentId, async () => {
  stickToBottom.value = true
  await nextTick()
  scrollToBottom(true, 'auto')
})

watch(loadingMessages, async (loading) => {
  if (!loading) {
    stickToBottom.value = true
    await nextTick()
    scrollToBottom(true, 'auto')
  }
})

onMounted(() => {
  void store.loadConversations()
})

async function onSubmit() {
  const text = input.value
  if (!text.trim() || streaming.value) return
  input.value = ''
  resizeTextarea()
  stickToBottom.value = true
  await nextTick()
  scrollToBottom(true, 'smooth')
  await store.sendMessage(text)
  await nextTick()
  textareaRef.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void onSubmit()
  }
}

function isStreamingBubble(m: { id: number | string }) {
  return streaming.value && lastAssistant.value?.id === m.id
}

function onStop() {
  store.stopGeneration()
}

async function onRegenerate() {
  stickToBottom.value = true
  await nextTick()
  scrollToBottom(true, 'smooth')
  await store.regenerate()
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-head">
        <h1 class="brand">Yang Chat</h1>
        <button class="btn primary" type="button" :disabled="streaming" @click="store.newConversation()">
          新对话
        </button>
      </div>

      <div v-if="loadingList" class="sidebar-loading">
        <div v-for="n in 5" :key="n" class="skel skel-line" />
      </div>
      <ul v-else class="conv-list">
        <li
          v-for="c in conversations"
          :key="c.id"
          class="conv-item"
          :class="{ active: c.id === currentId }"
        >
          <button
            class="conv-title"
            type="button"
            :disabled="streaming"
            @click="store.selectConversation(c.id)"
          >
            {{ c.title }}
          </button>
          <button
            class="icon-btn"
            type="button"
            title="删除"
            :disabled="streaming"
            @click.stop="store.removeConversation(c.id)"
          >
            ×
          </button>
        </li>
        <li v-if="conversations.length === 0" class="muted pad">暂无会话，点「新对话」开始</li>
      </ul>
    </aside>

    <main class="main">
      <header class="main-head">
        <div class="head-left">
          <h2>{{ store.currentConversation?.title ?? '选择或创建一个会话' }}</h2>
          <span v-if="streaming" class="status-chip">
            <span class="status-dot" />
            正在生成
          </span>
        </div>
        <button class="btn ghost head-action" type="button" @click="openPromptModal">
          系统提示词
        </button>
      </header>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="messages-wrap">
        <div
          ref="listRef"
          class="messages"
          @scroll.passive="onMessagesScroll"
        >
          <div v-if="loadingMessages" class="msg-loading">
            <div v-for="n in 3" :key="n" class="skel-bubble" :class="n === 2 ? 'right' : ''">
              <div class="skel skel-block" />
            </div>
          </div>
          <template v-else>
            <div v-if="messages.length === 0" class="empty">
              <p class="empty-title">开始对话</p>
              <p class="empty-sub">发送一条消息，体验流式输出</p>
            </div>
            <div
              v-for="m in messages"
              :key="m.id"
              class="bubble-row"
              :class="m.role"
            >
              <div class="bubble-col" :class="m.role">
                <div class="bubble" :class="{ pending: m.pending && !m.content }">
                  <div class="role">{{ m.role === 'user' ? '你' : 'AI' }}</div>
                  <div class="content">
                    <template v-if="m.role === 'assistant'">
                      <div
                        v-if="m.pending && !m.content"
                        class="typing"
                        aria-label="正在思考"
                      >
                        <span /><span /><span />
                      </div>
                      <AppMarkdown
                        v-else
                        :content="m.content"
                        :streaming="isStreamingBubble(m)"
                      />
                    </template>
                    <span v-else class="plain">{{ m.content }}</span>
                  </div>
                </div>
                <div
                  v-if="m.content && !(m.pending && !m.content)"
                  class="msg-actions"
                >
                  <button
                    class="msg-action"
                    type="button"
                    :disabled="streaming && isStreamingBubble(m)"
                    @click="copyMessage(m)"
                  >
                    {{ copiedId === m.id ? '已复制' : '复制' }}
                  </button>
                  <button
                    v-if="m.role === 'assistant' && isLastAssistant(m)"
                    class="msg-action"
                    type="button"
                    :disabled="streaming || !canRegenerate"
                    @click="onRegenerate"
                  >
                    重新生成
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <button
          v-show="showJumpBottom"
          class="jump-bottom"
          type="button"
          @click="jumpToBottom"
        >
          ↓ 回到底部
        </button>
      </div>

      <form class="composer" @submit.prevent="onSubmit">
        <textarea
          ref="textareaRef"
          v-model="input"
          rows="1"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          @keydown="onKeydown"
          @input="resizeTextarea"
        />
        <button
          v-if="streaming"
          class="btn danger send"
          type="button"
          @click="onStop"
        >
          停止
        </button>
        <button
          v-else
          class="btn primary send"
          type="submit"
          :disabled="!input.trim()"
        >
          发送
        </button>
      </form>
      <p v-if="isWaitingFirstToken" class="composer-hint">模型正在思考，可点「停止」中断…</p>
    </main>

    <div
      v-if="showPromptModal"
      class="modal-backdrop"
      @click.self="closePromptModal"
    >
      <div class="modal" role="dialog" aria-labelledby="prompt-title">
        <div class="modal-head">
          <h3 id="prompt-title">系统提示词</h3>
          <button class="icon-btn modal-close" type="button" title="关闭" @click="closePromptModal">
            ×
          </button>
        </div>
        <p class="modal-desc">
          会作为 system 消息发给模型，影响回复风格与约束。保存在本机浏览器。
        </p>
        <textarea
          v-model="promptDraft"
          class="prompt-input"
          rows="8"
          placeholder="例如：你是一个简洁的中文助手，优先给出可执行步骤。"
        />
        <div class="modal-actions">
          <button class="btn ghost" type="button" @click="closePromptModal">取消</button>
          <button class="btn primary" type="button" @click="savePrompt">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  background: #f3f4f6;
  color: #111827;
}

.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #111827;
  color: #e5e7eb;
  border-right: 1px solid #1f2937;
}

.sidebar-head {
  flex-shrink: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brand {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.sidebar-loading {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skel {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
  border-radius: 8px;
}

.sidebar-loading .skel {
  background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
  background-size: 200% 100%;
}

.skel-line {
  height: 36px;
}

.skel-block {
  height: 72px;
  width: min(420px, 70%);
  border-radius: 14px;
  background: linear-gradient(90deg, #e5e7eb 25%, #ffffff 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.conv-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: background 0.15s ease;
}

.conv-item.active {
  background: #1f2937;
}

.conv-item:hover:not(.active) {
  background: #1a2332;
}

.conv-title {
  flex: 1;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-title:disabled,
.icon-btn:disabled,
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 1.2rem;
  border-radius: 6px;
}

.icon-btn:hover:not(:disabled) {
  color: #f87171;
  background: #374151;
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #f3f4f6;
}

.main-head {
  flex-shrink: 0;
  padding: 14px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.head-action {
  flex-shrink: 0;
}

.main-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #2563eb;
  background: #eff6ff;
  border-radius: 999px;
  padding: 4px 10px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.messages-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 24px;
  background: #f3f4f6;
  scroll-behavior: auto;
}

.msg-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skel-bubble {
  display: flex;
}

.skel-bubble.right {
  justify-content: flex-end;
}

.skel-bubble.right .skel-block {
  width: min(280px, 55%);
  height: 48px;
}

.jump-bottom {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  border-radius: 999px;
  padding: 8px 14px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgb(0 0 0 / 10%);
  z-index: 2;
}

.jump-bottom:hover {
  background: #f9fafb;
}

.bubble-row {
  display: flex;
  margin-bottom: 16px;
  animation: fade-in 0.18s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.bubble-row.user {
  justify-content: flex-end;
}

.bubble-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: min(720px, 85%);
}

.bubble-col.user {
  align-items: flex-end;
}

.bubble {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}

.msg-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
}

.msg-action {
  border: 0;
  background: transparent;
  color: #6b7280;
  font: inherit;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.msg-action:hover:not(:disabled) {
  background: #e5e7eb;
  color: #111827;
}

.msg-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bubble.pending {
  min-width: 72px;
}

.bubble-row.user .bubble {
  background: #2563eb;
  color: #fff;
}

.role {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-bottom: 6px;
}

.content {
  word-break: break-word;
  line-height: 1.55;
  font-size: 0.95rem;
}

.plain {
  white-space: pre-wrap;
}

.typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 18px;
  padding: 2px 0;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: bounce 1.05s ease-in-out infinite;
}

.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
  40% { transform: translateY(-4px); opacity: 1; }
}

.composer {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  padding: 16px 24px 8px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}

.composer-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 0 24px 12px;
  font-size: 0.78rem;
  color: #9ca3af;
  background: #fff;
}

textarea {
  resize: none;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  outline: none;
  min-height: 44px;
  max-height: 160px;
  line-height: 1.45;
  overflow-y: auto;
}

textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 15%);
}

.btn {
  border: 0;
  border-radius: 10px;
  padding: 10px 14px;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn.primary {
  background: #2563eb;
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn.ghost {
  background: #f3f4f6;
  color: #374151;
}

.btn.ghost:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn.danger {
  background: #dc2626;
  color: #fff;
}

.btn.danger:hover:not(:disabled) {
  background: #b91c1c;
}

.send {
  align-self: end;
  min-width: 88px;
  height: 44px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(15 23 42 / 45%);
}

.modal {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgb(0 0 0 / 18%);
  padding: 18px 18px 16px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}

.modal-close {
  color: #6b7280;
}

.modal-close:hover {
  color: #111827;
  background: #f3f4f6;
}

.modal-desc {
  margin: 8px 0 12px;
  font-size: 0.85rem;
  color: #6b7280;
  line-height: 1.45;
}

.prompt-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 160px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  outline: none;
  line-height: 1.5;
}

.prompt-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 15%);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.muted {
  color: #9ca3af;
  font-size: 0.9rem;
}

.pad {
  padding: 12px 16px;
}

.empty {
  text-align: center;
  color: #6b7280;
  margin-top: 18vh;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 1.15rem;
  font-weight: 600;
  color: #374151;
}

.empty-sub {
  margin: 0;
  font-size: 0.9rem;
}

.error {
  flex-shrink: 0;
  margin: 12px 24px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.9rem;
}

@media (max-width: 800px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(140px, 32vh) 1fr;
  }

  .sidebar {
    max-height: none;
  }
}
</style>
