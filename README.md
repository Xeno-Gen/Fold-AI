# Fold AI

**极简 AI 框架 · 超低资源占用 · 跨平台部署**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-v24.11.1-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.12.10-blue.svg)](https://python.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20Android--Arm-brightgreen.svg)]()

## 🪶 为什么选择 Fold AI？

**压缩包仅 150KB，内存占用仅 65MB。**  
轻量不是妥协，而是设计目标——Fold AI 生来就为资源受限的环境而生。

| 指标 | 数值 |
|------|------|
| 压缩包大小 | 150 KB |
| 运行内存占用 | ≤ 65 MB |
| 最低可运行环境 | 128MB 内存 Linux 主机 |
| 支持平台 | Linux / Windows / Android Arm |

图标与图片资源全部走前端静态 CDN，服务器本身过关流量极少，完全可作为服务器核心稳定运行。

---

## ✨ 核心特性

- 🔌 **函数插件系统** — Python 函数插件，接口规范，日志清晰，易于二次开发
- 🤖 **OpenAI 兼容接口** — 无缝对接主流及新兴 API 提供商（ChatGPT、Gemini、DeepSeek、Kimi、Qwen、Zhipu、MiniMax 等）
- 🛡️ **管理员面板** — 用户管理、插件控制、权限配置，多项管控集中处理
- 💬 **完善的对话管理** — 历史记录、分支对话、消息编辑与重新生成
- 👥 **用户系统** — 注册登录、私信、在线状态
- 🎨 **简洁 UI** — 深色模式、自定义主题、流畅动画

---

## ⚠️ 安全警告

> **项目目前处于早期阶段**，安全防护机制尚未完善。  
> 强烈建议**仅在本地或局域网内部署**，避免将服务完全暴露于公网，防止 API Key 泄露等安全风险。

---

## 🚀 快速启动

### 环境要求

- Node.js v24.11.1
- Python 3.12.10

### Windows 一键启动

双击 **`点我启动.bat`** — 自动安装依赖并启动服务

### 手动启动

```bash
cd 项目目录
npm install
npm start
```

访问 `http://localhost:17923`

---

## 📁 项目结构

```
Fold-AI/
├── 点我启动.bat       # Windows 一键启动脚本
├── server.js          # 主服务器
├── Mod/               # 插件目录
├── data/              # 用户数据
├── public/            # 公共文件
├── ken/               # 文档
└── com/               # 配置目录
```

---

## 📝 License

MIT © Xeno-Gen

## 🔗 Links

- [GitHub](https://github.com/Xeno-Gen/Fold-AI)
````
