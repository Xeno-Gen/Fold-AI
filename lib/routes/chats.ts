import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const chatsRouter = Router();
const DATA_DIR = path.join(__dirname, '../../data/users');

function getChatsFilePath(userToken: string): string {
    return path.join(DATA_DIR, userToken, 'chats.json');
}

function readChats(userToken: string): any[] {
    const filePath = getChatsFilePath(userToken);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeChats(userToken: string, chats: any[]) {
    const filePath = getChatsFilePath(userToken);
    fs.writeFileSync(filePath, JSON.stringify(chats, null, 2));
}

chatsRouter.get('/chats', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    res.json(chats.map((c, i) => ({ id: i, title: c.title })));
});

chatsRouter.get('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '聊天不存在' });
    res.json(chats[id]);
});

chatsRouter.post('/chats', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const newChat = { title: '新对话', messages: [] };
    chats.push(newChat);
    writeChats(req.userToken!, chats);
    res.json({ id: chats.length - 1, title: newChat.title });
});

chatsRouter.put('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '聊天不存在' });
    chats[id] = req.body;
    writeChats(req.userToken!, chats);
    res.json({ success: true });
});

chatsRouter.delete('/chat/:id', (req: Request, res: Response) => {
    const chats = readChats(req.userToken!);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= chats.length) return res.status(404).json({ error: '聊天不存在' });
    chats.splice(id, 1);
    writeChats(req.userToken!, chats);
    res.json({ success: true });
});