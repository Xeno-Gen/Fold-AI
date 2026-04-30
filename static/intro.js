// 将 showToast 暴露为全局函数，供 HTML 内联事件调用
window.showToast = function(msg) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 4000);
};

// 暴露存储代码块到库的全局函数
window.saveCodeBlockToStorage = async function(code, lang) {
    const extMap = {
        html: 'html', txt: 'txt', js: 'js', ts: 'ts', css: 'css',
        json: 'json', md: 'md', py: 'py', java: 'java', cpp: 'cpp',
        c: 'c', go: 'go', rs: 'rs', php: 'php', ruby: 'rb',
        sql: 'sql', xml: 'xml', yaml: 'yml', sh: 'sh', bat: 'bat'
    };
    const ext = extMap[lang] || 'txt';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `code_${timestamp}_${random}.${ext}`;
    const file = new File([code], filename, { type: 'text/plain;charset=utf-8' });
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`上传失败 (${res.status})`);
        window.showToast(`已保存至存储库: ${filename}`);
        // 刷新存储面板（如果已打开）
        if (window.filePanelOverlay && window.filePanelOverlay.classList.contains('active')) {
            const activeTab = document.querySelector('.file-panel-tab.active');
            if (activeTab && activeTab.dataset.tab === 'storage') {
                const files = await window.getStorageFiles?.();
                if (files && window.renderStorageTab) window.renderStorageTab(files);
            }
        }
    } catch (err) {
        window.showToast(`保存失败: ${err.message}`);
        console.error(err);
    }
};

