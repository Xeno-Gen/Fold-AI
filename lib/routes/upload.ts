import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../data/uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const uploadRouter = Router();

uploadRouter.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: '没有文件' });

        const ext = path.extname(file.originalname).toLowerCase();
        const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);

        if (isImage) {
            const base64 = fs.readFileSync(file.path, 'base64');
            const mimeMap: Record<string, string> = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
            };
            return res.json({
                type: 'image',
                fileName: file.originalname,
                content: `data:${mimeMap[ext] || 'image/png'};base64,${base64}`,
                path: file.path
            });
        } else {
            const content = fs.readFileSync(file.path, 'utf-8');
            return res.json({
                type: 'text',
                fileName: file.originalname,
                content: content,
                path: file.path
            });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});