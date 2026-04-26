import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(__dirname, '../../data/users');

export interface UserConfig {
    defaultParams: {
        temperature: number;
        top_p: number;
        max_tokens: number;
        seed: number | null;
        frequency_penalty: number;
        presence_penalty: number;
        top_k: number | null;
    };
    currentProvider: string | null;
    currentModel: string | null;
    customPort: number;
    providerKeys: Record<string, string[]>;
    selectedKeyIndices: Record<string, number>;
    systemPrompt: string;   // 新增
}

function ensureUserDir(userToken: string) {
    const dir = path.join(DATA_DIR, userToken);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const configPath = path.join(dir, 'config.json');
    if (!fs.existsSync(configPath)) {
        const defaultConfig: UserConfig = {
            defaultParams: {
                temperature: 0.6,
                top_p: 1.0,
                max_tokens: 6000,
                seed: null,
                frequency_penalty: 0,
                presence_penalty: 0,
                top_k: null,
            },
            currentProvider: null,
            currentModel: null,
            customPort: 8080,
            providerKeys: {},
            selectedKeyIndices: {},
            systemPrompt: '',
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
}

export function getUserConfig(userToken: string): UserConfig {
    const configPath = path.join(DATA_DIR, userToken, 'config.json');
    if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!data.providerKeys) data.providerKeys = {};
        if (!data.selectedKeyIndices) data.selectedKeyIndices = {};
        if (data.customPort === undefined) data.customPort = 8080;
        if (data.systemPrompt === undefined) data.systemPrompt = '';
        for (const key of Object.keys(data.providerKeys)) {
            if (typeof data.providerKeys[key] === 'string') {
                data.providerKeys[key] = [data.providerKeys[key]];
                data.selectedKeyIndices[key] = 0;
            }
        }
        return data;
    }
    ensureUserDir(userToken);
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function saveUserConfig(userToken: string, config: UserConfig) {
    const configPath = path.join(DATA_DIR, userToken, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

declare global {
    namespace Express {
        interface Request {
            userToken?: string;
        }
    }
}

export function initUserMiddleware(req: Request, res: Response, next: NextFunction) {
    let userToken = req.cookies?.user_token;
    if (!userToken) {
        userToken = uuidv4();
        res.cookie('user_token', userToken, {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax',
        });
    }
    req.userToken = userToken;
    ensureUserDir(userToken);
    next();
}