// 保存文本并显示：先存到存储库，再打开文件查看面板
window.saveAndShowText = async function(prefix, text) {
    const showInViewer = (title, content) => {
        const t = document.getElementById('fileViewerTitle');
        const b = document.getElementById('fileViewerBody');
        const o = document.getElementById('fileViewerOverlay');
        if (t) t.textContent = title;
        if (b) b.textContent = content;
        if (o) o.classList.add('active');
    };

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${prefix}_${timestamp}_${random}.txt`;
    const file = new File([text], filename, { type: 'text/plain;charset=utf-8' });
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`保存失败 (${res.status})`);
        window.showToast(`已保存: ${filename}`);
        showInViewer(filename, text);
    } catch (err) {
        window.showToast('存储失败，仅显示内容');
        showInViewer(prefix, text);
    }
};



(function() {
    const $ = id => {
        const el = document.getElementById(id);
        if (!el) console.warn('⚠️ 未找到元素:', id);
        return el;
    };

    const chatArea = $('chatArea'),
        bottomInput = $('bottomInputContainer');
    const chatAreaInner = $('chatAreaInner');
    const initText = $('initialTextarea'),
        chatText = $('chatTextarea');
    const initSend = $('initialSendBtn'),
        chatSend = $('chatSendBtn');
    const initPreview = $('initialImagePreview'),
        chatPreview = $('chatImagePreview');
    const chatHeader = $('chatHeader'),
        centerInit = $('centerInitial');
    const chatTitleText = $('chatTitleText'),
        chatTitleInput = $('chatTitleInput');
    const emptyHint = $('emptyHint'),
        historyList = $('chatHistoryList');
    const settingsBtn = $('settingsBtn'),
        initialSettingsBtn = $('initialSettingsBtn');
    const drawerOverlay = $('drawerOverlay'),
        drawerBody = $('drawerBody'),
        drawerClose = $('drawerClose');
    const fileInput = $('hiddenFileInput'),
        toast = $('toast');
    const initModelBtn = $('initialModelBtn'),
        chatModelBtn = $('chatModelBtn');
    const initModelLabel = $('initialModelLabel'),
        chatModelLabel = $('chatModelLabel');
    const sidebarLeft = $('sidebarLeft'),
        sidebarToggle = $('sidebarToggle');
    const newChatIcon = $('newChatIcon'),
        newChatSidebarBtn = $('newChatSidebarBtn'),
        sidebarLogo = $('sidebarLogo');
    const historyIcon = $('historyIcon');
    const initialAttachBtn = $('initialAttachBtn'),
        chatAttachBtn = $('chatAttachBtn');

    const mobileSidebarBtn = $('mobileSidebarBtn');
    const fileViewerOverlay = $('fileViewerOverlay');
    const fileViewerBody = $('fileViewerBody');
    const fileViewerTitle = $('fileViewerTitle');
    const fileViewerClose = $('fileViewerClose');
const filePanelOverlay = $('filePanelOverlay'),
    filePanelBody = $('filePanelBody'),
    filePanelClose = $('filePanelClose'),
    filePanelTabs = $('filePanelTabs'),
    filePanelTitle = $('filePanelTitle');
const chatFileBtn = $('chatFileBtn'),
    initialFileBtn = $('initialFileBtn');


    let isChatActive = false;
    let deepThinkEnabled = false;
    let currentThinkMode = 'direct'; // 'deep' | 'direct' | 'reason' | 'creative'
    let commandExecEnabled = false;
    let chainOfThoughtEnabled = false;
    let appendOutputEnabled = false;
    let commandConfirmEnabled = true;
    let currentTheme = 'system'; // 'light' | 'dark' | 'system'
    let chats = [[]],
        chatTitles = ['当前对话'],
        currentChat = 0;
    let activeFiles = { initial: [], chat: [] };
    let streaming = false;
    let isUserScrolledAway = false;
    let currentAbortController = null;
    let currentProvider = null;
    let currentChatFormat = 'OpenAI';
    let currentModel = 'deepseek-v4-flash';
    let currentParams = {
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: 2048,
        seed: null,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_k: null,
        systemPrompt: ''
    };
    let customPort = 8080;
    let providers = [];
    let availableModels = [],
        allModels = [];
    const pinnedChats = new Set();
    let pendingNewChatIndex = null;

    // 主题管理
    function applyTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    // 加载保存的设置
    function loadSettings() {
        try {
            const saved = localStorage.getItem('fold_ai_settings');
            if (saved) {
                const s = JSON.parse(saved);
                currentTheme = s.theme || 'system';
                commandConfirmEnabled = s.commandConfirm !== undefined ? s.commandConfirm : true;
                commandExecEnabled = s.commandExecEnabled || false;
                chainOfThoughtEnabled = s.chainOfThoughtEnabled || false;
                appendOutputEnabled = s.appendOutputEnabled || false;
                currentThinkMode = s.thinkMode || 'direct';
                deepThinkEnabled = s.deepThink || false;
            }
        } catch (e) {}
        applyTheme(currentTheme);
    }

    function saveSettingsToLocal() {
        try {
            localStorage.setItem('fold_ai_settings', JSON.stringify({
                theme: currentTheme,
                commandConfirm: commandConfirmEnabled,
                commandExecEnabled: commandExecEnabled,
                chainOfThoughtEnabled: chainOfThoughtEnabled,
                appendOutputEnabled: appendOutputEnabled,
                thinkMode: currentThinkMode,
                deepThink: deepThinkEnabled
            }));
        } catch (e) {}
    }

    // 从 Config 文件夹加载提示词配置
    let configPrompts = { think_modes: {} };

    async function loadConfigPrompts() {
        try {
            const res = await fetch('/api/config/prompts.json');
            if (res.ok) configPrompts = await res.json();
        } catch (e) {}
    }

    // 获取当前模式的推理步骤
    function getReasonSteps() {
        const mode = configPrompts.think_modes?.[currentThinkMode];
        return mode?.steps || [];
    }

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
    const buttons = [
        { btn: initSend, target: 'initial' },
        { btn: chatSend, target: 'chat' }
    ];
    buttons.forEach(({ btn, target }) => {
        if (!btn) return;
        if (streaming) {
            btn.classList.add('stop-btn');
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
            btn.title = '停止生成';
        } else {
            btn.classList.remove('stop-btn');
            const ta = isChatActive ? chatText : initText;
            const hasContent = ta.value.trim() || activeFiles[target].length > 0;
            btn.disabled = !hasContent;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
            btn.title = '发送';
        }
    });
}

    function openFileViewer(name, content) {
        if (fileViewerTitle) fileViewerTitle.textContent = name;
        if (fileViewerBody) fileViewerBody.textContent = content;
        if (fileViewerOverlay) fileViewerOverlay.classList.add('active');
    }

    function closeFileViewer() {
        if (fileViewerOverlay) fileViewerOverlay.classList.remove('active');
    }
    if (fileViewerClose) fileViewerClose.onclick = closeFileViewer;
    if (fileViewerOverlay) fileViewerOverlay.addEventListener('click', e => {
        if (e.target === fileViewerOverlay) closeFileViewer();
    });

    if (mobileSidebarBtn) {
        mobileSidebarBtn.onclick = () => {
            if (sidebarLeft.classList.contains('visible')) {
                sidebarLeft.classList.remove('visible', 'expanded');
            } else {
                sidebarLeft.classList.add('visible', 'expanded');
            }
        };
    }

    // ========== 设置模态框 ==========
    const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');
    const settingsModalOverlay = document.getElementById('settingsModalOverlay');
    const settingsModal = document.getElementById('settingsModal');
    const settingsModalClose = document.getElementById('settingsModalClose');

    function openSettingsModal() {
        settingsModalOverlay.classList.add('active');
        settingsModal.classList.add('active');
        renderSettingsModal();
    }

    function closeSettingsModal() {
        settingsModal.classList.remove('active');
        setTimeout(() => {
            settingsModalOverlay.classList.remove('active');
        }, 200);
    }

    function renderSettingsModal() {
        document.querySelectorAll('#themeSelector .think-mode-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === currentTheme);
        });
        document.querySelectorAll('#commandConfirmToggle .think-mode-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === String(commandConfirmEnabled));
        });
    }

    if (sidebarSettingsBtn) {
        sidebarSettingsBtn.onclick = openSettingsModal;
    }
    if (settingsModalClose) {
        settingsModalClose.onclick = closeSettingsModal;
    }
    if (settingsModalOverlay) {
        settingsModalOverlay.addEventListener('click', e => {
            if (e.target === settingsModalOverlay) closeSettingsModal();
        });
    }

    // 设置模态框内的事件代理
    document.addEventListener('click', function(e) {
        if (!settingsModalOverlay.classList.contains('active')) return;
        const themeOption = e.target.closest('#themeSelector .think-mode-option');
        if (themeOption) {
            currentTheme = themeOption.dataset.theme;
            applyTheme(currentTheme);
            saveSettingsToLocal();
            renderSettingsModal();
        }
        const confirmToggle = e.target.closest('#commandConfirmToggle .think-mode-option');
        if (confirmToggle) {
            commandConfirmEnabled = confirmToggle.dataset.value === 'true';
            renderSettingsModal();
            saveSettingsToLocal();
            if (window.CommandExecutionPlugin) {
                window.CommandExecutionPlugin.setConfirmBeforeExecution(commandConfirmEnabled);
            }
        }
    });

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'system') applyTheme('system');
    });

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || '上传失败');
            }
            return res.json();
        } catch (err) {
            clearTimeout(timeout);
            throw err;
        }
    }

    function renderPreviews(container, fileList) {
        if (!container) return;
        container.innerHTML = '';
        fileList.forEach((file, idx) => {
            if (file.type === 'image') {
                const wrap = document.createElement('div');
                wrap.className = 'image-preview-item';
                wrap.style.backgroundImage = `url(${file.content})`;
                const btn = document.createElement('span');
                btn.className = 'remove-preview';
                btn.textContent = '×';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    fileList.splice(idx, 1);
                    renderPreviews(container, fileList);
                    updateSendBtn();
                };
                wrap.appendChild(btn);
                container.appendChild(wrap);
            } else {
                const wrap = document.createElement('div');
                wrap.className = 'file-preview-item';
                wrap.innerHTML = `<span class="file-icon">📄</span><span class="file-name">${escapeHtml(file.fileName)}</span>`;
                wrap.style.cursor = 'pointer';
                wrap.onclick = (e) => {
                    if (e.target.classList.contains('remove-preview')) return;
                    openFileViewer(file.fileName, file.content);
                };
                const btn = document.createElement('span');
                btn.className = 'remove-preview';
                btn.textContent = '×';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    fileList.splice(idx, 1);
                    renderPreviews(container, fileList);
                    updateSendBtn();
                };
                wrap.appendChild(btn);
                container.appendChild(wrap);
            }
        });
    }

    let fileTarget = { textarea: initText, preview: initPreview };
    fileInput.onchange = async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        const target = fileTarget.textarea === initText ? 'initial' : 'chat';
        for (const f of files) {
            try {
                const result = await uploadFile(f);
                activeFiles[target].push(result);
            } catch (err) {
                showToast('上传失败: ' + (err.message || '未知错误'));
            }
        }
        renderPreviews(fileTarget.preview, activeFiles[target]);
        updateSendBtn();
        fileInput.value = '';
    };

    initialAttachBtn.onclick = () => {
        fileTarget = { textarea: initText, preview: initPreview };
        fileInput.click();
    };
    chatAttachBtn.onclick = () => {
        fileTarget = { textarea: chatText, preview: chatPreview };
        fileInput.click();
    };

    initText.oninput = () => {
    updateSendBtn();
};
    chatText.oninput = () => {
    updateSendBtn();
};

    let dropdownInstance = null;
    (function initDropdown() {
        const div = document.createElement('div');
        div.className = 'model-picker-dropdown';
        div.style.position = 'fixed';
        div.style.zIndex = '999';
        div.style.display = 'none';
        document.body.appendChild(div);
        dropdownInstance = div;
    })();

    function positionDropdown(btn) {
        if (!btn || !dropdownInstance) return;
        const rect = btn.getBoundingClientRect();
        dropdownInstance.style.left = rect.left + 'px';
        dropdownInstance.style.top = rect.top - dropdownInstance.offsetHeight - 8 + 'px';
    }

    function openModelPicker(btn) {
        if (!dropdownInstance || !btn) return;
        if (dropdownInstance.style.display === 'flex' && dropdownInstance.dataset.btn === btn.id) {
            closeModelPicker();
            return;
        }
        closeModelPicker();
        dropdownInstance.style.display = 'flex';
        dropdownInstance.dataset.btn = btn.id;
        renderModelListInDropdown();
        positionDropdown(btn);
        document.addEventListener('click', outsideClickHandler);
    }

    function closeModelPicker() {
        if (dropdownInstance) {
            dropdownInstance.style.display = 'none';
            dropdownInstance.dataset.btn = '';
        }
        document.removeEventListener('click', outsideClickHandler);
    }

    function outsideClickHandler(e) {
        if (!dropdownInstance || dropdownInstance.style.display !== 'flex') return;
        if (!e.target.closest('.model-select-btn') && !e.target.closest('.model-picker-dropdown'))
            closeModelPicker();
    }

    function renderModelListInDropdown() {
        if (!dropdownInstance) return;
        let html =
            '<div class="model-search"><input type="text" class="model-search-input" placeholder="搜索模型..."></div><div class="model-list">';
        allModels.forEach(m => {
            html +=
                `<div class="model-picker-item${m === currentModel ? ' active' : ''}" data-model="${m}">
                <div class="model-icon">${currentProvider && providers.find(p => p.id === currentProvider)?.icon ? `<img src="${providers.find(p => p.id === currentProvider).icon}">` : '🤖'}</div>
                <div class="model-info"><div class="model-name">${m}</div><div class="model-desc">高性能对话模型</div></div>
                <div class="model-check">✓</div>
            </div>`;
        });
        if (!allModels.length) html += '<div style="padding:20px;text-align:center;color:#999;">暂无可用模型</div>';
        html += '</div>';
        dropdownInstance.innerHTML = html;
        const searchInput = dropdownInstance.querySelector('.model-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const kw = this.value.toLowerCase();
                dropdownInstance.querySelectorAll('.model-picker-item').forEach(item =>
                    (item.style.display = item.dataset.model.toLowerCase().includes(kw) ? 'flex' : 'none')
                );
            });
            setTimeout(() => searchInput.focus(), 0);
        }
        dropdownInstance.querySelectorAll('.model-picker-item').forEach(item => {
            item.onclick = () => {
                currentModel = item.dataset.model;
                updateModelButtonLabels();
                closeModelPicker();
                saveConfigToBackend();
            };
        });
    }

    function updateModelButtonLabels() {
        if (initModelLabel) initModelLabel.textContent = currentModel || '选择模型';
        if (chatModelLabel) chatModelLabel.textContent = currentModel || '选择模型';
    }

    initModelBtn.addEventListener('click', e => {
        e.stopPropagation();
        openModelPicker(initModelBtn);
    });
    chatModelBtn.addEventListener('click', e => {
        e.stopPropagation();
        openModelPicker(chatModelBtn);
    });
    window.addEventListener('resize', () => {
        if (dropdownInstance && dropdownInstance.style.display === 'flex') {
            const btnId = dropdownInstance.dataset.btn;
            if (btnId) positionDropdown(document.getElementById(btnId));
        }
    });

    async function saveConfigToBackend() {
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    defaultParams: currentParams,
                    currentProvider,
                    currentModel,
                    customPort,
                    systemPrompt: currentParams.systemPrompt,
                    chatFormat: currentChatFormat
                })
            });
        } catch (e) {}
    }

    async function loadConfigFromBackend() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            if (data.defaultParams) currentParams = { ...currentParams, ...data.defaultParams };
            if (data.currentProvider) currentProvider = data.currentProvider;
            else if (providers.length && !currentProvider) currentProvider = providers[0].id;
            if (data.currentModel) currentModel = data.currentModel;
            if (data.customPort !== undefined) customPort = data.customPort;
            if (data.systemPrompt !== undefined) currentParams.systemPrompt = data.systemPrompt;
            if (data.chatFormat) {
                currentChatFormat = data.chatFormat;
            } else {
                updateChatFormatFromProvider();
            }
            updateModelButtonLabels();
        } catch (e) {}
    }

    async function saveChatToBackend() {
        try {
            await fetch(`/api/chat/${currentChat}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: chatTitles[currentChat], messages: chats[currentChat] })
            });
        } catch (e) {}
    }

    async function loadChatsFromBackend() {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) return;
            const remote = await res.json();
            if (remote.length) {
                const nc = [],
                    nt = [];
                for (const c of remote) {
                    const detailRes = await fetch(`/api/chat/${c.id}`);
                    const detail = await detailRes.json();
                    nc.push(detail.messages || []);
                    nt.push(detail.title || c.title);
                }
                chats = nc;
                chatTitles = nt;
                currentChat = chats.length - 1;
                switchChat(currentChat);
            }
        } catch (e) {}
        updateHistoryList();
    }

    async function loadProviders() {
        try {
            const res = await fetch('/api/providers');
            providers = (await res.json()).providers || [];
            if (providers.length && !currentProvider) {
                currentProvider = providers[0].id;
            }
            // 设置默认 chatFormat
            updateChatFormatFromProvider();
            if (currentProvider) await loadModels(currentProvider);
        } catch (e) {}
    }

    // 获取当前提供商的可用格式列表
    function getAvailableFormats() {
        const p = providers.find(p => p.id === currentProvider);
        if (!p || !p.chatFormat) return ['OpenAI'];
        return p.chatFormat.split(',').map(s => s.trim());
    }

    // 根据当前提供商更新 chatFormat
    function updateChatFormatFromProvider() {
        const formats = getAvailableFormats();
        if (formats.length === 1) {
            currentChatFormat = formats[0];
        } else if (formats.length > 1 && !formats.includes(currentChatFormat)) {
            currentChatFormat = formats[0];
        }
    }

    async function loadModels(providerId) {
        try {
            const res = await fetch(`/api/provider/${providerId}/models`);
            if (!res.ok) throw new Error('获取模型列表失败');
            availableModels = (await res.json()).models || [];
            allModels = [...availableModels];
            if (availableModels.length && (!currentModel || !availableModels.includes(currentModel))) {
                currentModel = availableModels[0];
                updateModelButtonLabels();
            }
        } catch (e) {
            showToast('无法加载模型列表，请检查 API Key');
        }
    }

    async function loadProviderKeys(providerId) {
        try {
            const res = await fetch(`/api/provider/${providerId}/keys`);
            if (!res.ok) return [];
            return (await res.json()).keys || [];
        } catch (e) { return []; }
    }

    async function addProviderKey(providerId, key) {
        try {
            const res = await fetch(`/api/provider/${providerId}/keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });
            return res.ok;
        } catch (e) { return false; }
    }

    async function deleteProviderKey(providerId, index) {
        try {
            const res = await fetch(`/api/provider/${providerId}/key/${index}`, { method: 'DELETE' });
            return res.ok;
        } catch (e) { return false; }
    }

    async function useProviderKey(providerId, index) {
        try {
            const res = await fetch(`/api/provider/${providerId}/keys/use`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index })
            });
            return res.ok;
        } catch (e) { return false; }
    }

    function openDrawer() {
        loadConfigFromBackend().then(() => renderDrawer());
        drawerOverlay.classList.add('active');
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('active');
    }
    settingsBtn.onclick = openDrawer;
    initialSettingsBtn.onclick = openDrawer;
    drawerClose.onclick = closeDrawer;
    drawerOverlay.onclick = e => {
        if (e.target === drawerOverlay) closeDrawer();
    };

    async function renderDrawer() {
        if (!drawerBody) return;
        let html = '<div class="section-title">模型提供商</div><div class="provider-grid">';
        providers.forEach(p => {
            html += `<div class="provider-card${currentProvider === p.id ? ' active' : ''}" data-id="${p.id}">
                <div class="prov-icon">${p.icon ? `<img src="${p.icon}">` : p.name.charAt(0)}</div>
                <div class="provider-name">${p.name}</div>
            </div>`;
        });
        html += '</div>';

        // 格式切换
        const formats = getAvailableFormats();
        if (formats.length > 1) {
            html += '<div style="margin: 16px 0 20px;">';
            html += '<div class="section-title" style="margin-bottom:10px;">API 格式</div>';
            html += '<div class="think-mode-selector" id="chatFormatSelector" style="display:inline-flex;">';
            formats.forEach(f => {
                html += `<button class="think-mode-option${currentChatFormat === f ? ' active' : ''}" data-format="${f}">${f === 'OpenAI' ? 'OpenAI' : 'Anthropic'}</button>`;
            });
            html += '</div></div>';
        } else {
            // 只有一种格式，固定显示
            html += `<div style="margin: 16px 0 20px;"><div class="section-title" style="margin-bottom:6px;">API 格式</div><div style="font-size:13px;color:#888;">${formats[0]}</div></div>`;
        }

        html += '<div class="section-title" style="margin-top:10px;">API 密钥</div>';
        html +=
            '<div class="key-input-row"><input type="password" id="newKeyInput" placeholder="输入新的 API Key..."><button id="addKeyBtn">添加</button></div>';
        html += '<div class="key-list" id="keyListContainer"></div>';
        html += '<div class="section-title" style="margin-top:20px;">系统提示词</div>';
        html +=
            `<div class="system-prompt-section"><textarea id="systemPromptInput" rows="3" placeholder="定义 AI 的行为、角色或风格...">${escapeHtml(currentParams.systemPrompt || '')}</textarea></div>`;
        html += '<div class="section-title" style="margin-top:20px;">参数调节</div><div class="param-group">';
        const paramsDef = [
            { key: 'temperature', label: '温度', min: 0, max: 2, step: 0.1 },
            { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.05 },
            { key: 'max_tokens', label: '最大长度', min: 1, max: 8192, step: 1 },
            { key: 'frequency_penalty', label: '频率惩罚', min: -2, max: 2, step: 0.1 },
            { key: 'presence_penalty', label: '存在惩罚', min: -2, max: 2, step: 0.1 }
        ];
        paramsDef.forEach(p => {
            const val = currentParams[p.key] ?? 0;
            html +=
                `<div class="param-item"><label>${p.label}</label><input type="number" id="param-${p.key}" value="${val}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`;
        });
        html +=
            `<div class="param-item"><label>种子</label><input type="number" id="param-seed" placeholder="留空" value="${currentParams.seed || ''}"></div>`;
        html +=
            `<div class="param-item"><label>Top K</label><input type="number" id="param-topk" placeholder="留空" value="${currentParams.top_k || ''}"></div>`;
        html +=
            `<div class="param-item"><label>自定义端口</label><input type="number" id="customPortInput" value="${customPort}" min="1" max="65535"></div>`;
        html += '</div>';

        // 额外提示词（只读，根据当前模式显示）
        html += '<div class="section-title" style="margin-top:20px;">额外提示词</div>';
        html += '<div class="extra-prompts-section" id="extraPromptsSection">';
        const modeInfo = configPrompts.think_modes?.[currentThinkMode];
        if (currentThinkMode === 'deep') {
            html += '<div class="extra-prompt-item"><span class="extra-prompt-label">沉思模式</span><span class="extra-prompt-value">开启 API deep_think 参数</span></div>';
        } else if (currentThinkMode === 'direct') {
            html += '<div class="extra-prompt-item"><span class="extra-prompt-label">直接模式</span><span class="extra-prompt-value">无额外提示词</span></div>';
        } else if (currentThinkMode === 'reason' || currentThinkMode === 'direct') {
            html += '<div class="extra-prompt-item"><span class="extra-prompt-label">直接模式</span><span class="extra-prompt-value">无额外提示词</span></div>';
        } else if (currentThinkMode === 'creative') {
            html += '<div class="extra-prompt-item"><span class="extra-prompt-label">创意模式</span><span class="extra-prompt-value">（暂未实现）</span></div>';
        }
        html += '</div>';

        drawerBody.innerHTML = html;

        drawerBody.querySelectorAll('.provider-card').forEach(card => {
            card.onclick = async () => {
                drawerBody.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                currentProvider = card.dataset.id;
                updateChatFormatFromProvider();
                await loadModels(currentProvider);
                saveConfigToBackend();
                await refreshKeyList();
                // 重新渲染 drawer 以更新格式选择器
                renderDrawer();
            };
        });

        // 格式切换事件
        const formatSelector = document.getElementById('chatFormatSelector');
        if (formatSelector) {
            formatSelector.querySelectorAll('.think-mode-option').forEach(btn => {
                btn.onclick = () => {
                    formatSelector.querySelectorAll('.think-mode-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentChatFormat = btn.dataset.format;
                    saveConfigToBackend();
                };
            });
        }
        $('addKeyBtn').onclick = async () => {
            const inp = $('newKeyInput');
            if (!inp || !inp.value.trim()) { showToast('请输入密钥'); return; }
            if (!currentProvider) { showToast('请先选择提供商'); return; }
            if (await addProviderKey(currentProvider, inp.value.trim())) {
                showToast('密钥已添加');
                inp.value = '';
                await refreshKeyList();
                await loadModels(currentProvider);
            } else showToast('添加失败');
        };

        const sysPromptEl = document.getElementById('systemPromptInput');
        if (sysPromptEl) {
            sysPromptEl.addEventListener('change', function() {
                currentParams.systemPrompt = this.value;
                saveConfigToBackend();
            });
        }

        paramsDef.forEach(p => {
            const input = document.getElementById(`param-${p.key}`);
            if (input) {
                input.addEventListener('change', function() {
                    currentParams[p.key] = parseFloat(this.value) || 0;
                    saveConfigToBackend();
                });
            }
        });
        ['seed', 'topk'].forEach(k => {
            const el = document.getElementById(`param-${k}`);
            if (el) el.addEventListener('change', function() {
                const val = this.value ? parseInt(this.value) : null;
                if (k === 'seed') currentParams.seed = val;
                else currentParams.top_k = val;
                saveConfigToBackend();
            });
        });
        const customPortInput = document.getElementById('customPortInput');
        if (customPortInput) {
            customPortInput.addEventListener('change', function() {
                customPort = this.value ? parseInt(this.value) : 8080;
                saveConfigToBackend();
            });
        }

        await refreshKeyList();
    }

    async function refreshKeyList() {
        const container = $('keyListContainer');
        if (!container || !currentProvider) return;
        const keys = await loadProviderKeys(currentProvider);
        container.innerHTML = '';
        keys.forEach((mask, idx) => {
            const row = document.createElement('div');
            row.className = 'key-row';
            row.innerHTML = `<span class="key-mask">${mask}</span><input class="key-edit-input" value="" style="display:none;">
            <div class="key-actions">
                <button title="使用"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
                <button title="修改"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button title="删除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>
            </div>`;
            const editInput = row.querySelector('.key-edit-input');
            row.querySelector('[title="使用"]').onclick = async () => {
                if (await useProviderKey(currentProvider, idx)) {
                    showToast('已切换密钥');
                    await loadModels(currentProvider);
                    await refreshKeyList();
                }
            };
            row.querySelector('[title="修改"]').onclick = () => {
                row.classList.add('edit');
                editInput.value = '';
                editInput.focus();
                const confirmEdit = async () => {
                    const newKey = editInput.value.trim();
                    if (newKey) {
                        if ((await deleteProviderKey(currentProvider, idx)) && (await addProviderKey(
                                currentProvider, newKey))) {
                            showToast('密钥已更新');
                            await refreshKeyList();
                        }
                    }
                    row.classList.remove('edit');
                };
                editInput.onkeydown = e => { if (e.key === 'Enter') confirmEdit(); };
                editInput.onblur = () => { setTimeout(() => { if (row.classList.contains('edit')) confirmEdit(); },
                    100); };
            };
            row.querySelector('[title="删除"]').onclick = async () => {
                if (confirm('确认删除？')) {
                    if (await deleteProviderKey(currentProvider, idx)) {
                        showToast('已删除');
                        await refreshKeyList();
                    }
                }
            };
            container.appendChild(row);
        });
    }

    function renderMarkdown(text) {
    if (typeof marked === 'undefined') return escapeHtml(text).replace(/\n/g, '<br>');
    const renderer = new marked.Renderer();
    renderer.code = function({ text: codeText, lang }) {
        const escapedCode = escapeHtml(codeText || '');
        const displayLang = lang || 'code';
        const safeLang = displayLang.toLowerCase();
        
        // 生成唯一 ID 备用
        const blockId = 'cb_' + Math.random().toString(36).substring(2, 10);
        
        return `
<div class="_121d384" data-block-id="${blockId}">
    <div class="d2a24f03">
        <span class="d813de27">${escapeHtml(displayLang)}</span>
    </div>
    <div class="d2a24f03 _246a029">
        <div class="efa13877">
            <!-- 复制按钮 -->
            <button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right: 4px;" onclick="(function(btn){
                var wrapper = btn.closest('._121d384');
                var pre = wrapper && wrapper.nextElementSibling;
                var codeEl = pre && pre.querySelector('code');
                if(codeEl && codeEl.textContent) {
                    navigator.clipboard.writeText(codeEl.textContent).then(function(){ window.showToast('已复制代码'); });
                } else { window.showToast('❌ 无法获取代码'); }
            })(this)">
                <div class="ds-icon ds-atom-button__icon" style="font-size:16px;width:16px;height:16px;margin-right:3px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.14929 4.02032C7.11197 4.02032 7.87983 4.02016 8.49597 4.07598C9.12128 4.13269 9.65792 4.25188 10.1415 4.53106C10.7202 4.8653 11.2008 5.3459 11.535 5.92462C11.8142 6.40818 11.9334 6.94481 11.9901 7.57012C12.0459 8.18625 12.0458 8.95419 12.0458 9.9168C12.0458 10.8795 12.0459 11.6473 11.9901 12.2635C11.9334 12.8888 11.8142 13.4254 11.535 13.909C11.2008 14.4877 10.7202 14.9683 10.1415 15.3025C9.65792 15.5817 9.12128 15.7009 8.49597 15.7576C7.87984 15.8134 7.11196 15.8133 6.14929 15.8133C5.18667 15.8133 4.41874 15.8134 3.80261 15.7576C3.1773 15.7009 2.64067 15.5817 2.1571 15.3025C1.5784 14.9683 1.09778 14.4877 0.76355 13.909C0.484366 13.4254 0.365184 12.8888 0.308472 12.2635C0.252649 11.6473 0.252808 10.8795 0.252808 9.9168C0.252808 8.95418 0.252664 8.18625 0.308472 7.57012C0.365184 6.94481 0.484366 6.40818 0.76355 5.92462C1.09777 5.34589 1.57839 4.86529 2.1571 4.53106C2.64067 4.25188 3.1773 4.13269 3.80261 4.07598C4.41874 4.02017 5.18666 4.02032 6.14929 4.02032ZM6.14929 5.37774C5.16181 5.37774 4.46634 5.37761 3.92566 5.42657C3.39434 5.47472 3.07859 5.56574 2.83582 5.70587C2.4632 5.92106 2.15354 6.2307 1.93835 6.60333C1.79823 6.8461 1.70721 7.16185 1.65906 7.69317C1.6101 8.23385 1.61023 8.92933 1.61023 9.9168C1.61023 10.9043 1.61009 11.5998 1.65906 12.1404C1.70721 12.6717 1.79823 12.9875 1.93835 13.2303C2.15356 13.6029 2.46321 13.9126 2.83582 14.1277C3.07859 14.2679 3.39434 14.3589 3.92566 14.407C4.46634 14.456 5.16182 14.4559 6.14929 14.4559C7.13682 14.4559 7.83224 14.456 8.37292 14.407C8.90425 14.3589 9.21999 14.2679 9.46277 14.1277C9.83535 13.9126 10.145 13.6029 10.3602 13.2303C10.5004 12.9875 10.5914 12.6717 10.6395 12.1404C10.6885 11.5998 10.6884 10.9043 10.6884 9.9168C10.6884 8.92934 10.6885 8.23384 10.6395 7.69317C10.5914 7.16185 10.5004 6.8461 10.3602 6.60333C10.1451 6.23071 9.83536 5.92107 9.46277 5.70587C9.21999 5.56574 8.90424 5.47472 8.37292 5.42657C7.83224 5.3776 7.13682 5.37774 6.14929 5.37774ZM9.80164 0.367975C10.7638 0.367975 11.5314 0.36788 12.1473 0.423639C12.7726 0.480307 13.3093 0.598759 13.7928 0.877741C14.3717 1.21192 14.8521 1.69355 15.1864 2.27227C15.4655 2.75574 15.5857 3.29164 15.6425 3.9168C15.6983 4.53301 15.6971 5.3016 15.6971 6.26446V7.82989C15.6971 8.29264 15.6989 8.58993 15.6649 8.84844C15.4668 10.3525 14.401 11.5738 12.9833 11.9988V10.5467C13.6973 10.1903 14.2105 9.49662 14.3192 8.67169C14.3387 8.52347 14.3407 8.3358 14.3407 7.82989V6.26446C14.3407 5.27706 14.3398 4.58149 14.2909 4.04083C14.2428 3.50968 14.1526 3.19372 14.0126 2.95098C13.7974 2.57849 13.4876 2.26869 13.1151 2.05352C12.8724 1.91347 12.5564 1.82237 12.0253 1.77423C11.4847 1.72528 10.7888 1.7254 9.80164 1.7254H7.71472C6.7562 1.72558 5.92665 2.27697 5.52332 3.07891H4.07019C4.54221 1.51132 5.9932 0.368186 7.71472 0.367975H9.80164Z" fill="currentColor"/>
                    </svg>
                </div>
                <span>复制</span>
            </button>
            <!-- 下载按钮 -->
            <button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right: 4px;" onclick="(function(btn){
                var wrapper = btn.closest('._121d384');
                var pre = wrapper && wrapper.nextElementSibling;
                var codeEl = pre && pre.querySelector('code');
                var langSpan = wrapper && wrapper.querySelector('.d813de27');
                var lang = langSpan ? langSpan.textContent.trim() : 'txt';
                if(codeEl && codeEl.textContent) {
                    try {
                        var blob = new Blob([codeEl.textContent], { type: 'text/plain;charset=utf-8' });
                        var url = (window.URL || window.webkitURL).createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'code.' + (lang || 'txt');
                        document.body.appendChild(a);
                        a.click();
                        (window.URL || window.webkitURL).revokeObjectURL(url);
                        a.remove();
                        window.showToast('下载完成');
                    } catch(err) {
                        window.showToast('❌ 下载失败: ' + err.message);
                    }
                } else { window.showToast('❌ 无法获取代码'); }
            })(this)">
                <div class="ds-icon ds-atom-button__icon" style="font-size:16px;width:16px;height:16px;margin-right:3px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.3695 11.411L15.1234 12.8866C14.8869 14.3042 13.6603 15.3436 12.223 15.3436H3.77673C2.33958 15.3434 1.1128 14.3042 0.876343 12.8866L0.630249 11.411L2.05408 11.1747L2.29919 12.6493C2.41973 13.3713 3.04475 13.9001 3.77673 13.9003H12.223C12.9551 13.9002 13.58 13.3713 13.7006 12.6493L13.9457 11.1747L15.3695 11.411ZM8.72205 8.994C8.77717 8.93934 8.83792 8.88106 8.90271 8.81627L12.4828 5.23424L13.5043 6.25572L9.92224 9.8358C9.6395 10.1185 9.38763 10.3732 9.15857 10.5575C8.91892 10.7503 8.63953 10.9224 8.2865 10.9784C8.09711 11.0083 7.90363 11.0083 7.71423 10.9784C7.36106 10.9224 7.0809 10.7503 6.84119 10.5575C6.61215 10.3732 6.36022 10.1185 6.07751 9.8358L2.49646 6.25572L3.51697 5.23424L7.09705 8.81627C7.16219 8.88142 7.22331 8.94006 7.27869 8.99498V1.3065H8.72205V8.994Z" fill="currentColor"/>
                    </svg>
                </div>
                <span>下载</span>
            </button>
            <!-- 运行按钮 -->
            <button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right: 4px;" onclick="(function(btn){
                var wrapper = btn.closest('._121d384');
                var pre = wrapper && wrapper.nextElementSibling;
                var codeEl = pre && pre.querySelector('code');
                var langSpan = wrapper && wrapper.querySelector('.d813de27');
                var lang = langSpan ? langSpan.textContent.trim().toLowerCase() : '';
                if(codeEl && codeEl.textContent) {
                    try {
                        if (lang === 'javascript' || lang === 'js') {
                            eval(codeEl.textContent);
                            window.showToast('运行成功');
                        } else if (lang === 'html') {
                            var blob = new Blob([codeEl.textContent], { type: 'text/html' });
                            var url = (window.URL || window.webkitURL).createObjectURL(blob);
                            window.open(url);
                            window.showToast('已打开 HTML 页面');
                        } else {
                            window.showToast('⚠️ 仅支持 JavaScript / HTML 代码运行');
                        }
                    } catch(err) {
                        window.showToast('❌ 运行错误: ' + err.message);
                    }
                } else {
                    window.showToast('❌ 无法获取代码');
                }
            })(this)">
                <div class="ds-icon ds-atom-button__icon" style="font-size:16px;width:16px;height:16px;margin-right:3px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.1446 8C14.1446 4.6062 11.3938 1.85539 8 1.85539C4.6062 1.85539 1.85539 4.6062 1.85539 8C1.85539 11.3938 4.6062 14.1446 8 14.1446C11.3938 14.1446 14.1446 11.3938 14.1446 8ZM15.511 8C15.511 12.148 12.148 15.511 8 15.511C3.85202 15.511 0.489014 12.148 0.489014 8C0.489014 3.85202 3.85202 0.489014 8 0.489014C12.148 0.489014 15.511 3.85202 15.511 8Z" fill="currentColor"/>
                        <path d="M10.5617 8.42578C10.852 8.21614 10.852 7.78386 10.5617 7.57422L7.25708 5.18751C6.90974 4.93666 6.42436 5.18484 6.42436 5.61329V10.3867C6.42436 10.8152 6.90974 11.0633 7.25708 10.8125L10.5617 8.42578Z" fill="currentColor"/>
                    </svg>
                </div>
                <span>运行</span>
            </button>
            <!-- 存储到库按钮（新增） -->
            <button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right: 4px;" onclick="(function(btn){
                var wrapper = btn.closest('._121d384');
                var pre = wrapper && wrapper.nextElementSibling;
                var codeEl = pre && pre.querySelector('code');
                var langSpan = wrapper && wrapper.querySelector('.d813de27');
                var lang = langSpan ? langSpan.textContent.trim() : 'txt';
                if(codeEl && codeEl.textContent) {
                    window.saveCodeBlockToStorage(codeEl.textContent, lang);
                } else {
                    window.showToast('❌ 无法获取代码');
                }
            })(this)">
                <div class="ds-icon ds-atom-button__icon" style="font-size:16px;width:16px;height:16px;margin-right:3px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 6.5L8 11L3.5 6.5M8 10.5V0.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        <path d="M14 11V14H2V11" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    </svg>
                </div>
                <span>存储</span>
            </button>
            <div class="ae809fef"></div>
        </div>
    </div>
</div>
<pre><code class="language-${escapeHtml(displayLang)}">${escapedCode}</code></pre>`;
    };
    return marked.parse(text, { renderer });
}

    function createThinkBlock(reasoning) {
        return `<div class="think-block" style="margin-left: -12px;">
        <div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div class="think-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" fill="currentColor"></path>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z" fill="currentColor"></path>
                </svg>
            </div>
            <span>已深度思考</span>
            <div class="think-arrow">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"></path>
                </svg>
            </div>
        </div>
        <div class="think-body-wrapper">
            <div class="think-line"></div>
            <div class="think-content">${reasoning.replace(/\n/g, '<br>')}</div>
        </div>
    </div>`;
    }

    function createMessageBubble(content, role, images = [], reasoning = null, msgRef = null, cotHtml = '') {
        const bubble = document.createElement('div');
        const roleClass = role === 'system' ? 'system' : (role === 'user' ? 'user' : 'ai');
        bubble.className = 'message-bubble message-' + roleClass;
        let reasoningHtml = reasoning ? createThinkBlock(reasoning) : '';
        let contentHtml;
        if (role === 'ai') {
            contentHtml = renderMarkdown(content);
        } else if (role === 'system') {
            contentHtml = `<div class="markdown-body system-message">${renderMarkdown(content)}</div>`;
        } else {
            contentHtml = `<div class="markdown-body">${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
        }
        bubble.innerHTML = cotHtml + reasoningHtml + contentHtml;

        if (images && images.length) {
            const imgContainer = document.createElement('div');
            images.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                img.style.marginTop = '8px';
                imgContainer.appendChild(img);
            });
            bubble.appendChild(imgContainer);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        if (role === 'system') {
            actionsDiv.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>`;
        } else if (role === 'user') {
            actionsDiv.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>`;
        } else {
            actionsDiv.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="regenerate" title="重新生成"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        <button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>
        <button class="action-icon" data-action="tokens" title="Token消耗"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
        <button class="action-icon" data-action="apijson" title="API请求JSON"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>`;
        }
        bubble.appendChild(actionsDiv);

        actionsDiv.querySelector('[data-action="copy"]').onclick = () =>
            navigator.clipboard.writeText(content).then(() => showToast('已复制'));

        actionsDiv.querySelector('[data-action="delete"]').onclick = () => {
            if (msgRef) {
                const idx = chats[currentChat].indexOf(msgRef);
                if (idx !== -1) chats[currentChat].splice(idx, 1);
            }
            bubble.remove();
            saveChatToBackend();
        };

        if (role === 'user') {
            const editBtn = actionsDiv.querySelector('[data-action="edit"]');
            if (editBtn) editBtn.onclick = () => {
                const originalText = content;
                const textarea = document.createElement('textarea');
                textarea.value = originalText;
                textarea.setAttribute('rows', '3');
                textarea.style.cssText =
                    'width:100%; min-height:120px; border:1px solid #ccc; border-radius:12px; padding:12px; font-size:15px; font-family:inherit; line-height:1.55; resize:vertical; background:#fff; box-sizing:border-box; margin:0;';
                const originalInnerHTML = bubble.innerHTML;
                const origStyle = {
                    width: bubble.style.width,
                    maxWidth: bubble.style.maxWidth,
                    backgroundColor: bubble.style.backgroundColor,
                    borderRadius: bubble.style.borderRadius
                };
                bubble.innerHTML = '';
                bubble.style.maxWidth = '100%';
                bubble.style.width = '100%';
                bubble.style.backgroundColor = 'var(--bubble-user)';
                bubble.style.borderRadius = '18px 18px 6px 18px';
                bubble.appendChild(textarea);
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);

                const saveEdit = () => {
                    const newContent = textarea.value.trim();
                    if (newContent && newContent !== originalText) {
                        bubble.style.maxWidth = origStyle.maxWidth || '';
                        bubble.style.width = origStyle.width || '';
                        bubble.style.backgroundColor = origStyle.backgroundColor || '';
                        bubble.style.borderRadius = origStyle.borderRadius || '';
                        bubble.innerHTML =
                            `<div class="markdown-body">${escapeHtml(newContent).replace(/\n/g, '<br>')}</div>`;
                        if (msgRef) msgRef.content = newContent;
                        saveChatToBackend();
                        const newActionsDiv = document.createElement('div');
                        newActionsDiv.className = 'message-actions';
                        newActionsDiv.innerHTML =
                            `<button class="action-icon" data-action="copy" title="复制">…</button><button class="action-icon" data-action="edit" title="修改">…</button><button class="action-icon" data-action="delete" title="删除">…</button>`;
                        bubble.appendChild(newActionsDiv);
                    } else if (!newContent) {
                        bubble.remove();
                        if (msgRef) {
                            const idx = chats[currentChat].indexOf(msgRef);
                            if (idx !== -1) {
                                chats[currentChat].splice(idx, 1);
                                saveChatToBackend();
                            }
                        }
                    } else {
                        Object.assign(bubble.style, origStyle);
                        bubble.innerHTML = originalInnerHTML;
                    }
                };
                textarea.onblur = () => setTimeout(saveEdit, 200);
                textarea.onkeydown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                    }
                    if (e.key === 'Escape') {
                        Object.assign(bubble.style, origStyle);
                        bubble.innerHTML = originalInnerHTML;
                    }
                };
            };
        }

        if (role === 'ai') {
            const regenBtn = actionsDiv.querySelector('[data-action="regenerate"]');
            if (regenBtn) regenBtn.onclick = () => {
                if (msgRef) {
                    const idx = chats[currentChat].indexOf(msgRef);
                    if (idx !== -1) chats[currentChat].splice(idx, 1);
                }
                bubble.remove();
                sendMessage(true);
            };

            const editBtn = actionsDiv.querySelector('[data-action="edit"]');
            if (editBtn) editBtn.onclick = () => {
                const contentDiv = bubble.querySelector('.markdown-body') || bubble;
                if (!contentDiv) {
                    showToast('无法编辑此消息');
                    return;
                }
                const originalText = content;
                const originalInnerHTML = bubble.innerHTML;
                contentDiv.innerHTML =
                    `<textarea style="width:100%; min-height:120px; border:1px solid #ccc; border-radius:12px; padding:12px; font-size:15px; font-family:inherit; line-height:1.55; resize:vertical; background:#fff; box-sizing:border-box; margin:0;">${escapeHtml(originalText)}</textarea>`;
                const textarea = contentDiv.querySelector('textarea');
                textarea.focus();

                let editCancelled = false;

                const saveEdit = () => {
                    if (editCancelled) return;
                    const newContent = textarea.value;
                    contentDiv.innerHTML = renderMarkdown(newContent);
                    if (msgRef) msgRef.content = newContent;
                    saveChatToBackend();
                };

                textarea.onblur = () => {
                    setTimeout(() => {
                        if (!editCancelled) saveEdit();
                    }, 100);
                };
                textarea.onkeydown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                    }
                    if (e.key === 'Escape') {
                        editCancelled = true;
                        bubble.innerHTML = originalInnerHTML;
                    }
                };
            };

            // Token 消耗按钮
            const tokensBtn = actionsDiv.querySelector('[data-action="tokens"]');
            if (tokensBtn) tokensBtn.onclick = () => {
                const tokenData = msgRef?.usage;
                if (!tokenData) {
                    showToast('此消息没有 Token 消耗数据');
                    return;
                }
                const inputTokens = tokenData.prompt_tokens || tokenData.input_tokens || 0;
                const outputTokens = tokenData.completion_tokens || tokenData.output_tokens || 0;
                const totalTokens = tokenData.total_tokens || (inputTokens + outputTokens);
                const text = `Token 消耗详情\n\n输入 Token (prompt): ${inputTokens}\n输出 Token (completion): ${outputTokens}\n总计 Token: ${totalTokens}\n\n模型: ${currentModel}\n时间: ${new Date().toLocaleString()}`;
                if (window.saveAndShowText) {
                    window.saveAndShowText('token_usage', text);
                } else {
                    openFileViewer('Token 消耗', text);
                }
            };

            // API 请求 JSON 按钮
            const apijsonBtn = actionsDiv.querySelector('[data-action="apijson"]');
            if (apijsonBtn) apijsonBtn.onclick = () => {
                const reqData = msgRef?.apiRequest;
                if (!reqData) {
                    showToast('此消息没有 API 请求数据');
                    return;
                }
                const jsonStr = JSON.stringify(reqData, null, 2);
                const text = `API 请求 JSON\n\n模型: ${currentModel}\n提供商: ${currentProvider}\n格式: ${currentChatFormat}\n时间: ${new Date().toLocaleString()}\n\n${jsonStr}`;
                if (window.saveAndShowText) {
                    window.saveAndShowText('api_request', text);
                } else {
                    openFileViewer('API 请求 JSON', text);
                }
            };
        }

        return bubble;
    }

    function addMessage(content, role, images = [], reasoning = null, msgRef = null) {
        if (!chatAreaInner) return null;
        const bubble = createMessageBubble(content, role, images, reasoning, msgRef);
        chatAreaInner.appendChild(bubble);
        if (emptyHint) emptyHint.style.display = 'none';
        chatArea.scrollTop = chatArea.scrollHeight;
        return bubble;
    }

    // 过滤工具调用行和思维链结束标记（不显示给用户）
    function stripToolLines(text) {
        let t = text.replace(/\[判断需求\][\s\S]*?\[处理需求\]/g, '');
        t = t.replace(/^Output:end$/gm, '');
        return t.split('\n')
            .filter(l => {
                const trim = l.trim();
                return !trim.startsWith('tool:') && !/^(Power\d+|cmd\d+):/i.test(trim);
            })
            .join('\n')
            .trim();
    }

    // 解析并执行工具调用
    async function processToolCalls(responseText) {
        if (!/tool:CommandExecution/i.test(responseText)) return false;

        const commands = [];
        const powerRe = /Power(\d+):\s*([^\n]+?)(?=\s*(?:Power\d+|cmd\d+:|$))/gi;
        const cmdRe = /cmd(\d+):\s*([^\n]+?)(?=\s*(?:Power\d+|cmd\d+:|$))/gi;
        let m;
        while ((m = powerRe.exec(responseText)) !== null) {
            commands.push({ shell: 'powershell', command: m[2].trim(), idx: parseInt(m[1]) });
        }
        while ((m = cmdRe.exec(responseText)) !== null) {
            commands.push({ shell: 'cmd', command: m[2].trim(), idx: parseInt(m[1]) });
        }
        if (!commands.length) return false;

        commands.sort((a, b) => a.idx - b.idx);
        const dangerous = [/rm\s+-rf/i, /format\s+\w/i, /del\s+\/f/i, /rd\s+\/s/i, /shutdown/i, /restart-computer/i, /stop-computer/i];
        let executed = false;

        for (const { shell, command } of commands) {
            if (dangerous.some(p => p.test(command))) {
                const msg = { role: 'system', content: `⚠️ 危险命令已被拦截: ${command}`, images: [] };
                chats[currentChat].push(msg);
                addMessage(msg.content, 'system', [], null, msg);
                continue;
            }
            if (commandConfirmEnabled && window.CommandExecutionPlugin) {
                try { if (!(await window.CommandExecutionPlugin.confirmCommand(shell, command))) {
                    const msg = { role: 'system', content: `❌ 命令已取消: ${shell} ${command}`, images: [] };
                    chats[currentChat].push(msg);
                    addMessage(msg.content, 'system', [], null, msg);
                    continue;
                }} catch (e) { continue; }
            }
            executed = true;
            const execMsg = { role: 'system', content: `⏳ 执行中: ${shell}> ${command}`, images: [] };
            chats[currentChat].push(execMsg);
            const execBubble = addMessage(execMsg.content, 'system', [], null, execMsg);
            try {
                const res = await fetch('/api/plugin/command/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shell, command, timeout: 30000 })
                });
                if (res.ok) {
                    const d = await res.json();
                    const out = (d.stdout || d.stderr || '').trim();
                    const resultText = `${out ? out.substring(0, 2000) : '(无输出)'}\n退出码: ${d.exitCode}`;
                    // 更新气泡内容
                    const sysMsg = { role: 'system', content: `[命令结果] ${shell}> ${command}\n${resultText}`, images: [] };
                    const idx = chats[currentChat].indexOf(execMsg);
                    if (idx !== -1) chats[currentChat][idx] = sysMsg;
                    execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
                } else {
                    const e = await res.text();
                    const sysMsg = { role: 'system', content: `❌ 命令失败: ${shell}> ${command}\n${e}`, images: [] };
                    const idx = chats[currentChat].indexOf(execMsg);
                    if (idx !== -1) chats[currentChat][idx] = sysMsg;
                    execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
                }
            } catch (e) {
                const sysMsg = { role: 'system', content: `❌ 命令异常: ${shell}> ${command}\n${e.message}`, images: [] };
                const idx = chats[currentChat].indexOf(execMsg);
                if (idx !== -1) chats[currentChat][idx] = sysMsg;
                execBubble.replaceWith(createMessageBubble(sysMsg.content, 'system', [], null, sysMsg));
            }
        }
        saveChatToBackend();
        return executed;
    }

    // DeepSeek要求: 只能有一条system消息，且必须在最前面
    function reorderMessages(msgs) {
        const sys = msgs.filter(m => m.role === 'system');
        const others = msgs.filter(m => m.role !== 'system');
        if (sys.length <= 1) return [...sys, ...others];
        return [{ role: 'system', content: sys.map(m => m.content).join('\n\n') }, ...others];
    }

    async function callAPI(messages) {
    if (!currentModel) throw new Error('未选择模型');

    // 生成唯一请求 ID
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    const payload = {
        messages,
        provider: currentProvider,
        model: currentModel,
        chatFormat: currentChatFormat,
        ...currentParams,
        stream: true,
        requestId: requestId  // 👈 传给后端
    };

    if (currentThinkMode === 'deep') payload.deep_think = true;
    else if (currentThinkMode === 'direct' || currentThinkMode === 'reason') payload.chat_template_kwargs = { enable_thinking: false };

    currentAbortController = new AbortController();
    const controller = currentAbortController;

    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
    });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }
        return { body: res.body, apiRequest: payload };
    }

    async function sendMessage(isRegenerate = false) {
    // 如果正在流式输出，不允许再次发送，除非是重新生成
    if (streaming && !isRegenerate) return;
    if (streaming && isRegenerate) {
        // 先停止当前流
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
        streaming = false;
        updateSendBtn();
    }

    if (!currentModel) {
        showToast('请先选择模型');
        return;
    }

    // 处理新对话创建逻辑（保持原有）
    if (pendingNewChatIndex !== null && currentChat === pendingNewChatIndex) {
        try {
            const res = await fetch('/api/chats', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                const realId = data.id;
                chats.splice(pendingNewChatIndex, 1);
                chatTitles.splice(pendingNewChatIndex, 1);
                while (chats.length <= realId) {
                    chats.push([]);
                    chatTitles.push('');
                }
                chats[realId] = [];
                chatTitles[realId] = '新对话';
                currentChat = realId;
                pendingNewChatIndex = null;
            } else {
                pendingNewChatIndex = null;
            }
        } catch (e) {
            pendingNewChatIndex = null;
        }
    }

    const ta = isChatActive ? chatText : initText;
    const target = isChatActive ? 'chat' : 'initial';
    let userText = ta.value.trim();
    const textFiles = activeFiles[target].filter(f => f.type === 'text');
    const imgs = activeFiles[target].filter(f => f.type === 'image').map(f => f.content);

    if (!isRegenerate && !userText && !imgs.length && !textFiles.length) return;

    if (!isChatActive) {
        await newChat();
    }

    // 构建用户消息
    if (!isRegenerate) {
        let displayContent = userText || '';
        if (!displayContent && imgs.length) {
            displayContent = '图片';
        }
        const userMsg = {
            role: 'user',
            content: userText || (imgs.length ? '图片' : ''),
            images: imgs
        };
        chats[currentChat].push(userMsg);
        saveChatToBackend();

        // 处理文本文件在界面上的展示（保持原有逻辑）
        if (textFiles.length > 0) {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-bottom:6px;';
            textFiles.forEach(f => {
                const ext = f.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                const sizeStr = f.content ? `${ext} ${(new Blob([f.content]).size / 1024).toFixed(2)}KB` : ext;
                const card = document.createElement('div');
                card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bubble-user);border-radius:12px;width:160px;cursor:pointer;flex-shrink:0;';
                card.onclick = () => openFileViewer(f.fileName, f.content);
                card.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 28" fill="none" style="flex-shrink:0;">
                        <path d="M16.5 0l7 7v15.6c0 2.25 0 3.375-.573 4.164a3 3 0 0 1-.663.663C21.475 28 20.349 28 18.1 28H5.9c-2.25 0-3.375 0-4.164-.573a3 3 0 0 1-.663-.663C.5 25.975.5 24.849.5 22.6V5.4c0-2.25 0-3.375.573-4.164a3 3 0 0 1 .663-.663C2.525 0 3.651 0 5.9 0h10.6z" fill="url(#grad-${f.fileName})"/>
                        <path d="M16.5 0l7 7h-3.8c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C16.5 5.48 16.5 4.92 16.5 3.8V0z" fill="#fff" fill-opacity=".55"/>
                        <path d="M6 11.784c0-.433.351-.784.784-.784h10.432a.784.784 0 1 1 0 1.568H6.784A.784.784 0 0 1 6 11.784zM6 15.784c0-.433.351-.784.784-.784h10.432a.784.784 0 1 1 0 1.568H6.784A.784.784 0 0 1 6 15.784zM6.114 19.817c0-.433.35-.784.784-.784h6.318a.784.784 0 1 1 0 1.568H6.898a.784.784 0 0 1-.784-.784z" fill="#fff"/>
                        <defs><linearGradient id="grad-${f.fileName}" x1="1.5" y1="-1" x2="23.5" y2="28"><stop stop-color="#6D93FF"/><stop offset="1" stop-color="#5A71F0"/></linearGradient></defs>
                    </svg>
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.fileName)}</div>
                        <div style="font-size:11px;color:var(--dsw-alias-label-secondary);">${sizeStr}</div>
                    </div>
                `;
                grid.appendChild(card);
            });
            chatAreaInner.appendChild(grid);
        }

        addMessage(displayContent, 'user', imgs, null, userMsg);

        // 文本文件作为系统消息附加到聊天记录中
        if (textFiles.length) {
            textFiles.forEach(f => {
                chats[currentChat].push({
                    role: 'system',
                    content: `[文件: ${f.fileName}]\n${f.content}`
                });
            });
        }

        // 清空输入框和附件
        ta.value = '';
        activeFiles[target] = [];
        renderPreviews(isChatActive ? chatPreview : initPreview, []);
        updateSendBtn();
    }

    // 开始流式获取
    streaming = true;
    isUserScrolledAway = false;  // 新输出开始时，重新跟随视角
    updateSendBtn();

    const reasonSteps = getReasonSteps();
    const isReasonMode = false;

    let fullContent = '';
    let fullReasoning = '';

    if (isReasonMode) {
        // ===== 推理模式：三段式调用（流式，与深度思考同款样式） =====
        const ts = Date.now();
        const reasonContainer = document.createElement('div');
        reasonContainer.className = 'reasoning-container';

        // 为每个步骤创建 think-block 样式的可折叠块
        for (let i = 0; i < reasonSteps.length; i++) {
            const step = reasonSteps[i];
            const block = document.createElement('div');
            block.className = 'think-block';
            block.style.margin = '2px 0';
            block.innerHTML = `
                <div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <div class="think-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" fill="currentColor"></path>
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <span>${step.label}</span>
                    <span class="think-status" id="reason-status-${ts}-${i}">推理中...</span>
                    <div class="think-arrow">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
                <div class="think-body-wrapper">
                    <div class="think-line"></div>
                    <div class="think-content" id="reason-content-${ts}-${i}"></div>
                </div>
            `;
            reasonContainer.appendChild(block);
        }

        const bubble = addMessage('', 'ai', [], null, null);
        bubble.innerHTML = '';
        bubble.style.maxWidth = '100%';
        bubble.style.width = '100%';
        bubble.style.background = 'transparent';
        bubble.style.borderRadius = '0';
        bubble.appendChild(reasonContainer);

        try {
            const msgs = chats[currentChat]
                .filter(m => m.role)
                .map(m => ({ role: m.role, content: m.content, images: m.images || [] }));

            const stepResults = [];

            for (let i = 0; i < reasonSteps.length; i++) {
                const step = reasonSteps[i];
                const contentDiv = document.getElementById(`reason-content-${ts}-${i}`);
                const statusEl = document.getElementById(`reason-status-${ts}-${i}`);
                if (contentDiv) contentDiv.innerHTML = '';
                let stepContent = '';

                // 构建消息：用户输出为 {Svotye_system} 占位符，提示词追加分析指令
                const stepSystemPrompt = step.system_prompt + '，重点分析占位符最前一位的非系统占位符的用户输出';
                const stepMsgs = [
                    { role: 'system', content: stepSystemPrompt, images: [] },
                    ...msgs.map(m => ({ ...m })),
                    { role: 'user', content: '{Svotye_system}', images: [] },
                ];
                for (let j = 0; j < i; j++) {
                    if (stepResults[j]) {
                        stepMsgs.push({ role: 'assistant', content: stepResults[j], images: [] });
                    }
                }

                const callResult = await callAPI(stepMsgs);
                const stream = callResult.body;

                const decoder = new TextDecoder();
                const reader = stream.getReader();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6);
                            if (data === '[DONE]') continue;
                            try {
                                const json = JSON.parse(data);
                                const delta = json.choices?.[0]?.delta;
                                if (delta && delta.content !== undefined && delta.content !== null) {
                                    let contentPart = '';
                                    const c = delta.content;
                                    if (typeof c === 'string') {
                                        contentPart = c;
                                    } else if (Array.isArray(c)) {
                                        for (let k = 0; k < c.length; k++) {
                                            const item = c[k];
                                            if (typeof item === 'string') contentPart += item;
                                            else if (item?.text) contentPart += item.text;
                                        }
                                    } else if (typeof c === 'object' && c?.text) {
                                        contentPart = c.text;
                                    }
                                    if (contentPart) {
                                        stepContent += contentPart;
                                        if (contentDiv) contentDiv.innerHTML = renderMarkdown(stepContent);
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                    if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
                }

                stepResults.push(stepContent);
                if (contentDiv) contentDiv.innerHTML = renderMarkdown(stepContent);
                if (statusEl) statusEl.textContent = '✓ 完成';
            }

            // 保存结果
            const combined = stepResults.join('\n\n');
            const assistantMsg = { role: 'assistant', content: combined, reasoning: null };
            chats[currentChat].push(assistantMsg);
            updateHistoryTitle();
            saveChatToBackend();

        } catch (e) {
            if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
                // 不做额外处理
            } else {
                // 标记最后一个未完成的步骤为失败
                for (let i = 0; i < reasonSteps.length; i++) {
                    const statusEl = document.getElementById(`reason-status-${ts}-${i}`);
                    if (statusEl && statusEl.textContent === '推理中...') {
                        statusEl.textContent = '❌ 失败';
                    }
                }
                console.error(e);
            }
        } finally {
            streaming = false;
            currentAbortController = null;
            updateSendBtn();
        }
        return;
    }

    const bubble = addMessage('思考中...', 'ai', [], null, null);
    try {
        const msgs = chats[currentChat]
            .filter(m => m.role)
            .map(m => ({
                role: m.role,
                content: m.content,
                images: m.images || []
            }));

        // 告知 AI 工具能力
        if (commandExecEnabled) {
            const toolHint = msgs.find(m => m.role === 'system' && m.content.includes('[工具调用能力]'));
            if (!toolHint) {
                msgs.unshift({
                    role: 'system',
                    content: `[工具调用能力]\n你可以主动调用系统命令执行工具来完成用户的需求。\n\n调用格式:\ntool:CommandExecution\nPower1:具体的PowerShell命令\n或\ncmd1:具体的CMD命令\n\n多条命令用递增编号:Power1,Power2... 或 cmd1,cmd2...\n命令会按编号顺序执行。\n在执行前系统会自动进行安全检查。\n\n用户看不到这些工具调用指令，请在需要时主动使用。`,
                    images: []
                });
            }
        }

        // 告知 AI 追加输出能力
        if (appendOutputEnabled) {
            const appendHint = msgs.find(m => m.role === 'system' && m.content.includes('[追加输出]'));
            if (!appendHint) {
                msgs.unshift({
                    role: 'system',
                    content: `[追加输出]\n你可以使用 {Svotye_system} 占位符来分段追加输出。\n\n当一次输出因长度限制需要继续时，在输出的末尾加上 {Svotye_system} 标记。\n系统会自动将用户消息替换为占位符，让你从上次结束的地方继续输出。\n\n使用方式：在输出末尾单独一行写上 {Svotye_system}\n系统会自动追加后续输出，最多可追加3次。`,
                    images: []
                });
            }
        }

        let cotAnalysisHtml = '';
        let cotAnalysisText = '';

        if (chainOfThoughtEnabled) {
            try {
                const userMsgs = msgs.filter(m => m.role === 'user').slice(-2);
                const ph1Body = {
                    messages: [
                        { role: 'system', content: '判断需求:分析用户需求需几步,每步细节,100字内。直接输出分析。', images: [] },
                        ...userMsgs
                    ],
                    provider: currentProvider,
                    model: currentModel,
                    chatFormat: currentChatFormat,
                    max_tokens: 200,
                    temperature: 0.3,
                    stream: true
                };
                if (currentThinkMode === 'deep') ph1Body.deep_think = true;
                const ph1Res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ph1Body)
                });
                if (ph1Res.ok) {
                    const cotBlockStart = `<div class="think-block" style="margin-left: -12px;">
                        <div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
                            <div class="think-icon">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z" fill="currentColor"/></svg>
                            </div>
                            <span>思维链分析</span>
                            <div class="think-arrow"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"/></svg></div>
                        </div>
                        <div class="think-body-wrapper">
                            <div class="think-line"></div>
                            <div class="think-content" id="cot-stream-content"></div>
                        </div>
                    </div>`;
                    bubble.innerHTML = cotBlockStart + '<div class="markdown-body">处理中...</div>';

                    const ph1Reader = ph1Res.body.getReader();
                    const ph1Decoder = new TextDecoder();
                    let ph1Buffer = '';

                    while (true) {
                        const { done, value } = await ph1Reader.read();
                        if (done) break;
                        ph1Buffer += ph1Decoder.decode(value, { stream: true });
                        const lines = ph1Buffer.split('\n');
                        ph1Buffer = lines.pop() || '';
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.substring(6);
                                if (data === '[DONE]') continue;
                                try {
                                    const json = JSON.parse(data);
                                    const delta = json.choices?.[0]?.delta;
                                    if (delta?.content) {
                                        cotAnalysisText += String(delta.content);
                                        const el = document.getElementById('cot-stream-content');
                                        if (el) el.innerHTML = cotAnalysisText.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                    }
                                } catch (e) {}
                            }
                        }
                    }

                    if (cotAnalysisText) {
                        const escaped = cotAnalysisText.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        cotAnalysisHtml = cotBlockStart.replace(
                            '<div class="think-content" id="cot-stream-content"></div>',
                            '<div class="think-content">' + escaped + '</div>'
                        );
                        msgs.unshift({
                            role: 'system',
                            content: `[思维链]\n分析结果:${cotAnalysisText}\n\n处理需求:自主处理用户需求,可调工具。完成输出:Output:end`,
                            images: []
                        });
                    }
                }
            } catch (e) {}
        }

        // API要求所有system消息在最前面
        const callResult = await callAPI(reorderMessages(msgs));
        const stream = callResult.body;
        const apiRequest = callResult.apiRequest;

        bubble.innerHTML = cotAnalysisHtml;
        const reasoningDiv = document.createElement('div');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'markdown-body';
        bubble.appendChild(reasoningDiv);
        bubble.appendChild(contentDiv);

        const decoder = new TextDecoder();
        const reader = stream.getReader();
        let buffer = '';
        let streamUsage = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') continue;
                    try {
                        const json = JSON.parse(data);
                        // 捕获后端发送的独立 usage 事件
                        if (json.usage && !json.choices) {
                            streamUsage = json.usage;
                            continue;
                        }
                        // 捕获 OpenAI 流式 chunk 中的 usage
                        if (json.usage) {
                            streamUsage = json.usage;
                        }
                        const delta = json.choices?.[0]?.delta;
                        if (delta) {
                            if (delta.reasoning_content) {
                                fullReasoning += String(delta.reasoning_content);
                                reasoningDiv.innerHTML = createThinkBlock(fullReasoning);
                            }
                            if (delta.content !== undefined && delta.content !== null) {
                                let contentPart = '';
                                const c = delta.content;
                                if (typeof c === 'string') {
                                    contentPart = c;
                                } else if (Array.isArray(c)) {
                                    for (let i = 0; i < c.length; i++) {
                                        const item = c[i];
                                        if (typeof item === 'string') {
                                            contentPart += item;
                                        } else if (item && typeof item === 'object') {
                                            if (item.text) contentPart += item.text;
                                            else if (item.value) contentPart += item.value;
                                            else if (item.type === 'text' && item.text) contentPart += item.text;
                                        }
                                    }
                                } else if (typeof c === 'object' && c !== null) {
                                    contentPart = c.text || c.value || c.content || '';
                                    if (!contentPart && c.toString && c.toString !== Object.prototype.toString) {
                                        const str = c.toString();
                                        if (str && str !== '[object Object]') contentPart = str;
                                    }
                                }
                                if (contentPart !== undefined && contentPart !== null) {
                                    fullContent += contentPart;
                                }
                                if (fullContent) {
                                    contentDiv.innerHTML = renderMarkdown(stripToolLines(fullContent) || '...');
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
            if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
        }

        const assistantMsg = {
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning || null,
            usage: streamUsage || null,
            apiRequest: apiRequest || null
        };
        chats[currentChat].push(assistantMsg);
        const newBubble = createMessageBubble(fullContent, 'ai', [], fullReasoning, assistantMsg, cotAnalysisHtml);
        bubble.replaceWith(newBubble);
        updateHistoryTitle();
        saveChatToBackend();

        // 解析并执行工具调用
        if (commandExecEnabled) {
            try { await processToolCalls(fullContent); } catch (e) { console.error('[工具调用错误]', e); }
        }

        // 追加输出循环 — 在工具调用全部完成后执行
        try {
            let appendCount = 0;
            let appendContent = fullContent;
            while (appendOutputEnabled && appendCount < 3 && appendContent.includes('{Svotye_system}')) {
            appendCount++;
            const cleanContent = appendContent.replace(/\{Svotye_system\}/g, '').trim();
            // 更新已保存的助手消息内容（移除标记）
            const lastAssistant = [...chats[currentChat]].reverse().find(m => m.role === 'assistant');
            if (lastAssistant) lastAssistant.content = cleanContent;
            // 更新当前 bubble 显示
            const bubbleMd = bubble.querySelector('.markdown-body');
            if (bubbleMd) bubbleMd.innerHTML = renderMarkdown(stripToolLines(cleanContent) || '...');

            // 追加输出的用户占位符
            const appendUserMsg = { role: 'user', content: '{Svotye_system}', images: [] };
            chats[currentChat].push(appendUserMsg);

            // 构建追加 UI think-block
            const appendBlock = document.createElement('div');
            appendBlock.className = 'think-block';
            appendBlock.style.marginLeft = '-12px';
            appendBlock.innerHTML =
                `<div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <div class="think-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981Z" fill="currentColor"/></svg>
                    </div>
                    <span>追加输出 (${appendCount}/3)</span>
                    <div class="think-arrow">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"/></svg>
                    </div>
                </div>
                <div class="think-body-wrapper">
                    <div class="think-line"></div>
                    <div class="think-content">追加生成中...</div>
                </div>`;
            bubble.appendChild(appendBlock);
            const appendContentDiv = appendBlock.querySelector('.think-content');
            const appendReasoningDiv = document.createElement('div');

            // 构建消息列表并调用 API
            const appendMsgs = chats[currentChat]
                .filter(m => m.role)
                .map(m => ({ role: m.role, content: m.content, images: m.images || [] }));
            const appendCallResult = await callAPI(reorderMessages(appendMsgs));
            const appendStream = appendCallResult.body;
            const appendApiRequest = appendCallResult.apiRequest;

            const appendDecoder = new TextDecoder();
            const appendReader = appendStream.getReader();
            let appendBuffer = '';
            let appendFullContent2 = '';
            let appendFullReasoning = '';
            let appendStreamUsage = null;

            while (true) {
                const { done, value } = await appendReader.read();
                if (done) break;
                appendBuffer += appendDecoder.decode(value, { stream: true });
                const lines = appendBuffer.split('\n');
                appendBuffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            if (json.usage && !json.choices) { appendStreamUsage = json.usage; continue; }
                            if (json.usage) appendStreamUsage = json.usage;
                            const delta = json.choices?.[0]?.delta;
                            if (delta) {
                                if (delta.reasoning_content) {
                                    appendFullReasoning += String(delta.reasoning_content);
                                    appendReasoningDiv.innerHTML = createThinkBlock(appendFullReasoning);
                                    if (!appendReasoningDiv.parentNode && appendContentDiv.parentNode) {
                                        appendContentDiv.parentNode.insertBefore(appendReasoningDiv, appendContentDiv);
                                    }
                                }
                                if (delta.content !== undefined && delta.content !== null) {
                                    let contentPart = '';
                                    const c = delta.content;
                                    if (typeof c === 'string') contentPart = c;
                                    else if (Array.isArray(c)) {
                                        for (let i = 0; i < c.length; i++) {
                                            const item = c[i];
                                            if (typeof item === 'string') contentPart += item;
                                            else if (item && typeof item === 'object') {
                                                if (item.text) contentPart += item.text;
                                                else if (item.value) contentPart += item.value;
                                                else if (item.type === 'text' && item.text) contentPart += item.text;
                                            }
                                        }
                                    }
                                    appendFullContent2 += contentPart;
                                    appendContentDiv.innerHTML = renderMarkdown(stripToolLines(appendFullContent2) || '...');
                                }
                            }
                        } catch (e) {}
                    }
                }
                if (!isUserScrolledAway) chatArea.scrollTop = chatArea.scrollHeight;
            }

            // 保存追加的助手消息
            const appendAssistantMsg = {
                role: 'assistant',
                content: appendFullContent2,
                reasoning: appendFullReasoning || null,
                usage: appendStreamUsage || null,
                apiRequest: appendApiRequest || null
            };
            chats[currentChat].push(appendAssistantMsg);

            // 为追加内容添加 actions
            const appendActionsDiv = document.createElement('div');
            appendActionsDiv.className = 'message-actions';
            appendActionsDiv.innerHTML =
                `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="action-icon" data-action="regenerate" title="重新生成"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
                <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>
                <button class="action-icon" data-action="tokens" title="Token消耗"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
                <button class="action-icon" data-action="apijson" title="API请求JSON"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>`;
            appendContentDiv.parentNode.appendChild(appendActionsDiv);
            appendActionsDiv.querySelector('[data-action="copy"]').onclick = () =>
                navigator.clipboard.writeText(appendFullContent2).then(() => showToast('已复制'));
            appendActionsDiv.querySelector('[data-action="delete"]').onclick = () => {
                const idx = chats[currentChat].indexOf(appendAssistantMsg);
                if (idx !== -1) chats[currentChat].splice(idx, 1);
                appendBlock.remove();
                saveChatToBackend();
            };
            appendActionsDiv.querySelector('[data-action="tokens"]').onclick = () => {
                if (appendStreamUsage) {
                    const usage = appendStreamUsage;
                    const text = `Token 消耗:\n输入 tokens: ${usage.prompt_tokens ?? usage.input_tokens ?? 'N/A'}\n输出 tokens: ${usage.completion_tokens ?? usage.output_tokens ?? 'N/A'}\n总计 tokens: ${usage.total_tokens ?? 'N/A'}`;
                    window.saveAndShowText('Token消耗', text);
                } else { showToast('暂无 token 数据'); }
            };
            appendActionsDiv.querySelector('[data-action="apijson"]').onclick = () => {
                if (appendApiRequest) {
                    window.saveAndShowText('API请求JSON', JSON.stringify(appendApiRequest, null, 2));
                } else { showToast('暂无请求数据'); }
            };

            // 工具调用处理
            if (commandExecEnabled) {
                try { await processToolCalls(appendFullContent2); } catch (e) { console.error('[追加工具调用错误]', e); }
            }

            // 准备下一轮检查
            appendContent = appendFullContent2;
            saveChatToBackend();
        }
        } catch (appendErr) {
            console.error('[追加输出错误]', appendErr);
        }

    } catch (e) {
        if (e && (e.name === 'AbortError' || e.code === 'ERR_CANCELED')) {
            const markdownDiv = bubble.querySelector('.markdown-body') || bubble;
            markdownDiv.innerHTML = renderMarkdown(fullContent);
            const assistantMsg = {
                role: 'assistant',
                content: fullContent,
                reasoning: fullReasoning || null,
                usage: streamUsage || null,
                apiRequest: apiRequest || null
            };
            chats[currentChat].push(assistantMsg);
            updateHistoryTitle();
            saveChatToBackend();
            if (commandExecEnabled) {
                try { await processToolCalls(fullContent); } catch (ex) { console.error('[工具调用错误]', ex); }
            }
        } else {
            bubble.innerHTML = '';
            const errDiv = document.createElement('div');
            errDiv.style.cssText = 'padding:8px 0; color:#e74c3c; font-size:14px;';
            errDiv.textContent = '请求失败: ' + e.message;
            bubble.appendChild(errDiv);

            const errorActions = document.createElement('div');
            errorActions.className = 'message-actions';
            errorActions.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="regenerate" title="重新生成"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        <button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>`;
            bubble.appendChild(errorActions);

            errorActions.querySelector('[data-action="copy"]').onclick = () =>
                navigator.clipboard.writeText(e.message).then(() => showToast('已复制'));
            errorActions.querySelector('[data-action="delete"]').onclick = () => { bubble.remove(); };
            console.error(e);
        }
    } finally {
        streaming = false;
        currentAbortController = null;
        updateSendBtn();
    }
}

    function activateChat() {
        isChatActive = true;
        document.body.classList.add('chat-active');
        if (centerInit) centerInit.style.display = 'none';
        if (bottomInput) {
            bottomInput.style.opacity = '1';
            bottomInput.style.pointerEvents = 'all';
            bottomInput.style.maxHeight = '300px';
        }
        if (chatArea) {
            chatArea.style.opacity = '1';
            chatArea.style.pointerEvents = 'all';
            chatArea.style.maxHeight = 'none';
            chatArea.style.flex = '1 1 auto';
        }
        if (sidebarLeft && window.innerWidth > 768) sidebarLeft.classList.add('visible');
        updateHeaderTitle();
    }

    function switchChat(idx) {
        if (pendingNewChatIndex !== null && 
            idx !== pendingNewChatIndex &&
            chats[pendingNewChatIndex] && 
            chats[pendingNewChatIndex].length === 0) {
            chats.splice(pendingNewChatIndex, 1);
            chatTitles.splice(pendingNewChatIndex, 1);
            pendingNewChatIndex = null;
            if (idx > pendingNewChatIndex) idx--;
        }
        if (idx === currentChat && isChatActive) return;
        currentChat = idx;
        if (chatAreaInner) chatAreaInner.innerHTML = '';
        if (!chats[idx] || !chats[idx].length) {
            if (emptyHint) emptyHint.style.display = 'block';
        } else {
            if (emptyHint) emptyHint.style.display = 'none';
            chats[idx].forEach(m => {
                if (!m.role) return;
                const bubbleRole = m.role === 'system' ? 'system' : (m.role === 'user' ? 'user' : 'ai');
                addMessage(m.content, bubbleRole, m.images || [], m.reasoning, m);
            });
        }
        updateHistoryList();
        updateHeaderTitle();
    }

    async function newChat() {
        if (pendingNewChatIndex !== null && chats[pendingNewChatIndex] && chats[pendingNewChatIndex].length === 0) {
            if (!isChatActive) activateChat();
            switchChat(pendingNewChatIndex);
            return;
        }

        chats.push([]);
        chatTitles.push('新对话');
        pendingNewChatIndex = chats.length - 1;
        currentChat = pendingNewChatIndex;

        if (!isChatActive) activateChat();
        if (chatAreaInner) chatAreaInner.innerHTML = '';
        if (emptyHint) {
            emptyHint.style.display = 'block';
            emptyHint.textContent = '我能帮你点什么？';
        }
        updateHistoryList();
        updateHeaderTitle();
    }

    function updateHistoryTitle() {
        const msgs = chats[currentChat]?.filter(m => m.role === 'user') || [];
        chatTitles[currentChat] = msgs.length ? (msgs[0].content || '图片').substring(0, 25) : '空对话';
        updateHeaderTitle();
        updateHistoryList();
    }

    function updateHeaderTitle() {
        if (chatTitleText) chatTitleText.textContent = chatTitles[currentChat] || '对话';
    }

    function updateHistoryList() {
        if (!historyList) return;
        let ordered = [];
        pinnedChats.forEach(id => {
            if (id < chatTitles.length && chats[id] && chats[id].length > 0) ordered.push(id);
        });
        for (let i = chatTitles.length - 1; i >= 0; i--) {
            if (!pinnedChats.has(i) && chats[i] && chats[i].length > 0) ordered.push(i);
        }
        historyList.innerHTML = ordered
            .map(idx => {
                const title = chatTitles[idx] || '未命名';
                const pinned = pinnedChats.has(idx);
                return `<li class="chat-history-item${idx === currentChat ? ' active' : ''}" data-index="${idx}">
                <span class="history-title">${escapeHtml(title)}</span>
                <div class="history-actions">
                    <button class="action-icon small" title="收藏置顶">${pinned ? '★' : '☆'}</button>
                    <button class="action-icon small" title="重命名">✎</button>
                    <button class="action-icon small" title="删除">✕</button>
                </div>
            </li>`;
            })
            .join('');
        historyList.querySelectorAll('li').forEach(li => {
            const idx = parseInt(li.dataset.index);
            li.onclick = e => {
                if (e.target.closest('button')) return;
                if (!isChatActive) activateChat();
                switchChat(idx);
            };
            const favBtn = li.querySelector('[title="收藏置顶"]');
            if (favBtn)
                favBtn.onclick = e => {
                    e.stopPropagation();
                    if (pinnedChats.has(idx)) pinnedChats.delete(idx);
                    else pinnedChats.add(idx);
                    updateHistoryList();
                };
            const renameBtn = li.querySelector('[title="重命名"]');
            if (renameBtn)
                renameBtn.onclick = e => {
                    e.stopPropagation();
                    const newTitle = prompt('修改标题', chatTitles[idx]);
                    if (newTitle) {
                        chatTitles[idx] = newTitle;
                        if (idx === currentChat) updateHeaderTitle();
                        updateHistoryList();
                        saveChatToBackend();
                    }
                };
            const delBtn = li.querySelector('[title="删除"]');
            if (delBtn)
                delBtn.onclick = async e => {
                    e.stopPropagation();
                    if (!confirm('确定删除此对话？')) return;
                    try { await fetch(`/api/chat/${idx}`, { method: 'DELETE' }); } catch (e) {}
                    chats.splice(idx, 1);
                    chatTitles.splice(idx, 1);
                    pinnedChats.delete(idx);
                    if (currentChat >= chats.length) currentChat = chats.length - 1;
                    if (currentChat < 0) {
                        currentChat = 0;
                        chats = [[]];
                        chatTitles = ['当前对话'];
                    }
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
        chatTitleInput.onkeydown = async ev => {
            if (ev.key === 'Enter') {
                const t = chatTitleInput.value.trim();
                if (t) {
                    chatTitles[currentChat] = t;
                    updateHeaderTitle();
                    updateHistoryList();
                    saveChatToBackend();
                }
                chatTitleInput.style.display = 'none';
                chatTitleText.style.display = 'inline';
            } else if (ev.key === 'Escape') {
                chatTitleInput.style.display = 'none';
                chatTitleText.style.display = 'inline';
            }
        };
        chatTitleInput.onblur = () => {
            setTimeout(() => {
                chatTitleInput.style.display = 'none';
                chatTitleText.style.display = 'inline';
            }, 100);
        };
    };

    function addDirectChatButton() {
        if (document.getElementById('directChatBtn')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'direct-chat-container';
        wrapper.innerHTML =
            '<button id="directChatBtn" style="margin-top:12px;background:none;border:none;color:#aaa;font-size:12px;cursor:pointer;text-decoration:underline;">直接进入对话</button>';
        wrapper.onclick = async e => {
            e.stopPropagation();
            await newChat();
        };
        const inputWrapper = centerInit.querySelector('.input-wrapper-outer');
        if (inputWrapper) inputWrapper.after(wrapper);
    }

    newChatIcon.onclick = newChatSidebarBtn.onclick = sidebarLogo.onclick = () => newChat();
    historyIcon.onclick = () => {
        sidebarLeft.classList.add('visible', 'expanded');
    };

// ========== 文件面板功能 ==========

// 获取用户身份信息
async function getIdentity() {
    try {
        const res = await fetch('/api/identity');
        if (!res.ok) throw new Error('获取身份失败');
        return await res.json();
    } catch (e) {
        return null;
    }
}

// 初始化用户身份
async function initIdentity() {
    try {
        await fetch('/api/identity', { method: 'POST' });
    } catch (e) {}
}

// 获取存储文件列表
async function getStorageFiles() {
    try {
        const res = await fetch('/api/storage/files');
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
}

// 上传文件到存储
async function uploadToStorage(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch('/api/storage/upload', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('上传失败');
        return await res.json();
    } catch (e) {
        throw e;
    }
}

// 删除存储文件
async function deleteStorageFile(filename) {
    try {
        const res = await fetch(`/api/storage/file/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

// 渲染存储标签页
async function renderStorageTab(files) {
    if (!filePanelBody) return;
    if (filePanelTitle) filePanelTitle.textContent = '存储';
    
    if (!files || files.length === 0) {
        filePanelBody.innerHTML = '<div class="file-panel-empty">暂无存储文件</div>';
        return;
    }
    
    let html = '';
    for (const f of files) {
        const sizeStr = formatFileSize(f.size);
        const dateStr = f.modified ? new Date(f.modified).toLocaleString('zh-CN', { hour12: false }) : '';
        html += `
            <div class="file-list-item" data-filename="${escapeHtml(f.name)}">
                <div class="file-list-item-icon">📄</div>
                <div class="file-list-item-info">
                    <div class="file-list-item-name">${escapeHtml(f.name)}</div>
                    <div class="file-list-item-meta">${sizeStr} ${dateStr ? '· ' + dateStr : ''}</div>
                </div>
                <div class="file-list-item-actions">
                    <button class="file-action-view" title="查看">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="file-action-delete" title="删除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>`;
    }
    filePanelBody.innerHTML = html;
    
    for (const item of filePanelBody.querySelectorAll('.file-list-item')) {
        const filename = item.dataset.filename;
        
        // 查看按钮 - 复用右侧文件预览面板
        const viewBtn = item.querySelector('.file-action-view');
        if (viewBtn) {
            viewBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    const res = await fetch(`/api/storage/file/${encodeURIComponent(filename)}`);
                    if (!res.ok) throw new Error('获取文件失败');
                    const data = await res.json();
                    let content = data.content || '';
                    if (data.encoding === 'base64') {
                        content = atob(content);
                    }
                    // 使用右侧面板
                    if (fileViewerOverlay && fileViewerTitle && fileViewerBody) {
                        fileViewerTitle.textContent = filename;
                        fileViewerBody.textContent = content;
                        fileViewerOverlay.classList.add('active');
                    } else {
                        showToast('无法打开文件预览');
                    }
                } catch (err) {
                    showToast('读取文件失败: ' + err.message);
                }
            };
        }
        
        // 删除按钮 - 使用黑底提示确认
        const deleteBtn = item.querySelector('.file-action-delete');
        if (deleteBtn) {
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                showDeleteConfirm(filename);
            };
        }
    }
}

// 删除确认 - 黑底浮动条
function showDeleteConfirm(filename) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a1a1a;
        color: white;
        padding: 12px 20px;
        border-radius: 40px;
        font-size: 14px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        white-space: nowrap;
    `;
    confirmDiv.innerHTML = `
        <span>确认删除 "${filename.length > 30 ? filename.substring(0, 27) + '...' : filename}"？</span>
        <div style="display: flex; gap: 12px;">
            <button style="background: #ef4444; border: none; color: white; padding: 5px 14px; border-radius: 30px; cursor: pointer;">删除</button>
            <button style="background: #3a3a3a; border: none; color: white; padding: 5px 14px; border-radius: 30px; cursor: pointer;">取消</button>
        </div>
    `;
    document.body.appendChild(confirmDiv);
    
    const confirmBtn = confirmDiv.querySelector('button:first-child');
    const cancelBtn = confirmDiv.querySelector('button:last-child');
    
    const cleanup = () => {
        if (confirmDiv && confirmDiv.parentNode) confirmDiv.remove();
    };
    
    confirmBtn.onclick = async () => {
        cleanup();
        try {
            const res = await fetch(`/api/storage/file/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('已删除');
                const files = await getStorageFiles();
                renderStorageTab(files);
            } else {
                showToast('删除失败');
            }
        } catch (err) {
            showToast('删除失败: ' + err.message);
        }
    };
    
    cancelBtn.onclick = cleanup;
}

