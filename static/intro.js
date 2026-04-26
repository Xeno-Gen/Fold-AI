// 将 showToast 暴露为全局函数，供 HTML 内联事件调用
window.showToast = function(msg) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 2200);
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
    const initChar = $('initialCharCount'),
        chatChar = $('chatCharCount');
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
    filePanelTabs = $('filePanelTabs');
const chatFileBtn = $('chatFileBtn'),
    initialFileBtn = $('initialFileBtn');


    let isChatActive = false;
    let chats = [[]],
        chatTitles = ['当前对话'],
        currentChat = 0;
    let activeFiles = { initial: [], chat: [] };
    let streaming = false;
    let currentProvider = null;
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
        const ta = isChatActive ? chatText : initText;
        const target = isChatActive ? 'chat' : 'initial';
        const hasContent = ta.value.trim() || activeFiles[target].length > 0;
        const btn = isChatActive ? chatSend : initSend;
        if (!btn) return;
        btn.disabled = !hasContent || streaming;
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
        initChar.textContent = initText.value.length + '/8000';
        updateSendBtn();
    };
    chatText.oninput = () => {
        chatChar.textContent = chatText.value.length + '/8000';
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
                    systemPrompt: currentParams.systemPrompt
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
            if (currentProvider) await loadModels(currentProvider);
        } catch (e) {}
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
        html += '</div><div class="section-title" style="margin-top:10px;">API 密钥</div>';
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
        drawerBody.innerHTML = html;

        drawerBody.querySelectorAll('.provider-card').forEach(card => {
            card.onclick = async () => {
                drawerBody.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                currentProvider = card.dataset.id;
                await loadModels(currentProvider);
                saveConfigToBackend();
                await refreshKeyList();
            };
        });
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
                    fetch('/api/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: codeEl.textContent, lang: lang })
                    })
                    .then(function(res){ if(!res.ok) throw new Error('下载失败'); return res.blob(); })
                    .then(function(blob){
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = '';
                        document.body.appendChild(a);
                        a.click();
                        URL.revokeObjectURL(url);
                        a.remove();
                        window.showToast('下载完成');
                    })
                    .catch(function(err){ window.showToast('❌ 下载失败: ' + err.message); });
                } else { window.showToast('❌ 无法获取代码'); }
            })(this)">
                <div class="ds-icon ds-atom-button__icon" style="font-size:16px;width:16px;height:16px;margin-right:3px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.3695 11.411L15.1234 12.8866C14.8869 14.3042 13.6603 15.3436 12.223 15.3436H3.77673C2.33958 15.3434 1.1128 14.3042 0.876343 12.8866L0.630249 11.411L2.05408 11.1747L2.29919 12.6493C2.41973 13.3713 3.04475 13.9001 3.77673 13.9003H12.223C12.9551 13.9002 13.58 13.3713 13.7006 12.6493L13.9457 11.1747L15.3695 11.411ZM8.72205 8.994C8.77717 8.93934 8.83792 8.88106 8.90271 8.81627L12.4828 5.23424L13.5043 6.25572L9.92224 9.8358C9.6395 10.1185 9.38763 10.3732 9.15857 10.5575C8.91892 10.7503 8.63953 10.9224 8.2865 10.9784C8.09711 11.0083 7.90363 11.0083 7.71423 10.9784C7.36106 10.9224 7.0809 10.7503 6.84119 10.5575C6.61215 10.3732 6.36022 10.1185 6.07751 9.8358L2.49646 6.25572L3.51697 5.23424L7.09705 8.81627C7.16219 8.88142 7.22331 8.94006 7.27869 8.99498V1.3065H8.72205V8.994Z" fill="currentColor"/>
                    </svg>
                </div>
                <span>下载</span>
            </button>
            <!-- 运行按钮（仅 JavaScript 安全运行） -->
            <button class="ds-atom-button ds-text-button ds-text-button--with-icon" style="margin-right: 4px;" onclick="(function(btn){
                var wrapper = btn.closest('._121d384');
                var pre = wrapper && wrapper.nextElementSibling;
                var codeEl = pre && pre.querySelector('code');
                if(codeEl && codeEl.textContent) {
                    try {
                        eval(codeEl.textContent);
                        window.showToast('运行成功');
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

    function createMessageBubble(content, role, images = [], reasoning = null, msgRef = null) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble message-' + (role === 'user' ? 'user' : 'ai');
        let reasoningHtml = reasoning ? createThinkBlock(reasoning) : '';
        let contentHtml;
        if (role === 'ai') {
            contentHtml = renderMarkdown(content);
        } else {
            contentHtml = `<div class="markdown-body">${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
        }
        bubble.innerHTML = reasoningHtml + contentHtml;

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
        if (role === 'user') {
            actionsDiv.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>`;
        } else {
            actionsDiv.innerHTML = `<button class="action-icon" data-action="copy" title="复制"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 12-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="action-icon" data-action="regenerate" title="重新生成"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        <button class="action-icon" data-action="edit" title="修改"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-icon" data-action="delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 12 2v2"/></svg></button>`;
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

    async function callAPI(messages) {
        if (!currentModel) throw new Error('未选择模型');
        const payload = {
            messages,
            provider: currentProvider,
            model: currentModel,
            ...currentParams,
            stream: true
        };
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }
        return res.body;
    }

    async function sendMessage(isRegenerate = false) {
        if (streaming) return;
        if (!currentModel) {
            showToast('请先选择模型');
            return;
        }
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

            if (textFiles.length) {
                textFiles.forEach(f => {
                    chats[currentChat].push({
                        role: 'system',
                        content: `[文件: ${f.fileName}]\n${f.content}`
                    });
                });
            }

            ta.value = '';
            activeFiles[target] = [];
            renderPreviews(isChatActive ? chatPreview : initPreview, []);
            updateSendBtn();
        }

        streaming = true;
        updateSendBtn();
        const bubble = addMessage('思考中...', 'ai', [], null, null);
        try {
            const msgs = chats[currentChat]
                .filter(m => m.role)
                .map(m => ({
                    role: m.role,
                    content: m.content,
                    images: m.images || []
                }));
            const stream = await callAPI(msgs);
            bubble.innerHTML = '';
            const reasoningDiv = document.createElement('div');
            const contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-body';
            bubble.appendChild(reasoningDiv);
            bubble.appendChild(contentDiv);

            let fullContent = '';
            let fullReasoning = '';
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
                                    } 
                                    else if (Array.isArray(c)) {
                                        for (let i = 0; i < c.length; i++) {
                                            const item = c[i];
                                            if (typeof item === 'string') {
                                                contentPart += item;
                                            } 
                                            else if (item && typeof item === 'object') {
                                                if (item.text) contentPart += item.text;
                                                else if (item.value) contentPart += item.value;
                                                else if (item.type === 'text' && item.text) contentPart += item.text;
                                            }
                                        }
                                    } 
                                    else if (typeof c === 'object' && c !== null) {
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
                                        contentDiv.innerHTML = renderMarkdown(fullContent);
                                    }
                                }
                            }
                        } catch (e) {}
                    }
                }
                chatArea.scrollTop = chatArea.scrollHeight;
            }
            const assistantMsg = { role: 'assistant', content: fullContent, reasoning: fullReasoning || null };
            chats[currentChat].push(assistantMsg);
            const newBubble = createMessageBubble(fullContent, 'ai', [], fullReasoning, assistantMsg);
            bubble.replaceWith(newBubble);
            updateHistoryTitle();
            saveChatToBackend();
        } catch (e) {
            bubble.innerHTML = '请求失败: ' + e.message;
            console.error(e);
        }
        streaming = false;
        updateSendBtn();
    }

    initSend.onclick = () => sendMessage(false);
    chatSend.onclick = () => sendMessage(false);
    initText.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(false);
        }
    };
    chatText.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(false);
        }
    };

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
                if (m.role && m.role !== 'system')
                    addMessage(m.content, m.role === 'user' ? 'user' : 'ai', m.images || [], m.reasoning, m);
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

// 渲染插件标签页
function renderPluginsTab() {
    if (!filePanelBody) return;
    if (filePanelTitle) filePanelTitle.textContent = '插件';
    filePanelBody.innerHTML = `
        <div class="file-panel-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2;">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div style="font-weight:500;color:#bbb;">插件功能即将推出</div>
            <div style="font-size:11px;color:#ccc;">扩展 Fold.AI 的能力边界</div>
        </div>`;
}
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
        case 'plugins':
            renderPluginsTab();
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

    // 启动初始化
    (async () => {
        await loadProviders();
        await loadConfigFromBackend();
        await loadChatsFromBackend();
        updateModelButtonLabels();
        updateHistoryList();
        addDirectChatButton();
        if (currentProvider) { await loadModels(currentProvider); }
        console.log('✅ 初始化完成');
    })();
})();