/**
 * HTTP 原语（docs/接口规范.md §3.5）
 *
 * 只放"怎么写一个响应"这类原语，**不含任何业务判断**。
 * 路由文件用这些原语拼响应；service 不许 import 本文件（它不该碰 req/res）。
 */
import type { ServerResponse } from 'node:http';
import { join, normalize } from 'node:path';

export const MIME: Record<string, string> = {
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

export function json(res: ServerResponse, code: number, body: unknown): void {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
}

/** 开一条 SSE。前端与宿主之间只有这一条通道（§9.1.3） */
export function sseOpen(res: ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
}

/** 事件名一律 `<域>.<事件>`（§3.2），常量定义在 shared/events.ts */
export function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sseComment(res: ServerResponse, text: string): void {
  res.write(`: ${text}\n\n`);
}

/** 防目录穿越：把请求路径限制在 base 之内 */
export function safeJoin(base: string, rel: string): string | null {
  const p = normalize(join(base, rel));
  return p.startsWith(normalize(base)) ? p : null;
}
