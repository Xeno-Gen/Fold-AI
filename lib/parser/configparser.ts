import fs from 'fs';
import path from 'path';

const CONFIG_DIR = path.join(__dirname, '../../Config');

/**
 * 读取并解析 JSON 配置文件
 */
function readJsonFile(filename: string): any {
    const filePath = path.join(CONFIG_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`[配置解析] 读取 ${filename} 失败:`, e);
    }
    return null;
}

/**
 * 获取 prompts 配置
 */
export function getPrompts(): any {
    return readJsonFile('prompts.json') || {};
}

/**
 * 获取应用配置
 */
export function getAppConfig(): any {
    return readJsonFile('config.json') || {};
}

/**
 * 获取主题配置
 */
export function getThemeConfig(): any {
    return readJsonFile('theme.json') || {};
}

/**
 * 获取指定插件的系统提示词
 */
export function getPluginPrompt(pluginId: string): string {
    const prompts = getPrompts();
    return prompts[pluginId]?.system_prompt || '';
}

/**
 * 获取思考模式配置
 */
export function getThinkModes(): any {
    const prompts = getPrompts();
    return prompts.think_modes || {};
}

/**
 * 获取思考模式提示词
 */
export function getThinkModePrompt(mode: string): string {
    const modes = getThinkModes();
    return modes[mode]?.prompt || '';
}
