import { Router } from 'express'
import {
  addMessage,
  countUserMessages,
  deleteLastAssistantMessage,
  getConversation,
  listMessages,
  updateConversationTitle,
} from '../db.js'
import { streamChatCompletion } from '../services/deepseek.js'

const router = Router()

function writeSse(res, payload) {
  res.write(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`)
}

function titleFromContent(content) {
  const text = content.replace(/\s+/g, ' ').trim()
  if (!text) return '新对话'
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function buildModelMessages(conversationId, systemPrompt) {
  const history = listMessages(conversationId).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
  if (systemPrompt) {
    return [{ role: 'system', content: systemPrompt }, ...history]
  }
  return history
}

router.post('/', async (req, res) => {
  const conversationId = Number(req.body?.conversationId)
  const regenerate = req.body?.regenerate === true
  const content =
    typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  const systemPrompt =
    typeof req.body?.systemPrompt === 'string' ? req.body.systemPrompt.trim() : ''

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: '无效的会话 ID' })
  }

  const conversation = getConversation(conversationId)
  if (!conversation) {
    return res.status(404).json({ error: '会话不存在' })
  }

  if (regenerate) {
    deleteLastAssistantMessage(conversationId)
    const history = listMessages(conversationId)
    const last = history[history.length - 1]
    if (!last || last.role !== 'user') {
      return res.status(400).json({ error: '没有可重新生成的用户消息' })
    }
  } else {
    if (!content) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }
    addMessage(conversationId, 'user', content)
    if (conversation.title === '新对话' && countUserMessages(conversationId) === 1) {
      updateConversationTitle(conversationId, titleFromContent(content))
    }
  }

  const modelMessages = buildModelMessages(conversationId, systemPrompt)

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  let fullReply = ''
  // POST 读完 body 后 req 会触发 close，不能用来判断客户端断开；应看响应侧
  let clientClosed = false
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true
    }
  })

  try {
    const upstream = await streamChatCompletion(modelMessages)
    const reader = upstream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (clientClosed) {
        await reader.cancel().catch(() => {})
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || !line.startsWith('data:')) continue

        const data = line.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            fullReply += delta
            writeSse(res, { content: delta })
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    // 正常结束或用户停止：有内容都落库，避免停止后刷新丢失半截回复
    if (fullReply) {
      addMessage(conversationId, 'assistant', fullReply)
    }

    if (!clientClosed) {
      writeSse(res, '[DONE]')
    }
    if (!res.writableEnded) {
      res.end()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '流式对话失败'
    if (!res.headersSent) {
      return res.status(502).json({ error: message })
    }
    if (fullReply) {
      addMessage(conversationId, 'assistant', fullReply)
    }
    if (!clientClosed) {
      writeSse(res, { error: message })
      writeSse(res, '[DONE]')
    }
    if (!res.writableEnded) {
      res.end()
    }
  }
})

export default router
