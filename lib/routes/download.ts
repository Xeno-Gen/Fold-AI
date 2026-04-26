import { Router, Request, Response } from 'express';

export const downloadRouter = Router();

downloadRouter.post('/download', (req: Request, res: Response) => {
    const { code, lang } = req.body;
    if (!code) return res.status(400).json({ error: '缺少代码内容' });

    // 后缀映射（简单示例，可扩展）
    const extMap: Record<string, string> = {
        html: 'html',
        txt: 'txt',
        js: 'js',
        ts: 'ts',
        css: 'css',
        json: 'json',
        md: 'md',
        py: 'py',
        java: 'java',
    };
    const ext = extMap[lang] || 'txt';

    // 生成 16 位随机大小写字母
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let filename = '';
    for (let i = 0; i < 16; i++) {
        filename += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    filename += '.' + ext;

    // 设置响应头，浏览器会以附件形式下载
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(code);
});