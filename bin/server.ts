// bin/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { parseEnv } from '../lib/parser/envparser';
import { chatRouter, setSystemVersion } from '../lib/routes/chat';
import { configRouter, getDefaultWorkDir } from '../lib/routes/config';
import { providersRouter, setProviders } from '../lib/routes/providers';
import { chatsRouter } from '../lib/routes/chats';
import { initUserMiddleware, setDefaultSystemPrompt, getUserConfig } from '../lib/user/manager';
import { setDefaultParams } from '../lib/routes/config';
import { uploadRouter } from '../lib/routes/upload';
import { downloadRouter } from '../lib/routes/download';
import { storageRouter } from '../lib/routes/storage';
import { pluginsRouter } from '../lib/routes/plugins';
import { initPlugins } from '../lib/plugin/loader';
import { logger } from '../lib/logger';

// 多路径查找 .env：当前目录 > 当前目录/config > 包目录/config > 包目录
const pkgDir = path.join(__dirname, '..');
const envCandidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'config', '.env'),
    path.join(pkgDir, 'config', '.env'),
    path.join(pkgDir, '.env'),
];
let envPath = '';
let envContent = '';
for (const p of envCandidates) {
    if (fs.existsSync(p)) { envPath = p; envContent = fs.readFileSync(p, 'utf-8'); break; }
}
if (!envPath) {
    console.warn('[Fold.AI] 未找到 .env 配置文件，使用默认参数');
}
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
setDefaultSystemPrompt(envData.SYSTEM || '');

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
// 公开工作目录文件链接
app.use('/cwd', express.static(path.join(__dirname, '../../cwd')));

app.use('/api', chatRouter);
app.use('/api', configRouter);
app.use('/api', providersRouter);
app.use('/api', chatsRouter);
app.use('/api', uploadRouter);
app.use('/api', downloadRouter);
app.use('/api', storageRouter);
app.use('/api', pluginsRouter);
const loadedPlugins = initPlugins(pluginsRouter);

// 初始化检查：用户已选择提供商就算完成，Key 可稍后配置
function isUserInitialized(userToken: string): boolean {
    try {
        const config = getUserConfig(userToken);
        return !!config.currentProvider;
    } catch (e) {
        return false;
    }
}

// 初始化状态查询
app.get('/api/init/status', (req, res) => {
    res.json({ initialized: isUserInitialized(req.userToken!) });
});

// 安全解析工作目录路径
function resolveWorkPath(subPath: string, workDir?: string): string {
    const base = workDir || getDefaultWorkDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    if (!subPath) return base;
    const safe = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.join(base, safe);
    if (!resolved.startsWith(base)) return base;
    return resolved;
}

// 浏览工作目录
app.get('/api/files/browse', (req, res) => {
    try {
        const workDir = (req.query.workingDirectory as string) || undefined;
        const dirPath = resolveWorkPath(req.query.dir as string || '', workDir);
        if (!fs.existsSync(dirPath)) return res.status(404).json({ error: '目录不存在' });
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) return res.status(400).json({ error: '不是目录' });
        const items = fs.readdirSync(dirPath).map(name => {
            const fullPath = path.join(dirPath, name);
            const s = fs.statSync(fullPath);
            return { name, isDir: s.isDirectory(), size: s.size, mtime: s.mtime.toISOString() };
        }).sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        const base = workDir || getDefaultWorkDir();
        const relPath = dirPath.startsWith(base) ? dirPath.substring(base.length).replace(/\\/g, '/') || '/' : '/';
        res.json({ path: relPath, items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 读取工作目录文件
app.get('/api/files/read', (req, res) => {
    try {
        const workDir = (req.query.workingDirectory as string) || undefined;
        const filePath = resolveWorkPath(req.query.file as string || '', workDir);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) return res.status(400).json({ error: '不能读取目录' });
        if (stat.size > 10 * 1024 * 1024) return res.status(400).json({ error: '文件过大' });
        const ext = path.extname(filePath).toLowerCase();
        const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.log', '.csv', '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.rb', '.php', '.sh', '.bat', '.ps1', '.sql', '.vue', '.svelte', '.toml', '.env', '.gitignore', '.svg'];
        const isText = textExts.includes(ext) || !ext;
        if (isText) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return res.json({ name: path.basename(filePath), content, size: stat.size, mtime: stat.mtime.toISOString(), text: true });
        }
        res.json({ name: path.basename(filePath), size: stat.size, mtime: stat.mtime.toISOString(), text: false, ext });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

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
                html = html.replace('<script src="/intro.js"></script>\n\t<script src="/chat.js"></script>\n\t<script src="/slash.js"></script>', '<script>window.__CHAT_DATA__=' + chatJson + ';window.__CHAT_TOKEN__="' + req.params.token + '";</script><script src="/intro.js"></script>\n\t<script src="/chat.js"></script>\n\t<script src="/slash.js"></script>');
                return res.send(html);
            }
        }
    } catch (e) {}
    // 未找到对话，也标记 token 供前端读取
    html = html.replace('<script src="/intro.js"></script>\n\t<script src="/chat.js"></script>\n\t<script src="/slash.js"></script>', '<script>window.__CHAT_DATA__=null;window.__CHAT_TOKEN__="' + req.params.token + '";</script><script src="/intro.js"></script>\n\t<script src="/chat.js"></script>\n\t<script src="/slash.js"></script>');
    res.send(html);
});

app.get('/', (req, res) => {
    if (!isUserInitialized(req.userToken!)) {
        return res.sendFile(path.join(__dirname, '../static/init.html'));
    }
    res.sendFile(path.join(__dirname, '../static/intro.html'));
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