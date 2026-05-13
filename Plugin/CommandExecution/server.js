module.exports = function(context) {
    const express = require('express');
    const { exec } = require('child_process');
    const router = express.Router();

    // ---- detect: 检测用户输入是否需要执行命令 ----
    async function detect(req, res) {
        try {
            const { messages, provider, model } = req.body;

            if (!messages || !provider || !model) {
                return res.status(400).json({ error: '缺少必要参数' });
            }

            const apiKey = context.getUserProviderKey(req.userToken, provider);
            const baseUrl = context.getUserProviderUrl(provider);

            if (!apiKey || !baseUrl) {
                return res.status(400).json({ error: '提供商未配置或密钥缺失' });
            }

            const detectSystemPrompt = `判断用户是否需要执行系统命令，只需回答是或否。
如果需要则输出: YES
如果不需要则输出: 无`;

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

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            if (content.trim().toUpperCase().includes('YES')) {
                return res.json({ tool_calls: ['CommandExecution'] });
            }
            res.json({ tool_calls: [] });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    router.post('/detect', detect);

    // ---- generate: 由聊天模型生成具体的命令内容 ----
    async function generate(req, res) {
        try {
            const { messages, provider, model } = req.body;

            if (!messages || !provider || !model) {
                return res.status(400).json({ error: '缺少必要参数' });
            }

            const apiKey = context.getUserProviderKey(req.userToken, provider);
            const baseUrl = context.getUserProviderUrl(provider);

            if (!apiKey || !baseUrl) {
                return res.status(400).json({ error: '提供商未配置或密钥缺失' });
            }

            const cmdPrompt = `用户需要执行系统命令。请根据对话内容，输出具体的命令。
使用标签格式: <power:PowerShell命令> 或 <cmd:CMD命令>
只输出标签，不要添加其他内容。`;

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

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const powerMatch = content.match(/<power:(.+?)>/i);
            const cmdMatch = content.match(/<cmd:(.+?)>/i);

            if (powerMatch) {
                res.json({ shell: 'powershell', command: powerMatch[1].trim() });
            } else if (cmdMatch) {
                res.json({ shell: 'cmd', command: cmdMatch[1].trim() });
            } else {
                res.status(400).json({ error: '无法生成命令' });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    router.post('/generate', generate);

    // ---- execute: 执行命令（通过PowerShell或CMD） ----
    function execute(req, res) {
        const { shell, command, timeout, workingDirectory } = req.body;

        if (!command) {
            return res.status(400).json({ error: '缺少命令内容' });
        }

        if (shell !== 'powershell' && shell !== 'cmd') {
            return res.status(400).json({ error: '不支持的Shell类型' });
        }

        const execTimeout = timeout || 30000;
        const fs = require('fs');
        const path = require('path');
        let workDir = workingDirectory || process.cwd();
        // 'cwd' 映射到项目实际工作目录
        if (workDir === 'cwd') {
            workDir = path.join(__dirname, '../../../cwd');
        }
        // 相对路径转为绝对路径
        if (!path.isAbsolute(workDir)) {
            workDir = path.resolve(workDir);
        }
        // 确保工作目录存在，否则回退到进程 cwd
        if (!fs.existsSync(workDir)) {
            try { fs.mkdirSync(workDir, { recursive: true }); } catch (e) { workDir = process.cwd(); }
        }

        const dangerousPatterns = [
            /rm\s+-rf/i,
            /(?:^|[&|;])\s*format\s+[a-z]:/i,
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

        const sysRoot = process.env.SystemRoot || 'C:\\Windows';
        const psPath = sysRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        const cmdPath = sysRoot + '\\System32\\cmd.exe';

        let shellCommand;
        const psUtf8Preamble = 'chcp 65001 > $null; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues[\'*:Encoding\'] = \'utf8\'; $PSDefaultParameterValues[\'Out-File:Encoding\'] = \'utf8\'; $PSDefaultParameterValues[\'Set-Content:Encoding\'] = \'utf8\'; $PSDefaultParameterValues[\'Add-Content:Encoding\'] = \'utf8\';';
        if (shell === 'powershell' && command.includes('\n')) {
            // Multi-line PowerShell: write to temp .ps1 file to avoid newline issues
            const tmpDir = workDir;
            const tmpFile = tmpDir + '\\_ps_tmp_' + Date.now() + '.ps1';
            const psScript = psUtf8Preamble + '\n' + command;
            fs.writeFileSync(tmpFile, '﻿' + psScript, 'utf-8');
            shellCommand = `"${psPath}" -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`;
            context.logger.info('[exec] powershell (script)> ' + tmpFile);
            // Clean up temp file after execution
            const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (e) {} };
            const startTime = Date.now();
            exec(shellCommand, { timeout: execTimeout, cwd: workDir, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'buffer' }, (error, stdout, stderr) => {
                cleanup();
                handleResult(error, stdout, stderr, startTime);
            });
            return;
        } else if (shell === 'powershell') {
            shellCommand = `"${psPath}" -NoProfile -Command "${psUtf8Preamble} ${command.replace(/"/g, '\\"')}"`;
        } else {
            shellCommand = `"${cmdPath}" /c "chcp 65001>nul && ${command.replace(/"/g, '\\"')}"`;
        }

        context.logger.info('[exec] ' + shell + '> ' + command);
        const startTime = Date.now();

        exec(shellCommand, {
            timeout: execTimeout,
            cwd: workDir,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
            encoding: 'buffer',
        }, (error, stdout, stderr) => {
            handleResult(error, stdout, stderr, startTime);
        });

        function handleResult(error, stdout, stderr, startTime) {
            const duration = Date.now() - startTime;

            const decode = (buf) => {
                if (!buf || buf.length === 0) return '';
                // On Chinese Windows, PowerShell often outputs GBK despite chcp 65001.
                // Try GBK first: if it decodes cleanly (no replacement chars), use it.
                // GBK→UTF8 mismatch produces valid-but-wrong CJK chars that slip past
                // simple heuristics, so we invert the priority.
                try {
                    const gbk = new TextDecoder('gbk').decode(buf);
                    // If GBK produced replacement characters, the output likely isn't GBK
                    if (!gbk.includes('�')) return gbk;
                } catch {}
                // Fall back to UTF-8
                const utf8 = buf.toString('utf-8');
                if (!utf8.includes('�')) return utf8;
                // Both failed — return the one with fewer replacement chars
                try {
                    const gbk = new TextDecoder('gbk').decode(buf);
                    const gbkBad = (gbk.match(/�/g) || []).length;
                    const utf8Bad = (utf8.match(/�/g) || []).length;
                    return gbkBad <= utf8Bad ? gbk : utf8;
                } catch {}
                return utf8;
            };

            const result = {
                stdout: decode(stdout),
                stderr: decode(stderr),
                exitCode: error ? (error.code || 1) : 0,
                duration,
                shell,
                command,
            };

            if (error && !result.stderr) {
                result.stderr = error.message;
            }

            context.logger.info('[exec] exit=' + result.exitCode + ' dur=' + duration + 'ms stdout=' + (result.stdout ? result.stdout.substring(0, 100) : '(empty)'));
            res.json(result);
        }
    }
    router.post('/execute', execute);

    context.logger.info('CommandExecution plugin routes registered');

    // Return router AND named handlers for backward compat delegation
    return { router, detect, generate, execute };
};