// 已删除 - 插件移至深度思考弹窗
/*
    if (!filePanelBody) return;
    if (filePanelTitle) filePanelTitle.textContent = '插件';

    // 加载已保存的插件状态
    let pluginStates = {};
    try {
        const saved = localStorage.getItem('fold_ai_plugin_states');
        if (saved) pluginStates = JSON.parse(saved);
    } catch (e) {}

    // 获取 execute 命令
    let executeCommands = [];
    try {
        const res = await fetch('/api/plugin/executes');
        if (res.ok) {
            const data = await res.json();
            executeCommands = data.commands || [];
        }
    } catch (e) {}

    let html = '';

    // 显示常规插件
    if (executeCommands.length > 0 || true) {
        html += '<div class="settings-section-title" style="margin-bottom:10px;">函数工具</div>';
        html += '<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">';

        // execute 命令列表
        for (const cmd of executeCommands) {
            const isOn = pluginStates['exec:' + cmd.name] === true;
            html += `
                <div class="extra-prompt-item" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 14px;">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                        <div style="font-size:16px;flex-shrink:0;">⚡</div>
                        <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:500;color:var(--text);">${escapeHtml(cmd.name)}</div>
                            <div style="font-size:11px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(cmd.fileSpec)}</div>
                        </div>
                    </div>
                    <div class="think-mode-selector" style="flex-shrink:0;" data-plugin="exec:${cmd.name}">
                        <button class="think-mode-option ${!isOn ? 'active' : ''}" data-value="off">关闭</button>
                        <button class="think-mode-option ${isOn ? 'active' : ''}" data-value="on">开启</button>
                    </div>
                </div>`;
        }

        if (executeCommands.length === 0) {
            html += `<div style="text-align:center;padding:24px 0;color:#999;font-size:13px;">暂无函数工具，请在 execute.txt 中定义</div>`;
        }

        html += '</div>';
    }

    // 常规插件
    try {
        const res = await fetch('/api/plugins');
        if (res.ok) {
            const data = await res.json();
            const plugins = data.plugins || [];

            if (plugins.length > 0) {
                html += '<div class="settings-section-title" style="margin-bottom:10px;">系统插件</div>';
                html += '<div style="display:flex;flex-direction:column;gap:8px;">';

                for (const plugin of plugins) {
                    const pluginKey = 'plugin:' + plugin.id;
                    const saved = pluginStates[pluginKey];
                    // 默认关闭
                    const isOn = saved === true;
                    const pluginIcon = plugin.icon || '🔌';

                    html += `
                        <div class="extra-prompt-item" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 14px;">
                            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                                <div style="font-size:20px;flex-shrink:0;">${pluginIcon}</div>
                                <div style="min-width:0;">
                                    <div style="font-size:13px;font-weight:500;color:var(--text);">${escapeHtml(plugin.name || plugin.id)}</div>
                                    <div style="font-size:11px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(plugin.description || '')}</div>
                                </div>
                            </div>
                            <div class="think-mode-selector" style="flex-shrink:0;" data-plugin="${pluginKey}">
                                <button class="think-mode-option ${!isOn ? 'active' : ''}" data-value="off">关闭</button>
                                <button class="think-mode-option ${isOn ? 'active' : ''}" data-value="on">开启</button>
                            </div>
                        </div>`;
                }

                html += '</div>';
            }
        }
    } catch (e) {}

    if (!html) {
        html = `<div class="file-panel-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2;">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div style="font-weight:500;color:#bbb;">暂无可用插件</div>
        </div>`;
    }

    filePanelBody.innerHTML = html;

    // 绑定切换事件
    filePanelBody.querySelectorAll('.think-mode-selector[data-plugin]').forEach(selector => {
        const pluginKey = selector.dataset.plugin;
        selector.querySelectorAll('.think-mode-option').forEach(btn => {
            btn.addEventListener('click', function() {
                selector.querySelectorAll('.think-mode-option').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const isOn = this.dataset.value === 'on';
                let states = {};
                try {
                    const saved = localStorage.getItem('fold_ai_plugin_states');
                    if (saved) states = JSON.parse(saved);
                } catch (e) {}
                states[pluginKey] = isOn;
                localStorage.setItem('fold_ai_plugin_states', JSON.stringify(states));
                showToast(isOn ? '已开启' : '已关闭');
            });
        });
    });
}
*/
// 渲染身份标签页
async function renderIdentityTab() {
    if (!filePanelBody) return;
    if (filePanelTitle) filePanelTitle.textContent = '身份';
    const identity = await getIdentity();
    if (!identity) {
        filePanelBody.innerHTML = '<div class="file-panel-empty">无法获取身份信息</div>';
        return;
    }
    filePanelBody.innerHTML = `
        <div class="identity-card">
            <div class="identity-item">
                <span class="identity-label">唯一标识</span>
                <span class="identity-value">${escapeHtml(identity.id || '---')}</span>
            </div>
            <div class="identity-item">
                <span class="identity-label">首次使用时间</span>
                <span class="identity-value">${identity.createdAt ? new Date(identity.createdAt).toLocaleString('zh-CN') : '---'}</span>
            </div>
            <div class="identity-item">
                <span class="identity-label">最后活跃时间</span>
                <span class="identity-value">${identity.lastActive ? new Date(identity.lastActive).toLocaleString('zh-CN') : '---'}</span>
            </div>
        </div>`;
}

