import { Router, Request, Response } from 'express';
import { getUserConfig } from '../user/manager';
import { getUserProviderKey, getUserProviderUrl } from './providers';

export const chatRouter = Router();

chatRouter.post('/chat', async (req: Request, res: Response) => {
    try {
        const { messages, provider, model, temperature, top_p, max_tokens, seed, frequency_penalty, presence_penalty, top_k, stop, stream } = req.body;
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
            finalMessages.unshift({ role: "system", content: userConfig.systemPrompt, images: [] });
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

        const upstreamResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!upstreamResponse.ok) {
            const err = await upstreamResponse.text();
            return res.status(upstreamResponse.status).json({ error: err });
        }

        if (requestBody.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const reader = upstreamResponse.body?.getReader();
            if (!reader) return res.status(500).json({ error: '无响应流' });
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(decoder.decode(value, { stream: true }));
                }
            } catch (e) {
                console.error('流传输中断', e);
            } finally {
                res.end();
            }
        } else {
            const data: any = await upstreamResponse.json();
            let content = data.choices?.[0]?.message?.content || '';
            
            // 处理 content 可能是数组的情况（Claude 等模型）
            if (Array.isArray(content)) {
                content = content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('');
            } else if (typeof content === 'object' && content !== null) {
                // 处理其他可能的对象格式
                content = content.text || JSON.stringify(content);
            }
            
            res.json({ content });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});