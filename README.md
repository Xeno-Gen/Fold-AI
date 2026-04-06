# Fold AI

**轻量级 AI 框架 · 极低资源占用 · 跨平台支持**

[![许可证](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-v24.11.1-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.12.10-blue.svg)](https://python.org/)
[![平台](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20Android--Arm-brightgreen.svg)]()

## 🪶 为什么选择 Fold AI？

**150KB 安装包。50MB 内存。仅此而已。**  
Fold AI 专为资源受限环境从零构建——轻量化不是妥协，而是目标。

| 指标 | 数值 |
|--------|-------|
| 安装包大小 | 150 KB (.zip) / 700kB |
| 内存占用 | ≤ 50 MB |
| 最低运行环境 | 128MB 内存的 Linux 系统 |
| 支持平台 | Linux / Windows / Android Arm |

所有图标和图片均通过前端静态 CDN 提供，最大限度减少服务端流量。Fold AI 足够精简，可以作为核心服务运行在最基础的硬件上。

---

## ✨ 功能特性

- 🔌 **插件系统** — Python 函数插件，提供简洁接口、明确的日志记录和便捷的扩展能力
- 🤖 **兼容 OpenAI API** — 开箱即用，支持主流及新兴 API 提供商（ChatGPT、Gemini、DeepSeek、Kimi、通义千问、智谱、MiniMax 等）
- 🛡️ **管理面板** — 集中控制用户、插件和权限
- 💬 **对话管理** — 历史记录、分支对话、消息编辑与重新生成
- 👥 **用户系统** — 注册/登录、私信、在线状态
- 🎨 **清爽界面** — 深色模式、自定义主题、流畅动画

---

## ⚠️ 安全警告

> **本项目处于早期开发阶段。** 安全加固尚未完成。
> 强烈建议**仅在本地或可信局域网内部署**。
> 请勿将此服务暴露到公网——否则可能导致您的 API 密钥泄露。

---

## 🚀 快速开始

### 环境要求

- Node.js v20 ~ 24.11.1
- Python 3.12 ~ 3.12.10

(或尝试自己的版本)

### Windows 一键启动

双击 **`点我启动.bat`** — 自动安装依赖并启动服务器。

### 手动启动

```bash
cd fold
npm install
npm start / node server.js
访问 http://localhost:17923
```

## 📁 项目结构
text
fold/
├── server.js          # 主服务器
├── Mod/               # 插件目录
├── data/              # 用户数据
├── public/            # 公共文件
├── ken/               # 文档目录
└── com/               # 配置文件

## 📝 许可证
MIT © Xeno-Gen

## 🔗 链接

- [GitHub](https://github.com/Xeno-Gen/Fold-AI)
