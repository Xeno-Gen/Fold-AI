// bin/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { parseEnv } from '../lib/parser/envparser';
import { chatRouter } from '../lib/routes/chat';
import { configRouter } from '../lib/routes/config';
import { providersRouter, setProviders } from '../lib/routes/providers';
import { chatsRouter } from '../lib/routes/chats';
import { initUserMiddleware } from '../lib/user/manager';
import { setDefaultParams } from '../lib/routes/config';
import { uploadRouter } from '../lib/routes/upload';
import { downloadRouter } from '../lib/routes/download';
import { storageRouter } from '../lib/routes/storage';

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
    providers.push({ id, name, url, modelsUrl, icon });
});
setProviders(providers);

const app = express();
const PORT = parseInt(envData.POST) || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(initUserMiddleware);

app.use(express.static(path.join(__dirname, '../static')));

app.use('/api', chatRouter);
app.use('/api', configRouter);
app.use('/api', providersRouter);
app.use('/api', chatsRouter);
app.use('/api', uploadRouter);
app.use('/api', downloadRouter);
app.use('/api', storageRouter);

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/intro.html'));
});

const dirs = [
    path.join(__dirname, '../data'),
    path.join(__dirname, '../data/users'),
    path.join(__dirname, '../data/uploads'),
];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('已创建文件夹:', dir);
    }
});

app.listen(PORT, envData.LISTEN || '0.0.0.0', () => {
    console.log(`Fold.AI server running on http://${envData.LISTEN || '0.0.0.0'}:${PORT}`);
});