import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getUserProviderKey, getUserProviderUrl } from './providers';
import { logger } from '../logger';

export const pluginsRouter = Router();

const PLUGIN_DIR = path.join(__dirname, '../../Plugin');
const CONFIG_DIR = path.join(__dirname, '../../config');

/**
 * 获取插件列表
 */
pluginsRouter.get('/plugins', (req: Request, res: Response) => {
    try {
        if (!fs.existsSync(PLUGIN_DIR)) {
            return res.json({ plugins: [] });
        }

        const pluginFolders = fs.readdirSync(PLUGIN_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        const plugins: any[] = [];

        for (const folder of pluginFolders) {
            const manifestPath = path.join(PLUGIN_DIR, folder, 'plugin.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    plugins.push(manifest);
                } catch (e) {
                    logger.warn(`failed to read plugin manifest: ${folder}/plugin.json`);
                }
            }
        }

        res.json({ plugins });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 获取插件详情
 */
pluginsRouter.get('/plugin/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const manifestPath = path.join(PLUGIN_DIR, id, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: '插件未找到' });
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        res.json(manifest);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 获取插件配置
 */
pluginsRouter.get('/plugin/:id/settings', (req: Request, res: Response) => {
    const { id } = req.params;
    const manifestPath = path.join(PLUGIN_DIR, id, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: '插件未找到' });
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        res.json(manifest.settings || {});
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 获取 Config 文件夹下的配置文件
 */
pluginsRouter.get('/config/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    // 防止路径穿越
    const safeName = path.basename(name);
    const filePath = path.join(CONFIG_DIR, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '配置文件未找到' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // 尝试解析JSON
        try {
            res.json(JSON.parse(content));
        } catch {
            res.send(content);
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 检测用户输入是否需要调用插件（仅判断YES/NO，不生成命令内容）
 */
pluginsRouter.post('/plugin/detect', async (req: Request, res: Response) => {
    try {
        const { messages, provider, model } = req.body;

        if (!messages || !provider || !model) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const apiKey = getUserProviderKey(req.userToken!, provider);
        const baseUrl = getUserProviderUrl(provider);

        if (!apiKey || !baseUrl) {
            return res.status(400).json({ error: '提供商未配置或密钥缺失' });
        }

        const detectSystemPrompt = `判断用户是否需要调用插件，只需回答是或否。
可用插件: CommandExecution(命令执行), Memory(记忆)
如果需要则输出: tool:CommandExecution 或 tool:Memory
如果不需要则输出: 无
多个插件用换行分隔: tool:插件1\\ntool:插件2`;

        const detectMessages = [
            { role: "system", content: detectSystemPrompt },
            ...messages.slice(-2)
        ];

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: detectMessages,
                temperature: 0.01,
                max_tokens: 100,
                stream: false,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const lines = content.split('\n').map((l: string) => l.trim());
        const toolLines = lines.filter((l: string) => l.startsWith('tool:'));

        if (toolLines.length > 0) {
            const pluginNames = toolLines.map((l: string) => l.split(':')[1].trim()).filter(Boolean);
            return res.json({ tool_calls: pluginNames });
        }

        res.json({ tool_calls: [] });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 由聊天模型生成具体的命令内容
 */
pluginsRouter.post('/plugin/command/generate', async (req: Request, res: Response) => {
    try {
        const { messages, provider, model } = req.body;

        if (!messages || !provider || !model) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const apiKey = getUserProviderKey(req.userToken!, provider);
        const baseUrl = getUserProviderUrl(provider);

        if (!apiKey || !baseUrl) {
            return res.status(400).json({ error: '提供商未配置或密钥缺失' });
        }

        const cmdPrompt = `用户需要执行系统命令。请根据对话内容，输出具体的命令。
输出格式:
tool:CommandExecution
shell:powershell
command:要执行的命令

只输出以上格式内容，不要添加其他。`;

        const genMessages = [
            { role: "system", content: cmdPrompt },
            ...messages.slice(-3)
        ];

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: genMessages,
                temperature: 0.1,
                max_tokens: 300,
                stream: false,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const lines = content.split('\n').map((l: string) => l.trim());
        const toolLine = lines.find((l: string) => l.startsWith('tool:'));
        const shellLine = lines.find((l: string) => l.startsWith('shell:'));
        const commandLine = lines.find((l: string) => l.startsWith('command:'));

        if (commandLine) {
            res.json({
                shell: shellLine ? shellLine.substring(6).trim() : 'powershell',
                command: commandLine.substring(8).trim()
            });
        } else {
            res.status(400).json({ error: '无法生成命令' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 执行命令（通过PowerShell或CMD）
 */
pluginsRouter.post('/plugin/command/execute', (req: Request, res: Response) => {
    const { shell, command, timeout, workingDirectory } = req.body;

    if (!command) {
        return res.status(400).json({ error: '缺少命令内容' });
    }

    if (shell !== 'powershell' && shell !== 'cmd') {
        return res.status(400).json({ error: '不支持的Shell类型' });
    }

    const execTimeout = timeout || 30000;
    const workDir = workingDirectory || process.cwd();

    // 检查危险命令
    const dangerousPatterns = [
        /rm\s+-rf/i,
        /format\s+\w/i,
        /del\s+\/f/i,
        /rd\s+\/s/i,
        /shutdown/i,
        /restart-computer/i,
        /stop-computer/i,
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
            return res.status(403).json({ error: '危险命令被拦截' });
        }
    }

    // 强制统一为UTF-8编码输出
    const shellCommand = shell === 'powershell'
        ? `powershell.exe -NoProfile -Command "$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command.replace(/"/g, '\\"')}"`
        : `cmd.exe /c "chcp 65001>nul && ${command.replace(/"/g, '\\"')}"`;

    const startTime = Date.now();

    exec(shellCommand, {
        timeout: execTimeout,
        cwd: workDir,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        encoding: 'buffer',
    }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;

        // 统一解码为UTF-8: 先尝试UTF-8，检测到乱码则用GBK(CP936)重试
        const decode = (buf: Buffer): string => {
            if (!buf || buf.length === 0) return '';
            const utf8 = buf.toString('utf-8');
            // 包含替换字符 → 非法UTF-8 → 用GBK
            if (utf8.includes('�')) {
                try { return new TextDecoder('gbk').decode(buf); } catch { return utf8; }
            }
            // 无替换字符 + 非ASCII字符较多时检测是否GBK被误解为UTF-8
            // GBK→UTF-8 误解码会产生大量拉丁扩展区字符(0x80-0x2FF)，而非CJK字符
            const chars = [...utf8];
            const nonAscii = chars.filter(c => c.charCodeAt(0) > 127);
            if (nonAscii.length > 2) {
                const latinCount = nonAscii.filter(c => {
                    const code = c.charCodeAt(0);
                    return code >= 0x80 && code <= 0x02FF;
                }).length;
                if (latinCount / nonAscii.length > 0.6) {
                    try { return new TextDecoder('gbk').decode(buf); } catch { return utf8; }
                }
            }
            return utf8;
        };

        const result: any = {
            stdout: decode(stdout as Buffer),
            stderr: decode(stderr as Buffer),
            exitCode: error ? (error as any).code || 1 : 0,
            duration,
            shell,
            command,
        };

        if (error && !result.stderr) {
            result.stderr = error.message;
        }

        res.json(result);
    });
});
