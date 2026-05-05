# 🚀 Fold.AI

**极速 · 便携 · 全平台 AI 对话客户端（Web GUI）**


[![Node.js](https://img.shields.io/badge/Node.js-v20--v25.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Size](https://img.shields.io/badge/压缩后-90KB-success)](#)
[![Memory](https://img.shields.io/badge/内存-~20MB-9cf)](#)
[![License](https://img.shields.io/badge/license-MIT-orange)](#license)


> 本项目完全由 \*\*DeepSeek-v4-pro\*\* 在 \*\*20 分钟\*\* 内自动生成，源码压缩后仅 \*\*44KB\*\*，运行时内存占用仅 \*\*20MB\*\* —— 一款真正"即开即用"的轻量级 AI 助手。
> GitHub 上资源占用最小的 AI 客户端。

\---

## ✨ 为什么选择 Fold.AI？

* ⚡ **20 分钟诞生**：整个项目由 DeepSeek-v4-pro 在 20 分钟内写完，展现 AI 编码的惊人效率。
* 📦 **极致轻量**：源码压缩后仅 **90KB**，原生 JavaScript 运行，无需庞大依赖。
* 🧠 **内存友好**：Node.js 进程内存占用低至 **20MB**，老旧设备也能流畅运行。
* 🌍 **全平台支持**：只要有 Node.js (v20 – v25.9.0)，Windows / macOS / Linux 均可使用。
* 🔌 **13 大模型提供商**：国产模型 + 海外主流，一站式接入。
* 📱 **响应式设计**：针对手机触摸优化，聊天界面在移动端同样舒适。
* ✏️ **对话自由编辑**：随时修改用户发言或模型回复，控制上下文再继续生成。
* 🔄 **重新生成**：不满意就重试，一键换一个回答。
* 📋 **动态模型列表**：实时请求提供商的最新可用模型，随时切换。
* ⚙️ **前端实时调参**：API 密钥、temperature、max\_tokens 等全部在 Web 界面手动配置，无需编辑文件。
* 🍪 **轻量会话管理**：仅使用 Cookie 标记用户身份，无数据库、无登录体系，极致简便。

\---

> ⚠️ \*\*安全提醒\*\*  
> 本项目通过 \*\*Cookie\*\* 进行简单的用户区分，\*\*未实现\*\*复杂的身份认证或权限控制。  
> 请不要在生产环境或公网直接部署，也不要在不信任的网络中传输敏感信息。  
> 这是一个为本地/内网个人使用设计的极客工具，\*\*安全不是它的目标，轻量和速度才是\*\*。

### 免责声明

该程序能够使 AI 随意调用命令行程序，即使仅仅是无管理员权限的普通命令行，但是也可能对你的设备造成不可挽回的损失，因此应该慎重选择是否执行命令，命令默认需要确认，在设置内开关。

\---

## 🚀 快速开始

### 前提条件

* **Node.js** 版本 `v20`、`v22`、`v24` 或 `v25.9.0`（推荐 v22 LTS）
* 一个现代浏览器（Chrome、Edge、Safari 等）

### 1\. 获取项目

```bash
git clone https://github.com/Xeno-Gen/Fold.AI.git
cd Fold.AI
```

或直接下载已编译的压缩包，解压即用。

### 2\. 配置 API 密钥

**无需编辑任何文件。** 启动后打开 Web 界面，在设置面板中手动填入各提供商的 API 密钥，即填即用。

### 3\. 运行（无需安装依赖）

项目已编译为原生 JavaScript，任选一种方式启动：

**Windows 用户**：直接双击 `依赖安装.bat`

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
> node dist/bin/server.js
> ```

\---

## 🤖 支持的 AI 提供商（13 家）

|编号|提供商|说明|
|-|-|-|
|1|DeepSeek|国产顶尖推理模型|
|2|Kimi|月之暗面长文本模型|
|3|智谱清言|清华智谱 GLM 系列|
|4|Qwen|阿里通义千问|
|5|ChatGPT|OpenAI 官方|
|6|Gemini|Google 多模态模型|
|7|硅基流动|SiliconFlow 模型聚合|
|8|Claude|Anthropic 出品|
|9|MiniMax|海螺AI|
|10|小米MiMo|小米自研模型|
|11|Ollama|本地模型运行平台|
|12|llama.cpp|本地 CPU 推理引擎|
|13|*(更多接入中)*|—|

所有提供商的密钥、URL 均通过前端界面配置，灵活切换。

\---

## 🎮 功能一览

* **对话式聊天** —— 自然的多轮对话，上下文集于一身。
* **对话链接** —— 每个对话有唯一链接 `/chat/{token}`，刷新后直接恢复对话内容。
* **四种思考模式** —— 快速（无深度思考）、思考（开启 deep\_think）、沉思（附加 DeepThink.json 提示词）、静思（附加 Medit.json 提示词）。
* **编辑消息** —— 双击任意用户或模型消息，直接修改内容，后续回答基于新上下文。
* **重新输出** —— 点击"重新生成"按钮，让模型再答一次。
* **Markdown 渲染** —— 支持代码高亮、一键复制、下载、运行 JavaScript/HTML 代码。
* **文件上传** —— 支持图片和文本文件，AI 可读取分析。
* **命令执行** —— AI 可调用系统命令，默认需确认，可在设置中开关。
* **请求模型列表** —— 选择提供商后，自动拉取可用模型名称。
* **前端参数面板** —— 在 Web 界面实时调节 temperature、max\_tokens、top\_p 等。
* **前端密钥管理** —— API 密钥全部在浏览器端配置，.env 只保留服务级默认值。
* **响应式 Web 界面** —— 桌面、平板、手机均自适应，触摸操作流畅。
* **主题切换** —— 浅色 / 深色 / 跟随系统。
* **自定义字体** —— 支持切换聊天字体。
* **极简部署** —— 解压即用，双击 bat 或一行 node 命令即可跑。
* **Cookie 用户标记** —— 打开浏览器即自动分配身份，无需注册登录，会话独立。

\---

## 💡 项目亮点：20 分钟 AI 创作

> Fold.AI 的初始版本 \*\*完全由 DeepSeek-v4-pro 在 20 分钟内编码完成\*\*，未做任何手动大改。
> 这证明了 AI 已经能够从零构建轻量、可用的全栈应用。
> 你手中的每一个功能，从 13 家提供商的集成到手机端 UI，都是 AI 在"分分钟"内输出的成果。
> \*\*这不是未来，这就是现在。\*\*

\---

## 📁 项目结构

```
Fold.AI/
├── bin/server.ts              # 服务端入口
├── lib/
│   ├── routes/                # API 路由（chat、config、providers 等）
│   ├── user/                  # 用户管理（Cookie 身份）
│   ├── parser/                # .env 配置解析
│   └── logger.ts              # 日志
├── static/
│   ├── intro.html             # 前端 HTML
│   ├── intro.js               # 前端 JavaScript
│   └── css/                   # 样式文件
├── Plugin/
│   └── CommandExecution/      # 命令执行插件
├── config/
│   ├── .env                   # 服务配置
│   ├── prompts.json           # 提示词配置
│   ├── DeepThink.json         # 沉思模式提示词
│   └── Medit.json             # 静思模式提示词
├── com/
│   └── ver.json               # 版本信息
├── data/                      # 运行时数据（用户配置、对话记录）
├── dist/                      # 编译输出
├── package.json
└── tsconfig.json
```

\---

## 🤝 贡献

欢迎提交 Issue 或 PR！如果你也用 AI 生成了绝妙的功能，请大胆分享。

\---

## 📄 许可证

MIT © 2026 Fold.AI 贡献者
*初版代码由 DeepSeek-v4-pro 生成。*

\---

**⭐ 如果这个"20 分钟作品"让你觉得有趣，请点亮 Star！
让更多人看到 AI + TypeScript 的极致轻量魅力。**

