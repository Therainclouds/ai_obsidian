/**
 * agent 控制面（docs/接口规范.md §3.1）
 *
 * `/api/agent/*` 指的是**本机那个进程**，不是云端模型 —— 云端没有对外 API，
 * 它藏在 agent 运行时内部（§1）。
 *
 * 本文件只处理 HTTP 关注点：读体、拼响应、串 SSE。
 * 业务在 services/agent.service.ts，协议在 acp-client.ts —— **这里不许直接碰适配器**。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AGENT_DELTA, AGENT_DONE, AGENT_ERROR, AGENT_STAGE } from '../../shared/events.ts';
import { json, sseOpen, sseSend } from '../lib/http.ts';
import { getStatus, noteError, runChat } from '../services/agent.service.ts';

/** GET /api/agent/status —— 存在性与能力面，**不触发会话**（懒启动） */
export function handleAgentStatus(res: ServerResponse): void {
  json(res, 200, getStatus());
}

/**
 * POST /api/agent/chat —— 发一轮对话，SSE 回流。
 *
 * 失败不毁内容（§6.3.4）：用户那条消息留在对话里、草稿不清空、输入框不锁，
 * 错误只挂一条，出口是内联重试。
 */
export async function handleAgentChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let raw = '';
  for await (const chunk of req) raw += chunk;

  let text = '';
  try {
    text = (JSON.parse(raw || '{}') as { text?: string }).text ?? '';
  } catch {
    json(res, 400, { error: '请求体不是合法 JSON' });
    return;
  }
  if (!text.trim()) {
    json(res, 400, { error: '空消息' });
    return;
  }

  sseOpen(res);
  try {
    await runChat(text, {
      onStage: (stage, label) => sseSend(res, AGENT_STAGE, { stage, label }),
      onDelta: (delta) => sseSend(res, AGENT_DELTA, { text: delta }),
    });
    sseSend(res, AGENT_DONE, { ok: true });
  } catch (e) {
    const err = e as Error & { code?: number };
    noteError(err.message);
    sseSend(res, AGENT_ERROR, { code: err.code ?? null, message: err.message });
  } finally {
    res.end();
  }
}
