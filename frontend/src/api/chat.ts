export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type StreamChatOptions = {
  content?: string
  regenerate?: boolean
  systemPrompt?: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error || `请求失败 (${res.status})`
  } catch {
    return `请求失败 (${res.status})`
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch('/api/conversations')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createConversation(title?: string): Promise<Conversation> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res))
}

export async function fetchMessages(conversationId: number): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export type StreamHandlers = {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export async function streamChat(
  conversationId: number,
  options: StreamChatOptions,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = { conversationId }
  if (options.regenerate) {
    body.regenerate = true
  } else {
    body.content = options.content ?? ''
  }
  if (options.systemPrompt) {
    body.systemPrompt = options.systemPrompt
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    handlers.onError(await parseError(res))
    return
  }

  if (!res.body) {
    handlers.onError('浏览器不支持流式响应')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''

      for (const raw of parts) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          handlers.onDone()
          return
        }
        try {
          const json = JSON.parse(data) as { content?: string; error?: string }
          if (json.error) {
            handlers.onError(json.error)
            return
          }
          if (typeof json.content === 'string') {
            handlers.onDelta(json.content)
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    handlers.onDone()
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      handlers.onDone()
      throw e
    }
    throw e
  }
}