// 打开文件面板
async function openFilePanel(tab = 'storage') {
    await initIdentity();
    if (filePanelOverlay) filePanelOverlay.classList.add('active');

    // 切换标签页
    const tabs = filePanelTabs.querySelectorAll('.file-panel-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    switch (tab) {
        case 'storage':
            const files = await getStorageFiles();
            renderStorageTab(files);
            break;
        case 'identity':
            await renderIdentityTab();
            break;
    }
}

// 关闭文件面板
function closeFilePanel() {
    if (filePanelOverlay) filePanelOverlay.classList.remove('active');
}

// 文件大小格式化
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// 绑定文件面板关闭按钮
if (filePanelClose) {
    filePanelClose.onclick = closeFilePanel;
}

// 点击遮罩关闭
if (filePanelOverlay) {
    filePanelOverlay.addEventListener('click', e => {
        if (e.target === filePanelOverlay) closeFilePanel();
    });
}

// 标签页切换
if (filePanelTabs) {
    filePanelTabs.querySelectorAll('.file-panel-tab').forEach(tab => {
        tab.onclick = () => {
            openFilePanel(tab.dataset.tab);
        };
    });
}

// 绑定按钮点击事件
if (initialFileBtn) {
    initialFileBtn.onclick = () => {
        openFilePanel('storage');
    };
}
if (chatFileBtn) {
    chatFileBtn.onclick = () => {
        openFilePanel('storage');
    };
}

