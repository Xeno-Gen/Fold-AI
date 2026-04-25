# 🚀 Fold.ai

**极速 · 便携 · 全平台 AI 对话客户端（Web GUI）**

> 本项目完全由 **DeepSeek-v4-pro** 在 **20 分钟** 内自动生成，源码压缩后仅 **44KB**，运行时内存占用仅 **20MB** —— 一款真正“即开即用”的轻量级 AI 助手。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20--v25.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![Size](https://img.shields.io/badge/压缩后-44KB-success)](#)
[![Memory](https://img.shields.io/badge/内存-~20MB-9cf)](#)
[![License](https://img.shields.io/badge/license-MIT-orange)](#license)

<details open>
<summary>📸 界面预览（手机端友好）</summary>

<img width="1599" height="813" alt="桌面端截图" src="https://github.com/user-attachments/assets/27ca4729-a9ad-4ef5-9b48-34afa6a8b91b" />
<img width="1592" height="807" alt="移动端截图" src="https://github.com/user-attachments/assets/9b712cff-48e1-4181-91aa-b87b7eaf6ee2" />

</details>

---

## ✨ 为什么选择 Fold.ai？

- ⚡ **20 分钟诞生**：整个项目由 DeepSeek-v4-pro 在 20 分钟内写完，展现 AI 编码的惊人效率。
- 📦 **极致轻量**：源码压缩后仅 **44KB**，原生 JavaScript 运行，无需庞大依赖。
- 🧠 **内存友好**：Node.js 进程内存占用低至 **20MB**，老旧设备也能流畅运行。
- 🌍 **全平台支持**：只要有 Node.js (v20 – v25.9.0)，Windows / macOS / Linux 均可使用。
- 🔌 **12 大模型提供商**：一个密钥都不少，覆盖主流 AI 平台。
- 📱 **响应式设计**：针对手机触摸优化，聊天界面在移动端同样舒适。
- ✏️ **对话自由编辑**：随时修改用户发言或模型回复，控制上下文再继续生成。
- 🔄 **重新生成**：不满意就重试，一键换一个回答。
- 📋 **动态模型列表**：实时请求提供商的最新可用模型，随时切换。
- ⚙️ **自定义参数**：温度（temperature）、最大 Token、Top-p 等，完全开放调整。
- 🍪 **轻量会话管理**：仅使用 Cookie 标记用户身份，无数据库、无登录体系，极致简便。

---

> ⚠️ **安全提醒**  
> 本项目通过 **Cookie** 进行简单的用户区分，**未实现**复杂的身份认证或权限控制。  
> 请不要在生产环境或公网直接部署，也不要在不信任的网络中传输敏感信息。  
> 这是一个为本地/内网个人使用设计的极客工具，**安全不是它的目标，轻量和速度才是**。

---

## 🚀 快速开始

### 前提条件
- **Node.js** 版本 `v20`、`v22`、`v24` 或 `v25.9.0` （推荐 v22 LTS）
- 一个现代浏览器（Chrome、Edge、Safari 等）

### 1. 获取项目
```bash
git clone https://github.com/yourusername/fold-ai.git
cd fold-ai
```
或直接下载已编译的 `fold-ai.min.js`（仅 44KB）从 [Releases 页面](https://github.com/yourusername/fold-ai/releases)。

### 2. 配置 API 密钥
在项目根目录创建 `.env` 文件，填入你要使用的提供商密钥：
```env
OPENAI_API_KEY=sk-****
ANTHROPIC_API_KEY=sk-ant-****
# ... 其他密钥见提供商列表
```

### 3. 运行（无需安装依赖）
项目已编译为原生 JavaScript，可直接启动：
```bash
node dist/server.js
# 或使用预编译的单文件
node fold-ai.min.js
```
启动后，在浏览器中访问 `http://localhost:3000`，即刻体验。

> 🧪 若想从 TypeScript 源码构建：  
> ```bash
> npm install
> npm run build
> node dist/server.js
> ```

---

## 🤖 支持的 AI 提供商（12 家）

| 编号 | 提供商 | 环境变量配置 |
|------|--------|--------------|
| 1 | OpenAI | `OPENAI_API_KEY` |
| 2 | Azure OpenAI | `AZURE_API_KEY` |
| 3 | Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| 4 | Google Generative AI | `GOOGLE_API_KEY` |
| 5 | Groq | `GROQ_API_KEY` |
| 6 | DeepSeek | `DEEPSEEK_API_KEY` |
| 7 | Cohere | `COHERE_API_KEY` |
| 8 | Together AI | `TOGETHER_API_KEY` |
| 9 | Fireworks AI | `FIREWORKS_API_KEY` |
| 10 | Perplexity | `PERPLEXITY_API_KEY` |
| 11 | Mistral AI | `MISTRAL_API_KEY` |
| 12 | xAI (Grok) | `XAI_API_KEY` |

在 `.env` 文件中填入你要使用的密钥，即可切换。

---

## 🎮 功能一览

- **对话式聊天** —— 自然的多轮对话，上下文集于一身。
- **编辑消息** —— 双击任意用户或模型消息，直接修改内容，后续回答基于新上下文。
- **重新输出** —— 点击“重新生成”按钮，让模型再答一次。
- **请求模型列表** —— 选择提供商后，自动拉取可用模型名称，如 `gpt-4o`、`claude-3-opus`。
- **自定义参数面板** —— 实时调节 `temperature`、`max_tokens`、`top_p` 等。
- **响应式 Web 界面** —— 桌面、平板、手机均自适应，触摸操作流畅。
- **极简部署** —— 复制一个 44KB 的 JS 文件到任何装有 Node 的机器，直接跑。
- **Cookie 用户标记** —— 打开浏览器即自动分配身份，无需注册登录，会话独立。

---

## 💡 项目亮点：20 分钟 AI 创作

> Fold.ai 的初始版本 **完全由 DeepSeek-v4-pro 在 20 分钟内编码完成**，未做任何手动大改。  
> 这证明了 AI 已经能够从零构建轻量、可用的全栈应用。  
> 你手中的每一个功能，从 12 家提供商的集成到手机端 UI，都是 AI 在“分分钟”内输出的成果。  
> **这不是未来，这就是现在。**

---

## 📂 项目结构（压缩后仅 44KB）

```
fold-ai/
├── src/                # TypeScript 源码
│   ├── server.ts       # 轻量 HTTP 服务器 (含 Cookie 会话)
│   ├── providers/      # 12 家 AI 提供商适配
│   └── client/         # 前端 Web GUI（原生 JS）
├── dist/               # 编译后的纯 JS 文件
│   └── server.js       # 可以直接 node 运行
└── fold-ai.min.js      # 单文件压缩版（44KB）
```

---

## 🤝 贡献

欢迎提交 Issue 或 PR！如果你也用 AI 生成了绝妙的功能，请大胆分享。

---

## 📄 许可证

MIT © 2025 Fold.ai 贡献者  
*初版代码由 DeepSeek-v4-pro 生成。*

---

**⭐ 如果这个“20 分钟作品”让你觉得有趣，请点亮 Star！**  
**让更多人看到 AI + TypeScript 的极致轻量魅力。**
```
