import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import chatRouter from './routes/chat.js'
import conversationsRouter from './routes/conversations.js'
import './db.js'

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/conversations', conversationsRouter)
app.use('/api/chat', chatRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  if (res.headersSent) return
  res.status(500).json({ error: err?.message || '服务器内部错误' })
})

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
