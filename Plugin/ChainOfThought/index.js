/**
 * ChainOfThought Plugin - 思维链
 * 三阶段推理: 判断需求 -> 处理需求 -> Output:end
 */
(function() {
    'use strict';

    class ChainOfThoughtPlugin {
        constructor() {
            this.id = 'ChainOfThought';
            this.name = '思维链';
            this.enabled = false;
            this.loadSettings();
        }

        loadSettings() {
            try {
                const saved = localStorage.getItem('plugin_ChainOfThought');
                if (saved) {
                    const s = JSON.parse(saved);
                    this.enabled = s.enabled ?? false;
                }
            } catch (e) {}
        }

        saveSettings() {
            try {
                localStorage.setItem('plugin_ChainOfThought', JSON.stringify({
                    enabled: this.enabled
                }));
            } catch (e) {}
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            this.saveSettings();
            document.dispatchEvent(new CustomEvent('plugin:cot:enabled', { detail: { enabled } }));
        }
    }

    window.ChainOfThoughtPlugin = new ChainOfThoughtPlugin();
    console.log('[ChainOfThought] plugin loaded');
})();
