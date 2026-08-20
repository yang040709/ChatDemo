import { Router } from 'express'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
} from '../db.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(listConversations())
})

router.post('/', (req, res) => {
  const title =
    typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 50)
      : '新对话'
  const conversation = createConversation(title)
  res.status(201).json(conversation)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '无效的会话 ID' })
  }
  const ok = deleteConversation(id)
  if (!ok) {
    return res.status(404).json({ error: '会话不存在' })
  }
  res.status(204).end()
})

router.get('/:id/messages', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '无效的会话 ID' })
  }
  const conversation = getConversation(id)
  if (!conversation) {
    return res.status(404).json({ error: '会话不存在' })
  }
  res.json(listMessages(id))
})

export default router
