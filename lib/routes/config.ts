import { Router, Request, Response } from 'express';
import { getUserConfig, saveUserConfig, getDefaultSystemPrompt } from '../user/manager';
import { getSystemPrompt, getPluginPrompts } from '../parser/configparser';
import path from 'path';
import fs from 'fs';

export const configRouter = Router();
let globalDefaultParams: any = {};

export function setDefaultParams(params: any) {
    globalDefaultParams = { ...params };
}

// 默认工作目录：项目根目录下的 cwd 文件夹
export function getDefaultWorkDir(): string {
    return path.join(__dirname, '../../../cwd');
}

// 粗略估算 token 数（中英文混合估算）
function estimateTokens(text: string): number {
    if (!text) return 0;
    let tokens = 0;
    for (const char of text) {
        // 中文字符范围
        if (/[一-鿿㐀-䶿豈-﫿]/.test(char)) {
            tokens += 0.6;
        } else {
            tokens += 0.25; // 英文字符约 0.25 tokens (4字符=1 token)
        }
    }
    return Math.ceil(tokens);
}

configRouter.get('/config', (req: Request, res: Response) => {
    const userConfig = getUserConfig(req.userToken!);
    const keysStatus: Record<string, boolean> = {};
    for (const [provider, keys] of Object.entries(userConfig.providerKeys)) {
        keysStatus[provider] = Array.isArray(keys) && keys.length > 0;
    }
    const baseSystemPrompt = getSystemPrompt();
    res.json({
        defaultParams: userConfig.defaultParams,
        currentProvider: userConfig.currentProvider,
        currentModel: userConfig.currentModel,
        customPort: userConfig.customPort,
        providerKeys: keysStatus,
        systemPrompt: userConfig.systemPrompt || '',
        chatFormat: userConfig.chatFormat || '',
        pureMode: userConfig.pureMode || false,
        baseSystemPrompt: baseSystemPrompt,
        baseSystemTokenCount: estimateTokens(baseSystemPrompt),
        pluginPrompts: getPluginPrompts(),
        workDir: getDefaultWorkDir(),
    });
});

configRouter.post('/config', (req: Request, res: Response) => {
    const { defaultParams, currentProvider, currentModel, customPort, systemPrompt, chatFormat, pureMode } = req.body;
    const userConfig = getUserConfig(req.userToken!);
    if (defaultParams) {
        userConfig.defaultParams = { ...userConfig.defaultParams, ...defaultParams };
    }
    if (currentProvider !== undefined) userConfig.currentProvider = currentProvider;
    if (currentModel !== undefined) userConfig.currentModel = currentModel;
    if (customPort !== undefined) userConfig.customPort = customPort;
    if (systemPrompt !== undefined) userConfig.systemPrompt = systemPrompt;
    if (chatFormat !== undefined) userConfig.chatFormat = chatFormat;
    if (pureMode !== undefined) userConfig.pureMode = pureMode;
    saveUserConfig(req.userToken!, userConfig);
    res.json({ success: true });
});