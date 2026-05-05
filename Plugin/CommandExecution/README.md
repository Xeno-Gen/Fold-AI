# 命令执行插件 (CommandExecution)

## 简介
允许 AI 根据对话需求主动调用系统命令执行工具。

## 调用格式
AI 在回复中输出以下格式即可调用：

```plaintext
tool:CommandExecution
Power1: 具体的PowerShell命令
```

或使用 CMD：
```plaintext
tool:CommandExecution
cmd1: 具体的CMD命令
```

多条命令使用递增编号：Power1, Power2... 或 cmd1, cmd2...

## 执行流程
1. AI 输出 tool:CommandExecution + 命令
2. 系统自动进行安全检查
3. 如开启确认模式，弹出确认窗口给用户审核
4. 执行命令并显示结果
5. 结果会追加到对话中

## 安全机制
- 危险命令（rm -rf、format、shutdown 等）自动拦截
- 可选执行前用户确认
- 命令执行超时限制

## 启用/禁用
在输入框的深度思考弹窗 → 工具链 → 命令执行 中切换。
