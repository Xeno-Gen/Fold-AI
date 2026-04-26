import { Router, Request, Response } from 'express';
import { getUserConfig, saveUserConfig } from '../user/manager';

export const providersRouter = Router();
let providersList: any[] = [];

export function setProviders(list: any[]) {
    providersList = list;
}

providersRouter.get('/providers', (_req: Request, res: Response) => {
    const safeList = providersList.map(p => ({ id: p.id, name: p.name, icon: p.icon }));
    res.json({ providers: safeList });
});

// 获取所有密钥掩码
providersRouter.get('/provider/:id/keys', (req: Request, res: Response) => {
    const { id } = req.params;
    const userConfig = getUserConfig(req.userToken!);
    const keys = userConfig.providerKeys[id] || [];
    const masks = keys.map(k => k.substring(0, 6) + '...' + k.substring(k.length - 4));
    res.json({ keys: masks });
});

// 添加密钥
providersRouter.post('/provider/:id/keys', (req: Request, res: Response) => {
    const { id } = req.params;
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少密钥' });
    const userConfig = getUserConfig(req.userToken!);
    if (!userConfig.providerKeys[id]) {
        userConfig.providerKeys[id] = [];
        userConfig.selectedKeyIndices[id] = 0;
    }
    userConfig.providerKeys[id].push(apiKey);
    saveUserConfig(req.userToken!, userConfig);
    res.json({ success: true });
});

// 切换当前使用的密钥索引
providersRouter.post('/provider/:id/keys/use', (req: Request, res: Response) => {
    const { id } = req.params;
    const { index } = req.body;
    const userConfig = getUserConfig(req.userToken!);
    if (!userConfig.providerKeys[id] || index >= userConfig.providerKeys[id].length) {
        return res.status(400).json({ error: '索引无效' });
    }
    userConfig.selectedKeyIndices[id] = index;
    saveUserConfig(req.userToken!, userConfig);
    res.json({ success: true });
});

// 删除密钥
providersRouter.delete('/provider/:id/key/:index', (req: Request, res: Response) => {
    const { id, index } = req.params;
    const idx = parseInt(index);
    const userConfig = getUserConfig(req.userToken!);
    if (!userConfig.providerKeys[id] || idx >= userConfig.providerKeys[id].length) {
        return res.status(400).json({ error: '索引无效' });
    }
    userConfig.providerKeys[id].splice(idx, 1);
    // 如果删除的是当前使用密钥，重置为0
    if (userConfig.selectedKeyIndices[id] === idx) {
        userConfig.selectedKeyIndices[id] = 0;
    } else if (userConfig.selectedKeyIndices[id] > idx) {
        userConfig.selectedKeyIndices[id]--;
    }
    saveUserConfig(req.userToken!, userConfig);
    res.json({ success: true });
});

// 获取模型列表（使用当前选中密钥）
providersRouter.get('/provider/:id/models', async (req: Request, res: Response) => {
    const { id } = req.params;
    const provider = providersList.find(p => p.id === id);
    if (!provider) return res.status(404).json({ error: '提供商未找到' });
    const userConfig = getUserConfig(req.userToken!);
    const keys = userConfig.providerKeys[id];
    if (!keys || keys.length === 0) return res.status(400).json({ error: '未配置密钥' });
    const index = userConfig.selectedKeyIndices[id] ?? 0;
    const apiKey = keys[index];
    try {
        const response = await fetch(provider.modelsUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error(await response.text());
        const data: any = await response.json();
        let models: string[] = [];
        if (data.data && Array.isArray(data.data)) {
            models = data.data.map((m: any) => m.id || m.name).filter(Boolean);
        } else if (Array.isArray(data)) {
            models = data.map((m: any) => m.id || m.name).filter(Boolean);
        }
        res.json({ models });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 内部使用：获取当前密钥
export function getUserProviderKey(userToken: string, providerId: string): string | null {
    const userConfig = getUserConfig(userToken);
    const keys = userConfig.providerKeys[providerId];
    if (!keys || keys.length === 0) return null;
    const index = userConfig.selectedKeyIndices[providerId] ?? 0;
    return keys[index] || null;
}

export function getUserProviderUrl(providerId: string): string | null {
    const provider = providersList.find(p => p.id === providerId);
    return provider ? provider.url : null;
}