const initDeepThinkBtn = document.getElementById('initialDeepThinkBtn');
const chatDeepThinkBtn = document.getElementById('chatDeepThinkBtn');



document.addEventListener('DOMContentLoaded', function() {
    const initDeepThinkBtn = document.getElementById('initialDeepThinkBtn');
    const chatDeepThinkBtn = document.getElementById('chatDeepThinkBtn');

 if (!initDeepThinkBtn || !chatDeepThinkBtn) {
        console.warn('深度思考按钮未找到，请检查 HTML 中的 id 是否正确');
        return;
    }

    let currentPopup = null;

    function createDeepThinkPopup(triggerBtn) {
        const existing = document.querySelector('.deep-think-popup');
        if (existing) {
            existing.remove();
            if (existing._triggerBtn === triggerBtn) { currentPopup = null; return; }
        }

        const popup = document.createElement('div');
        popup.className = 'deep-think-popup';
        popup._triggerBtn = triggerBtn;

        // 确定当前激活的模式
        const isDeep = currentThinkMode === 'deep';
        const isDirect = currentThinkMode === 'direct';
        const isReason = currentThinkMode === 'reason';
        const isCreative = currentThinkMode === 'creative';

        popup.innerHTML = `
        <div class="deep-think-popup-inner">
            <!-- 工具链区域 -->
            <div class="tool-chain-section">
                <div class="tool-chain-title">工具链</div>
                <div class="tool-chain-item">
                    <div class="tool-chain-item-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span>命令执行</span>
                    </div>
                    <div class="tool-chain-toggle">
                        <button class="tool-chain-option ${commandExecEnabled ? 'active' : ''}" data-tool="command" data-value="on">允许</button>
                        <button class="tool-chain-option ${!commandExecEnabled ? 'active' : ''}" data-tool="command" data-value="off">禁用</button>
                    </div>
                </div>
                <div class="tool-chain-item">
                    <div class="tool-chain-item-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.47V19a2 2 0 11-4 0v-.53c0-1.03-.47-1.99-1.274-2.618l-.548-.547z"/>
                        </svg>
                        <span>思维链</span>
                    </div>
                    <div class="tool-chain-toggle">
                        <button class="tool-chain-option ${chainOfThoughtEnabled ? 'active' : ''}" data-tool="cot" data-value="on">允许</button>
                        <button class="tool-chain-option ${!chainOfThoughtEnabled ? 'active' : ''}" data-tool="cot" data-value="off">禁用</button>
                    </div>
                </div>
                <div class="tool-chain-item">
                    <div class="tool-chain-item-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                        </svg>
                        <span>追加输出</span>
                    </div>
                    <div class="tool-chain-toggle">
                        <button class="tool-chain-option ${appendOutputEnabled ? 'active' : ''}" data-tool="append" data-value="on">允许</button>
                        <button class="tool-chain-option ${!appendOutputEnabled ? 'active' : ''}" data-tool="append" data-value="off">禁用</button>
                    </div>
                </div>
            </div>
            <!-- 思考模式区域 -->
            <div class="think-section">
                <span class="think-section-title">深度思考</span>
                <div class="think-mode-selector">
                    <button class="think-mode-option ${isDeep ? 'active' : ''}" data-mode="deep">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.47V19a2 2 0 11-4 0v-.53c0-1.03-.47-1.99-1.274-2.618l-.548-.547z"/>
                        </svg>
                        <span>沉思</span>
                    </button>
                    <button class="think-mode-option ${isDirect ? 'active' : ''}" data-mode="direct">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>直接</span>
                    </button>
                    <button class="think-mode-option ${isReason ? 'active' : ''}" data-mode="reason">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <span>推理</span>
                    </button>
                    <button class="think-mode-option ${isCreative ? 'active' : ''}" data-mode="creative">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        <span>创意</span>
                    </button>
                </div>
            </div>
        </div>
        `;

        popup.classList.add('deep-think-popup');
        document.body.appendChild(popup);

        // 动画：先定位再播放
        const rect = triggerBtn.getBoundingClientRect();
        popup.style.left = (rect.left + rect.width/2 - 10) + 'px';
        popup.style.top = (rect.top - 8) + 'px';
        popup.style.transformOrigin = 'bottom center';

        // 触发入场动画
        requestAnimationFrame(() => {
            popup.classList.add('active');
            // 定位回中心
            requestAnimationFrame(() => {
                popup.style.left = (rect.left + rect.width/2 - popup.offsetWidth/2) + 'px';
                popup.style.top = (rect.top - popup.offsetHeight - 8) + 'px';
            });
        });

        // 工具链切换事件
        popup.querySelectorAll('.tool-chain-option').forEach(option => {
            option.addEventListener('click', () => {
                const tool = option.dataset.tool;
                const value = option.dataset.value;
                if (tool === 'command') {
                    commandExecEnabled = value === 'on';
                    popup.querySelectorAll('.tool-chain-option[data-tool="command"]').forEach(o => {
                        o.classList.toggle('active', o === option);
                    });
                    if (window.CommandExecutionPlugin) {
                        window.CommandExecutionPlugin.setEnabled(commandExecEnabled);
                    }
                    saveSettingsToLocal();
                }
                if (tool === 'cot') {
                    chainOfThoughtEnabled = value === 'on';
                    popup.querySelectorAll('.tool-chain-option[data-tool="cot"]').forEach(o => {
                        o.classList.toggle('active', o === option);
                    });
                    if (window.ChainOfThoughtPlugin) {
                        window.ChainOfThoughtPlugin.setEnabled(chainOfThoughtEnabled);
                    }
                    saveSettingsToLocal();
                }
                if (tool === 'append') {
                    appendOutputEnabled = value === 'on';
                    popup.querySelectorAll('.tool-chain-option[data-tool="append"]').forEach(o => {
                        o.classList.toggle('active', o === option);
                    });
                    saveSettingsToLocal();
                }
            });
        });

        // 思考模式切换事件
        popup.querySelectorAll('.think-mode-option').forEach(option => {
            option.addEventListener('click', () => {
                currentThinkMode = option.dataset.mode;
                deepThinkEnabled = currentThinkMode !== 'direct';
                popup.querySelectorAll('.think-mode-option').forEach(o => {
                    o.classList.toggle('active', o === option);
                });
                saveSettingsToLocal();
            });
        });

        const closeHandler = (e) => {
            if (!popup.contains(e.target) && e.target !== triggerBtn) {
                popup.classList.remove('active');
                setTimeout(() => {
                    popup.remove();
                    currentPopup = null;
                }, 200);
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
        currentPopup = popup;
    }

    initDeepThinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createDeepThinkPopup(initDeepThinkBtn);
    });
    chatDeepThinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createDeepThinkPopup(chatDeepThinkBtn);
    });
});

