/**
 * CommandExecution Plugin - 命令执行插件
 * 允许AI模型执行PowerShell和CMD命令
 * 所有操作显示在"执行插件"区域，类似深度思考输出样式
 */

(function() {
    'use strict';

    class CommandExecutionPlugin {
        constructor() {
            this.id = 'CommandExecution';
            this.name = '命令执行';
            this.enabled = false;
            this.confirmBeforeExecution = true;
            this.allowedShells = ['powershell', 'cmd'];
            this.timeout = 30000;
            this.workingDirectory = 'D:\\claude';
            this.executionHistory = [];

            // 从配置加载设置
            this.loadSettings();
        }

        loadSettings() {
            try {
                const saved = localStorage.getItem('plugin_CommandExecution');
                if (saved) {
                    const settings = JSON.parse(saved);
                    this.enabled = settings.enabled ?? false;
                    this.confirmBeforeExecution = settings.confirmBeforeExecution ?? true;
                    this.allowedShells = settings.allowedShells ?? ['powershell', 'cmd'];
                    this.timeout = settings.timeout ?? 30000;
                    this.workingDirectory = settings.workingDirectory ?? 'D:\\claude';
                }
            } catch (e) {
                console.warn('[CommandExecution] 加载设置失败:', e);
            }
        }

        saveSettings() {
            try {
                localStorage.setItem('plugin_CommandExecution', JSON.stringify({
                    enabled: this.enabled,
                    confirmBeforeExecution: this.confirmBeforeExecution,
                    allowedShells: this.allowedShells,
                    timeout: this.timeout,
                    workingDirectory: this.workingDirectory
                }));
            } catch (e) {
                console.warn('[CommandExecution] 保存设置失败:', e);
            }
        }

        /**
         * 设置启用状态
         */
        setEnabled(enabled) {
            this.enabled = enabled;
            this.saveSettings();
            // 触发事件
            document.dispatchEvent(new CustomEvent('plugin:command:enabled', { detail: { enabled } }));
        }

        /**
         * 设置确认模式
         */
        setConfirmBeforeExecution(confirm) {
            this.confirmBeforeExecution = confirm;
            this.saveSettings();
        }

        /**
         * 执行命令 - 由前端调用
         * @param {string} shell - 'powershell' 或 'cmd'
         * @param {string} command - 要执行的命令
         * @param {Function} onResult - 结果回调
         */
        async execute(shell, command, onResult) {
            if (!this.enabled) {
                throw new Error('命令执行插件未启用');
            }

            if (!this.allowedShells.includes(shell)) {
                throw new Error(`不允许的Shell类型: ${shell}`);
            }

            // 检查命令安全性
            if (!this.isCommandSafe(command)) {
                throw new Error('命令被安全策略拦截');
            }

            // 如果开启确认，等待用户确认
            if (this.confirmBeforeExecution) {
                const confirmed = await this.confirmCommand(shell, command);
                if (!confirmed) {
                    throw new Error('用户取消了命令执行');
                }
            }

            // 显示执行状态
            this.showExecutionBlock(shell, command, 'running');

            try {
                // 通过后端API执行命令
                const result = await this.executeViaAPI(shell, command);

                // 记录执行历史
                this.executionHistory.push({
                    shell,
                    command,
                    result,
                    time: new Date().toISOString()
                });

                // 显示结果
                this.showExecutionBlock(shell, command, 'completed', result);

                if (onResult) onResult(null, result);
                return result;
            } catch (err) {
                this.showExecutionBlock(shell, command, 'error', err.message);
                if (onResult) onResult(err);
                throw err;
            }
        }

        /**
         * 检查命令是否安全
         */
        isCommandSafe(command) {
            const dangerousPatterns = [
                /rm\s+-rf/i,
                /format\s+\w/i,
                /del\s+\/f/i,
                /rd\s+\/s/i,
                /shutdown/i,
                /restart-computer/i,
                /stop-computer/i,
                /Remove-Item/i,
                /Clear-Host/i,
            ];

            // 如果是查看类命令，直接放行
            const safePatterns = [
                /^(dir|ls|pwd|cd|echo|type|cat|get-|find|where|help|man|whoami|hostname)/i,
                /^git\s/,
                /^npm\s/,
                /^node\s/,
                /^pnpm\s/,
                /^bun\s/,
                /^python\s/,
                /^ipconfig/i,
                /^systeminfo/i,
                /^netstat/i,
                /^tasklist/i,
                /^chcp/i,
                /^set\s/i,
                /^\$env:/i,
            ];

            // 查看类命令直接放行
            for (const pattern of safePatterns) {
                if (pattern.test(command.trim())) return true;
            }

            // 危险命令拦截
            for (const pattern of dangerousPatterns) {
                if (pattern.test(command)) return false;
            }

            // 默认允许
            return true;
        }

        /**
         * 确认命令执行
         */
        confirmCommand(shell, command) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'command-confirm-overlay';

                const displayCmd = command.length > 80 ? command.substring(0, 77) + '...' : command;

                overlay.innerHTML = `
                    <div class="command-confirm-dialog">
                        <div class="command-confirm-header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <span>执行命令确认</span>
                        </div>
                        <div class="command-confirm-body">
                            <div class="command-confirm-info">
                                <span class="command-confirm-label">Shell:</span>
                                <span class="command-confirm-value">${shell}</span>
                            </div>
                            <div class="command-confirm-info">
                                <span class="command-confirm-label">命令:</span>
                                <span class="command-confirm-value command-confirm-code">${this.escapeHtml(displayCmd)}</span>
                            </div>
                            <div class="command-confirm-info">
                                <span class="command-confirm-label">目录:</span>
                                <span class="command-confirm-value">${this.workingDirectory}</span>
                            </div>
                        </div>
                        <div class="command-confirm-actions">
                            <button class="command-confirm-btn command-confirm-cancel">取消</button>
                            <button class="command-confirm-btn command-confirm-allow">允许执行</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(overlay);

                // 动画进入
                requestAnimationFrame(() => {
                    overlay.classList.add('active');
                });

                const cleanup = (result) => {
                    overlay.classList.remove('active');
                    setTimeout(() => {
                        if (overlay.parentNode) overlay.remove();
                        resolve(result);
                    }, 200);
                };

                overlay.querySelector('.command-confirm-cancel').onclick = () => cleanup(false);
                overlay.querySelector('.command-confirm-allow').onclick = () => cleanup(true);

                // ESC键取消
                const keyHandler = (e) => {
                    if (e.key === 'Escape') {
                        cleanup(false);
                        document.removeEventListener('keydown', keyHandler);
                    }
                };
                document.addEventListener('keydown', keyHandler);
            });
        }

        /**
         * 通过API执行命令
         */
        async executeViaAPI(shell, command) {
            const res = await fetch('/api/plugin/command/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shell,
                    command,
                    timeout: this.timeout,
                    workingDirectory: this.workingDirectory
                })
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err || '命令执行失败');
            }

            return await res.json();
        }

        /**
         * 显示执行内容块（类似深度思考样式）
         */
        showExecutionBlock(shell, command, status, result) {
            // 查找或创建执行插件容器
            let container = document.getElementById('execution-plugin-container');
            if (!container) {
                container = this.createExecutionContext();
            }

            const block = document.createElement('div');
            block.className = 'execution-block';

            const statusIcon = status === 'running' ? '⏳' : status === 'completed' ? '✅' : '❌';
            const statusText = status === 'running' ? '执行中...' : status === 'completed' ? '执行完成' : '执行失败';

            const displayCmd = command.length > 100 ? command.substring(0, 97) + '...' : command;

            block.innerHTML = `
                <div class="execution-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <div class="execution-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </div>
                    <span>执行命令 <span class="execution-status">${statusText}</span></span>
                    <div class="think-arrow" style="margin-left:auto;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"></path>
                        </svg>
                    </div>
                </div>
                <div class="execution-body-wrapper">
                    <div class="execution-line"></div>
                    <div class="execution-content">
                        <div class="execution-command"><span class="execution-prompt">${shell === 'powershell' ? 'PS' : 'CMD'}> </span>${this.escapeHtml(displayCmd)}</div>
                        ${result ? this.formatResult(result, status) : '<div class="execution-loading">⏳ 命令执行中...</div>'}
                    </div>
                </div>
            `;

            container.appendChild(block);

            // 滚动到最新
            const pluginHeader = document.getElementById('execution-plugin-header');
            if (pluginHeader) {
                pluginHeader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        /**
         * 格式化执行结果
         */
        formatResult(result, status) {
            if (status === 'error') {
                return `<div class="execution-result execution-error">${this.escapeHtml(result)}</div>`;
            }

            const stdout = result.stdout || '';
            const stderr = result.stderr || '';
            const exitCode = result.exitCode !== undefined ? result.exitCode : 0;

            let html = '';
            if (stdout) {
                html += `<pre class="execution-stdout">${this.escapeHtml(stdout)}</pre>`;
            }
            if (stderr) {
                html += `<pre class="execution-stderr">${this.escapeHtml(stderr)}</pre>`;
            }
            if (!stdout && !stderr) {
                html += `<div class="execution-empty">命令已执行 (退出码: ${exitCode})</div>`;
            }
            html += `<div class="execution-exit-code">退出码: ${exitCode}</div>`;

            return html;
        }

        /**
         * 创建执行插件容器
         */
        createExecutionContext() {
            const chatAreaInner = document.getElementById('chatAreaInner');
            if (!chatAreaInner) return null;

            const container = document.createElement('div');
            container.id = 'execution-plugin-container';
            container.className = 'execution-plugin-container';

            const header = document.createElement('div');
            header.id = 'execution-plugin-header';
            header.className = 'execution-plugin-header';
            header.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <span>执行插件</span>
                <button class="execution-clear-btn" title="清除记录">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;

            header.querySelector('.execution-clear-btn').onclick = () => {
                container.innerHTML = '';
                this.executionHistory = [];
            };

            container.appendChild(header);

            // 插入到chatAreaInner的最前面（在消息之前）
            chatAreaInner.insertBefore(container, chatAreaInner.firstChild);

            return container;
        }

        /**
         * 检查并移除执行插件容器（如果没有内容）
         */
        cleanupExecutionContext() {
            const container = document.getElementById('execution-plugin-container');
            if (container && container.children.length <= 1) {
                container.remove();
            }
        }

        escapeHtml(text) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(text).replace(/[&<>"']/g, m => map[m]);
        }
    }

    // 注册插件到全局
    window.CommandExecutionPlugin = new CommandExecutionPlugin();

    console.log('[CommandExecution] 插件已加载');

})();
