// bin/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { parseEnv } from '../lib/parser/envparser';
import { chatRouter, setSystemVersion } from '../lib/routes/chat';
import { configRouter } from '../lib/routes/config';
import { providersRouter, setProviders } from '../lib/routes/providers';
import { chatsRouter } from '../lib/routes/chats';
import { initUserMiddleware } from '../lib/user/manager';
import { setDefaultParams } from '../lib/routes/config';
import { uploadRouter } from '../lib/routes/upload';
import { downloadRouter } from '../lib/routes/download';
import { storageRouter } from '../lib/routes/storage';
import { pluginsRouter } from '../lib/routes/plugins';
import { logger } from '../lib/logger';

const envPath = path.join(__dirname, '../config/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envData = parseEnv(envContent);

// 默认参数
const defaultParams = {
    max_tokens: parseInt(envData.MAX_TOKENS) || 6000,
    temperature: parseFloat(envData.TEMPERATURE) || 0.6,
    top_p: parseFloat(envData.TOP_P) || 1.0,
    seed: envData.SEED && envData.SEED !== 'null' ? parseInt(envData.SEED) : null,
    frequency_penalty: parseFloat(envData.FREQUENCY_PENALTY) || 0,
    presence_penalty: parseFloat(envData.PRESENCE_PENALTY) || 0,
    stream: envData.STREAM === 'true',
    timeout: parseInt(envData.TIMEOUT) || 60,
};
setDefaultParams(defaultParams);

const providers: any[] = [];
const providerIds = Object.keys(envData)
    .filter(k => k.endsWith('_ENABLED') && envData[k] === 'true')
    .map(k => k.replace('_ENABLED', ''));
providerIds.forEach(id => {
    const name = envData[id + '_NAME'] || id;
    const url = envData[id + '_URL'] || '';
    const modelsUrl = envData[id + '_MODELS_URL'] || '';
    const icon = envData[id + '_ICON'] || '';
    const chatFormat = envData[id + '_CHAT_FORMAT'] || 'OpenAI';
    const anthropicUrl = envData[id + '_ANTHROPIC'] || '';
    providers.push({ id, name, url, modelsUrl, icon, chatFormat, anthropicUrl });
});
setProviders(providers);

// 检测系统版本并注入
const sysVersion = `${os.type()} ${os.release()} (${os.arch()})`;
setSystemVersion(sysVersion);
logger.info('System version: ' + sysVersion);

const app = express();
const PORT = parseInt(envData.POST) || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(initUserMiddleware);

app.use(express.static(path.join(__dirname, '../static')));
app.use('/plugins', express.static(path.join(__dirname, '../Plugin')));
app.use('/com', express.static(path.join(__dirname, '../com')));

app.use('/api', chatRouter);
app.use('/api', configRouter);
app.use('/api', providersRouter);
app.use('/api', chatsRouter);
app.use('/api', uploadRouter);
app.use('/api', downloadRouter);
app.use('/api', storageRouter);
app.use('/api', pluginsRouter);

app.get('/chat/:token', (req, res) => {
    const htmlPath = path.join(__dirname, '../static/intro.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');
    // 尝试从用户数据中查找该 token 对应的对话
    try {
        const dataDir = path.join(__dirname, '../data/users', req.userToken!, 'chats.json');
        if (fs.existsSync(dataDir)) {
            const chats = JSON.parse(fs.readFileSync(dataDir, 'utf-8'));
            const chat = chats.find((c: any) => c.token === req.params.token);
            if (chat) {
                const chatJson = JSON.stringify(chat).replace(/</g, '\\u003c');
                html = html.replace('<script src="/intro.js"></script>', '<script>window.__CHAT_DATA__=' + chatJson + ';window.__CHAT_TOKEN__="' + req.params.token + '";</script><script src="/intro.js"></script>');
                return res.send(html);
            }
        }
    } catch (e) {}
    // 未找到对话，也标记 token 供前端读取
    html = html.replace('<script src="/intro.js"></script>', '<script>window.__CHAT_DATA__=null;window.__CHAT_TOKEN__="' + req.params.token + '";</script><script src="/intro.js"></script>');
    res.send(html);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/intro.html'));
});

const dirs = [
    path.join(__dirname, '../data'),
    path.join(__dirname, '../data/users'),
    path.join(__dirname, '../data/uploads'),
    path.join(__dirname, '../data/plugin_data'),
];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('created dir: ' + dir);
    }
});

app.listen(PORT, envData.LISTEN || '0.0.0.0', () => {
    logger.info(`Fold.AI server running on http://${envData.LISTEN || '0.0.0.0'}:${PORT}`);
});