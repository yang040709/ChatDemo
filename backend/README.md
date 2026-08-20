# AI 对话流式输出 Demo（Backend）

Express + SQLite + DeepSeek，演示「打字机」式流式回复。

## 流式链路

1. 前端 `POST /api/chat`，后端先把用户消息写入 SQLite。
2. 后端请求 DeepSeek `chat/completions`（`stream: true`），拿到上游 SSE。
3. 每收到一段 `delta.content`，立刻以 `data: {"content":"..."}` 转发给浏览器。
4. 前端用 `fetch` + `ReadableStream` 逐块追加到气泡，形成流式效果。
5. 流结束后把完整 assistant 回复写入数据库，并发送 `data: [DONE]`。

## 配置

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
```

## 启动

```bash
npm install
npm run dev
# http://localhost:3001
```

前端在 `../frontend` 下 `npm run dev`，Vite 会把 `/api` 代理到本服务。