function stopStreaming() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        // streaming 状态会在流读取中断后自动置为 false，但保险可以提前设
        streaming = false;
        updateSendBtn();
    }
}

        initSend.onclick = () => {
    if (streaming) {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
    } else {
        sendMessage(false);
    }
};
chatSend.onclick = () => {
    if (streaming) {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
    } else {
        sendMessage(false);
    }
};
        // ----- 覆盖键盘事件（Enter 时若正在流式则不发送） -----
        if (initText) {
            initText.onkeydown = e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!streaming) sendMessage(false);
                }
            };
        }
        if (chatText) {
            chatText.onkeydown = e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!streaming) sendMessage(false);
                }
            };
        }

        // 滚动检测：用户向上滚动则松开自动跟随，滚回底部则重新锁定
        chatArea.addEventListener('scroll', () => {
            const threshold = 40;
            const atBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < threshold;
            isUserScrolledAway = !atBottom;
        });

if (sidebarToggle) {
    sidebarToggle.onclick = () => {
        if (!sidebarLeft.classList.contains('visible')) {
            sidebarLeft.classList.add('visible');
            sidebarLeft.classList.remove('expanded');
        } else if (sidebarLeft.classList.contains('visible') && !sidebarLeft.classList.contains('expanded')) {
            sidebarLeft.classList.add('expanded');
        } else if (sidebarLeft.classList.contains('expanded')) {
            sidebarLeft.classList.remove('expanded');
        }
    };
}

    // 启动初始化
    // 加载保存的设置
    loadSettings();

    // 初始化命令执行插件状态
    if (window.CommandExecutionPlugin) {
        window.CommandExecutionPlugin.setEnabled(commandExecEnabled);
        window.CommandExecutionPlugin.setConfirmBeforeExecution(commandConfirmEnabled);
    }
    if (window.ChainOfThoughtPlugin) {
        window.ChainOfThoughtPlugin.setEnabled(chainOfThoughtEnabled);
    }

    (async () => {
        await loadProviders();
        await loadConfigFromBackend();
        await loadConfigPrompts();
        await loadChatsFromBackend();
        updateModelButtonLabels();
        updateHistoryList();
        addDirectChatButton();
        if (currentProvider) { await loadModels(currentProvider); }
        console.log('✅ 初始化完成');
    })();

    // 执行插件模式下的文件
	})();