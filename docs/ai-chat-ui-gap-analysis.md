# AI 对话产品体验差距分析

> 对照本仓库 Demo（Vue 3 + Express + SQLite + DeepSeek SSE）与 GitHub 上常见「DeepSeek / 豆包 / Gemini / ChatGPT 风格」开源实现，说明**已经具备什么**、**差在哪里**、**优先补什么**。  
> 调研日期：2026-08-20

---

## 1. 本项目当前能力（基线）

| 能力 | 状态 | 说明 |
|------|------|------|
| SSE 流式输出 | 已有 | DeepSeek `stream=true` → 后端转发 → 前端 `ReadableStream` 追加 |
| 多会话 + SQLite 持久化 | 已有 | 会话 CRUD、历史回灌模型 |
| Markdown（GFM） | 已有 | `marked` + `DOMPurify`；用户消息纯文本 |
| 基础布局 | 已有 | 侧栏 + 消息区局部滚动 + 输入框固定 |
| 停止生成 | 未完成 | Store 里有 `AbortController`，无 Stop 按钮、未真正 abort |
| 代码语法高亮 | 无 | 仅有 `<pre>` 深色样式 |
| 思维链 / Reasoning | 无 | 只转发 `delta.content` |
| 消息操作（复制 / 重试 / 编辑） | 无 | — |
| 多模型切换、附件、登录 | 无 | 模型仅 `.env` 固定 |

结论：本项目是**教学向流式对话骨架**，核心链路（SSE + 落库 + 多会话）是通的；与官网级产品或成熟开源 Chat UI 的差距，主要在**交互完备度**、**富渲染**、**协议能力扩展**三层，而不是「会不会流式」。

---

## 2. GitHub 可参考的相关仓库

下列仓库都在做「类 DeepSeek / Gemini / ChatGPT」的对话前端或全栈，可当作对标样本（星数会变，以功能面为准）。

### 2.1 偏 DeepSeek / 轻量 Clone

| 仓库 | 链接 | 技术 | 和本项目的关系 |
|------|------|------|----------------|
| ngnclht1102/deepseek-chat-ui | https://github.com/ngnclht1102/deepseek-chat-ui | React + Tailwind，兼容 OpenAI/DeepSeek | 同定位：流式 + Markdown + 历史；多用 localStorage，UI 更接近 DeepSeek 官网风格 |
| dr386/deepseek-webui | https://github.com/dr386/deepseek-webui | React + Node + Ollama | 强调流式打字机与 Markdown；偏本地 DeepSeek R1 |
| ductnn/chat-deepseek-ui | https://github.com/ductnn/chat-deepseek-ui | Streamlit + Ollama | 功能简单，适合对照「最小聊天」；工程形态与本项目不同 |
| Chlience/deepseek-chat（社区同类） | 搜索 `deepseek-chat` + FastAPI | FastAPI + SQLite + 多 Provider | 常见能力：系统提示组、**Thinking 折叠面板**、多 Provider 配置 |

### 2.2 偏 Gemini / 多模态客户端体验

| 仓库 | 链接 | 亮点（相对本 Demo） |
|------|------|---------------------|
| bohesocool/gemini-chat | https://github.com/bohesocool/gemini-chat | 停止生成、消息编辑、**思维链**、Markdown + **代码高亮 + LaTeX**、多窗口/子话题、主题、调试面板 |
| HeavenTTT/Gemini-OmniChat-auto | https://github.com/HeavenTTT/Gemini-OmniChat-auto | 多服务商、分支重生成、Token/耗时统计、导入导出、主题 |
| yeahhe365/CanvasChat | https://github.com/yeahhe365/CanvasChat | 多模态输入、代码一键复制、LaTeX、偏 Gemini Canvas 体验 |

### 2.3 偏生产级 Vue / 协议级参考

| 仓库 / 文档 | 链接 | 亮点（相对本 Demo） |
|-------------|------|---------------------|
| nuxt-ui-templates/chat-vue | https://github.com/nuxt-ui-templates/chat-vue | Vue + AI SDK：多模型、**Reasoning UI**、工具调用、认证、SQLite、流式代码高亮（Comark） |
| Nuxt UI Chat 组件文档 | https://ui.nuxt.com/docs/components/chat | 行业较标准的 Chat Prompt / Messages / Reasoning 组件约定 |
| lobehub/lobe-chat（LobeHub） | https://github.com/lobehub/lobe-chat | 成熟产品级：统一 SSE 协议（`text` / `reasoning` / `tool_calls` / `usage`…）、插件、多 Agent、平滑输出队列 |

### 2.4 豆包相关说明

