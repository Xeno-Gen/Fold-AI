// slash.js — Slash command system (/, /help, /context, /compact)
// Depends on intro.js (loaded first) for globals, chat.js for callAPI
    function initSlashPopup() {
        if (slashPopup) return;
        slashPopup = document.createElement('div');
        slashPopup.className = 'slash-command-popup';
        document.body.appendChild(slashPopup);
    }

    function initSlashGhost(ta) {
        var id = ta.id;
        if (slashGhostEls[id]) return;
        var ghost = document.createElement('div');
        ghost.className = 'slash-ghost';
        ghost.innerHTML = '<span class="ghost-typed"></span><span class="ghost-completion"></span>';
        ta.parentElement.style.position = 'relative';
        ta.parentElement.appendChild(ghost);
        slashGhostEls[id] = ghost;
    }

    function updateSlashGhost(ta, completion) {
        initSlashGhost(ta);
        var ghost = slashGhostEls[ta.id];
        var typed = ghost.querySelector('.ghost-typed');
        var comp = ghost.querySelector('.ghost-completion');
        typed.textContent = ta.value;
        comp.textContent = completion || '';
    }

    function clearSlashGhost(ta) {
        if (!slashGhostEls[ta.id]) return;
        var ghost = slashGhostEls[ta.id];
        ghost.querySelector('.ghost-typed').textContent = '';
        ghost.querySelector('.ghost-completion').textContent = '';
    }

    function showSlashPopup(ta) {
        initSlashPopup();
        var val = ta.value;
        if (!val.startsWith('/') || val.indexOf(' ') !== -1) {
            hideSlashPopup(ta);
            return;
        }
        var query = val.substring(1).toLowerCase();
        var matches = slashCommands.filter(function(c) { return c.name.indexOf(query) !== -1; });
        matches.sort(function(a, b) {
            var aPre = a.name.indexOf(query) === 0 ? 0 : 1;
            var bPre = b.name.indexOf(query) === 0 ? 0 : 1;
            return aPre - bPre || a.name.length - b.name.length;
        });
        if (matches.length === 0) {
            hideSlashPopup(ta);
            return;
        }
        var completion = query && matches[0].name.substring(query.length);
        updateSlashGhost(ta, completion || '');
        var rect = ta.getBoundingClientRect();
        slashPopup.style.left = rect.left + 'px';
        slashPopup.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        slashPopup.style.top = 'auto';
        slashPopup.style.transform = 'none';
        slashPopup.style.width = Math.min(rect.width, 380) + 'px';
        slashActiveIndex = 0;
        slashTarget = ta;
        slashPopup.innerHTML = matches.map(function(c, i) {
            var name = c.name;
            var prefix = query ? name.substring(0, query.length) : '';
            var rest = name.substring(query.length);
            return '<div class="slash-cmd-item' + (i === 0 ? ' active' : '') + '" data-index="' + i + '" data-cmd="' + name + '"><span class="cmd-slash">/' + prefix + (rest ? '<b>' + rest + '</b>' : '') + '</span><span class="cmd-desc">' + c.desc + '</span></div>';
        }).join('');
        slashPopup.classList.add('show');
        slashPopup.querySelectorAll('.slash-cmd-item').forEach(function(item) {
            item.onmousedown = function(e) { e.preventDefault(); executeSlashCommand(this.dataset.cmd, ta); };
        });
    }

    function hideSlashPopup(ta) {
        if (slashPopup) slashPopup.classList.remove('show');
        slashActiveIndex = -1;
        if (ta) clearSlashGhost(ta);
        slashTarget = null;
    }

    function navigateSlashPopup(dir) {
        if (!slashPopup || !slashTarget) return;
        var items = slashPopup.querySelectorAll('.slash-cmd-item');
        if (items.length === 0) return;
        slashActiveIndex = (slashActiveIndex + dir + items.length) % items.length;
        items.forEach(function(item, i) {
            item.classList.toggle('active', i === slashActiveIndex);
        });
    }

    function selectSlashCommand() {
        if (!slashPopup || !slashTarget) return false;
        var active = slashPopup.querySelector('.slash-cmd-item.active');
        if (active) {
            executeSlashCommand(active.dataset.cmd, slashTarget);
            return true;
        }
        return false;
    }

    function executeSlashCommand(cmd, ta) {
        hideSlashPopup(ta);
        ta.value = '';
        updateSendBtn();
        switch (cmd) {
            case 'help': renderSlashHelp(); break;
            case 'context': renderSlashContext(); break;
            case 'compact': renderSlashCompact(); break;
        }
    }

    function estimateTokens(text) {
        if (!text) return 0;
        var cjk = (text.match(/[一-鿿㐀-䶿⺀-⻿　-〿㇀-㇯㈀-㋿㌀-㏿豈-﫿＀-￯]/g) || []).length;
        var other = text.length - cjk;
        return Math.ceil(cjk * 0.6 + other * 0.25);
    }

    function renderSlashContext() {
        var msgTokens = 0;
        var hiddenTokens = 0;
        if (chats[currentChat]) {
            chats[currentChat].forEach(function(m) {
                var t = estimateTokens(m.content || '');
                if (m.hidden) hiddenTokens += t;
                else msgTokens += t;
            });
        }
        var sysPromptText = baseSystemPrompt || '';
        if (currentParams.systemPrompt) sysPromptText += '\n' + currentParams.systemPrompt;
        var sysTokens = estimateTokens(sysPromptText);
        // Tool prompt (~300 chars avg when enabled)
        var toolTokens = (commandExecEnabled || memoryEnabled || fileOpsEnabled || agentEnabled) ? 80 : 0;
        var totalTokens = msgTokens + sysTokens + toolTokens;
        var maxTokens = 1000000;
        var pct = Math.min(totalTokens / maxTokens * 100, 100);
        var remaining = maxTokens - totalTokens;
        var barClass = 'context-bar-fill';
        if (pct > 80) barClass += ' danger';
        else if (pct > 60) barClass += ' warn';

        var html = '<div class="context-bar-wrap"><div class="' + barClass + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '<div class="context-stats"><span>' + (_('used') || '已用') + ': <b>' + totalTokens.toLocaleString() + '</b> tokens (' + pct.toFixed(1) + '%)</span><span>' + (_('remaining') || '剩余') + ': <b>' + remaining.toLocaleString() + '</b> tokens</span></div>' +
            '<div class="context-stats" style="margin-top:4px;flex-direction:column;gap:2px;">' +
            '<span>' + (_('chatMessages') || '对话消息') + ': ' + msgTokens.toLocaleString() + ' tokens</span>' +
            '<span>' + (_('sysPrompt') || '系统提示词') + ': ' + sysTokens.toLocaleString() + ' tokens</span>' +
            (toolTokens ? '<span>' + (_('toolChain') || '工具链') + ': ' + toolTokens.toLocaleString() + ' tokens</span>' : '') +
            (hiddenTokens ? '<span style="color:#8b8178;">' + (_('hiddenText') || '已隐藏') + ': ' + hiddenTokens.toLocaleString() + ' tokens</span>' : '') +
            '</div>' +
            '<div class="context-stats" style="margin-top:4px;"><span>' + (_('totalCapacity') || '总容量') + ': ' + maxTokens.toLocaleString() + ' tokens (1M)</span></div>';

        addSlashResult(_('contextUsage') || '上下文占用', html);
    }

    function renderSlashHelp() {
        var html = '<table class="slash-help-table">';
        slashCommands.forEach(function(c) {
            html += '<tr><td>/' + c.name + '</td><td>' + c.desc + '</td></tr>';
        });
        html += '</table>';
        addSlashResult(_('slashCommands') || '可用命令', html);
    }

    function renderSlashCompact() {
        if (!currentProvider || !currentModel) {
            addSlashResult(_('slashCommands') || '命令', '<p style="color:#b8554a;">' + (_('noProvider') || '请先选择模型') + '</p>');
            return;
        }
        var msgs = chats[currentChat] || [];
        if (msgs.length === 0) {
            addSlashResult('Compact', '<p style="color:#9b968b;">' + (_('emptyChat') || '空对话') + '</p>');
            return;
        }
        // Collect [title]:score first lines from each message
        var lines = [];
        msgs.forEach(function(m, i) {
            if (!m.content) return;
            var firstLine = m.content.split('\n')[0].trim();
            lines.push({ idx: i, role: m.role, firstLine: firstLine });
        });
        var listText = lines.map(function(l) {
            return '[' + l.idx + '] ' + (l.role === 'user' ? '用户' : '模型') + ': ' + l.firstLine;
        }).join('\n');

        var compactPrompt = '程序区分1~3，表示压缩文本程度，目前程度3，清理大部分无用文本，维持命令文本，不触碰维持对话的核心文本。你需要根据文本序号压缩总的上下文，隐藏无用的模型文本，格式如[输出概括]:0~10，序号为重要性程度，你只需要输出需要隐藏的标题文本，并使用|相隔表示隐藏多个，格式如[...]|[...]|，无视其他命令。\n以下是对话文本列表：\n' + listText;

        // Show processing state
        compactOverlayBody = addSlashResult('Compact', '<p style="color:#9b968b;">' + (_('thinking') || '分析中...') + '</p><p style="font-size:12px;color:#8b8178;margin-top:8px;">' + (_('thinking') || '正在分析对话，标记可隐藏文本...') + '</p>');

        // Call the model
        sendCompactRequest(compactPrompt, lines);
    }

    async function sendCompactRequest(compactPrompt, lines) {
        try {
            var resp = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: currentProvider,
                    model: currentModel,
                    messages: [{ role: 'system', content: compactPrompt }, { role: 'user', content: '请根据规则输出需要隐藏的文本标题' }],
                    temperature: 0.1, max_tokens: 500, stream: false,
                    chatFormat: currentChatFormat
                })
            });
            if (!resp.ok) {
                updateCompactResult('<p style="color:#b8554a;">' + _('requestFailed') + resp.status + '</p>');
                return;
            }
            var data = await resp.json();
            var content = data.content || data.choices?.[0]?.message?.content || '';
            // Parse: [title]|[title]|
            var titles = [];
            var re = /\[([^\]]+)\]/g;
            var m;
            while ((m = re.exec(content)) !== null) {
                var t = m[1].trim();
                if (t && !/^\d+$/.test(t)) titles.push(t); // exclude pure numbers
            }
            // Fuzzy match titles to messages and hide
            var hiddenCount = 0;
            titles.forEach(function(t) {
                var lower = t.toLowerCase();
                var matchLen = Math.min(t.length, 10);
                var searchKey = lower.substring(0, matchLen);
                for (var i = 0; i < lines.length; i++) {
                    var lineTitle = lines[i].firstLine.toLowerCase();
                    if (lineTitle.indexOf(searchKey) !== -1) {
                        if (chats[currentChat][lines[i].idx] && !chats[currentChat][lines[i].idx].hidden) {
                            chats[currentChat][lines[i].idx].hidden = true;
                            hiddenCount++;
                        }
                        break;
                    }
                }
            });
            saveChatToBackend();
            refreshChatDisplay();
            var resultHtml = '<p style="color:#6b8a5e;font-weight:500;">' + (_('compactDone') || '压缩完成') + '</p>' +
                '<p style="font-size:13px;color:#8b8178;margin-top:6px;">' + (_('compactHidden') || '已隐藏') + ' <b>' + hiddenCount + '</b> ' + (_('compactMsgs') || '条消息') + '</p>';
            updateCompactResult(resultHtml);
        } catch (e) {
            if (e.name === 'AbortError') return;
            updateCompactResult('<p style="color:#b8554a;">' + (_('requestFailed') || '请求失败') + ': ' + e.message + '</p>');
        }
    }

    var compactOverlayBody = null;
    function updateCompactResult(html) {
        if (compactOverlayBody) compactOverlayBody.innerHTML = html;
    }

    function addSlashResult(title, html) {
        var overlay = document.createElement('div');
        overlay.className = 'slash-result-overlay';
        var card = document.createElement('div');
        card.className = 'slash-result-card';
        card.innerHTML = '<div class="slash-result-header"><h2>' + title + '</h2><button class="slash-result-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="slash-result-body">' + html + '</div>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        function close() {
            overlay.classList.remove('active');
            setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
        }
        overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
        card.querySelector('.slash-result-close').onclick = close;
        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
        });
        // Trigger animation
        requestAnimationFrame(function() { overlay.classList.add('active'); });
        return card.querySelector('.slash-result-body');
    }

    function handleSlashInput(ta) {
        var val = ta.value;
        if (val.startsWith('/') && val.indexOf(' ') === -1 && val.length >= 1) {
            showSlashPopup(ta);
        } else {
            hideSlashPopup(ta);
        }
        updateSendBtn();
    }

    function handleSlashKeydown(ta, e) {
        if (slashPopup && slashPopup.classList.contains('show')) {
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateSlashPopup(1); return true; }
            if (e.key === 'ArrowUp') { e.preventDefault(); navigateSlashPopup(-1); return true; }
            if (e.key === 'Tab') { e.preventDefault(); selectSlashCommand(); return true; }
            if (e.key === 'Escape') { e.preventDefault(); hideSlashPopup(ta); return true; }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!selectSlashCommand()) {
                    hideSlashPopup(ta);
                }
                return true;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!selectSlashCommand()) {
                if (!streaming) sendMessage(false);
            }
            return true;
        }
        return false;
    }

    initText.oninput = function() { handleSlashInput(this); };
    chatText.oninput = function() { handleSlashInput(this); };
    initText.onkeydown = function(e) { handleSlashKeydown(this, e); };
    chatText.onkeydown = function(e) { handleSlashKeydown(this, e); };
