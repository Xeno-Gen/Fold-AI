# Fold.ai


[![Node.js](https://img.shields.io/badge/Node.js-v20--v25.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-orange)](#license)

**轻量级、便携、跨平台的 AI Web GUI客户端**
## 兼顾了扮演、记忆、独立编码，无提示词污染
### 提供最纯净、原生的模型性能

## 不同语言的Md
[English README](https://github.com/Xeno-Gen/Fold.AI/edit/main/README-en.md)
[简体中文 README](https://github.com/Xeno-Gen/Fold.AI)

## 已实装的插件类型
**1.记忆（v0.2.0实装）** <br>
模型可以自主选择写入的记忆，记忆会在全部对话中生效，前提是你打开了记忆的工具链，而不是禁用。<br>
**2.命令执行（v0.2.0实装）** <br>
模型可以自主执行Cmd命令、PowerShell命令，在Linux平台上也兼容。<br>
**3.Agent（v0.2.1实装）** <br>
模型自主选择追加输出，如得到信息后追加调用。<br>
**4.压缩旧执行（v0.2.2实装）** <br>
将历史对话的旧执行返回压缩。<br>
**5.文件操作（v0.2.2实装）** <br>
更精细的文件操作。

## 安装
目前`Fold.ai`未上线任何包管理器平台，发行版本已被构建为原生JavaScript，可以使用Node.js直接运行
```
#1.手动构建项目依赖
cd fold
npm install
Node bin/server.js

#2.Windows用户使用`依赖安装.bat`进行一键启动
双击.bat

#3.Linux / MacOs使用.sh脚本进行依赖安装和启动
双击.sh
```

## 🤝 贡献

欢迎提交 Issue 或 PR！

## 📄 许可证

MIT © 2026 Fold.AI 贡献者

**⭐ 如果这个"20分钟作品"让你觉得有趣，请点亮 Star！**

