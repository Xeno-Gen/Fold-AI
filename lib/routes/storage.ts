import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
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

// 存储文件夹
function getStoragePath(userToken: string): string {
    const storagePath = path.join(getLibPath(userToken), 'files');
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }
    return storagePath;
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
        // 更新最后活跃时间
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

// 配置文件上传（存储到 storage 目录）
const storageMulter = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const storagePath = getStoragePath((req as any).userToken);
            cb(null, storagePath);
        },
        filename: (req, file, cb) => {
            // 保留原始文件名，如果已存在则加时间戳
            cb(null, file.originalname);
        },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ========== 身份接口 ==========

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

// ========== 存储文件接口 ==========

// GET /api/storage/files - 获取存储文件列表
storageRouter.get('/storage/files', (req: Request, res: Response) => {
    const storagePath = getStoragePath(req.userToken!);
    const files = fs.readdirSync(storagePath).map(name => {
        const filePath = path.join(storagePath, name);
        const stat = fs.statSync(filePath);
        return {
            name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            isDirectory: stat.isDirectory(),
        };
    });
    res.json(files);
});

// POST /api/storage/upload - 上传文件到存储
storageRouter.post('/storage/upload', storageMulter.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有文件' });
    }
    res.json({
        name: req.file.originalname,
        size: req.file.size,
        modified: new Date().toISOString(),
    });
});

// GET /api/storage/file/:filename - 获取文件内容
storageRouter.get('/storage/file/:filename', (req: Request, res: Response) => {
    const storagePath = getStoragePath(req.userToken!);
    const filePath = path.join(storagePath, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    const stat = fs.statSync(filePath);
    const ext = path.extname(req.params.filename).toLowerCase();
    const isBinary = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.pdf'].includes(ext);
    
    if (isBinary) {
        // 二进制文件返回 base64
        const content = fs.readFileSync(filePath);
        res.json({
            name: req.params.filename,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            content: content.toString('base64'),
            encoding: 'base64',
        });
    } else {
        // 文本文件直接返回内容
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.json({
                name: req.params.filename,
                size: stat.size,
                modified: stat.mtime.toISOString(),
                content,
            });
        } catch (e) {
            res.status(500).json({ error: '无法读取文件' });
        }
    }
});

// DELETE /api/storage/file/:filename - 删除存储文件
storageRouter.delete('/storage/file/:filename', (req: Request, res: Response) => {
    const storagePath = getStoragePath(req.userToken!);
    const filePath = path.join(storagePath, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
    } else {
        fs.unlinkSync(filePath);
    }
    
    res.json({ success: true });
});