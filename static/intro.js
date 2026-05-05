// 如果有服务端嵌入的对话数据，立即隐藏开幕输入框防止闪烁
(function(){
    if (window.__CHAT_DATA__) {
        document.body.classList.add('chat-active');
        var ci = document.getElementById('centerInitial');
        if (ci) ci.style.display = 'none';
    }
})();

// 将 showToast 暴露为全局函数
window.showToast = function(msg) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 4000);
};

(function() {
    const $ = id => {
        const el = document.getElementById(id);
        if (!el) console.warn('未找到元素:', id);
        return el;
    };

    const chatArea = $('chatArea'), bottomInput = $('bottomInputContainer');
    const chatAreaInner = $('chatAreaInner');
    const initText = $('initialTextarea'), chatText = $('chatTextarea');
    const initSend = $('initialSendBtn'), chatSend = $('chatSendBtn');
    const initPreview = $('initialImagePreview'), chatPreview = $('chatImagePreview');
    const chatHeader = $('chatHeader'), centerInit = $('centerInitial');
    const chatTitleText = $('chatTitleText'), chatTitleInput = $('chatTitleInput');
    const emptyHint = $('emptyHint'), historyList = $('chatHistoryList');
    const settingsBtn = $('settingsBtn'), initialSettingsBtn = $('initialSettingsBtn');
    const drawerOverlay = $('drawerOverlay'), drawerBody = $('drawerBody'), drawerClose = $('drawerClose');
    const fileInput = $('hiddenFileInput'), toast = $('toast');
    const initModelBtn = $('initialModelBtn'), chatModelBtn = $('chatModelBtn');
    const initModelLabel = $('initialModelLabel'), chatModelLabel = $('chatModelLabel');
    const sidebarLeft = $('sidebarLeft'), sidebarToggle = $('sidebarToggle');
    const newChatSidebarBtn = $('newChatSidebarBtn'), sidebarLogo = $('sidebarLogo');
    const initialAttachBtn = $('initialAttachBtn'), chatAttachBtn = $('chatAttachBtn');

    const fileViewerOverlay = $('fileViewerOverlay');
    const fileViewerBody = $('fileViewerBody'), fileViewerTitle = $('fileViewerTitle'), fileViewerClose = $('fileViewerClose');
    const filePanelOverlay = $('filePanelOverlay'), filePanelBody = $('filePanelBody'), filePanelClose = $('filePanelClose'), filePanelTabs = $('filePanelTabs'), filePanelTitle = $('filePanelTitle');
    const chatFileBtn = $('chatFileBtn'), initialFileBtn = $('initialFileBtn');

    let isChatActive = false, deepThinkEnabled = false, currentThinkMode = 'fast';
    let cachedThinkPrompt = '';
    let commandExecEnabled = false, commandConfirmEnabled = true, currentTheme = 'system';
    let chats = [[]], chatTitles = ['当前对话'], chatTokens = [''], currentChat = 0;
    let activeFiles = { initial: [], chat: [] };
    let streaming = false, isUserScrolledAway = false, currentAbortController = null;
    let currentProvider = null, currentChatFormat = 'OpenAI', currentModel = 'deepseek-v4-flash';
    let currentParams = { temperature: 0.7, top_p: 1.0, max_tokens: 2048, seed: null, frequency_penalty: 0, presence_penalty: 0, top_k: null, systemPrompt: '' };
    let customPort = 8080, providers = [], availableModels = [], allModels = [];
    const pinnedChats = new Set();
    let pendingNewChatIndex = null;

    function generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        for (let i = 0; i < 16; i++) result += chars.charAt(arr[i] % 62);
        return result;
    }
    function getCurrentToken() { return chatTokens[currentChat] || ''; }
    function updateUrlWithToken() {
        const token = getCurrentToken();
        if (token) history.pushState(null, '', '/chat/' + token);
    }

    function applyTheme(theme) {
        if (theme === 'system') {
            document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('fold_ai_settings'));
            if (s) {
                currentTheme = s.theme || 'system';
                commandConfirmEnabled = s.commandConfirm !== undefined ? s.commandConfirm : true;
                commandExecEnabled = s.commandExecEnabled || false;
                currentThinkMode = s.thinkMode === 'direct' ? 'fast' : (s.thinkMode || 'fast');
                deepThinkEnabled = s.deepThink || false;
            }
        } catch (e) {}
        applyTheme(currentTheme);
        try { var sf = localStorage.getItem('fold_chat_font'); if (sf) document.documentElement.style.setProperty('--chat-font', sf); } catch (e) {}
    }

    function saveSettingsToLocal() {
        try {
            localStorage.setItem('fold_ai_settings', JSON.stringify({ theme: currentTheme, commandConfirm: commandConfirmEnabled, commandExecEnabled: commandExecEnabled, thinkMode: currentThinkMode, deepThink: deepThinkEnabled }));
        } catch (e) {}
    }

    let configPrompts = { think_modes: {} };
    async function loadConfigPrompts() {
        try { const r = await fetch('/api/config/prompts.json'); if (r.ok) configPrompts = await r.json(); } catch (e) {}
    }
    function getReasonSteps() { return configPrompts.think_modes?.[currentThinkMode]?.steps || []; }

    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2200);
    }

    function updateSendBtn() {
        const btns = [{ btn: initSend, target: 'initial' }, { btn: chatSend, target: 'chat' }];
        btns.forEach(({ btn, target }) => {
            if (!btn) return;
            if (streaming) {
                btn.classList.add('stop-btn');
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
                btn.title = '停止生成';
            } else {
                btn.classList.remove('stop-btn');
                const ta = isChatActive ? chatText : initText;
                btn.disabled = !(ta.value.trim() || activeFiles[target].length > 0);
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
                btn.title = '发送';
            }
        });
    }

    function openFileViewer(name, content) {
        if (fileViewerTitle) fileViewerTitle.textContent = name;
        if (fileViewerBody) fileViewerBody.textContent = content;
        if (fileViewerOverlay) fileViewerOverlay.classList.add('active');
    }
    function closeFileViewer() { if (fileViewerOverlay) fileViewerOverlay.classList.remove('active'); }
    if (fileViewerClose) fileViewerClose.onclick = closeFileViewer;
    if (fileViewerOverlay) fileViewerOverlay.addEventListener('click', e => { if (e.target === fileViewerOverlay) closeFileViewer(); });

    if (sidebarToggle) sidebarToggle.onclick = () => { sidebarLeft.classList.toggle('visible'); sidebarLeft.classList.toggle('expanded'); };

    const settingsPanel = document.getElementById('settingsPanel');
    const settingsPanelNav = document.getElementById('settingsPanelNav');
    const settingsPanelContent = document.getElementById('settingsPanelContent');
    const settingsPanelClose = document.getElementById('settingsPanelClose');
    var settingsLastTab = localStorage.getItem('fold_settings_tab') || 'preferences';
    var settingsTabMeta = [
        { id: 'preferences', label: '偏好', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
        { id: 'plugins', label: '插件', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
        { id: 'version', label: '版本', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' }
    ];

    function openSettings() {
        if (settingsPanel) settingsPanel.classList.add('active');
        if (chatArea) chatArea.style.display = 'none';
        if (centerInit) centerInit.style.display = 'none';
        if (bottomInput) bottomInput.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'none';
        switchSettingsTab(settingsLastTab);
    }

    function closeSettings() {
        if (settingsPanel) settingsPanel.classList.remove('active');
        if (chatArea) chatArea.style.display = '';
        if (bottomInput) bottomInput.style.display = '';
        if (chatHeader) chatHeader.style.display = '';
        if (centerInit) centerInit.style.display = '';
    }

    function switchSettingsTab(tab) {
        settingsLastTab = tab;
        try { localStorage.setItem('fold_settings_tab', tab); } catch (e) {}
        if (settingsPanelNav) {
            settingsPanelNav.innerHTML = settingsTabMeta.map(function(t) {
                return '<button class="settings-panel-nav-item' + (t.id === tab ? ' active' : '') + '" data-tab="' + t.id + '">' + t.icon + '<span>' + t.label + '</span></button>';
            }).join('');
            settingsPanelNav.querySelectorAll('.settings-panel-nav-item').forEach(function(btn) {
                btn.onclick = function() { switchSettingsTab(btn.dataset.tab); };
            });
        }
        if (tab === 'preferences') renderPreferencesTab();
        else if (tab === 'plugins') renderPluginsTab();
        else if (tab === 'version') renderVersionTab();
    }

    function renderPreferencesTab() {
        if (!settingsPanelContent) return;
        settingsPanelContent.innerHTML = '<div class="settings-section"><div class="settings-section-title">外观</div>' +
            '<div class="settings-item"><span class="settings-item-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>主题模式</span><div class="think-mode-selector" id="settingsThemeSelector" style="display:inline-flex;">' +
            '<button class="think-mode-option' + (currentTheme === 'light' ? ' active' : '') + '" data-theme="light"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span>浅色</span></button>' +
            '<button class="think-mode-option' + (currentTheme === 'dark' ? ' active' : '') + '" data-theme="dark"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>深色</span></button>' +
            '<button class="think-mode-option' + (currentTheme === 'system' ? ' active' : '') + '" data-theme="system"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><span>系统</span></button></div></div>' +
            '<div class="settings-item"><span class="settings-item-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>聊天字体</span><select id="settingsFontSelect" style="padding:5px 10px;border-radius:6px;border:0.5px solid #ddd;font-size:13px;background:#fff;font-family:inherit;"><option value="">默认</option><option value="PingFang SC, Microsoft YaHei, sans-serif">PingFang</option><option value="Noto Serif SC, serif">Noto Serif</option><option value="Songti SC, serif">宋体</option></select></div></div>';
        // 字体
        var fontSelect = document.getElementById('settingsFontSelect');
        if (fontSelect) {
            var currentFont = document.documentElement.style.getPropertyValue('--chat-font') || '';
            fontSelect.value = currentFont;
            fontSelect.onchange = function() {
                document.documentElement.style.setProperty('--chat-font', this.value);
                try { localStorage.setItem('fold_chat_font', this.value); } catch (e) {}
            };
        }
        // 主题
        settingsPanelContent.querySelectorAll('#settingsThemeSelector .think-mode-option').forEach(function(o) {
            o.onclick = function() {
                currentTheme = o.dataset.theme;
                applyTheme(currentTheme);
                saveSettingsToLocal();
                settingsPanelContent.querySelectorAll('#settingsThemeSelector .think-mode-option').forEach(function(x) { x.classList.toggle('active', x === o); });
            };
        });
    }

    function renderPluginsTab() {
        if (!settingsPanelContent) return;
        settingsPanelContent.innerHTML = '<div class="settings-section"><div class="settings-section-title">插件</div>' +
            '<div class="settings-item"><span class="settings-item-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>执行前确认</span><div class="think-mode-selector" id="settingsConfirmToggle" style="display:inline-flex;">' +
            '<button class="think-mode-option' + (commandConfirmEnabled ? ' active' : '') + '" data-value="true">开启</button>' +
            '<button class="think-mode-option' + (!commandConfirmEnabled ? ' active' : '') + '" data-value="false">关闭</button></div></div></div>';
        settingsPanelContent.querySelectorAll('#settingsConfirmToggle .think-mode-option').forEach(function(o) {
            o.onclick = function() {
                commandConfirmEnabled = o.dataset.value === 'true';
                settingsPanelContent.querySelectorAll('#settingsConfirmToggle .think-mode-option').forEach(function(x) { x.classList.toggle('active', x === o); });
                saveSettingsToLocal();
                if (window.CommandExecutionPlugin) window.CommandExecutionPlugin.setConfirmBeforeExecution(commandConfirmEnabled);
            };
        });
    }

    function renderVersionTab() {
        if (!settingsPanelContent) return;
        var verText = 'Fold.AI';
        // 尝试直接从 ver.json 加载版本
        (async function() {
            try { var r = await fetch('/com/ver.json'); if (r.ok) { var d = await r.json(); verText = '版本 ' + (d.stage || '') + ' ' + (d.ver || '') + ' · Fold.AI'; } } catch (e) {}
        })().then(function() {
            var el = settingsPanelContent.querySelector('.settings-version-text');
            if (el) el.textContent = verText;
        });
        settingsPanelContent.innerHTML = '<div class="settings-section"><div class="settings-section-title">版本</div>' +
            '<div class="settings-item"><span class="settings-item-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span class="settings-version-text">' + escapeHtml(verText) + '</span></span></div>' +
            '<div class="settings-item" style="cursor:pointer;" onclick="window.open(\'https://github.com/Xeno-Gen/Fold.AI\')"><span class="settings-item-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub 仓库</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></div></div>';
    }

    if (sidebarSettingsBtn) sidebarSettingsBtn.onclick = openSettings;
    var settingsFab = document.getElementById('sidebarSettingsFab');
    if (settingsFab) settingsFab.onclick = openSettings;
    if (settingsPanelClose) settingsPanelClose.onclick = closeSettings;

    document.addEventListener('click', function(e) {
        if (!settingsModalOverlay.classList.contains('active')) return;
        const t = e.target.closest('#themeSelector .think-mode-option');
        if (t) { currentTheme = t.dataset.theme; applyTheme(currentTheme); saveSettingsToLocal(); renderSettingsModal(); return; }
        const c = e.target.closest('#commandConfirmToggle .think-mode-option');
        if (c) { commandConfirmEnabled = c.dataset.value === 'true'; renderSettingsModal(); saveSettingsToLocal(); if (window.CommandExecutionPlugin) window.CommandExecutionPlugin.setConfirmBeforeExecution(commandConfirmEnabled); }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (currentTheme === 'system') applyTheme('system'); });

    async function uploadFile(file) {
        const fd = new FormData();
        fd.append('file', file);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
            const r = await fetch('/api/upload', { method: 'POST', body: fd, signal: ctrl.signal });
            clearTimeout(t);
            if (!r.ok) throw new Error(await r.text() || '上传失败');
            return r.json();
        } catch (err) { clearTimeout(t); throw err; }
    }

    function renderPreviews(container, fileList) {
        if (!container) return;
        container.innerHTML = '';
        fileList.forEach((file, idx) => {
            const wrap = document.createElement('div');
            if (file.type === 'image') {
                wrap.className = 'image-preview-item';
                wrap.style.backgroundImage = 'url(' + file.content + ')';
            } else {
                wrap.className = 'file-preview-item';
                wrap.innerHTML = '<span class="file-icon">📄</span><span class="file-name">' + escapeHtml(file.fileName) + '</span>';
                wrap.style.cursor = 'pointer';
                wrap.onclick = function(e) { if (!e.target.classList.contains('remove-preview')) openFileViewer(file.fileName, file.content); };
            }
            const btn = document.createElement('span');
            btn.className = 'remove-preview';
            btn.textContent = 'x';
            btn.onclick = function(e) { e.stopPropagation(); fileList.splice(idx, 1); renderPreviews(container, fileList); updateSendBtn(); };
            wrap.appendChild(btn);
            container.appendChild(wrap);
        });
    }

    let fileTarget = { textarea: initText, preview: initPreview };
    fileInput.onchange = async function(e) {
        const files = e.target.files;
        if (!files.length) return;
        const target = fileTarget.textarea === initText ? 'initial' : 'chat';
        for (const f of files) {
            try { activeFiles[target].push(await uploadFile(f)); }
            catch (err) { showToast('上传失败: ' + (err.message || '未知错误')); }
        }
        renderPreviews(fileTarget.preview, activeFiles[target]);
        updateSendBtn();
        fileInput.value = '';
    };
    initialAttachBtn.onclick = function() { fileTarget = { textarea: initText, preview: initPreview }; fileInput.click(); };
    chatAttachBtn.onclick = function() { fileTarget = { textarea: chatText, preview: chatPreview }; fileInput.click(); };
    initText.oninput = updateSendBtn;
    chatText.oninput = updateSendBtn;

    let dropdownInstance = null;
    (function() {
        const div = document.createElement('div');
        div.className = 'model-picker-dropdown';
        div.style.cssText = 'position:fixed;z-index:999;display:none;';
        document.body.appendChild(div);
        dropdownInstance = div;
    })();

    function positionDropdown(btn) {
        if (!btn || !dropdownInstance) return;
        const rect = btn.getBoundingClientRect();
        dropdownInstance.style.left = (rect.right - dropdownInstance.offsetWidth) + 'px';
        dropdownInstance.style.top = (rect.top - dropdownInstance.offsetHeight - 8) + 'px';
    }

    function openModelPicker(btn) {
        if (!dropdownInstance || !btn) return;
        if (dropdownInstance.classList.contains('show') && dropdownInstance.dataset.btn === btn.id) { closeModelPicker(); return; }
        closeModelPicker();
        dropdownInstance.style.display = 'flex';
        dropdownInstance.classList.add('show');
        dropdownInstance.dataset.btn = btn.id;
        renderModelListInDropdown();
        positionDropdown(btn);
        document.addEventListener('click', outsideClickHandler);
    }

    function closeModelPicker() {
        if (dropdownInstance) { dropdownInstance.classList.remove('show'); dropdownInstance.style.display = 'none'; dropdownInstance.dataset.btn = ''; }
        document.removeEventListener('click', outsideClickHandler);
    }

    function outsideClickHandler(e) {
        if (!dropdownInstance || !dropdownInstance.classList.contains('show')) return;
        if (!e.target.closest('.model-select-btn') && !e.target.closest('.model-picker-dropdown')) closeModelPicker();
    }

    function renderModelListInDropdown() {
        if (!dropdownInstance) return;
        let h = '<div class="model-search"><input type="text" class="model-search-input" placeholder="搜索模型..."></div><div class="model-list">';
        allModels.forEach(function(m) {
            h += '<div class="model-picker-item' + (m === currentModel ? ' active' : '') + '" data-model="' + m + '"><div class="model-name">' + m + '</div></div>';
        });
        if (!allModels.length) h += '<div style="padding:20px;text-align:center;color:#999;">暂无可用模型</div>';
        h += '</div>';
        dropdownInstance.innerHTML = h;
        var searchInput = dropdownInstance.querySelector('.model-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var kw = this.value.toLowerCase();
                dropdownInstance.querySelectorAll('.model-picker-item').forEach(function(item) {
                    item.style.display = item.dataset.model.toLowerCase().includes(kw) ? 'flex' : 'none';
                });
            });
            setTimeout(function() { searchInput.focus(); }, 0);
        }
        dropdownInstance.querySelectorAll('.model-picker-item').forEach(function(item) {
            item.onclick = function() { currentModel = item.dataset.model; updateModelButtonLabels(); closeModelPicker(); saveConfigToBackend(); };
        });
    }

    function updateModelButtonLabels() {
        if (initModelLabel) initModelLabel.textContent = currentModel || '选择模型';
        if (chatModelLabel) chatModelLabel.textContent = currentModel || '选择模型';
    }

    initModelBtn.addEventListener('click', function(e) { e.stopPropagation(); openModelPicker(initModelBtn); });
    chatModelBtn.addEventListener('click', function(e) { e.stopPropagation(); openModelPicker(chatModelBtn); });
    window.addEventListener('resize', function() {
        if (dropdownInstance && dropdownInstance.classList.contains('show')) {
            var btnId = dropdownInstance.dataset.btn;
            if (btnId) positionDropdown(document.getElementById(btnId));
        }
    });

    async function saveConfigToBackend() {
        try { await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultParams: currentParams, currentProvider: currentProvider, currentModel: currentModel, customPort: customPort, systemPrompt: currentParams.systemPrompt, chatFormat: currentChatFormat }) }); } catch (e) {}
    }

    async function loadConfigFromBackend() {
        try {
            var data = await (await fetch('/api/config')).json();
            if (data.defaultParams) currentParams = Object.assign({}, currentParams, data.defaultParams);
            if (data.currentProvider) currentProvider = data.currentProvider;
            else if (providers.length && !currentProvider) currentProvider = providers[0].id;
            if (data.currentModel) currentModel = data.currentModel;
            if (data.customPort !== undefined) customPort = data.customPort;
            if (data.systemPrompt !== undefined) currentParams.systemPrompt = data.systemPrompt;
            if (data.chatFormat) currentChatFormat = data.chatFormat;
            else updateChatFormatFromProvider();
            updateModelButtonLabels();
        } catch (e) {}
    }

    async function saveChatToBackend() {
        try { await fetch('/api/chat/' + currentChat, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: chatTitles[currentChat], messages: chats[currentChat], token: chatTokens[currentChat] }) }); } catch (e) {}
    }

    async function loadChatsFromBackend(embeddedToken) {
        try {
            var res = await fetch('/api/chats');
            if (!res.ok) return;
            var remote = await res.json();
            if (remote.length) {
                var nc = [], nt = [], ntok = [];
                for (var ci = 0; ci < remote.length; ci++) {
                    var c = remote[ci];
                    var detail = await (await fetch('/api/chat/' + c.id)).json();
                    nc.push(detail.messages || []);
                    nt.push(detail.title || c.title);
                    ntok.push(detail.token || c.token || '');
                }
                chats = nc; chatTitles = nt; chatTokens = ntok;
                var targetToken = embeddedToken || (window.location.pathname.match(/^\/chat\/([A-Za-z0-9]+)$/) || [])[1];
                if (targetToken) {
                    var idx = chatTokens.indexOf(targetToken);
                    if (idx !== -1) { if (!isChatActive) activateChat(false); switchChat(idx); return; }
                }
            }
        } catch (e) {}
        updateHistoryList();
    }

    async function loadProviders() {
        try {
            var res = await fetch('/api/providers');
            providers = (await res.json()).providers || [];
            if (providers.length && !currentProvider) currentProvider = providers[0].id;
            updateChatFormatFromProvider();
            if (currentProvider) await loadModels(currentProvider);
        } catch (e) {}
    }

    function getAvailableFormats() {
        var p = providers.find(function(p) { return p.id === currentProvider; });
        if (!p || !p.chatFormat) return ['OpenAI'];
        return p.chatFormat.split(',').map(function(s) { return s.trim(); });
    }

    function updateChatFormatFromProvider() {
        var formats = getAvailableFormats();
        if (formats.length === 1) { currentChatFormat = formats[0]; }
        else if (formats.length > 1 && !formats.includes(currentChatFormat)) { currentChatFormat = formats[0]; }
    }

    async function loadModels(providerId) {
        try {
            var res = await fetch('/api/provider/' + providerId + '/models');
            if (!res.ok) throw new Error('获取模型列表失败');
            availableModels = (await res.json()).models || [];
            allModels = [].concat(availableModels);
            if (availableModels.length && (!currentModel || !availableModels.includes(currentModel))) {
                currentModel = availableModels[0];
                updateModelButtonLabels();
            }
        } catch (e) { showToast('无法加载模型列表，请检查 API Key'); }
    }

    async function loadProviderKeys(providerId) {
        try { var res = await fetch('/api/provider/' + providerId + '/keys'); if (!res.ok) return []; return (await res.json()).keys || []; } catch (e) { return []; }
    }
    async function addProviderKey(providerId, key) {
        try { var res = await fetch('/api/provider/' + providerId + '/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) }); return res.ok; } catch (e) { return false; }
    }
    async function deleteProviderKey(providerId, index) {
        try { var res = await fetch('/api/provider/' + providerId + '/key/' + index, { method: 'DELETE' }); return res.ok; } catch (e) { return false; }
    }
    async function useProviderKey(providerId, index) {
        try { var res = await fetch('/api/provider/' + providerId + '/keys/use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: index }) }); return res.ok; } catch (e) { return false; }
    }

    function openDrawer() { loadConfigFromBackend().then(function() { renderDrawer(); }); drawerOverlay.classList.add('active'); }
    function closeDrawer() { drawerOverlay.classList.remove('active'); }
    settingsBtn.onclick = openDrawer;
    initialSettingsBtn.onclick = openDrawer;
    drawerClose.onclick = closeDrawer;
    drawerOverlay.onclick = function(e) { if (e.target === drawerOverlay) closeDrawer(); };

    async function renderDrawer() {
        if (!drawerBody) return;
        var html = '<div class="section-title">模型提供商</div><div class="provider-grid">';
        providers.forEach(function(p) {
            html += '<div class="provider-card' + (currentProvider === p.id ? ' active' : '') + '" data-id="' + p.id + '"><div class="prov-icon">' + (p.icon ? '<img src="' + p.icon + '">' : p.name.charAt(0)) + '</div><div class="provider-name">' + p.name + '</div></div>';
        });
        html += '</div>';
        var formats = getAvailableFormats();
        if (formats.length > 1) {
            html += '<div style="margin:16px 0 20px;"><div class="section-title" style="margin-bottom:10px;">API 格式</div><div class="think-mode-selector" id="chatFormatSelector" style="display:inline-flex;">';
            formats.forEach(function(f) {
                html += '<button class="think-mode-option' + (currentChatFormat === f ? ' active' : '') + '" data-format="' + f + '">' + (f === 'OpenAI' ? 'OpenAI' : 'Anthropic') + '</button>';
            });
            html += '</div></div>';
        } else {
            html += '<div style="margin:16px 0 20px;"><div class="section-title" style="margin-bottom:6px;">API 格式</div><div style="font-size:13px;color:#888;">' + formats[0] + '</div></div>';
        }
        html += '<div class="section-title" style="margin-top:10px;">API 密钥</div>';
        html += '<div class="key-input-row"><input type="password" id="newKeyInput" placeholder="输入新的 API Key..."><button id="addKeyBtn">添加</button></div>';
        html += '<div class="key-list" id="keyListContainer"></div>';
        html += '<div class="section-title" style="margin-top:20px;">系统提示词</div>';
        html += '<div class="system-prompt-section"><textarea id="systemPromptInput" rows="3" placeholder="定义 AI 的行为、角色或风格...">' + escapeHtml(currentParams.systemPrompt || '') + '</textarea></div>';
        html += '<div class="section-title" style="margin-top:20px;">参数调节</div><div class="param-group">';
        var paramsDef = [
            { key: 'temperature', label: '温度', min: 0, max: 2, step: 0.1 },
            { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.05 },
            { key: 'max_tokens', label: '最大长度', min: 1, max: 8192, step: 1 },
            { key: 'frequency_penalty', label: '频率惩罚', min: -2, max: 2, step: 0.1 },
            { key: 'presence_penalty', label: '存在惩罚', min: -2, max: 2, step: 0.1 }
        ];
        paramsDef.forEach(function(p) {
            var val = currentParams[p.key] != null ? currentParams[p.key] : 0;
            html += '<div class="param-item"><label>' + p.label + '</label><input type="number" id="param-' + p.key + '" value="' + val + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '"></div>';
        });
        html += '<div class="param-item"><label>种子</label><input type="number" id="param-seed" placeholder="留空" value="' + (currentParams.seed != null ? currentParams.seed : '') + '"></div>';
        html += '<div class="param-item"><label>Top K</label><input type="number" id="param-topk" placeholder="留空" value="' + (currentParams.top_k != null ? currentParams.top_k : '') + '"></div>';
        html += '<div class="param-item"><label>自定义端口</label><input type="number" id="customPortInput" value="' + customPort + '" min="1" max="65535"></div>';
        html += '</div>';
        html += '<div class="section-title" style="margin-top:20px;">额外提示词</div>';
        html += '<div class="extra-prompts-section" id="extraPromptsSection">';
        if (currentThinkMode === 'fast') { html += '<div class="extra-prompt-item"><span class="extra-prompt-label">快速模式</span><span class="extra-prompt-value">无深度思考</span></div>'; }
        else if (currentThinkMode === 'think') { html += '<div class="extra-prompt-item"><span class="extra-prompt-label">思考模式</span><span class="extra-prompt-value">开启 API deep_think 参数</span></div>'; }
        else if (currentThinkMode === 'deep') { html += '<div class="extra-prompt-item"><span class="extra-prompt-label">沉思模式</span><span class="extra-prompt-value">deep_think + DeepThink.json 提示词</span></div>'; }
        else if (currentThinkMode === 'meditate') { html += '<div class="extra-prompt-item"><span class="extra-prompt-label">静思模式</span><span class="extra-prompt-value">deep_think + Medit.json 提示词</span></div>'; }
        html += '</div>';
        drawerBody.innerHTML = html;

        drawerBody.querySelectorAll('.provider-card').forEach(function(card) {
            card.onclick = async function() {
                drawerBody.querySelectorAll('.provider-card').forEach(function(c) { c.classList.remove('active'); });
                card.classList.add('active');
                currentProvider = card.dataset.id;
                updateChatFormatFromProvider();
                await loadModels(currentProvider);
                saveConfigToBackend();
                await refreshKeyList();
                renderDrawer();
            };
        });
        var formatSelector = document.getElementById('chatFormatSelector');
        if (formatSelector) {
            formatSelector.querySelectorAll('.think-mode-option').forEach(function(btn) {
                btn.onclick = function() {
                    formatSelector.querySelectorAll('.think-mode-option').forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    currentChatFormat = btn.dataset.format;
                    saveConfigToBackend();
                };
            });
        }
        document.getElementById('addKeyBtn').onclick = async function() {
            var inp = document.getElementById('newKeyInput');
            if (!inp || !inp.value.trim()) { showToast('请输入密钥'); return; }
            if (!currentProvider) { showToast('请先选择提供商'); return; }
            if (await addProviderKey(currentProvider, inp.value.trim())) {
                showToast('密钥已添加');
                inp.value = '';
                await refreshKeyList();
                await loadModels(currentProvider);
            } else showToast('添加失败');
        };
        var sysPromptEl = document.getElementById('systemPromptInput');
        if (sysPromptEl) {
            sysPromptEl.addEventListener('change', function() { currentParams.systemPrompt = this.value; saveConfigToBackend(); });
        }
        paramsDef.forEach(function(p) {
            var input = document.getElementById('param-' + p.key);
            if (input) {
                input.addEventListener('change', function() { currentParams[p.key] = parseFloat(this.value) || 0; saveConfigToBackend(); });
            }
        });
        ['seed', 'topk'].forEach(function(k) {
            var el = document.getElementById('param-' + k);
            if (el) el.addEventListener('change', function() {
                var val = this.value ? parseInt(this.value) : null;
                if (k === 'seed') currentParams.seed = val;
                else currentParams.top_k = val;
                saveConfigToBackend();
            });
        });
        var customPortInput = document.getElementById('customPortInput');
        if (customPortInput) {
            customPortInput.addEventListener('change', function() { customPort = this.value ? parseInt(this.value) : 8080; saveConfigToBackend(); });
        }
        await refreshKeyList();
    }

    async function refreshKeyList() {
        var container = document.getElementById('keyListContainer');
        if (!container || !currentProvider) return;
        var keys = await loadProviderKeys(currentProvider);
        container.innerHTML = '';
        keys.forEach(function(mask, idx) {
            var row = document.createElement('div');
            row.className = 'key-row';
            row.innerHTML = '<span class="key-mask">' + mask + '</span><input class="key-edit-input" value="" style="display:none;"><div class="key-actions"><button title="使用"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button><button title="修改"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button title="删除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>';
            var editInput = row.querySelector('.key-edit-input');
            row.querySelector('[title="使用"]').onclick = async function() {
                if (await useProviderKey(currentProvider, idx)) { showToast('已切换密钥'); await loadModels(currentProvider); await refreshKeyList(); }
            };
            row.querySelector('[title="修改"]').onclick = function() {
                row.classList.add('edit');
                editInput.value = '';
                editInput.focus();
                var confirmEdit = async function() {
                    var newKey = editInput.value.trim();
                    if (newKey) {
                        if ((await deleteProviderKey(currentProvider, idx)) && (await addProviderKey(currentProvider, newKey))) { showToast('密钥已更新'); await refreshKeyList(); }
                    }
                    row.classList.remove('edit');
                };
                editInput.onkeydown = function(e) { if (e.key === 'Enter') confirmEdit(); };
                editInput.onblur = function() { setTimeout(function() { if (row.classList.contains('edit')) confirmEdit(); }, 100); };
            };
            row.querySelector('[title="删除"]').onclick = async function() {
                if (confirm('确认删除？')) {
                    if (await deleteProviderKey(currentProvider, idx)) { showToast('已删除'); await refreshKeyList(); }
                }
            };
            container.appendChild(row);
        });
    }

    function renderMarkdown(text) {
        if (typeof marked === 'undefined') return escapeHtml(text).replace(/\n/g, '<br>');
        var renderer = new marked.Renderer();
        renderer.code = function(tok) {
            var codeText = tok && tok.text ? tok.text : '';
            var lang = tok && tok.lang ? tok.lang : 'code';
            var escapedCode = escapeHtml(codeText || '');
            var displayLang = lang.toLowerCase();
            return '<div class="_121d384"><div class="d2a24f03"><span class="d813de27">' + escapeHtml(displayLang) + '</span></div><div class="d2a24f03 _246a029"><div class="efa13877"><button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right:4px;" onclick="(function(b){var w=b.closest(\'._121d384\');var p=w&&w.nextElementSibling;var c=p&&p.querySelector(\'code\');if(c&&c.textContent){navigator.clipboard.writeText(c.textContent).then(function(){window.showToast(\'已复制代码\');})}else{window.showToast(\'❌ 无法获取代码\')}})(this)"><span>复制</span></button><button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right:4px;" onclick="(function(b){var w=b.closest(\'._121d384\');var p=w&&w.nextElementSibling;var c=p&&p.querySelector(\'code\');var l=w&&w.querySelector(\'.d813de27\');var la=l?l.textContent.trim():\'txt\';if(c&&c.textContent){var bl=new Blob([c.textContent],{type:\'text/plain;charset=utf-8\'});var u=(window.URL||window.webkitURL).createObjectURL(bl);var a=document.createElement(\'a\');a.href=u;a.download=\'code.\'+la;document.body.appendChild(a);a.click();(window.URL||window.webkitURL).revokeObjectURL(u);a.remove();window.showToast(\'下载完成\')}else{window.showToast(\'❌ 无法获取代码\')}})(this)"><span>下载</span></button><button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right:4px;" onclick="(function(b){var w=b.closest(\'._121d384\');var p=w&&w.nextElementSibling;var c=p&&p.querySelector(\'code\');var l=w&&w.querySelector(\'.d813de27\');var la=l?l.textContent.trim().toLowerCase():\'\';if(c&&c.textContent){try{if(la===\'javascript\'||la===\'js\'){eval(c.textContent);window.showToast(\'运行成功\')}else if(la===\'html\'){var bl=new Blob([c.textContent],{type:\'text/html\'});var u=(window.URL||window.webkitURL).createObjectURL(bl);window.open(u);window.showToast(\'已打开 HTML 页面\')}else{window.showToast(\'⚠️ 仅支持 JavaScript / HTML 代码运行\')}}catch(err){window.showToast(\'❌ 运行错误:\'+err.message)}}else{window.showToast(\'❌ 无法获取代码\')}})(this)"><span>运行</span></button><div class="ae809fef"></div></div></div></div><pre><code class="language-' + escapeHtml(displayLang) + '">' + escapedCode + '</code></pre>';
        };
        return marked.parse(text, { renderer: renderer });
    }

    function createThinkBlock(reasoning) {
        return '<div class="think-block" style="margin-left:-12px;"><div class="think-header" onclick="this.parentElement.classList.toggle(\'collapsed\')"><div class="think-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" fill="currentColor"></path></svg></div><span>已深度思考</span><div class="think-arrow"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"></path></svg></div></div><div class="think-body-wrapper"><div class="think-line"></div><div class="think-content">' + reasoning.replace(/\n/g, '<br>') + '</div></div></div>';
    }

    function createMessageBubble(content, role, images, reasoning, msgRef, cotHtml) {
        var bubble = document.createElement('div');
        var roleClass = role === 'system' ? 'system' : (role === 'user' ? 'user' : 'ai');
        bubble.className = 'message-bubble message-' + roleClass;
        var reasoningHtml = reasoning ? createThinkBlock(reasoning) : '';
        var contentHtml;
        if (role === 'ai') { contentHtml = renderMarkdown(content); }
        else if (role === 'system') { contentHtml = '<div class="markdown-body system-message">' + renderMarkdown(content) + '</div>'; }
        else { contentHtml = '<div class="markdown-body">' + escapeHtml(content).replace(/\n/g, '<br>') + '</div>'; }
        bubble.innerHTML = (cotHtml || '') + reasoningHtml + contentHtml;

        if (images && images.length) {
            var ic = document.createElement('div');
            images.forEach(function(src) {
                var img = document.createElement('img');
                img.src = src;
                img.style.cssText = 'max-width:100%;border-radius:8px;margin-top:8px;';
                ic.appendChild(img);
            });
            bubble.appendChild(ic);
        }

        var ad = document.createElement('div');
        ad.className = 'message-actions';
        if (role === 'user') {
            ad.innerHTML = '<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        } else if (role === 'system') {
            ad.innerHTML = '<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        } else {
            ad.innerHTML = '<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="action-icon" data-action="regenerate" title="重新生成"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button><button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button><button class="action-icon" data-action="tokens" title="Token消耗"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button><button class="action-icon" data-action="apijson" title="API请求JSON"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>';
        }
        bubble.appendChild(ad);

        ad.querySelector('[data-action="copy"]').onclick = function() { navigator.clipboard.writeText(content).then(function() { showToast('已复制'); }); };
        ad.querySelector('[data-action="delete"]').onclick = function() {
            if (msgRef) {
                var idx = chats[currentChat].indexOf(msgRef);
                if (idx !== -1) chats[currentChat].splice(idx, 1);
            }
            bubble.remove();
            saveChatToBackend();
        };

        if (role === 'ai') {
            ad.querySelector('[data-action="regenerate"]').onclick = function() {
                if (msgRef) {
                    var idx = chats[currentChat].indexOf(msgRef);
                    if (idx !== -1) chats[currentChat].splice(idx, 1);
                }
                bubble.remove();
                sendMessage(true);
            };
            ad.querySelector('[data-action="tokens"]').onclick = function() {
                var td = msgRef && msgRef.usage;
                if (!td) { showToast('此消息没有 Token 消耗数据'); return; }
                var it = td.prompt_tokens || td.input_tokens || 0;
                var ot = td.completion_tokens || td.output_tokens || 0;
                var tt = td.total_tokens || (it + ot);
                openFileViewer('Token 消耗', 'Token 消耗详情\n\n输入 Token (prompt): ' + it + '\n输出 Token (completion): ' + ot + '\n总计 Token: ' + tt + '\n\n模型: ' + currentModel + '\n时间: ' + new Date().toLocaleString());
            };
            ad.querySelector('[data-action="apijson"]').onclick = function() {
                var rd = msgRef && msgRef.apiRequest;
                if (!rd) { showToast('此消息没有 API 请求数据'); return; }
                openFileViewer('API 请求 JSON', 'API 请求 JSON\n\n模型: ' + currentModel + '\n提供商: ' + currentProvider + '\n时间: ' + new Date().toLocaleString() + '\n\n' + JSON.stringify(rd, null, 2));
            };
        }
        return bubble;
    }

    function addMessage(content, role, images, reasoning, msgRef) {
        if (!chatAreaInner) return null;
        var bubble = createMessageBubble(content, role, images, reasoning, msgRef);
        chatAreaInner.appendChild(bubble);
        if (emptyHint) emptyHint.style.display = 'none';
        chatArea.scrollTop = chatArea.scrollHeight;
        return bubble;
    }

    function stripToolLines(text) {
        return text.split('\n').filter(function(l) {
            var t = l.trim();
            return !t.startsWith('tool:') && !/^(Power\d+|cmd\d+):/i.test(t);
        }).join('\n').trim();
    }

    async function processToolCalls(responseText) {
        if (!/tool:CommandExecution/i.test(responseText)) return;
        var commands = [];
        var lines = responseText.split('\n');
        lines.forEach(function(line, i) {
            var t = line.trim();
            var pm = t.match(/^(Power\d+):(.+)/i);
            var cm = t.match(/^(cmd\d+):(.+)/i);
            if (pm) commands.push({ idx: parseInt(pm[1]), shell: 'powershell', command: pm[2] });
            else if (cm) commands.push({ idx: parseInt(cm[1]), shell: 'cmd', command: cm[2] });
        });
        commands.sort(function(a, b) { return a.idx - b.idx; });
        var dangerous = [/rm\s+-rf/i, /format\s+\w/i, /del\s+\/f/i, /rd\s+\/s/i, /shutdown/i];
        for (var ci = 0; ci < commands.length; ci++) {
            var cmd = commands[ci];
            if (dangerous.some(function(p) { return p.test(cmd.command); })) {
                var msg = { role: 'system', content: '⚠️ 危险命令已被拦截: ' + cmd.command, images: [] };
                chats[currentChat].push(msg);
                addMessage(msg.content, 'system', [], null, msg);
                continue;
            }
            if (commandConfirmEnabled && window.CommandExecutionPlugin) {
                try {
                    if (!(await window.CommandExecutionPlugin.confirmCommand(cmd.shell, cmd.command))) {
                        var msg = { role: 'system', content: '❌ 命令已取消: ' + cmd.shell + ' ' + cmd.command, images: [] };
                        chats[currentChat].push(msg);
                        addMessage(msg.content, 'system', [], null, msg);
                        continue;
                    }
                } catch (e) { continue; }
            }
            var execMsg = { role: 'system', content: '⏳ 执行中: ' + cmd.shell + '> ' + cmd.command, images: [] };
            chats[currentChat].push(execMsg);
            var execBubble = addMessage(execMsg.content, 'system', [], null, execMsg);
            try {
                var res = await fetch('/api/plugin/command/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shell: cmd.shell, command: cmd.command, timeout: 30000 }) });
                if (res.ok) {
                    var d = await res.json();
                    var out = (d.stdout || d.stderr || '').trim();
                    var resultText = (out ? out.substring(0, 2000) : '(无输出)') + '\n退出码: ' + d.exitCode;
                    var sysMsg = { role: 'system', content: '[命令结果] ' + cmd.shell + '> ' + cmd.command + '\n' + resultText, images: [] };
                    var idx = chats[currentChat].indexOf(execMsg);
                    if (idx !== -1) chats[currentChat][idx] = sysMsg;
                    execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
                } else {
                    var e = await res.text();
                    var sysMsg = { role: 'system', content: '❌ 命令失败: ' + cmd.shell + '> ' + cmd.command + '\n' + e, images: [] };
                    var idx = chats[currentChat].indexOf(execMsg);
                    if (idx !== -1) chats[currentChat][idx] = sysMsg;
                    execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
                }
            } catch (e) {
                var sysMsg = { role: 'system', content: '❌ 命令异常: ' + cmd.shell + '> ' + cmd.command + '\n' + e.message, images: [] };
                var idx = chats[currentChat].indexOf(execMsg);
                if (idx !== -1) chats[currentChat][idx] = sysMsg;
                execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
            }
        }
        saveChatToBackend();
    }

    function reorderMessages(msgs) {
        var sys = msgs.filter(function(m) { return m.role === 'system'; });
        var others = msgs.filter(function(m) { return m.role !== 'system'; });
        if (sys.length <= 1) return [].concat(sys).concat(others);
        return [{ role: 'system', content: sys.map(function(m) { return m.content; }).join('\n\n') }].concat(others);
    }

    async function callAPI(messages) {
        if (!currentModel) throw new Error('未选择模型');
        var requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        var payload = { messages: messages, provider: currentProvider, model: currentModel, chatFormat: currentChatFormat };
        Object.keys(currentParams).forEach(function(k) { payload[k] = currentParams[k]; });
        payload.stream = true;
        payload.requestId = requestId;
        if (currentThinkMode !== 'fast') payload.deep_think = true;
        currentAbortController = new AbortController();
        var controller = currentAbortController;
        var res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        if (!res.ok) { var err = await res.text(); throw new Error(err); }
        return { body: res.body, apiRequest: payload };
    }

    async function sendMessage(isRegenerate) {
        if (streaming && !isRegenerate) return;
        if (!currentModel) { showToast('请先选择模型'); return; }

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
                        chats[realId] = []; chatTitles[realId] = '新对话'; chatTokens[realId] = data.token || savedToken;
                        currentChat = realId;
                        pendingNewChatIndex = null;
                        updateUrlWithToken();
                    } else { pendingNewChatIndex = null; }
                } catch (e) { pendingNewChatIndex = null; }
            }
        }

        if (!isRegenerate) {
            var displayContent = userText || (imgs.length ? '图片' : '');
            var userMsg = { role: 'user', content: userText || (imgs.length ? '图片' : ''), images: imgs };
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
                    chats[currentChat].push({ role: 'system', content: '[文件: ' + f.fileName + ']\n' + f.content });
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

        var fullContent = '';
        var fullReasoning = '';
        var bubble = addMessage('思考中...', 'ai', [], null, null);

        try {
            var msgs = chats[currentChat].filter(function(m) { return m.role; }).map(function(m) { return { role: m.role, content: m.content, images: m.images || [] }; });
            if (commandExecEnabled) {
                var toolHint = msgs.find(function(m) { return m.role === 'system' && m.content.includes('[工具调用能力]'); });
                if (!toolHint) {
                    msgs.unshift({ role: 'system', content: '[工具调用能力]\n你可以主动调用系统命令执行工具来完成用户的需求。\n调用格式:\ntool:CommandExecution\nPower1:具体的PowerShell命令\n或\ncmd1:具体的CMD命令', images: [] });
                }
            }
            // 加载思考模式附加提示词
            if (currentThinkMode === 'deep' || currentThinkMode === 'meditate') {
                try {
                    var configFile = currentThinkMode === 'deep' ? 'DeepThink.json' : 'Medit.json';
                    var res = await fetch('/api/config/' + configFile);
                    if (res.ok) {
                        var cfg = await res.json();
                        if (cfg.think && cfg.think.trim()) {
                            msgs.unshift({ role: 'system', content: cfg.think, images: [] });
                        }
                    }
                } catch (e) {}
            }
            var callResult = await callAPI(reorderMessages(msgs));
            var stream = callResult.body;
            var apiRequest = callResult.apiRequest;

            bubble.innerHTML = '';
            var reasoningDiv = document.createElement('div');
            var contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-body';
            bubble.appendChild(reasoningDiv);
            bubble.appendChild(contentDiv);

            var decoder = new TextDecoder();
            var reader = stream.getReader();
            var buffer = '';
            var streamUsage = null;

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
                            if (json.usage && !json.choices) { streamUsage = json.usage; continue; }
                            if (json.usage) streamUsage = json.usage;
                            var delta = json.choices?.[0]?.delta;
                            if (delta) {
                                if (delta.reasoning_content) {
                                    fullReasoning += String(delta.reasoning_content);
                                    reasoningDiv.innerHTML = createThinkBlock(fullReasoning);
                                }
                                if (delta.content != null) {
                                    fullContent += String(delta.content);
                                    if (fullContent) contentDiv.innerHTML = renderMarkdown(stripToolLines(fullContent) || '...');
                                }
                            }
                        } catch (e) {}
                    }
                }
                if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
            }

            var assistantMsg = { role: 'assistant', content: fullContent, reasoning: fullReasoning || null, usage: streamUsage || null, apiRequest: apiRequest || null };
            chats[currentChat].push(assistantMsg);
            var newBubble = createMessageBubble(fullContent, 'ai', [], fullReasoning, assistantMsg, '');
            bubble.replaceWith(newBubble);
            updateHistoryTitle();
            saveChatToBackend();
            if (commandExecEnabled) {
                try { await processToolCalls(fullContent); } catch (e) { console.error('[工具调用错误]', e); }
            }
        } catch (e) {
            if (e && (e.name === 'AbortError' || e.code === 'ERR_CANCELED')) {
                var md = bubble.querySelector('.markdown-body') || bubble;
                md.innerHTML = renderMarkdown(fullContent);
                var assistantMsg = { role: 'assistant', content: fullContent, reasoning: fullReasoning || null, usage: streamUsage || null, apiRequest: apiRequest || null };
                chats[currentChat].push(assistantMsg);
                updateHistoryTitle();
                saveChatToBackend();
            } else {
                bubble.innerHTML = '';
                var errDiv = document.createElement('div');
                errDiv.style.cssText = 'padding:8px 0;color:#e74c3c;font-size:14px;';
                errDiv.textContent = '请求失败: ' + e.message;
                bubble.appendChild(errDiv);
                console.error(e);
            }
        } finally {
            streaming = false;
            currentAbortController = null;
            updateSendBtn();
        }
    }

    function activateChat(animated) {
        isChatActive = true;
        document.body.classList.add('chat-active');
        if (centerInit) {
            if (animated) {
                centerInit.classList.add('slide-down');
                setTimeout(function() { if (centerInit) centerInit.style.display = 'none'; }, 400);
            } else {
                centerInit.style.display = 'none';
            }
        }
        if (bottomInput) { bottomInput.style.opacity = '1'; bottomInput.style.pointerEvents = 'all'; bottomInput.style.maxHeight = '300px'; }
        if (chatArea) { chatArea.style.opacity = '1'; chatArea.style.pointerEvents = 'all'; chatArea.style.maxHeight = 'none'; chatArea.style.flex = '1 1 auto'; }
        updateHeaderTitle();
    }

    function deactivateChat() {
        isChatActive = false;
        document.body.classList.remove('chat-active');
        if (centerInit) { centerInit.style.display = null; centerInit.classList.remove('slide-down'); }
        if (bottomInput) { bottomInput.style.opacity = null; bottomInput.style.pointerEvents = null; bottomInput.style.maxHeight = null; }
        if (chatArea) { chatArea.style.opacity = null; chatArea.style.pointerEvents = null; chatArea.style.maxHeight = null; chatArea.style.flex = null; }
        if (chatAreaInner) chatAreaInner.innerHTML = '';
        if (initText) initText.value = '';
        if (chatText) chatText.value = '';
        history.pushState(null, '', '/');
    }

    function switchChat(idx) {
        if (pendingNewChatIndex !== null && idx !== pendingNewChatIndex && chats[pendingNewChatIndex] && chats[pendingNewChatIndex].length === 0) {
            chats.splice(pendingNewChatIndex, 1);
            chatTitles.splice(pendingNewChatIndex, 1);
            chatTokens.splice(pendingNewChatIndex, 1);
            pendingNewChatIndex = null;
            if (idx > pendingNewChatIndex) idx--;
        }
        if (idx === currentChat && isChatActive) return;
        currentChat = idx;
        updateUrlWithToken();
        if (chatAreaInner) chatAreaInner.innerHTML = '';
        if (!chats[idx] || !chats[idx].length) {
            if (emptyHint) emptyHint.style.display = 'block';
        } else {
            if (emptyHint) emptyHint.style.display = 'none';
            chats[idx].forEach(function(m) {
                if (!m.role) return;
                var r = m.role === 'system' ? 'system' : (m.role === 'user' ? 'user' : 'ai');
                addMessage(m.content, r, m.images || [], m.reasoning, m);
            });
        }
        updateHistoryList();
        updateHeaderTitle();
    }

    async function newChat(animated) {
        // 如果已经有空的待确认对话，忽略（已经在开幕状态）
        if (pendingNewChatIndex !== null && chats[pendingNewChatIndex] && chats[pendingNewChatIndex].length === 0) {
            return;
        }
        // 如果当前在对话中，回到开幕界面
        if (isChatActive) {
            deactivateChat();
        }
        // 创建新的待确认对话
        var newToken = generateToken();
        chats.push([]);
        chatTitles.push('新对话');
        chatTokens.push(newToken);
        pendingNewChatIndex = chats.length - 1;
        currentChat = pendingNewChatIndex;
        if (chatAreaInner) chatAreaInner.innerHTML = '';
        if (emptyHint) { emptyHint.style.display = 'block'; emptyHint.textContent = '我能帮你点什么？'; }
        updateHistoryList();
        updateHeaderTitle();
    }

    function updateHistoryTitle() {
        var msgs = chats[currentChat]?.filter(function(m) { return m.role === 'user'; }) || [];
        chatTitles[currentChat] = msgs.length ? (msgs[0].content || '图片').substring(0, 25) : '空对话';
        updateHeaderTitle();
        updateHistoryList();
    }

    function updateHeaderTitle() { if (chatTitleText) chatTitleText.textContent = chatTitles[currentChat] || '对话'; }

    function updateHistoryList() {
        if (!historyList) return;
        var ordered = [];
        pinnedChats.forEach(function(id) { if (id < chatTitles.length && chats[id] && chats[id].length > 0) ordered.push(id); });
        for (var i = chatTitles.length - 1; i >= 0; i--) {
            if (!pinnedChats.has(i) && chats[i] && chats[i].length > 0) ordered.push(i);
        }
        historyList.innerHTML = ordered.map(function(idx) {
            var title = chatTitles[idx] || '未命名';
            var pinned = pinnedChats.has(idx);
            return '<li class="chat-history-item' + (idx === currentChat ? ' active' : '') + '" data-index="' + idx + '"><span class="history-title">' + escapeHtml(title) + '</span><div class="history-actions"><button class="action-icon small" title="收藏置顶">' + (pinned ? '★' : '☆') + '</button><button class="action-icon small" title="重命名">✎</button><button class="action-icon small" title="删除">✕</button></div></li>';
        }).join('');
        historyList.querySelectorAll('li').forEach(function(li) {
            var idx = parseInt(li.dataset.index);
            li.onclick = function(e) {
                if (e.target.closest('button')) return;
                if (!isChatActive) activateChat(false);
                switchChat(idx);
            };
            li.querySelector('[title="收藏置顶"]').onclick = function(e) { e.stopPropagation(); if (pinnedChats.has(idx)) pinnedChats.delete(idx); else pinnedChats.add(idx); updateHistoryList(); };
            li.querySelector('[title="重命名"]').onclick = function(e) {
                e.stopPropagation();
                var newTitle = prompt('修改标题', chatTitles[idx]);
                if (newTitle) { chatTitles[idx] = newTitle; if (idx === currentChat) updateHeaderTitle(); updateHistoryList(); saveChatToBackend(); }
            };
            li.querySelector('[title="删除"]').onclick = async function(e) {
                e.stopPropagation();
                if (!confirm('确定删除此对话？')) return;
                try { await fetch('/api/chat/' + idx, { method: 'DELETE' }); } catch (e) {}
                chats.splice(idx, 1);
                chatTitles.splice(idx, 1);
                chatTokens.splice(idx, 1);
                pinnedChats.delete(idx);
                if (currentChat >= chats.length) currentChat = chats.length - 1;
                if (currentChat < 0) { currentChat = 0; chats = [[]]; chatTitles = ['当前对话']; chatTokens = ['']; }
                updateHistoryList();
                if (isChatActive) switchChat(currentChat);
            };
        });
    }

    chatHeader.onclick = function(e) {
        if (e.target === chatTitleInput) return;
        chatTitleText.style.display = 'none';
        chatTitleInput.style.display = 'inline-block';
        chatTitleInput.value = chatTitles[currentChat];
        chatTitleInput.focus();
        chatTitleInput.onkeydown = async function(ev) {
            if (ev.key === 'Enter') {
                var t = chatTitleInput.value.trim();
                if (t) { chatTitles[currentChat] = t; updateHeaderTitle(); updateHistoryList(); saveChatToBackend(); }
                chatTitleInput.style.display = 'none';
                chatTitleText.style.display = 'inline';
            } else if (ev.key === 'Escape') {
                chatTitleInput.style.display = 'none';
                chatTitleText.style.display = 'inline';
            }
        };
        chatTitleInput.onblur = function() { setTimeout(function() { chatTitleInput.style.display = 'none'; chatTitleText.style.display = 'inline'; }, 100); };
    };

    function addDirectChatButton() {
        if (document.getElementById('directChatBtn')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'direct-chat-container';
        wrapper.innerHTML = '<button id="directChatBtn" style="margin-top:12px;background:none;border:none;color:#aaa;font-size:12px;cursor:pointer;text-decoration:underline;">直接进入对话</button>';
        wrapper.onclick = async function(e) { e.stopPropagation(); await newChat(); };
        var inputWrapper = centerInit && centerInit.querySelector('.input-wrapper-outer');
        if (inputWrapper) inputWrapper.after(wrapper);
    }

    newChatSidebarBtn.onclick = sidebarLogo.onclick = async function() { await newChat(); };
    var fabBtn = document.getElementById('sidebarNewChatFab');
    if (fabBtn) fabBtn.onclick = async function() { await newChat(); };

    window.addEventListener('popstate', function() {
        var match = window.location.pathname.match(/^\/chat\/([A-Za-z0-9]+)$/);
        if (match) {
            var idx = chatTokens.indexOf(match[1]);
            if (idx !== -1 && idx !== currentChat) { if (!isChatActive) activateChat(false); switchChat(idx); }
        }
    });

    initSend.onclick = function() {
        if (streaming) { if (currentAbortController) { currentAbortController.abort(); currentAbortController = null; } }
        else { sendMessage(false); }
    };
    chatSend.onclick = function() {
        if (streaming) { if (currentAbortController) { currentAbortController.abort(); currentAbortController = null; } }
        else { sendMessage(false); }
    };
    initText.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!streaming) sendMessage(false); } };
    chatText.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!streaming) sendMessage(false); } };
    chatArea.addEventListener('scroll', function() { isUserScrolledAway = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight > 40; });

    async function getIdentity() {
        try { var r = await fetch('/api/identity'); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
    }
    async function initIdentity() { try { await fetch('/api/identity', { method: 'POST' }); } catch (e) {} }

    async function renderIdentityTab() {
        if (!filePanelBody) return;
        if (filePanelTitle) filePanelTitle.textContent = '身份';
        var identity = await getIdentity();
        if (!identity) { filePanelBody.innerHTML = '<div class="file-panel-empty">无法获取身份信息</div>'; return; }
        filePanelBody.innerHTML = '<div class="identity-card"><div class="identity-item"><span class="identity-label">唯一标识</span><span class="identity-value">' + escapeHtml(identity.id || '---') + '</span></div><div class="identity-item"><span class="identity-label">首次使用时间</span><span class="identity-value">' + (identity.createdAt ? new Date(identity.createdAt).toLocaleString('zh-CN') : '---') + '</span></div><div class="identity-item"><span class="identity-label">最后活跃时间</span><span class="identity-value">' + (identity.lastActive ? new Date(identity.lastActive).toLocaleString('zh-CN') : '---') + '</span></div></div>';
    }

    function renderPromptTab() {
        if (!filePanelBody) return;
        if (filePanelTitle) filePanelTitle.textContent = '提示词';
        var promptText = '===== API 参数 =====\n';
        promptText += '提供商: ' + (currentProvider || '未设置') + '\n';
        promptText += '模型: ' + (currentModel || '未设置') + '\n';
        promptText += '思考模式: ' + currentThinkMode + '\n';
        promptText += '温度: ' + (currentParams.temperature ?? '默认') + '\n';
        promptText += '最大Token: ' + (currentParams.max_tokens ?? '默认') + '\n';
        promptText += '工具链: ' + (commandExecEnabled ? '命令执行' : '无') + '\n';
        promptText += '\n===== 用户系统提示词 =====\n';
        promptText += (currentParams.systemPrompt || '(未设置)');
        promptText += '\n\n===== 总 system prompt =====\n';
        promptText += (currentParams.systemPrompt || '');
        if (commandExecEnabled) promptText += '\n\n你可以主动调用系统命令执行工具来完成用户的需求。调用格式: tool:CommandExecution';
        filePanelBody.innerHTML = '<div><div class="memory-viewer-section-title">系统提示词</div><pre class="memory-viewer-prompt" style="white-space:pre-wrap;font-size:12px;font-family:monospace;background:var(--code-bg,#f5f5f5);border-radius:8px;padding:12px 14px;color:var(--text-secondary,#666);max-height:400px;overflow-y:auto;line-height:1.5;">' + escapeHtml(promptText) + '</pre></div>';
    }

    async function openFilePanel(tab) {
        if (!tab) tab = 'identity';
        await initIdentity();
        if (filePanelOverlay) filePanelOverlay.classList.add('active');
        var tabs = filePanelTabs.querySelectorAll('.file-panel-tab');
        tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tab); });
        if (tab === 'identity') await renderIdentityTab();
        else if (tab === 'prompt') renderPromptTab();
    }
    function closeFilePanel() { if (filePanelOverlay) filePanelOverlay.classList.remove('active'); }
    if (filePanelClose) filePanelClose.onclick = closeFilePanel;
    if (filePanelOverlay) filePanelOverlay.addEventListener('click', function(e) { if (e.target === filePanelOverlay) closeFilePanel(); });
    if (filePanelTabs) {
        filePanelTabs.querySelectorAll('.file-panel-tab').forEach(function(tab) {
            tab.onclick = function() { openFilePanel(tab.dataset.tab); };
        });
    }
    if (initialFileBtn) initialFileBtn.onclick = function() { openFilePanel('identity'); };
    if (chatFileBtn) chatFileBtn.onclick = function() { openFilePanel('identity'); };

    document.addEventListener('DOMContentLoaded', function() {
        var initDeepThinkBtn = document.getElementById('initialDeepThinkBtn');
        var chatDeepThinkBtn = document.getElementById('chatDeepThinkBtn');
        if (!initDeepThinkBtn || !chatDeepThinkBtn) { console.warn('深度思考按钮未找到'); return; }

        var currentPopup = null;
        function createDeepThinkPopup(triggerBtn) {
            var existing = document.querySelector('.deep-think-popup');
            if (existing) { existing.remove(); if (existing._triggerBtn === triggerBtn) { currentPopup = null; return; } }
            var popup = document.createElement('div');
            popup.className = 'deep-think-popup';
            popup._triggerBtn = triggerBtn;
            popup.innerHTML = '<div class="deep-think-popup-inner"><div class="tool-chain-section"><div class="tool-chain-title">工具链</div><div class="tool-chain-item"><div class="tool-chain-item-left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>命令执行</span></div><div class="tool-chain-toggle"><button class="tool-chain-option' + (commandExecEnabled ? ' active' : '') + '" data-tool="command" data-value="on">允许</button><button class="tool-chain-option' + (!commandExecEnabled ? ' active' : '') + '" data-tool="command" data-value="off">禁用</button></div></div></div><div class="think-section"><span class="think-section-title">思考模式</span><div class="think-mode-selector" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px;width:320px;"><button class="think-mode-option' + (currentThinkMode === 'fast' ? ' active' : '') + '" data-mode="fast"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>快速</span></button><button class="think-mode-option' + (currentThinkMode === 'think' ? ' active' : '') + '" data-mode="think"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span>思考</span></button><button class="think-mode-option' + (currentThinkMode === 'deep' ? ' active' : '') + '" data-mode="deep"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.47V19a2 2 0 11-4 0v-.53c0-1.03-.47-1.99-1.274-2.618l-.548-.547z"/></svg><span>沉思</span></button><button class="think-mode-option' + (currentThinkMode === 'meditate' ? ' active' : '') + '" data-mode="meditate"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>静思</span></button></div></div></div>';
            document.body.appendChild(popup);
            var rect = triggerBtn.getBoundingClientRect();
            popup.style.left = (rect.left + rect.width / 2 - 10) + 'px';
            popup.style.top = (rect.top - 8) + 'px';
            popup.style.transformOrigin = 'bottom center';
            requestAnimationFrame(function() {
                popup.classList.add('active');
                requestAnimationFrame(function() { popup.style.left = (rect.left + rect.width / 2 - popup.offsetWidth / 2) + 'px'; popup.style.top = (rect.top - popup.offsetHeight - 8) + 'px'; });
            });
            popup.querySelectorAll('.think-mode-option').forEach(function(op) {
                op.addEventListener('click', function() {
                    currentThinkMode = op.dataset.mode;
                    deepThinkEnabled = currentThinkMode !== 'fast';
                    popup.querySelectorAll('.think-mode-option').forEach(function(o) { o.classList.toggle('active', o === op); });
                    saveSettingsToLocal();
                });
            });
            popup.querySelectorAll('.tool-chain-option').forEach(function(op) {
                op.addEventListener('click', function() {
                    var tool = op.dataset.tool;
                    var value = op.dataset.value;
                    if (tool === 'command') {
                        commandExecEnabled = value === 'on';
                        popup.querySelectorAll('.tool-chain-option[data-tool="command"]').forEach(function(o) { o.classList.toggle('active', o === op); });
                        if (window.CommandExecutionPlugin) window.CommandExecutionPlugin.setEnabled(commandExecEnabled);
                        saveSettingsToLocal();
                    }
                });
            });
            var closeHandler = function(e) { if (!popup.contains(e.target) && e.target !== triggerBtn) { popup.classList.remove('active'); setTimeout(function() { popup.remove(); currentPopup = null; }, 200); document.removeEventListener('click', closeHandler); } };
            setTimeout(function() { document.addEventListener('click', closeHandler); }, 10);
            currentPopup = popup;
        }
        initDeepThinkBtn.addEventListener('click', function(e) { e.stopPropagation(); createDeepThinkPopup(initDeepThinkBtn); });
        chatDeepThinkBtn.addEventListener('click', function(e) { e.stopPropagation(); createDeepThinkPopup(chatDeepThinkBtn); });
    });

    loadSettings();
    if (window.CommandExecutionPlugin) {
        window.CommandExecutionPlugin.setEnabled(commandExecEnabled);
        window.CommandExecutionPlugin.setConfirmBeforeExecution(commandConfirmEnabled);
    }

    (async function loadVersion() {
        try { var r = await fetch('/com/ver.json'); if (r.ok) { var d = await r.json(); var ve = document.getElementById('versionDisplay'); if (ve) ve.textContent = '版本 ' + (d.stage || '') + ' ' + (d.ver || '') + ' · Fold.AI'; } } catch (e) {}
    })();

    (async function() {
        // 检查服务端嵌入的对话数据（/chat/{token} 时）
        // 嵌入数据只用于防闪（提前隐藏开幕 + 标出当前 token），
        // 数据加载仍然走 loadChatsFromBackend 保证完整
        var embeddedToken = null;
        if (window.__CHAT_DATA__ && window.__CHAT_TOKEN__) {
            embeddedToken = window.__CHAT_TOKEN__;
        }
        delete window.__CHAT_DATA__;
        delete window.__CHAT_TOKEN__;
        await loadProviders();
        await loadConfigFromBackend();
        await loadConfigPrompts();
        await loadChatsFromBackend(embeddedToken);
        updateModelButtonLabels();
        updateHistoryList();
        addDirectChatButton();
        if (currentProvider) { await loadModels(currentProvider); }
    })();
})();
