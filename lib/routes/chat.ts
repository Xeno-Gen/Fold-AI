import { Router, Request, Response } from 'express';
import { getUserConfig, incrementUsage } from '../user/manager';
import { getUserProviderKey, getUserProviderUrl, getProviders } from './providers';
import { getSystemPrompt } from '../parser/configparser';
import { logger } from '../logger';

export const chatRouter = Router();

// 系统版本（服务器启动时设置）
let systemVersion = '';

export function setSystemVersion(ver: string) {
    systemVersion = ver;
}

// 存储活跃请求的 AbortController
const activeControllers = new Map<string, AbortController>();

// 停止生成接口
chatRouter.post('/chat/stop', (req: Request, res: Response) => {
    const { requestId } = req.body;
    if (!requestId) {
        return res.status(400).json({ success: false, error: '缺少 requestId' });
    }
    const controller = activeControllers.get(requestId);
    if (controller) {
        logger.info(`stop generation: request ${requestId}, aborting`);
        controller.abort();
        activeControllers.delete(requestId);
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '没有找到活跃的请求' });
    }
});

// 将消息转换为 Anthropic 格式
function toAnthropicMessages(messages: any[]) {
    const systemMessages: string[] = [];
    const apiMessages: any[] = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemMessages.push(msg.content);
        } else if (msg.role === 'user' || msg.role === 'assistant') {
            let content: any;
            if (msg.images && msg.images.length > 0) {
                const parts: any[] = [];
                if (msg.content) parts.push({ type: 'text', text: msg.content });
                msg.images.forEach((img: string) => {
                    // 支持 base64 或 url 图片
                    if (img.startsWith('data:')) {
                        const mediaType = img.split(';')[0].split(':')[1] || 'image/png';
                        const base64Data = img.split(',')[1] || img;
                        parts.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } });
                    } else {
                        parts.push({ type: 'image', source: { type: 'url', url: img } });
                    }
                });
                content = parts;
            } else {
                content = msg.content;
            }
            apiMessages.push({ role: msg.role, content });
        }
        // 忽略其他 role
    }

    return { system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined, messages: apiMessages };
}

