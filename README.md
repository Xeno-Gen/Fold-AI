# 🚀 Fold.ai

**极速 · 便携 · 全平台 AI 对话客户端（Web GUI）**

[![Node.js](https://img.shields.io/badge/Node.js-v20--v25.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Size](https://img.shields.io/badge/压缩后-44KB-success)](#)
[![Memory](https://img.shields.io/badge/内存-~20MB-9cf)](#)
[![License](https://img.shields.io/badge/license-MIT-orange)](#license)

> 本项目完全由 **DeepSeek-v4-pro** 在 **20 分钟** 内自动生成，源码压缩后仅 **44KB**，运行时内存占用仅 **20MB** —— 一款真正“即开即用”的轻量级 AI 助手。

<details open>
<summary>📸 界面预览（手机端友好）</summary>

<img width="1599" height="813" alt="桌面端截图" src="https://github.com/user-attachments/assets/27ca4729-a9ad-4ef5-9b48-34afa6a8b91b" />
<img width="1080" height="2121" alt="Screenshot_2026-04-26-20-14-35-54_a252b927494330cdc2c8ba3b3f952e5e" src="https://github.com/user-attachments/assets/31800069-abb6-4c65-a5dc-421760a0ed68" />

</details>

---

## ✨ 为什么选择 Fold.ai？

- ⚡ **20 分钟诞生**：整个项目由 DeepSeek-v4-pro 在 20 分钟内写完，展现 AI 编码的惊人效率。
- 📦 **极致轻量**：源码压缩后仅 **44KB**，原生 JavaScript 运行，无需庞大依赖。
- 🧠 **内存友好**：Node.js 进程内存占用低至 **20MB**，老旧设备也能流畅运行。
- 🌍 **全平台支持**：只要有 Node.js (v20 – v25.9.0)，Windows / macOS / Linux 均可使用。
- 🔌 **13 大模型提供商**：国产模型 + 海外主流，一站式接入。
- 📱 **响应式设计**：针对手机触摸优化，聊天界面在移动端同样舒适。
- ✏️ **对话自由编辑**：随时修改用户发言或模型回复，控制上下文再继续生成。
- 🔄 **重新生成**：不满意就重试，一键换一个回答。
- 📋 **动态模型列表**：实时请求提供商的最新可用模型，随时切换。
- ⚙️ **前端实时调参**：API 密钥、temperature、max_tokens 等全部在 Web 界面手动配置，无需编辑文件。
- 🍪 **轻量会话管理**：仅使用 Cookie 标记用户身份，无数据库、无登录体系，极致简便。

<img width="1593" height="799" alt="image" src="https://github.com/user-attachments/assets/284245e6-6506-4262-9993-cbda16b1e633" />

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
git clone https://github.com/yourusername/fold.ai.git
cd fold.ai
```
或直接下载已编译的压缩包，解压即用。

### 2. 配置 API 密钥
**无需编辑任何文件！** 启动后打开 Web 界面，在设置面板中手动填入各提供商的 API 密钥，即填即用。

### 3. 运行（无需安装依赖）
项目已编译为原生 JavaScript，任选一种方式启动：

**Windows 用户**：直接双击 `.bat`

**命令行用户**：
```bash
cd fold/bin
node server.js
```

启动后，浏览器访问 `http://localhost:17923`，即刻体验。

> 🧪 若想从 TypeScript 源码构建：  
> ```bash
> cd fold
> npm install
> npm run build
> node dist/server.js
> ```

---

## 🤖 支持的 AI 提供商（13 家）

| 编号 | 提供商 | 说明 |
|------|--------|------|
| 1 | DeepSeek | 国产顶尖推理模型 |
| 2 | Kimi | 月之暗面长文本模型 |
| 3 | 智谱清言 | 清华智谱 GLM 系列 |
| 4 | Qwen | 阿里通义千问 |
| 5 | ChatGPT | OpenAI 官方 |
| 6 | Gemini | Google 多模态模型 |
| 7 | 硅基流动 | SiliconFlow 模型聚合 |
| 8 | Claude | Anthropic 出品 |
| 9 | MiniMax | 海螺AI |
| 10 | 小米MiMo | 小米自研模型 |
| 11 | Ollama | 本地模型运行平台 |
| 12 | llama.cpp | 本地 CPU 推理引擎 |
| 13 | *(更多接入中)* | — |

所有提供商的密钥、URL 均通过前端界面配置，灵活切换。

---

## 🎮 功能一览

- **对话式聊天** —— 自然的多轮对话，上下文集于一身。
- **编辑消息** —— 双击任意用户或模型消息，直接修改内容，后续回答基于新上下文。
- **重新输出** —— 点击"重新生成"按钮，让模型再答一次。
- **请求模型列表** —— 选择提供商后，自动拉取可用模型名称。
- **前端参数面板** —— 在 Web 界面实时调节 `temperature`、`max_tokens`、`top_p` 等。
- **前端密钥管理** —— API 密钥全部在浏览器端配置，`.env` 只保留服务级默认值。
- **响应式 Web 界面** —— 桌面、平板、手机均自适应，触摸操作流畅。
- **极简部署** —— 解压即用，双击 bat 或一行 node 命令即可跑。
- **Cookie 用户标记** —— 打开浏览器即自动分配身份，无需注册登录，会话独立。

---

## 💡 项目亮点：20 分钟 AI 创作

> Fold.ai 的初始版本 **完全由 DeepSeek-v4-pro 在 20 分钟内编码完成**，未做任何手动大改。  
> 这证明了 AI 已经能够从零构建轻量、可用的全栈应用。  
> 你手中的每一个功能，从 13 家提供商的集成到手机端 UI，都是 AI 在"分分钟"内输出的成果。  
> **这不是未来，这就是现在。**

---

## 🤝 贡献

欢迎提交 Issue 或 PR！如果你也用 AI 生成了绝妙的功能，请大胆分享。

---

## 📄 许可证

MIT © 2025 Fold.ai 贡献者  
*初版代码由 DeepSeek-v4-pro 生成。*

---

**⭐ 如果这个"20 分钟作品"让你觉得有趣，请点亮 Star！**  
**让更多人看到 AI + TypeScript 的极致轻量魅力。**
