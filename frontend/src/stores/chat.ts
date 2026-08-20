import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMessages,
  streamChat,
  type Conversation,
  type Message,
} from '@/api/chat'

export type LocalMessage = Omit<Message, 'id'> & {
  id: number | string
  pending?: boolean
}

const SYSTEM_PROMPT_KEY = 'yang-chat-system-prompt'

function loadSystemPrompt() {
  try {
    return localStorage.getItem(SYSTEM_PROMPT_KEY) ?? ''
  } catch {
    return ''
  }
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([])
  const currentId = ref<number | null>(null)
  const messages = ref<LocalMessage[]>([])
  const streaming = ref(false)
  const loadingList = ref(false)
  const loadingMessages = ref(false)
  const error = ref('')
  const systemPrompt = ref(loadSystemPrompt())
  let abortController: AbortController | null = null

  watch(systemPrompt, (value) => {
    try {
      localStorage.setItem(SYSTEM_PROMPT_KEY, value)
    } catch {
      // ignore quota / private mode
    }
  })

  const currentConversation = computed(() =>
    conversations.value.find((c) => c.id === currentId.value) ?? null,
  )

  const canRegenerate = computed(() => {
    if (streaming.value || currentId.value == null) return false
    const list = messages.value
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i]
      if (!m) continue
      if (m.role === 'assistant') return true
      if (m.role === 'user') return true
    }
    return false
  })

  async function loadConversations() {
    loadingList.value = true
    error.value = ''
    try {
      conversations.value = await fetchConversations()
      const first = conversations.value[0]
      if (currentId.value == null && first) {
        await selectConversation(first.id)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载会话失败'
    } finally {
      loadingList.value = false
    }
  }

  async function selectConversation(id: number) {
    if (streaming.value) return
    currentId.value = id
    loadingMessages.value = true
    error.value = ''
    try {
      messages.value = await fetchMessages(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载消息失败'
      messages.value = []
    } finally {
      loadingMessages.value = false
    }
  }

  async function newConversation() {
    if (streaming.value) return
    error.value = ''
    try {
      const conv = await createConversation()
      conversations.value = [conv, ...conversations.value]
      currentId.value = conv.id
      messages.value = []
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建会话失败'
    }
  }

  async function removeConversation(id: number) {
    if (streaming.value) return
    error.value = ''
    try {
      await deleteConversation(id)
      conversations.value = conversations.value.filter((c) => c.id !== id)
      if (currentId.value === id) {
        currentId.value = null
        messages.value = []
        const next = conversations.value[0]
        if (next) {
          await selectConversation(next.id)
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除会话失败'
    }
  }

  function stopGeneration() {
    if (!streaming.value || !abortController) return
    abortController.abort()
  }

  function setSystemPrompt(value: string) {
    systemPrompt.value = value
  }

  async function refreshConversationList() {
    try {
      conversations.value = await fetchConversations()
    } catch {
      // ignore title refresh errors
    }
  }

  async function runAssistantStream(
    conversationId: number,
    options: { content?: string; regenerate?: boolean },
    assistantIndex: number,
  ) {
    streaming.value = true
    abortController = new AbortController()

    try {
      await streamChat(
        conversationId,
        {
          ...options,
          systemPrompt: systemPrompt.value.trim() || undefined,
        },
        {
          onDelta(delta) {
            const msg = messages.value[assistantIndex]
            if (msg) {
              msg.content += delta
              msg.pending = false
            }
          },
          onDone() {
            const msg = messages.value[assistantIndex]
            if (msg) msg.pending = false
          },
          onError(message) {
            error.value = message
            const msg = messages.value[assistantIndex]
            if (msg && !msg.content) {
              messages.value.splice(assistantIndex, 1)
            } else if (msg) {
              msg.pending = false
            }
          },
        },
        abortController.signal,
      )

      await refreshConversationList()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        error.value = e instanceof Error ? e.message : '发送失败'
      } else {
        const msg = messages.value[assistantIndex]
        if (msg) msg.pending = false
      }
    } finally {
      streaming.value = false
      abortController = null
    }
  }

  async function sendMessage(content: string) {
    const text = content.trim()
    if (!text || streaming.value) return

    error.value = ''

    if (currentId.value == null) {
      await newConversation()
      if (currentId.value == null) return
    }

    const conversationId = currentId.value
    const now = new Date().toISOString()

    messages.value.push({
      id: `local-user-${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content: text,
      created_at: now,
    })

    const assistantIndex =
      messages.value.push({
        id: `local-assistant-${Date.now()}`,
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        created_at: now,
        pending: true,
      }) - 1

    await runAssistantStream(conversationId, { content: text }, assistantIndex)
  }

  async function regenerate() {
    if (streaming.value || currentId.value == null) return

    const conversationId = currentId.value
    const list = messages.value
    let lastUserIndex = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.role === 'user') {
        lastUserIndex = i
        break
      }
    }
    if (lastUserIndex < 0) {
      error.value = '没有可重新生成的用户消息'
      return
    }

    error.value = ''

    // 去掉最后一条用户消息之后的 assistant（含半截/失败占位）
    messages.value = list.slice(0, lastUserIndex + 1)

    const now = new Date().toISOString()
    const assistantIndex =
      messages.value.push({
        id: `local-assistant-${Date.now()}`,
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        created_at: now,
        pending: true,
      }) - 1

    await runAssistantStream(conversationId, { regenerate: true }, assistantIndex)
  }

  return {
    conversations,
    currentId,
    messages,
    streaming,
    loadingList,
    loadingMessages,
    error,
    systemPrompt,
    currentConversation,
    canRegenerate,
    loadConversations,
    selectConversation,
    newConversation,
    removeConversation,
    sendMessage,
    stopGeneration,
    regenerate,
    setSystemPrompt,
  }
})