公开仓库里**很少有「完整复刻豆包官网」的前后端**（多为浏览器扩展增强，例如 [Rex16200513/Better_Doubao](https://github.com/Rex16200513/Better_Doubao)：导出、收藏、语料板等）。  
对标「豆包对话效果」时，更宜直接对照**豆包 Web 产品行为**（侧栏会话、停止、复制、重新生成、附件、联网/深度思考开关等），再用上面 Gemini / Nuxt Chat / LobeChat 的开源实现补技术路径。

---

## 3. 产品级对话效果通常包含什么

综合 DeepSeek 官网、豆包、Gemini、ChatGPT，以及上表开源实现，成熟对话体验大致分四层：

```text
┌─────────────────────────────────────────────┐
│  L4 扩展能力：工具调用 / 联网 / 画布 / 插件   │  ← 本项目无
├─────────────────────────────────────────────┤
│  L3 富内容：高亮代码 / 公式 / 附件 / 思维链   │  ← 本项目仅基础 MD
├─────────────────────────────────────────────┤
│  L2 会话交互：停止 / 复制 / 重试 / 编辑 / 分支 │  ← 本项目基本无
├─────────────────────────────────────────────┤
│  L1 核心链路：流式 SSE + 多会话持久化 + 布局   │  ← 本项目已有
└─────────────────────────────────────────────┘
```

本项目卡在 **L1 已完成，L2～L4 大量缺失**。

---

## 4. 差距对照表（本项目 vs 参考实现）

| 维度 | 本项目 | deepseek-chat-ui 类 | gemini-chat 类 | Nuxt Chat / LobeChat |
|------|--------|---------------------|----------------|----------------------|
| 流式 SSE | 有 | 有 | 有 | 有（协议更完整） |
| 多会话持久化 | SQLite 服务端 | 多为本地存储 | IndexedDB 等 | DB + 认证隔离 |
| Markdown | GFM，无高亮 | 有 | MD + 高亮 + KaTeX | 流式友好 Markdown |
| **停止生成** | 缺 UI/接线 | 通常有 | 有 | 有 |
| **复制 / 重试 / 编辑** | 无 | 部分有 | 有 | 有 |
| **Reasoning 展示** | 无 | 部分有 | 有 | 有（专用组件） |
| 多模型 / 参数面板 | 仅 env | API Key + 模型切换 | 强 | 强 |
| 附件 / 多模态 | 无 | 弱 | 强 | 强 |
| 主题 / 快捷键 / 导出 | 无 | 弱 | 有 | 有 |
| 工具调用 / Agent | 无 | 无或弱 | 弱～中 | 强 |
| 工程完备度 | Demo | 中小型产品 | 客户端级 | 生产级 |

**差距最集中的地方（按用户可感知排序）：**

1. **消息级交互缺失**（停止、复制、重新生成）——官网级产品几乎标配。  
2. **富渲染不足**（无语法高亮、无公式、代码块无一键复制）——DeepSeek/Gemini 回复里代码很多，观感差距最大。  
3. **无思维链 UI**——DeepSeek Reasoner / Gemini thinking / 豆包「深度思考」类体验的核心差异。  
4. **协议过简**——当前 SSE 只有 `{ content }` / `[DONE]`；成熟方案会区分 `reasoning`、`usage`、`error`、`tool_calls`（见 LobeChat 协议）。  
5. **产品壳缺失**——模型切换、系统提示、附件、主题、会话重命名/搜索/导出、登录与多用户隔离。

相对「有没有流式」：本项目与他们**差距不大**；相对「像不像官网对话」：**差距主要在 L2 交互 + L3 富内容 + Thinking**。

---

## 5. 和官方产品（非开源）的体验差（补充）

开源仓库很难 1:1 复刻商业站，但行为差仍可参考：

| 官方常见能力 | 本项目 |
|--------------|--------|
| DeepSeek：联网 / 深度思考开关、Reasoner 折叠思考过程 | 无 |
| 豆包：附件、语音、技能/插件入口、会话管理更完整 | 无 |
| Gemini：多模态上传、Canvas/Artifacts、Thoughts | 无 |
| ChatGPT：分支对话、GPTs、工具结果卡片 | 无 |

这些属于 L3～L4，Demo 不必一次做完，但写清差距有助于排期。

---

## 6. 建议的补齐优先级（若继续迭代）

适合**在现有 Express + Vue 栈上小步逼近官网手感**，而不必直接上 LobeChat 体量：

| 优先级 | 项 | 理由 | 参考实现 |
|--------|----|------|----------|
| P0 | 停止生成（Abort + Stop 按钮） | 交互缺口最大、改动小 | gemini-chat、Nuxt Chat |
| P0 | 代码块：Shiki/Highlight.js + 一键复制 | 立刻提升「像 AI 产品」的观感 | gemini-chat、Comark |
| P1 | 消息操作：复制整条、重新生成 | 标配交互 | Gemini OmniChat、豆包 Web |
| P1 | 转发 `reasoning_content` + 折叠「思考过程」 | 对齐 DeepSeek Reasoner / 深度思考 | LobeChat 协议、Nuxt UChatReasoning |
| P2 | 模型/温度/系统提示设置页 | 从 Demo 迈向可用工具 | deepseek-chat-ui、gemini-chat |
| P2 | 会话重命名、导出 Markdown | 会话管理完整度 | Better Doubao（导出思路）、OmniChat |
| P3 | 附件、工具调用、认证 | 产品化，工作量大 | Nuxt chat-vue、LobeChat |

---

## 7. 一句话总结

- **GitHub 上**能找到大量 DeepSeek/Gemini 风格聊天 UI；Vue 侧最接近「现代产品模板」的是 **[nuxt-ui-templates/chat-vue](https://github.com/nuxt-ui-templates/chat-vue)**；协议与体验天花板可看 **[lobehub/lobe-chat](https://github.com/lobehub/lobe-chat)**；轻量对照可用 **[ngnclht1102/deepseek-chat-ui](https://github.com/ngnclht1102/deepseek-chat-ui)**、**[bohesocool/gemini-chat](https://github.com/bohesocool/gemini-chat)**。  
- **本项目**流式与多会话骨架已对齐「教学 Demo」目标；与他们的主要差距**不在会不会 SSE**，而在：**停止/复制/重试等消息交互、代码高亮与公式、思维链展示、更完整的 SSE 事件类型与产品级壳层**。

如需按上表 P0 开始改代码，可以直接指定优先做哪几项。
