// chat.js — Chat flow, Agent loop, Tool processing, API calls
// Depends on intro.js (loaded first) for all globals and utility functions
    function wrapStreamingBlock(text) {
        // 如果文本包含开标签但无对应闭标签，将开标签之后的内容折叠
        return renderPluginBlocks(text);
    }

    function stripTags(text) {
        return text
            .replace(/<mem:[^>]+>[\s\S]*?<\/mem:[^>]+>/gi, '')
            .replace(/<(?:power|powershell)>\s*[\s\S]*?\s*<\/(?:power|powershell)>/gi, '')
            .replace(/<(?:cmd|command)>\s*[\s\S]*?\s*<\/(?:cmd|command)>/gi, '')
            .replace(/<\s*(?:add|mod)\s*>[\s\S]*?\s*<\s*\/\s*(?:add|mod)\s*>/gi, '')
            .replace(/<mem-del:[^>]+>/gi, '')
            .replace(/<conti:994>/gi, '')
            .trim();
    }

    async function processToolCalls(responseText) {
        // Parse <power>\n...\n</power> and <cmd>\n...\n</cmd> tags
        var commands = [];
        var powerRegex = /<(?:power|powershell)>\s*([\s\S]*?)\s*<\/(?:power|powershell)>/gi;
        var cmdRegex = /<(?:cmd|command)>\s*([\s\S]*?)\s*<\/(?:cmd|command)>/gi;
        var match;
        while ((match = powerRegex.exec(responseText)) !== null) {
            commands.push({ idx: commands.length, shell: 'powershell', command: match[1].trim() });
        }
        while ((match = cmdRegex.exec(responseText)) !== null) {
            commands.push({ idx: commands.length, shell: 'cmd', command: match[1].trim() });
        }
        if (commands.length === 0) return;
        // Stop all streaming command timers since we're about to execute for real
        for (var bid in pluginBlockTimers) {
            if (pluginBlockTimers[bid] && pluginBlockTimers[bid].type === 'cmd') pluginBlockTimers[bid].done = true;
        }

        var dangerous = [/rm\s+-rf/i, /(?:^|[&|;])\s*format\s+[a-z]:/i, /del\s+\/f/i, /rd\s+\/s/i, /shutdown/i];
        for (var ci = 0; ci < commands.length; ci++) {
            var cmd = commands[ci];
            if (dangerous.some(function(p) { return p.test(cmd.command); })) {
                var msg = { role: 'system', content: _('dangerousBlocked') + cmd.command, images: [], _isExec: true };
                chats[currentChat].push(msg);
                addMessage(msg.content, 'system', [], null, msg);
                continue;
            }
            if (commandConfirmEnabled && window.CommandExecutionPlugin) {
                try {
                    if (!(await window.CommandExecutionPlugin.confirmCommand(cmd.shell, cmd.command))) {
                        var msg = { role: 'system', content: _('cmdCancelled') + cmd.shell + ' ' + cmd.command, images: [], _isExec: true };
                        chats[currentChat].push(msg);
                        addMessage(msg.content, 'system', [], null, msg);
                        continue;
                    }
                } catch (e) {
                    console.error('[命令确认] 确认弹窗失败，直接执行:', e);
                }
            }
            // 找到 AI 消息内对应该命令的 cmd plugin-block 并更新它
            var matchedBid = null;
            var cmdNorm = cmd.command.replace(/\s+/g, ' ').trim().toLowerCase();
            for (var bid in pluginBlockTimers) {
                var t = pluginBlockTimers[bid];
                if (t && t.type === 'cmd') {
                    var storedCmd = (t.content || '').replace(/\s+/g, ' ').trim().toLowerCase();
                    if (storedCmd === cmdNorm) { matchedBid = bid; break; }
                }
            }
            var execMsg = { role: 'system', content: '', images: [], _bid: matchedBid, _isExec: true };
            chats[currentChat].push(execMsg);
            try {
                var workDir = (window.CommandExecutionPlugin && window.CommandExecutionPlugin.workingDirectory) || defaultWorkDir;
                var res = await fetch('/api/plugin/CommandExecution/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shell: cmd.shell, command: cmd.command, timeout: 30000, workingDirectory: workDir }) });
                var sysMsg;
                var resultTitle, resultBody;
                if (res.ok) {
                    var d = await res.json();
                    var rawOut = d.stdout || d.stderr || '';
                    var out = rawOut.trim();
                    resultBody = (rawOut ? (out || rawOut) : _('noOutput')) + '\n' + _('exitCode') + d.exitCode;
                    resultTitle = '命令结果: ' + cmd.shell + '> ' + (cmd.command.length > 50 ? cmd.command.substring(0, 47) + '...' : cmd.command);
                    sysMsg = { role: 'system', content: resultBody, images: [], _isExec: true, _execTitle: resultTitle };
                } else {
                    var errText = await res.text();
                    resultTitle = '命令失败: ' + cmd.shell + '> ' + (cmd.command.length > 50 ? cmd.command.substring(0, 47) + '...' : cmd.command);
                    resultBody = errText;
                    sysMsg = { role: 'system', content: resultBody, images: [], _isExec: true, _execTitle: resultTitle };
                }
                var idx = chats[currentChat].indexOf(execMsg);
                if (idx !== -1) chats[currentChat][idx] = sysMsg;
                var target = matchedBid ? document.getElementById(matchedBid) : null;
                if (target) {
                    updateCmdBlock(target, resultTitle, resultBody);
                } else {
                    var fallback = createCmdBlock(resultTitle, resultBody);
                    chatAreaInner.appendChild(fallback);
                    if (emptyHint) emptyHint.style.display = 'none';
                }
                chatArea.scrollTop = chatArea.scrollHeight;
            } catch (e) {
                var resultBody = e.message;
                var resultTitle = '命令异常: ' + cmd.shell + '> ' + (cmd.command.length > 50 ? cmd.command.substring(0, 47) + '...' : cmd.command);
                var sysMsg = { role: 'system', content: resultBody, images: [], _isExec: true, _execTitle: resultTitle };
                var idx = chats[currentChat].indexOf(execMsg);
                if (idx !== -1) chats[currentChat][idx] = sysMsg;
                var target = matchedBid ? document.getElementById(matchedBid) : null;
                if (target) {
                    updateCmdBlock(target, resultTitle, resultBody);
                } else {
                    var fallback = createCmdBlock(resultTitle, resultBody);
                    chatAreaInner.appendChild(fallback);
                    if (emptyHint) emptyHint.style.display = 'none';
                }
                chatArea.scrollTop = chatArea.scrollHeight;
            }
        }
        saveChatToBackend();
    }

    async function processMemoryCalls(responseText) {
        // Parse <mem:key>content</mem:key> tags
        var memRegex = /<mem:([^>]+)>([\s\S]*?)<\/mem:\1>/gi;
        var memDelRegex = /<mem-del:([^>]+)>/gi;
        var match;
        while ((match = memRegex.exec(responseText)) !== null) {
            var key = match[1].trim();
            var content = match[2].trim();
            if (!key || !content) continue;
            try {
                var res = await fetch('/api/plugin/Memory/memory/' + encodeURIComponent(key), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: content })
                });
                if (res.ok) {
                    var msg = { role: 'system', content: _('memSaved') + key + ']', images: [], _isExec: true };
                    chats[currentChat].push(msg);
                    addMessage(msg.content, 'system', [], null, msg);
                }
            } catch (e) {}
        }
        while ((match = memDelRegex.exec(responseText)) !== null) {
            var key = match[1].trim();
            if (!key) continue;
            try {
                var res = await fetch('/api/plugin/Memory/memory/' + encodeURIComponent(key), { method: 'DELETE' });
                if (res.ok) {
                    var msg = { role: 'system', content: _('memDeleted') + key + ']', images: [], _isExec: true };
                    chats[currentChat].push(msg);
                    addMessage(msg.content, 'system', [], null, msg);
                }
            } catch (e) {}
        }
        if (memRegex.lastIndex > 0 || memDelRegex.lastIndex > 0) saveChatToBackend();
        // reset lastIndex for future calls
        memRegex.lastIndex = 0;
        memDelRegex.lastIndex = 0;
        await refreshMemories();
    }

    async function processFileOpsCalls(responseText) {
        var foRegex = /<(add|mod)>([\s\S]*?)<\/\1>/gi;
        var match;
        var hasMatch = false;
        while ((match = foRegex.exec(responseText)) !== null) { hasMatch = true; }
        if (!hasMatch) return;
        foRegex.lastIndex = 0;
        try {
            var workDir = (window.CommandExecutionPlugin && window.CommandExecutionPlugin.workingDirectory) || defaultWorkDir || 'cwd';
            var res = await fetch('/api/plugin/FileOperations/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: responseText, workingDirectory: workDir })
            });
            if (res.ok) {
                var data = await res.json();
                if (data.results && data.results.length > 0) {
                    var lines = [];
                    data.results.forEach(function(r) {
                        if (r.error) {
                            lines.push('[文件操作] ' + r.type + ' 失败: ' + r.error);
                        } else if (r.type === 'add') {
                            lines.push('[文件操作] ' + r.file + ' 已' + (r.action === 'updated' ? '更新' : '创建') + ' (' + r.written + ' bytes)');
                        } else if (r.type === 'mod') {
                            lines.push('[文件操作] ' + r.file + ' 行' + r.range + ' 已修改 (替换' + r.replaced + '行为' + r.with + '行)');
                        }
                    });
                    if (lines.length > 0) {
                        var msg = { role: 'system', content: lines.join('\n'), images: [], _isExec: true };
                        chats[currentChat].push(msg);
                        addMessage(msg.content, 'system', [], null, msg);
                        saveChatToBackend();
                    }
                }
            }
        } catch (e) {}
    }

    // 从 pluginPrompts 模板构建工具提示词
    function buildToolPrompt() {
        var parts = [];
        if (agentEnabled && pluginPrompts.agent) {
            parts.push(pluginPrompts.agent);
        }
        if ((commandExecEnabled || memoryEnabled || fileOpsEnabled)) {
            var toolContent = '';
            // Use tools.md if available, otherwise inline fallback
            if (pluginPrompts.tools) {
                toolContent = pluginPrompts.tools;
            } else {
                toolContent = '你可以在回复中直接使用标签调用以下功能:\n';
                if (commandExecEnabled) {
                    toolContent += '\n- 执行PowerShell: <powershell>\\n命令内容\\n</powershell> 或 <power>\\n命令内容\\n</power>\n- 执行CMD: <command>\\n命令内容\\n</command> 或 <cmd>\\n命令内容\\n</cmd>';
                }
                if (memoryEnabled) {
                    toolContent += '\n- 保存记忆: <mem:键名>内容</mem:键名>\n- 删除记忆: <mem-del:键名>';
                }
                if (fileOpsEnabled) {
                    toolContent += '\n- 写入文件: <add>文件名\\n内容</add>\n- 修改文件: <mod>(文件路径)|(起始行,结束行)\\n修改内容</mod>\n- 恢复备份: <res>文件名</res>';
                }
                toolContent += '\n标签不会显示给用户，请自然地将标签穿插在回复中。';
            }
            parts.push(toolContent.trim());

            // Append dynamic content (memories, work dir) after the static md
            var dynamicParts = [];
            if (memoryEnabled && cachedMemories.length > 0) {
                var memList = '\n[已有记忆]';
                cachedMemories.forEach(function(m, i) { memList += '\n' + (i + 1) + '. ' + m.key + ': ' + (m.content || ''); });
                dynamicParts.push(memList);
            }
            if (commandExecEnabled) {
                var wd = (window.CommandExecutionPlugin && window.CommandExecutionPlugin.workingDirectory) || defaultWorkDir || 'cwd';
                dynamicParts.push('\n默认工作目录为 ' + wd + '，所有命令默认在此目录执行，记住在查看文件时不能虚构文件夹，最佳做法是使用查阅目录的命令');
            }
            if (dynamicParts.length) {
                parts.push(dynamicParts.join('\n').trim());
            }
        }
        return parts.join('\n').trim();
    }

    function compressOldExecMessages(msgs) {
        if (!compressOldExecutions) return msgs;
        var userCount = 0;
        var boundaryIndex = -1;
        for (var i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'user') {
                userCount++;
                if (userCount >= 3) {
                    boundaryIndex = i;
                    break;
                }
            }
        }
        if (boundaryIndex === -1) return msgs;
        for (var i = 0; i < boundaryIndex; i++) {
            if (msgs[i]._isExec && msgs[i].role === 'system') {
                msgs[i] = { role: 'system', content: '<End_System>', images: [], _isExec: true };
            }
        }
        return msgs;
    }

    function reorderMessages(msgs) {
        // 旧的分离式工具提示词合并到第一条 system 消息，其余保持原有顺序
        var toolTexts = [];
        var rest = [];
        msgs.forEach(function(m) {
            if (m.role === 'system' && (
                m.content.indexOf('[工具调用能力]') !== -1 ||
                m.content.indexOf('[Agent能力]') !== -1 ||
                m.content.indexOf('[追加调用]') !== -1
            )) {
                toolTexts.push(m.content);
            } else {
                rest.push(m);
            }
        });
        if (toolTexts.length > 0) {
            // 工具提示词必须放在最前面，独立成一条 system 消息
            rest.unshift({ role: 'system', content: toolTexts.join('\n'), images: [] });
        }
        return rest;
    }

    async function callAPI(messages) {
        if (!currentModel) throw new Error(_('noModel'));
        console.log('[API] 发起请求, 消息数:', messages.length, '模型:', currentModel, '提供商:', currentProvider);
        var requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        currentRequestId = requestId;
        var payload = { messages: messages, provider: currentProvider, model: currentModel, chatFormat: currentChatFormat };
        Object.keys(currentParams).forEach(function(k) { if (currentParams[k] != null) payload[k] = currentParams[k]; });
        payload.stream = true;
        payload.requestId = requestId;
        if (currentThinkMode !== 'fast') payload.deep_think = true;
        payload.thinkMode = currentThinkMode;
        currentAbortController = new AbortController();
        var controller = currentAbortController;
        var res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        if (!res.ok) { var err = await res.text(); throw new Error(err); }
        return { body: res.body, apiRequest: payload };
    }

    async function sendMessage(isRegenerate) {
        if (streaming && !isRegenerate) return;
        if (!currentModel) { showToast(_('selectModel')); return; }
        console.log('[发送] 开始发送消息, 模型:', currentModel, '提供商:', currentProvider, '思考模式:', currentThinkMode, '格式:', currentChatFormat, '参数:', JSON.stringify({ temperature: currentParams.temperature, max_tokens: currentParams.max_tokens, top_p: currentParams.top_p }));

        // 先读取输入内容（必须在 newChat 之前，因为之后 isChatActive 会变化）
        var fromCenter = !isChatActive;
        var ta = fromCenter ? initText : chatText;
        var target = fromCenter ? 'initial' : 'chat';
        var userText = ta.value.trim();
        var textFiles = activeFiles[target].filter(function(f) { return f.type === 'text'; });
        var imgs = activeFiles[target].filter(function(f) { return f.type === 'image'; }).map(function(f) { return f.content; });
        if (!isRegenerate && !userText && !imgs.length && !textFiles.length) return;

        // 如果是开幕输入框首次发送，创建对话并确认到后端
        if (fromCenter) {
            await newChat(true);
            if (!isChatActive) activateChat(true);
            if (pendingNewChatIndex !== null && currentChat === pendingNewChatIndex) {
                try {
                    var res = await fetch('/api/chats', { method: 'POST' });
                    if (res.ok) {
                        var data = await res.json();
                        var realId = data.id;
                        var savedToken = chatTokens[pendingNewChatIndex] || generateToken();
                        chats.splice(pendingNewChatIndex, 1);
                        chatTitles.splice(pendingNewChatIndex, 1);
                        chatTokens.splice(pendingNewChatIndex, 1);
                        while (chats.length <= realId) { chats.push([]); chatTitles.push(''); chatTokens.push(''); }
                        chats[realId] = []; chatTitles[realId] = _('newChat'); chatTokens[realId] = data.token || savedToken;
                        currentChat = realId;
                        pendingNewChatIndex = null;
                        updateUrlWithToken();
                    } else { pendingNewChatIndex = null; }
                } catch (e) { pendingNewChatIndex = null; }
            }
        }

        if (!isRegenerate) {
            var displayContent = userText || (imgs.length ? _('image') : '');
            var userMsg = { role: 'user', content: userText || (imgs.length ? _('image') : ''), images: imgs };
            chats[currentChat].push(userMsg);
            saveChatToBackend();
            if (textFiles.length > 0) {
                var grid = document.createElement('div');
                grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-bottom:6px;';
                textFiles.forEach(function(f) {
                    var ext = f.fileName.split('.').pop().toUpperCase() || 'FILE';
                    var sizeStr = ext + ' ' + Math.round((new Blob([f.content]).size / 1024) * 100) / 100 + 'KB';
                    var card = document.createElement('div');
                    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bubble-user);border-radius:12px;width:160px;cursor:pointer;flex-shrink:0;';
                    card.onclick = function() { openFileViewer(f.fileName, f.content); };
                    card.innerHTML = '<span>' + escapeHtml(f.fileName) + '</span>';
                    grid.appendChild(card);
                });
                chatAreaInner.appendChild(grid);
            }
            addMessage(displayContent, 'user', imgs, null, userMsg);
            if (textFiles.length > 0) {
                textFiles.forEach(function(f) {
                    chats[currentChat].push({ role: 'system', content: _('filePrefix') + f.fileName + ']\n' + f.content });
                });
            }
            ta.value = '';
            activeFiles[target] = [];
            renderPreviews(isChatActive ? chatPreview : initPreview, []);
            updateSendBtn();
        }

        streaming = true;
        isUserScrolledAway = false;
        updateSendBtn();

        if (isRegenerate) {
            var lastUserIdx = -1;
            for (var rmi = chats[currentChat].length - 1; rmi >= 0; rmi--) {
                if (chats[currentChat][rmi].role === 'user') { lastUserIdx = rmi; break; }
            }
            if (lastUserIdx !== -1) chats[currentChat].splice(lastUserIdx + 1);
            // Only remove AI/system bubbles after the last user bubble
            var allBubbles = chatAreaInner.querySelectorAll('.message-bubble');
            var foundUser = false;
            for (var abi = allBubbles.length - 1; abi >= 0; abi--) {
                if (allBubbles[abi].classList.contains('message-user') && !foundUser) {
                    foundUser = true;
                    continue;
                }
                if (foundUser && (allBubbles[abi].classList.contains('message-ai') || allBubbles[abi].classList.contains('message-system'))) {
                    allBubbles[abi].remove();
                }
            }
        }

        var fullContent = '';
        var fullReasoning = '';
        var thinkStartTime = null;
        userExpandedBodies = {};
        var bubble = addMessage(_('thinking'), 'ai', [], null, null);

        try {
            var streamUsage = null;
            var streamRequestBody = null;
            var apiRequest = null;
            var maxAgentIter = agentEnabled ? agentMaxIterations : 1;
            var agentBubbles = [];

            for (var agentIter = 0; agentIter < maxAgentIter; agentIter++) {
                // Rebuild messages from current chat state (includes command results from previous iterations)
                var iterMsgs = reorderMessages(
                    compressOldExecMessages(
                        chats[currentChat].filter(function(m) { return m.role; }).map(function(m) { return { role: m.role, content: m.content, images: m.images || [], _isExec: m._isExec }; })
                    )
                );
                // 构建工具/Agent 提示词（从外部 Config/Plugin/*.md 模板加载）
                var toolPromptText = buildToolPrompt();
                // 融合到第一条 system 消息中（不新建单独消息）
                if (toolPromptText) {
                    // 工具提示词必须放在最前面，独立成一条 system 消息
                    // 检查是否已有工具提示词，避免重复添加
                    var hasToolPrompt = false;
                    for (var si = 0; si < iterMsgs.length; si++) {
                        if (iterMsgs[si].role === 'system' && (iterMsgs[si].content.indexOf('[Agent能力]') !== -1 || iterMsgs[si].content.indexOf('[工具调用能力]') !== -1)) {
                            hasToolPrompt = true;
                            break;
                        }
                    }
                    if (!hasToolPrompt) {
                        iterMsgs.unshift({ role: 'system', content: toolPromptText, images: [] });
                    }
                }
                // Think mode prompts
                if (currentThinkMode === 'deep' || currentThinkMode === 'meditate') {
                    try {
                        var cfgFile = currentThinkMode === 'deep' ? 'DeepThink.json' : 'Medit.json';
                        var cfgRes = await fetch('/api/config/' + cfgFile);
                        if (cfgRes.ok) {
                            var cfg = await cfgRes.json();
                            if (cfg.think && cfg.think.trim()) {
                                var th2 = iterMsgs.find(function(m) { return m.role === 'system' && m.content.indexOf(cfg.think.substring(0, 20)) !== -1; });
                                if (!th2) iterMsgs.unshift({ role: 'system', content: cfg.think, images: [] });
                            }
                        }
                    } catch (e) {}
                }

                var callResult = await callAPI(iterMsgs);
                apiRequest = callResult.apiRequest || apiRequest;
                fullContent = '';
                fullReasoning = '';

                bubble.innerHTML = '';
                var reasoningDiv = document.createElement('div');
                var contentDiv = document.createElement('div');
                contentDiv.className = 'markdown-body';
                bubble.appendChild(reasoningDiv);
                bubble.appendChild(contentDiv);

                var decoder = new TextDecoder();
                var reader = callResult.body.getReader();
                var buffer = '';

                while (true) {
                    var result = await reader.read();
                    if (result.done) break;
                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (var li = 0; li < lines.length; li++) {
                        var line = lines[li];
                        if (line.startsWith('data: ')) {
                            var data = line.substring(6);
                            if (data === '[DONE]') continue;
                            try {
                                var json = JSON.parse(data);
                                if (json.type === 'request_body' && json.requestBody) { streamRequestBody = json.requestBody; continue; }
                                if (json.usage && !json.choices) { streamUsage = json.usage; continue; }
                                if (json.usage) streamUsage = json.usage;
                                var delta = json.choices?.[0]?.delta;
                                if (delta) {
                                    if (delta.reasoning_content) {
                                        if (!thinkStartTime) { thinkStartTime = Date.now(); }
                                        fullReasoning += String(delta.reasoning_content);
                                        reasoningDiv.innerHTML = createThinkBlock(fullReasoning, { isThinking: true });
                                        if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
                                    }
                                    if (delta.content != null) {
                                        fullContent += String(delta.content);
                                        if (fullContent) {
                                            contentDiv.innerHTML = _renderAIContent(fullContent) || '...';
                                            updatePluginTimers();
                                            restoreExpandedBlocks();
                                            if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
                                        }
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                    if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
                }
                if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
                    try {
                        var remJson = JSON.parse(buffer.trim().substring(6));
                        var remDelta = remJson.choices?.[0]?.delta;
                        if (remDelta) {
                            if (remDelta.reasoning_content) fullReasoning += String(remDelta.reasoning_content);
                            if (remDelta.content != null) fullContent += String(remDelta.content);
                        }
                    } catch (e) {}
                }

                // Save this iteration to chat (before agent check so non-agent mode also saves)
                var iterAssistantMsg = { role: 'assistant', content: fullContent, reasoning: fullReasoning || null, usage: streamUsage || null, apiRequest: streamRequestBody || apiRequest || null };
                chats[currentChat].push(iterAssistantMsg);
                saveChatToBackend();

                // Process tool calls from this iteration (before agent break so non-agent mode also processes)
                if (commandExecEnabled) {
                    try { await processToolCalls(fullContent); } catch (e) { console.error('[工具调用错误]', e); }
                }
                if (memoryEnabled) {
                    try { await processMemoryCalls(fullContent); } catch (e) { console.error('[记忆调用错误]', e); }
                }
                if (fileOpsEnabled) {
                    try { await processFileOpsCalls(fullContent); } catch (e) { console.error('[文件操作错误]', e); }
                }

                if (!agentEnabled) break;

                // Check conti:994 on any line
                var shouldContinue = false;
                if (agentIter < maxAgentIter - 1) {
                    var contentLines = fullContent.split('\n');
                    for (var cl = 0; cl < contentLines.length; cl++) {
                        if (contentLines[cl].indexOf('<conti:994>') !== -1) {
                            shouldContinue = true;
                            break;
                        }
                    }
                }
                console.log('[Agent] 迭代 ' + (agentIter + 1) + ' 完成, 长度: ' + fullContent.length + ', <conti:994>=' + shouldContinue);

                if (!shouldContinue) break;

                // Finalize current iteration bubble (restore message actions)
                var finMsg = iterAssistantMsg;
                var finBubble = createMessageBubble(fullContent, 'ai', [], fullReasoning, finMsg, '');
                bubble.replaceWith(finBubble);

                // Start fresh bubble for next iteration
                bubble = addMessage('...', 'ai', [], null, null);
            }

            var thinkElapsed = thinkStartTime ? Math.round((Date.now() - thinkStartTime) / 1000) : 0;
            if (thinkStartTime) { console.log('[Agent] 思考结束, 耗时:', thinkElapsed, '秒'); }
            console.log('[API] 响应完成, 内容长度:', fullContent.length, '字符');
            iterAssistantMsg.thinkElapsed = thinkElapsed || null;
            var newBubble = createMessageBubble(fullContent, 'ai', [], fullReasoning, iterAssistantMsg, '');
            bubble.replaceWith(newBubble);
            updateHistoryTitle();
            saveChatToBackend();
        } catch (e) {
            if (e && (e.name === 'AbortError' || e.code === 'ERR_CANCELED')) {
                var md = bubble.querySelector('.markdown-body') || bubble;
                md.innerHTML = renderMarkdown(renderPluginBlocks(fullContent));
                updatePluginTimers();
                var thinkElapsed2 = thinkStartTime ? Math.round((Date.now() - thinkStartTime) / 1000) : 0;
                if (thinkStartTime) {
                    console.log('[深度思考] 深度思考被中断, 耗时:', thinkElapsed2, '秒');
                }
                var assistantMsg = { role: 'assistant', content: fullContent, reasoning: fullReasoning || null, usage: streamUsage || null, apiRequest: apiRequest || null, thinkElapsed: thinkElapsed2 || null };
                chats[currentChat].push(assistantMsg);
                updateHistoryTitle();
                saveChatToBackend();
            } else {
                bubble.innerHTML = '';
                var errDiv = document.createElement('div');
                errDiv.style.cssText = 'padding:8px 0;color:#e74c3c;font-size:14px;';
                errDiv.textContent = _('requestFailed') + e.message;
                bubble.appendChild(errDiv);
                console.error(e);
            }
        } finally {
            streaming = false;
            currentAbortController = null;
            updateSendBtn();
        }
    }
