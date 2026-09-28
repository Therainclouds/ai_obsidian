/**
 * 本地宿主进程（DESIGN-SPEC §9.1.3 · ADR-0008）
 *
 * M0 只做三件事：起进程、托管前端产物、开 localhost 的那一条通道。
 * 刻意不接 ACP —— ACP 接入在 M5（§9.4）。
 *
 * 依赖克制：只用 node:http，不引 express。
 * 理由见 ADR-0004 §1「内存是硬预算 · 白名单之外不再装依赖」。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_PORT } from '../shared/ports.ts';
import type { HealthPayload } from '../shared/types.ts';

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

function json(res: import('node:http').ServerResponse, code: number, body: unknown): void {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
}

/** 防目录穿越：把请求路径限制在 dist/ 内 */
function safeJoin(base: string, rel: string): string | null {
  const p = normalize(join(base, rel));
  return p.startsWith(base) ? p : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${HOST_PORT}`);
  const path = url.pathname;

  // 健康检查：前端用它确认"宿主在不在"
  if (path === '/api/health') {
    const body: HealthPayload = {
      ok: true,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      agentConnected: false, // M0：ACP 未接入（M5）
      space: '我的空间',
    };
    return json(res, 200, body);
  }

  // SSE：前端 ↔ 宿主的流式通道。M0 只保持连接，真实事件随 Harness 一起落（M5 起）
  if (path === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
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
    // SPA 回退
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
  console.log('[host] agent 运行时: 未接入（M0 · ACP 在 M5）');
});
