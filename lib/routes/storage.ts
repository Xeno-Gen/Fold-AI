import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const storageRouter = Router();

// lib 文件夹路径建立在用户目录下
function getLibPath(userToken: string): string {
    const libPath = path.join(__dirname, '../../data/users', userToken, 'lib');
    if (!fs.existsSync(libPath)) {
        fs.mkdirSync(libPath, { recursive: true });
    }
    return libPath;
}

// 身份文件
function getIdentityPath(userToken: string): string {
    return path.join(getLibPath(userToken), 'identity.json');
}

// 获取或创建身份
function getOrCreateIdentity(userToken: string) {
    const identityFile = getIdentityPath(userToken);
    if (fs.existsSync(identityFile)) {
        const identity = JSON.parse(fs.readFileSync(identityFile, 'utf-8'));
        identity.lastActive = new Date().toISOString();
        fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2));
        return identity;
    }
    const identity = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
    };
    fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2));
    return identity;
}

// GET /api/identity - 获取身份
storageRouter.get('/identity', (req: Request, res: Response) => {
    const identity = getOrCreateIdentity(req.userToken!);
    res.json(identity);
});

// POST /api/identity - 初始化/刷新身份
storageRouter.post('/identity', (req: Request, res: Response) => {
    const identity = getOrCreateIdentity(req.userToken!);
    res.json(identity);
});
