# Fold AI

**Lightweight AI Framework · Minimal Resource Usage · Cross-Platform**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-v24.11.1-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.12.10-blue.svg)](https://python.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20Android--Arm-brightgreen.svg)]()

## 🪶 Why Fold AI?

**150KB package. 65MB RAM. That's it.**  
Fold AI is built from the ground up for resource-constrained environments — lightweight is not a compromise, it's the goal.

| Metric | Value |
|--------|-------|
| Package Size | 150 KB (.zip) / 700kB |
| Memory Usage | ≤ 65 MB |
| Minimum Environment | Linux with 128MB RAM |
| Supported Platforms | Linux / Windows / Android Arm |

All icons and images are served via frontend static CDN, keeping server-side traffic minimal. Fold AI is lean enough to run as a core service on the most modest hardware.

---

## ✨ Features

- 🔌 **Plugin System** — Python function plugins with a clean interface, explicit logging, and easy extensibility
- 🤖 **OpenAI-Compatible API** — Works with major and emerging API providers out of the box (ChatGPT, Gemini, DeepSeek, Kimi, Qwen, Zhipu, MiniMax, and more)
- 🛡️ **Admin Panel** — Centralized control over users, plugins, and permissions
- 💬 **Conversation Management** — History, branching, message editing and regeneration
- 👥 **User System** — Register/login, private messaging, online status
- 🎨 **Clean UI** — Dark mode, custom themes, smooth animations

---

## ⚠️ Security Warning

> **This project is in early development.** Security hardening is not yet complete.  
> It is strongly recommended to **deploy locally or within a trusted LAN only**.  
> Do not expose this service to the public internet — doing so risks leaking your API keys.

---

## 🚀 Quick Start

### Requirements

- Node.js v24.11.1
- Python 3.12.10

### Windows One-Click Launch

Double-click **`点我启动.bat`** — dependencies are installed and the server starts automatically.

### Manual Launch

```bash
cd fold
npm install
npm start
```

Visit `http://localhost:17923`

---

## 📁 Project Structure

```
fold/
├── server.js          # Main server
├── Mod/               # Plugins directory
├── data/              # User data
├── public/            # Public files
├── ken/               # Documentation
└── com/               # Configuration
```

---

## 📝 License

MIT © Xeno-Gen

## 🔗 Links

- [GitHub](https://github.com/Xeno-Gen/Fold-AI)
