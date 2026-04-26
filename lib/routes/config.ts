import { Router, Request, Response } from 'express';
import { getUserConfig, saveUserConfig } from '../user/manager';

export const configRouter = Router();
let globalDefaultParams: any = {};

export function setDefaultParams(params: any) {
    globalDefaultParams = { ...params };
}

configRouter.get('/config', (req: Request, res: Response) => {
    const userConfig = getUserConfig(req.userToken!);
    const keysStatus: Record<string, boolean> = {};
    for (const [provider, keys] of Object.entries(userConfig.providerKeys)) {
        keysStatus[provider] = Array.isArray(keys) && keys.length > 0;
    }
    res.json({
        defaultParams: userConfig.defaultParams,
        currentProvider: userConfig.currentProvider,
        currentModel: userConfig.currentModel,
        customPort: userConfig.customPort,
        providerKeys: keysStatus,
        systemPrompt: userConfig.systemPrompt || '',
    });
});

configRouter.post('/config', (req: Request, res: Response) => {
    const { defaultParams, currentProvider, currentModel, customPort, systemPrompt } = req.body;
    const userConfig = getUserConfig(req.userToken!);
    if (defaultParams) {
        userConfig.defaultParams = { ...userConfig.defaultParams, ...defaultParams };
    }
    if (currentProvider !== undefined) userConfig.currentProvider = currentProvider;
    if (currentModel !== undefined) userConfig.currentModel = currentModel;
    if (customPort !== undefined) userConfig.customPort = customPort;
    if (systemPrompt !== undefined) userConfig.systemPrompt = systemPrompt;
    saveUserConfig(req.userToken!, userConfig);
    res.json({ success: true });
});