// 将 OpenAI 流式响应行转换为前端 SSE
function processOpenAIStreamLine(line: string, fullContent: { current: string }, fullReasoning: { current: string }): string | null {
    if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data === '[DONE]') return 'data: [DONE]\n\n';
        try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (delta) {
                if (delta.reasoning_content) {
                    fullReasoning.current += String(delta.reasoning_content);
                    return 'data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: delta.reasoning_content } }] }) + '\n\n';
                }
                if (delta.content !== undefined && delta.content !== null) {
                    const contentPart = parseContent(delta.content);
                    if (contentPart) {
                        fullContent.current += contentPart;
                        return 'data: ' + JSON.stringify({ choices: [{ delta: { content: contentPart } }] }) + '\n\n';
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

function parseContent(c: any): string {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
        return c.map(item => {
            if (typeof item === 'string') return item;
            if (item?.text) return item.text;
            if (item?.value) return item.value;
            return '';
        }).join('');
    }
    if (typeof c === 'object' && c !== null) {
        return c.text || c.value || c.content || '';
    }
    return '';
}

// 处理非流式 OpenAI 响应
function parseOpenAIResponse(data: any): string {
    let content = data.choices?.[0]?.message?.content || '';
    if (Array.isArray(content)) {
        content = content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
    } else if (typeof content === 'object' && content !== null) {
        content = content.text || JSON.stringify(content);
    }
    return content;
}

// 处理 Anthropic 流式 SSE 事件，转换为前端统一的 SSE 格式
function processAnthropicStreamLine(line: string, fullContent: { current: string }, fullReasoning: { current: string }): string | null {
    if (line.startsWith('event: ')) {
        // 事件类型行，跳过（在 data 行处理）
        return null;
    }
    if (line.startsWith('data: ')) {
        const dataStr = line.substring(6);
        try {
            const data = JSON.parse(dataStr);
            const type = data.type;

            if (type === 'content_block_delta') {
                const delta = data.delta;
                if (delta?.type === 'text' && delta.text) {
                    fullContent.current += delta.text;
                    return 'data: ' + JSON.stringify({ choices: [{ delta: { content: delta.text } }] }) + '\n\n';
                }
                if (delta?.type === 'thinking_delta' && delta?.thinking) {
                    fullReasoning.current += delta.thinking;
                    return 'data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: delta.thinking } }] }) + '\n\n';
                }
            } else if (type === 'message_start') {
                // 可以忽略或处理初始消息
                return null;
            } else if (type === 'message_delta') {
                // delta stop_reason, 可以忽略
                return null;
            } else if (type === 'message_stop') {
                return 'data: [DONE]\n\n';
            } else if (type === 'content_block_start') {
                return null;
            } else if (type === 'content_block_stop') {
                return null;
            } else if (type === 'ping') {
                return null;
            }
        } catch (e) {}
    }
    return null;
}

// 处理非流式 Anthropic 响应
function parseAnthropicResponse(data: any): string {
    if (data.content && Array.isArray(data.content)) {
        return data.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
    }
    return data.content?.[0]?.text || '';
}

chatRouter.post('/chat', async (req: Request, res: Response) => {
    let requestId: string | null = null;
    let abortController: AbortController | null = null;

    try {
        const {
            messages, provider, model, temperature, top_p, max_tokens,
            seed, frequency_penalty, presence_penalty, top_k, stop, stream,
            chat_template_kwargs, deep_think, thinkMode, chatFormat,
            requestId: reqId
        } = req.body;

        requestId = reqId || null;
        logger.info(`API chat: provider=${provider} model=${model} stream=${stream ?? false} messages=${(messages||[]).length}`);

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

        // 判断使用的格式
        const currentFormat = chatFormat || 'OpenAI';
        const providerInfo = getProviders().find((p: any) => p.id === provider);

        // 如果是 Anthropic 格式，使用对应的 URL
        let requestUrl = baseUrl;
        let isAnthropicFormat = false;
        if (currentFormat === 'Anthropic') {
            isAnthropicFormat = true;
            // 如果提供商有专门的 anthropic URL，使用它
            if (providerInfo?.anthropicUrl) {
                requestUrl = providerInfo.anthropicUrl;
            }
        }

        const params = userConfig.defaultParams;

        // 构建消息数组，保留 images 字段
        const rawMessages = (messages || []) as any[];
        const finalMessages: any[] = rawMessages.map((m: any) => ({
            role: m.role,
            content: m.content || '',
            images: m.images || []
        }));

        if (!isAnthropicFormat) {
            // OpenAI 格式：system prompt 合并到消息中
            // 从 config/prompts/*.md 读取基础系统提示词
            const basePrompt = getSystemPrompt();
            let effectivePrompt = '';
            // 非纯净模式时加入基础提示词
            if (!userConfig.pureMode && basePrompt) {
                effectivePrompt = basePrompt;
            }
            if (userConfig.systemPrompt) {
                effectivePrompt = effectivePrompt
                    ? effectivePrompt + '\n\n' + userConfig.systemPrompt
                    : userConfig.systemPrompt;
            }
            if (systemVersion) {
                effectivePrompt = `[用户使用的系统版本: ${systemVersion}]\n${effectivePrompt}`;
            }
            if (effectivePrompt) {
                if (finalMessages.length > 0 && finalMessages[0].role === 'system') {
                    finalMessages[0].content = effectivePrompt + '\n\n' + finalMessages[0].content;
                } else {
                    finalMessages.unshift({ role: "system", content: effectivePrompt, images: [] });
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

            const openaiBody: any = {
                model: model || userConfig.currentModel || 'deepseek-v4-flash',
                messages: processedMessages,
                temperature: temperature ?? params.temperature,
                top_p: top_p ?? params.top_p,
                max_tokens: max_tokens ?? params.max_tokens,
                stream: stream ?? false,
            };

            if (seed !== null && seed !== undefined) openaiBody.seed = seed;
            else if (params.seed !== null) openaiBody.seed = params.seed;
            if (frequency_penalty !== undefined) openaiBody.frequency_penalty = frequency_penalty;
            else openaiBody.frequency_penalty = params.frequency_penalty;
            if (presence_penalty !== undefined) openaiBody.presence_penalty = presence_penalty;
            else openaiBody.presence_penalty = params.presence_penalty;
            if (top_k !== null && top_k !== undefined) openaiBody.top_k = top_k;
            else if (params.top_k !== null) openaiBody.top_k = params.top_k;
            if (stop) openaiBody.stop = stop;
            if (chat_template_kwargs) openaiBody.chat_template_kwargs = chat_template_kwargs;
            // DeepSeek 思考强度适配
            if (provider === 'DEEPSEEK' && deep_think) {
                const effort = thinkMode === 'meditate' ? 'max' : 'high';
                openaiBody.reasoning_effort = effort;
            } else if (deep_think !== undefined) {
                openaiBody.deep_think = deep_think;
            }

            abortController = new AbortController();
            if (requestId) {
                activeControllers.set(requestId, abortController);
                abortController.signal.addEventListener('abort', () => {
                    logger.info(`request aborted for ${requestId}`);
                    activeControllers.delete(requestId!);
                }, { once: true });
            }

            const upstreamResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(openaiBody),
                signal: abortController.signal,
            });

            if (!upstreamResponse.ok) {
                const err = await upstreamResponse.text();
                if (requestId) activeControllers.delete(requestId);
                return res.status(upstreamResponse.status).json({ error: err });
            }

            // 记录模型使用次数
            const usedModel = openaiBody.model;
            if (usedModel && req.userToken) {
                try { incrementUsage(req.userToken, usedModel); } catch (e) {}
            }

            const reqStartTime = Date.now();
            if (openaiBody.stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.write('data: ' + JSON.stringify({ type: 'request_body', requestBody: openaiBody }) + '\n\n');

                logger.info(`[chat] streaming → model=${usedModel} msgs=${(messages||[]).length}`);

                req.on('close', () => {
                    const dur = Date.now() - reqStartTime;
                    logger.info(`[chat] stream ended (client disconnect) model=${usedModel} dur=${dur}ms`);
                    if (abortController) abortController.abort();
                    if (requestId) activeControllers.delete(requestId);
                });

                const reader = upstreamResponse.body?.getReader();
                if (!reader) {
                    if (requestId) activeControllers.delete(requestId);
                    return res.status(500).json({ error: '无响应流' });
                }

                const decoder = new TextDecoder();
                let streamBuffer = '';
                let lastUsage: any = null;
                let streamAborted = false;
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        streamBuffer += chunk;
                        const lines = streamBuffer.split('\n');
                        streamBuffer = lines.pop() || '';
                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const d = JSON.parse(line.substring(6));
                                    if (d.usage) lastUsage = d.usage;
                                } catch {}
                            }
                        }
                        res.write(chunk);
                    }
                } catch (e: any) {
                    if (e.name === 'AbortError') {
                        streamAborted = true;
                        const dur = Date.now() - reqStartTime;
                        logger.info(`[chat] stream aborted model=${usedModel} dur=${dur}ms`);
                    } else {
                        logger.error('stream error: ' + e.message);
                    }
                } finally {
                    if (!streamAborted) {
                        const dur = Date.now() - reqStartTime;
                        const tokStr = lastUsage
                            ? `in=${lastUsage.prompt_tokens || '?'} out=${lastUsage.completion_tokens || '?'} total=${lastUsage.total_tokens || '?'}`
                            : 'tokens=?';
                        logger.info(`[chat] stream done model=${usedModel} ${tokStr} dur=${dur}ms`);
                    }
                    if (requestId) activeControllers.delete(requestId);
                    if (!res.writableEnded) {
                        res.end();
                    }
                }
            } else {
                const data: any = await upstreamResponse.json();
                const content = parseOpenAIResponse(data);
                const usage = data.usage || null;
                const dur = Date.now() - reqStartTime;
                const tokStr = usage
                    ? `in=${usage.prompt_tokens || '?'} out=${usage.completion_tokens || '?'} total=${usage.total_tokens || '?'}`
                    : 'tokens=?';
                logger.info(`[chat] done model=${usedModel} ${tokStr} dur=${dur}ms`);
                if (requestId) activeControllers.delete(requestId);
                res.json({ content, usage, requestBody: openaiBody });
            }
        } else {
            // ===== Anthropic 格式 =====
            const { system, messages: anthropicMessages } = toAnthropicMessages(finalMessages);

            // 注入系统版本和用户 systemPrompt 到 Anthropic system 字段
            // 从 config/prompts/*.md 读取基础系统提示词
            const basePrompt = getSystemPrompt();
            let effectiveSystem = system || '';
            // 非纯净模式时加入基础提示词
            if (!userConfig.pureMode && basePrompt) {
                effectiveSystem = effectiveSystem
                    ? basePrompt + '\n\n' + effectiveSystem
                    : basePrompt;
            }
            if (userConfig.systemPrompt) {
                effectiveSystem = effectiveSystem
                    ? effectiveSystem + '\n\n' + userConfig.systemPrompt
                    : userConfig.systemPrompt;
            }
            if (systemVersion) {
                effectiveSystem = effectiveSystem
                    ? `[用户使用的系统版本: ${systemVersion}]\n${effectiveSystem}`
                    : `[用户使用的系统版本: ${systemVersion}]`;
            }

            const anthropicBody: any = {
                model: model || userConfig.currentModel || 'claude-sonnet-4-6',
                max_tokens: max_tokens || params.max_tokens || 4096,
                messages: anthropicMessages,
                temperature: temperature ?? params.temperature,
                top_p: top_p ?? params.top_p,
                stream: stream ?? false,
            };

            if (effectiveSystem) anthropicBody.system = effectiveSystem;
            if (top_k !== null && top_k !== undefined) anthropicBody.top_k = top_k;
            else if (params.top_k !== null) anthropicBody.top_k = params.top_k;
            if (stop) anthropicBody.stop_sequences = Array.isArray(stop) ? stop : [stop];
            if (seed !== null && seed !== undefined) anthropicBody.metadata = { ...anthropicBody.metadata, user_id: String(seed) };

            abortController = new AbortController();
            if (requestId) {
                activeControllers.set(requestId, abortController);
                abortController.signal.addEventListener('abort', () => {
                    logger.info(`request aborted for ${requestId} (Anthropic)`);
                    activeControllers.delete(requestId!);
                }, { once: true });
            }

            const upstreamResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(anthropicBody),
                signal: abortController.signal,
            });

            if (!upstreamResponse.ok) {
                const err = await upstreamResponse.text();
                if (requestId) activeControllers.delete(requestId);
                return res.status(upstreamResponse.status).json({ error: err });
            }

            // 记录模型使用次数
            const antModel = anthropicBody.model;
            if (antModel && req.userToken) {
                try { incrementUsage(req.userToken, antModel); } catch (e) {}
            }

            const antReqStart = Date.now();
            if (anthropicBody.stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.write('data: ' + JSON.stringify({ type: 'request_body', requestBody: anthropicBody }) + '\n\n');

                logger.info(`[chat] streaming → model=${antModel} msgs=${(messages||[]).length}`);

                req.on('close', () => {
                    const dur = Date.now() - antReqStart;
                    logger.info(`[chat] stream ended (client disconnect) model=${antModel} dur=${dur}ms`);
                    if (abortController) abortController.abort();
                    if (requestId) activeControllers.delete(requestId);
                });

                const reader = upstreamResponse.body?.getReader();
                if (!reader) {
                    if (requestId) activeControllers.delete(requestId);
                    return res.status(500).json({ error: '无响应流' });
                }

                const decoder = new TextDecoder();
                let buffer = '';
                const dummyContent = { current: '' };
                const dummyReasoning = { current: '' };
                let streamUsage: any = null;
                let antAborted = false;

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('data: ')) {
                                try {
                                    const d = JSON.parse(trimmed.substring(6));
                                    if (d.type === 'message_start' && d.message?.usage) {
                                        streamUsage = { ...d.message.usage };
                                    } else if (d.type === 'message_delta' && d.usage?.output_tokens !== undefined) {
                                        if (!streamUsage) streamUsage = {};
                                        streamUsage.output_tokens = d.usage.output_tokens;
                                        streamUsage.total_tokens = (streamUsage.input_tokens || 0) + d.usage.output_tokens;
                                    }
                                } catch {}
                            }
                            const converted = processAnthropicStreamLine(trimmed, dummyContent, dummyReasoning);
                            if (converted) {
                                res.write(converted);
                            }
                        }
                    }
                    if (buffer.trim()) {
                        const converted = processAnthropicStreamLine(buffer.trim(), dummyContent, dummyReasoning);
                        if (converted) {
                            res.write(converted);
                        }
                    }
                    if (streamUsage) {
                        res.write('data: ' + JSON.stringify({ usage: streamUsage }) + '\n\n');
                    }
                    res.write('data: [DONE]\n\n');
                } catch (e: any) {
                    if (e.name === 'AbortError') {
                        antAborted = true;
                        logger.info(`[chat] stream aborted model=${antModel} dur=${Date.now() - antReqStart}ms`);
                    } else {
                        logger.error('Anthropic stream error: ' + e.message);
                    }
                } finally {
                    if (!antAborted) {
                        const dur = Date.now() - antReqStart;
                        const tokStr = streamUsage
                            ? `in=${streamUsage.input_tokens || '?'} out=${streamUsage.output_tokens || '?'} total=${streamUsage.total_tokens || '?'}`
                            : 'tokens=?';
                        logger.info(`[chat] stream done model=${antModel} ${tokStr} dur=${dur}ms`);
                    }
                    if (requestId) activeControllers.delete(requestId);
                    if (!res.writableEnded) {
                        res.end();
                    }
                }
            } else {
                const data: any = await upstreamResponse.json();
                const content = parseAnthropicResponse(data);
                const usage = data.usage || null;
                const dur = Date.now() - antReqStart;
                const tokStr = usage
                    ? `in=${usage.input_tokens || '?'} out=${usage.output_tokens || '?'} total=${usage.total_tokens || '?'}`
                    : 'tokens=?';
                logger.info(`[chat] done model=${antModel} ${tokStr} dur=${dur}ms`);
                if (requestId) activeControllers.delete(requestId);
                res.json({ content, usage, requestBody: anthropicBody });
            }
        }
    } catch (e: any) {
        if (requestId) activeControllers.delete(requestId);
        if (abortController) abortController.abort();

        if (e.name === 'AbortError') {
            if (!res.headersSent) {
                res.status(499).json({ error: '请求已取消' });
            }
        } else {
            logger.error('request failed: ' + e.message);
            if (!res.headersSent) {
                res.status(500).json({ error: e.message });
            }
        }
    }
});
