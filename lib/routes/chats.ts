import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const chatsRouter = Router();
const DATA_DIR = path.join(__dirname, '../../data/users');

function getChatsFilePath(userToken: string): string {
    return path.join(DATA_DIR, userToken, 'chats.json');
}

function generateToken(): string {
    return crypto.randomBytes(12).toString('base64url').substring(0, 16);
}

function readChats(userToken: string): any[] {
    const filePath = getChatsFilePath(userToken);
    if (!fs.existsSync(filePath)) return [];
    const chats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // 为没有 token 的旧对话生成 token
    chats.forEach((c: any) => {
        if (!c.token) c.token = generateToken();
    });
    // 保存回文件以便后续使用
    writeChats(userToken, chats);
    return chats;
}

function writeChats(userToken: string, chats: any[]) {
    const filePath = getChatsFilePath(userToken);
    fs.writeFileSync(filePath, JSON.stringify(chats, null, 2));
}

// 获取对话列表（含 token）
chatsRouter.get('/chats', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    res.json(chats.map((c, i) => ({ id: i, title: c.title, token: c.token })));
});

// 通过 token 获取对话
chatsRouter.get('/chat/by-token/:token', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const chat = chats.find((c: any) => c.token === req.params.token);
    if (!chat) return res.status(404).json({ error: '对话不存在' });
    res.json(chat);
});

// 通过 id 获取对话
chatsRouter.get('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '对话不存在' });
    res.json(chats[id]);
});

// 创建新对话
chatsRouter.post('/chats', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const newChat = { title: '新对话', messages: [], token: generateToken() };
    chats.push(newChat);
    writeChats(req.userToken!, chats);
    res.json({ id: chats.length - 1, title: newChat.title, token: newChat.token });
});

// 更新对话
chatsRouter.put('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '聊天不存在' });
    chats[id] = req.body;
    writeChats(req.userToken!, chats);
    res.json({ success: true });
});

// 删除对话
chatsRouter.delete('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '聊天不存在' });
    chats.splice(id, 1);
    writeChats(req.userToken!, chats);
    res.json({ success: true });
});
