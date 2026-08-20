# Yang Chat · 项目简历说明

> 对照参考简历 [Sky-Chat](https://github.com/cquptJerry0/Sky-Chat) 的写法，整理本仓库可写进简历的表述，并标明「已实现 / 部分对齐 / 未覆盖」。  
> 更新日期：2026-08-20

---

## 1. 与 Sky-Chat 对照：我们实现了多少

粗估：**产品功能面约 25%～35%**；**流式对话主链路约 60%～70%**（SSE + 落库 + 多会话 + 富文本渲染 + 基础交互已打通）。  
对方是偏「官网级全栈产品」；本项目是「可演示、可讲清原理」的流式聊天骨架。

| Sky-Chat 简历点 | 本项目 | 说明 |
|-----------------|--------|------|
| 流式对话（SSE） | ✅ 已有 | `Fetch` + `ReadableStream` 解析 SSE；绕开 `EventSource` 不能 POST 的限制 |
| 多会话管理 | ✅ 已有 | 创建 / 切换 / 删除；SQLite 持久化 |
| Markdown 富渲染 | ✅ 已有 | Comark：流式 Markdown、Shiki 高亮、KaTeX 公式、代码块复制 |
| 停止生成 | ✅ 已有 | `AbortController` + UI；半截回复仍落库 |
| 消息复制 / 重新生成 | ✅ 已有 | 气泡级复制；`regenerate` 删末条 assistant 再流式 |
| 系统提示词 | ✅ 已有 | localStorage + 请求带 `system` |
| 未闭合 Markdown 稳定化 | ✅ 部分 | `stabilizeStreamingMarkdown` + Comark `autoClose`；列表/fence 防抖 |
| 滚动跟随 / 防跳动 | ✅ 部分 | 贴底跟随、`rAF` 滚动调度、「回到底部」；无虚拟列表 / overflow-anchor 专项 |
| 思维链 / Thinking | ❌ 无 | 未转发 `reasoning_content` |
| 联网搜索 / 生图 / 工具调用 | ❌ 无 | 无 Function Calling、无 FSM 多阶段状态机 |
| 语音 / 附件上传 | ❌ 无 | — |
| 对话分享页 / RSC | ❌ 无 | 无分享链路、无 SSR |
| 虚拟滚动 + 游标分页 | ❌ 无 | 全量拉消息，长会话会压力变大 |
| 批处理降频渲染（120→40） | ❌ 无 | 每 chunk 直接改 Pinia，未做缓冲队列 |
| OAuth / JWT / HttpOnly | ❌ 无 | 无登录鉴权 |
| Markdown XSS 白名单 | ⚠️ 弱 | 走组件树渲染，非 `v-html`；未做 rehype-sanitize 级策略 |

**结论：** 简历里对方写的「流式层 + 渲染稳定 + 会话交互」我们有可写的实装；「多模态 / Agent / 鉴权 / 性能标数字 / 分享页」尚未做，不要照抄对方措辞。

---

## 2. 简历条目（可直接粘贴，按需删减）

**Yang Chat**｜个人项目  
技术栈：TypeScript + Vue 3 + Pinia + Vite + Comark + Express + SQLite + DeepSeek API  

全栈 AI 对话 Demo，覆盖流式输出、多会话持久化与常见聊天交互：

- 基于 `Fetch` + `ReadableStream` 自研 SSE 消费层，支持 POST 请求体与 `AbortController` 停止生成；后端转发 DeepSeek 上游流，并在客户端断开时将半截 assistant 回复落库  
- 使用 Pinia 管理会话 / 消息 / 流式状态；实现重新生成（删除末条 assistant 后按历史重放）与系统提示词（本机配置，请求注入 `system`）  
- 接入 Comark 做流式 Markdown 渲染（语法高亮、公式、代码块一键复制），并对半截 fence / 列表边界做稳定化补全，减轻流式中结构跳动  
- 消息区实现贴底跟随、`requestAnimationFrame` 滚动合并与「回到底部」，避免用户上翻阅读时被强制拽回  

（可选一句定位）侧重打通「模型 SSE → 服务端转发落库 → 前端流式渲染」全链路，便于面试讲清流式协议与聊天 UI 工程问题。

---

## 3. 技术实现要点（面试展开版）

### 3.1 SSE 流式与会话状态

- 浏览器侧不用 `EventSource`（无法带 JSON body），改为 `POST /api/chat` + 读 `ReadableStream`，按行解析 `data: {...}` / `[DONE]`  
- Pinia 维护 `streaming`、本地 pending 气泡与 `AbortController`；停止时 abort fetch，Express 侧监听响应 `close`，有内容则写入 assistant  
- 支持 `regenerate`：不重复插入 user，删除库中最后一条 assistant，用历史末条 user 再请求模型  

### 3.2 渲染与交互体验

- Comark：`streaming` + `autoClose` + 自研 `stabilizeStreamingMarkdown`（补换行、空列表标记、未闭合 fence）  
- 代码块自定义 `ProsePre`（复制）；气泡级「复制 / 重新生成」  
- 滚动：距离底部阈值判定 stick；流式追加时用 `rAF` 合并 `scrollTo`；上翻后显示跳转底部按钮  

### 3.3 数据与配置

- SQLite（`better-sqlite3`）：conversations / messages；首条用户消息自动生成会话标题  
- 系统提示词存 `localStorage`，随聊天请求传到后端并拼进 DeepSeek `messages`  

---

## 4. 诚实边界（避免简历翻车）

写进简历时建议主动区分：

| 可以说 | 不建议说 |
|--------|----------|
| 自研 SSE 解析与停止生成 | 「有限状态机管理 thinking → tool_calling」 |
| 流式 Markdown 稳定化、高亮与公式 | 「渲染峰值从 120 降到 40」（无实测数据） |
| 多会话 + SQLite 持久化 | 「PostgreSQL / Prisma / 生产级多租户」 |
| 复制 / 重试 / 系统提示词 | 「联网搜索、生图、语音、分享页 RSC」 |
| 组件化渲染降低随意 `v-html` 风险 | 「完整 OAuth + JWT HttpOnly 鉴权方案」 |

对方简历里的虚拟列表、批处理队列、弹窗 OAuth、分享页 RSC 等，**本仓库未实现**；若面试官追问，应明确「当前 Demo 范围」并指向可扩展点（见 [ai-chat-ui-gap-analysis.md](./ai-chat-ui-gap-analysis.md)）。

---

## 5. 一句话对比

| | Sky-Chat | Yang Chat（本仓库） |
|--|----------|---------------------|
| 定位 | 功能完整的 AI 聊天产品 | 流式对话全链路 Demo |
| 栈 | Next.js + Zustand + Prisma + PG | Vue 3 + Pinia + Express + SQLite |
| 强项 | Agent / 多模态 / 鉴权 / 性能与分享 | SSE 主路径清晰、交互与渲染够用、易讲原理 |
| 适合简历写法 | 产品亮点 + 量化指标 | 工程链路 + 流式/渲染细节（如实、可 demo） |
