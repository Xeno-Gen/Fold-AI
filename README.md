# Fold AI

**轻量级AI框架 · 开箱即用的多模型对话平台**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-v24.11.1-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.12.10-blue.svg)](https://python.org/)
[![Windows](https://img.shields.io/badge/Windows-支持-0078D6.svg)](https://microsoft.com/windows)

## ✨ 特性

- 🤖 **多模型支持** - 一键接入 DeepSeek、Kimi、智谱、通义千问、ChatGPT、Gemini 等主流 AI 模型
- 🔌 **插件系统** - 支持 Python 函数插件，可扩展自定义功能
- 📁 **文件管理** - 公共文件夹读写、文件上传下载、目录管理
- 💬 **对话管理** - 历史会话、分支对话、消息编辑重新生成
- 👥 **用户系统** - 注册登录、私信聊天、在线状态
- 🛡️ **管理员控制** - 用户管理、插件管控、权限设置
- 🎨 **界面美观** - 深色模式、自定义主题、流畅动画

## 🚀 快速开始（Windows）

### 标准环境

- Node.js v24.11.1
- Python 3.12.10

### 一键启动

双击运行 **`点我启动.bat`**，一键安装依赖和启动服务器

### 手动启动

```bash
cd 目录
npm install
npm start
```

访问 `http://localhost:17923`

## 📦 技术栈

| 技术 | 版本 |
|------|------|
| Node.js | v24.11.1 |
| Python | 3.12.10 |
| Express | ^4.18.2 |
| Socket.io | ^4.6.1 |

## 📁 项目结构

```
Fold-AI/
├── 点我启动.bat       # Windows 一键启动脚本
├── server.js          # 主服务端
├── Mod/               # 插件目录
├── data/              # 用户数据
├── public/app.js index.html       # 公共文件
├── ken/               # 须知文件
└── com/               # 配置目录
```

## 📝 许可证

MIT © Xeno-Gen

## 🔗 链接

- [GitHub](https://github.com/Xeno-Gen/Fold-AI)
