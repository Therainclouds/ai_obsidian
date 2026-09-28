/**
 * 本地宿主进程（DESIGN-SPEC §9.1.3 · ADR-0008）
 *
 * 职责：起进程 · 托管前端产物 · 拉起 agent 运行时并持有它的 stdio · 开 localhost 那一条通道。
 * 它是**知识空间唯一的写入者**（M0 阶段还没有写任何文件）。
 *
 * 依赖克制：只用 node:http，不引 express。
 * 理由见 ADR-0004 §1「内存是硬预算 · 白名单之外不再装依赖」。
 */
import { createServer, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_PORT } from '../shared/ports.ts';
import type { HealthPayload } from '../shared/types.ts';
import {
  AGENT_DELTA,
  AGENT_DONE,
  AGENT_ERROR,
  AGENT_STAGE,
  AGENT_STAGE_LABEL,
  AGENT_STAGE_ORDER,
  type AgentStageEvent,
} from '../shared/events.ts';
import { AcpClient, hermesAvailable, resolveHermes, type InitializeResult } from './acp-client.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const startedAt = Date.now();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function json(res: ServerResponse, code: number, body: unknown): void {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
}

function sseOpen(res: ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
}

function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** 防目录穿越：把请求路径限制在 dist/ 内 */
function safeJoin(base: string, rel: string): string | null {
  const p = normalize(join(base, rel));
  return p.startsWith(base) ? p : null;
}

// ---- agent 运行时的单例（ADR-0002 §5：一个 home 一个 agent，因此串行化复用）----
let client: AcpClient | null = null;
let initResult: InitializeResult | null = null;
let sessionId: string | null = null;
let agentError: string | null = null;

async function ensureAgent(): Promise<AcpClient> {
  if (client && sessionId) return client;
  if (!client) {
    if (!hermesAvailable()) {
      const { py } = resolveHermes();
      throw new Error(`未找到 agent 运行时。期望的解释器：${py}`);
    }
    client = new AcpClient();
    initResult = await client.start();
    console.log(`[host] agent 就绪：${initResult.agentInfo.name} ${initResult.agentInfo.version}`);
  }
  if (!sessionId) {
    const s = await client.newSession(process.cwd());
    sessionId = s.sessionId;
    console.log(`[host] 会话已建立：${sessionId}`);
  }
  return client;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${HOST_PORT}`);
  const path = url.pathname;

  if (path === '/api/health') {
    const body: HealthPayload = {
      ok: true,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      agentConnected: Boolean(sessionId),
      space: '我的空间',
    };
    return json(res, 200, body);
  }

  /** agent 运行时的存在性 / 能力面，不触发会话 */
  if (path === '/api/agent/status') {
    return json(res, 200, {
      installed: hermesAvailable(),
      resolved: resolveHermes(),
      initialized: Boolean(initResult),
      agentInfo: initResult?.agentInfo ?? null,
      capabilities: initResult?.agentCapabilities ?? null,
      hasSession: Boolean(sessionId),
      error: agentError,
    });
  }

  /** 发一轮对话，SSE 回流。前端与宿主只有这一条通道（§9.1.3 · docs/接口规范.md §3.1） */
  if (path === '/api/agent/chat' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let text = '';
    try {
      text = (JSON.parse(raw || '{}') as { text?: string }).text ?? '';
    } catch {
      return json(res, 400, { error: '请求体不是合法 JSON' });
    }
    if (!text.trim()) return json(res, 400, { error: '空消息' });

    const stage = (key: (typeof AGENT_STAGE_ORDER)[number]) =>
      sseSend(res, AGENT_STAGE, {
        stage: key,
        label: AGENT_STAGE_LABEL[key],
      } satisfies AgentStageEvent);

    sseOpen(res);
    stage(AGENT_STAGE_ORDER[0]);

    try {
      const c = await ensureAgent();
      stage(AGENT_STAGE_ORDER[1]);

      c.setUpdateHandler((u) => {
        const t = u.update?.content?.text;
        if (typeof t === 'string' && t) sseSend(res, AGENT_DELTA, { text: t });
      });

      stage(AGENT_STAGE_ORDER[2]);
      await c.prompt(sessionId!, text);
      agentError = null;
      sseSend(res, AGENT_DONE, { ok: true });
    } catch (e) {
      const err = e as Error & { code?: number };
      agentError = err.message;
      // 失败不毁内容：用户写的留在对话里，错误只挂一条（§6.3.4）
      sseSend(res, AGENT_ERROR, { code: err.code ?? null, message: err.message });
    } finally {
      client?.setUpdateHandler(null);
      res.end();
    }
    return;
  }

  // SSE：给界面一个长期通道（M0 先只保持连接）
  if (path === '/events') {
    sseOpen(res);
    res.write(': connected\n\n');
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);
    req.on('close', () => clearInterval(keepAlive));
    return;
  }

  // 静态产物
  try {
    await stat(DIST);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('dist/ 不存在 —— 先跑 npm run build\n');
  }

  const rel = path === '/' ? '/index.html' : path;
  const file = safeJoin(DIST, rel);
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('403');
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': data.length,
    });
    return res.end(data);
  } catch {
    try {
      const data = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'content-length': data.length });
      return res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
  }
});

server.listen(HOST_PORT, '127.0.0.1', () => {
  console.log(`[host] 本地宿主已启动  http://127.0.0.1:${HOST_PORT}`);
  console.log(`[host] 前端产物: ${DIST}`);
  const { py, cli } = resolveHermes();
  console.log(`[host] agent 运行时: ${hermesAvailable() ? `已就绪（${py}）` : `未找到（${cli}）`}`);
});
