# Yang Chat

多会话 AI 聊天 Demo：Vue 3 + Pinia 前端，Express / SQLite 后端，DeepSeek 流式 API。

## 功能

- 多会话：创建 / 切换 / 删除，消息持久化到 SQLite
- 流式输出：SSE 打字机效果，Markdown / 代码高亮 / 公式（Comark）
- 停止生成：中断请求，半截回复仍会落库
- 消息操作：一键复制、重新生成最后一条 AI 回复
- 系统提示词：本机保存，请求时作为 `system` 消息发给模型

## 快速开始

1. **后端**

```bash
cd backend
cp .env.example .env
# 在 .env 中填入 DEEPSEEK_API_KEY
pnpm install   # 或 npm install
pnpm run dev
```

2. **前端**（另开终端）

```bash
cd frontend
pnpm install   # 或 npm install
pnpm run dev
```

浏览器打开 Vite 提示的地址（通常是 `http://localhost:5173`）。前端通过代理访问 `http://localhost:3001`。

## 原理一句话

DeepSeek 按 token 推送 SSE → Express 转发并落库 → 浏览器 `ReadableStream` 边收边渲染。

更细的后端说明见 [backend/README.md](backend/README.md)。  
项目简历写法见 [docs/yang-chat-resume.md](docs/yang-chat-resume.md)；体验差距与后续可做项见 [docs/ai-chat-ui-gap-analysis.md](docs/ai-chat-ui-gap-analysis.md)。
