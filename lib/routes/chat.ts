import { Router, Request, Response } from 'express';
import { getUserConfig } from '../user/manager';
import { getUserProviderKey, getUserProviderUrl } from './providers';
import http from 'http';
import https from 'https';
import { Socket } from 'net';

export const chatRouter = Router();

// 存储活跃请求的 socket 引用
const activeSockets = new Map<string, Socket>();

// 停止生成接口
chatRouter.post('/chat/stop', (req: Request, res: Response) => {
    const { requestId } = req.body;
    if (!requestId) {
        return res.status(400).json({ success: false, error: '缺少 requestId' });
    }
    const socket = activeSockets.get(requestId);
    if (socket) {
        console.log(`[停止生成] 找到请求 ${requestId}，正在强制销毁 socket`);
        socket.destroy();
        activeSockets.delete(requestId);
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '没有找到活跃的请求' });
    }
});

chatRouter.post('/chat', async (req: Request, res: Response) => {
    let requestId: string | null = null;
    let upstreamSocket: Socket | null = null;
    
    try {
        const { 
            messages, provider, model, temperature, top_p, max_tokens, 
            seed, frequency_penalty, presence_penalty, top_k, stop, stream, 
            chat_template_kwargs, deep_think, 
            requestId: reqId
        } = req.body;
        
        requestId = reqId || null;
        const userConfig = getUserConfig(req.userToken!);

        let apiKey: string | null = null;
        let baseUrl: string | null = null;

        if (provider) {
            apiKey = getUserProviderKey(req.userToken!, provider);
            baseUrl = getUserProviderUrl(provider);
            if (!apiKey || !baseUrl) {
                return res.status(400).json({ error: '提供商未配置或密钥缺失' });
            }
        } else {
            return res.status(400).json({ error: '未选择模型提供商' });
        }

        const params = userConfig.defaultParams;

        // 构建消息数组，保留 images 字段
        const rawMessages = (messages || []) as any[];
        const finalMessages: any[] = rawMessages.map((m: any) => ({
            role: m.role,
            content: m.content || '',
            images: m.images || []
        }));

        if (userConfig.systemPrompt) {
            if (finalMessages.length > 0 && finalMessages[0].role === 'system') {
                finalMessages[0].content = userConfig.systemPrompt + '\n\n' + finalMessages[0].content;
            } else {
                finalMessages.unshift({ role: "system", content: userConfig.systemPrompt, images: [] });
            }
        }

        // 将带 images 的消息转换为多模态 content 数组
        const processedMessages = finalMessages.map((msg: any) => {
            if (!msg.images || msg.images.length === 0) return msg;
            const contentParts: any[] = [];
            if (msg.content) {
                contentParts.push({ type: "text", text: msg.content });
            }
            msg.images.forEach((img: string) => {
                contentParts.push({ type: "image_url", image_url: { url: img } });
            });
            return { ...msg, content: contentParts };
        });

        const requestBody: any = {
            model: model || userConfig.currentModel || 'deepseek-v4-flash',
            messages: processedMessages,
            temperature: temperature ?? params.temperature,
            top_p: top_p ?? params.top_p,
            max_tokens: max_tokens ?? params.max_tokens,
            stream: stream ?? false,
        };

        if (seed !== null && seed !== undefined) requestBody.seed = seed;
        else if (params.seed !== null) requestBody.seed = params.seed;
        if (frequency_penalty !== undefined) requestBody.frequency_penalty = frequency_penalty;
        else requestBody.frequency_penalty = params.frequency_penalty;
        if (presence_penalty !== undefined) requestBody.presence_penalty = presence_penalty;
        else requestBody.presence_penalty = params.presence_penalty;
        if (top_k !== null && top_k !== undefined) requestBody.top_k = top_k;
        else if (params.top_k !== null) requestBody.top_k = params.top_k;
        if (stop) requestBody.stop = stop;
        if (chat_template_kwargs) requestBody.chat_template_kwargs = chat_template_kwargs;
        if (deep_think !== undefined) requestBody.deep_think = deep_think;

        // 创建 Agent，设置 keepAlive: false，便于管理 socket
        const agent = baseUrl.startsWith('https') 
            ? new https.Agent({ keepAlive: false }) 
            : new http.Agent({ keepAlive: false });

        // 监听 agent 的 'key' 事件来捕获底层 socket
        // @ts-ignore
        agent.on('key', (key: string, socket: Socket) => {
            if (requestId) {
                console.log(`[连接建立] 请求 ${requestId} 的 socket 已创建，key: ${key}`);
                activeSockets.set(requestId, socket);
                upstreamSocket = socket;
                
                // socket 关闭时自动清理
                socket.once('close', () => {
                    console.log(`[连接关闭] 请求 ${requestId} 的 socket 已关闭`);
                    activeSockets.delete(requestId!);
                });
            }
        });

        const upstreamResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            // @ts-ignore
            agent: agent,
        });

        if (!upstreamResponse.ok) {
            const err = await upstreamResponse.text();
            if (requestId) activeSockets.delete(requestId);
            return res.status(upstreamResponse.status).json({ error: err });
        }

        if (requestBody.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // 监听客户端断开连接
            req.on('close', () => {
                console.log(`[客户端断开] 请求 ${requestId}，销毁上游 socket`);
                if (upstreamSocket && !(upstreamSocket as Socket).destroyed) {
                    (upstreamSocket as Socket).destroy();
                }
                if (requestId) activeSockets.delete(requestId);
            });

            const reader = upstreamResponse.body?.getReader();
            if (!reader) {
                if (requestId) activeSockets.delete(requestId);
                return res.status(500).json({ error: '无响应流' });
            }

            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    // 如果 socket 已被销毁，停止读取
                    if (upstreamSocket && (upstreamSocket as Socket).destroyed) {
                        console.log('[流中断] 检测到 socket 已销毁，停止读取');
                        break;
                    }
                    
                    res.write(decoder.decode(value, { stream: true }));
                }
            } catch (e: any) {
                console.error('流传输异常:', e.message);
            } finally {
                if (requestId) activeSockets.delete(requestId);
                if (!res.writableEnded) {
                    res.end();
                }
            }
        } else {
            // 非流式处理
            const data: any = await upstreamResponse.json();
            let content = data.choices?.[0]?.message?.content || '';
            
            if (Array.isArray(content)) {
                content = content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('');
            } else if (typeof content === 'object' && content !== null) {
                content = content.text || JSON.stringify(content);
            }

            if (requestId) activeSockets.delete(requestId);
            res.json({ content });
        }
    } catch (e: any) {
        if (requestId) activeSockets.delete(requestId);
        if (upstreamSocket && !(upstreamSocket as Socket).destroyed) {
            (upstreamSocket as Socket).destroy();
        }
        
        if (e.name === 'AbortError') {
            if (!res.headersSent) {
                res.status(499).json({ error: '请求已取消' });
            }
        } else {
            console.error('请求处理失败:', e.message);
            if (!res.headersSent) {
                res.status(500).json({ error: e.message });
            }
        }
    }
});