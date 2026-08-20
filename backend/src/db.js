import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, '../data/chat.db')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);
`)

export function listConversations() {
  return db
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       ORDER BY updated_at DESC`,
    )
    .all()
}

export function createConversation(title = '新对话') {
  const result = db
    .prepare(`INSERT INTO conversations (title) VALUES (?)`)
    .run(title)
  return getConversation(result.lastInsertRowid)
}

export function getConversation(id) {
  return db
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM conversations WHERE id = ?`,
    )
    .get(id)
}

export function deleteConversation(id) {
  const result = db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id)
  return result.changes > 0
}

export function touchConversation(id) {
  db.prepare(
    `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`,
  ).run(id)
}

export function updateConversationTitle(id, title) {
  db.prepare(
    `UPDATE conversations
     SET title = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(title, id)
}

export function listMessages(conversationId) {
  return db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY id ASC`,
    )
    .all(conversationId)
}

export function addMessage(conversationId, role, content) {
  const result = db
    .prepare(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES (?, ?, ?)`,
    )
    .run(conversationId, role, content)
  touchConversation(conversationId)
  return db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages WHERE id = ?`,
    )
    .get(result.lastInsertRowid)
}

export function countUserMessages(conversationId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE conversation_id = ? AND role = 'user'`,
    )
    .get(conversationId)
  return row.count
}

/** 删除会话中最后一条 assistant 消息（用于重新生成） */
export function deleteLastAssistantMessage(conversationId) {
  const row = db
    .prepare(
      `SELECT id FROM messages
       WHERE conversation_id = ? AND role = 'assistant'
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(conversationId)
  if (!row) return false
  const result = db.prepare(`DELETE FROM messages WHERE id = ?`).run(row.id)
  if (result.changes > 0) touchConversation(conversationId)
  return result.changes > 0
}

export default db
