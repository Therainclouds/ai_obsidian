/**
 * 静态产物托管（docs/接口规范.md §3.5）
 *
 * 宿主兼管前端产物 —— 同一个进程，省一个常驻服务（ADR-0008：
 * 「宿主托管前端产物」是为什么不做第二个服务的原因）。
 */
import type { ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { MIME, safeJoin } from '../lib/http.ts';

function plain(res: ServerResponse, code: number, text: string): void {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

export async function handleStatic(res: ServerResponse, dist: string, urlPath: string): Promise<void> {
  try {
    await stat(dist);
  } catch {
    plain(res, 404, 'dist/ 不存在 —— 先跑 npm run build\n');
    return;
  }

  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = safeJoin(dist, rel);
  if (!file) {
    plain(res, 403, '403');
    return;
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': data.length,
    });
    res.end(data);
  } catch {
    // SPA 回退
    try {
      const data = await readFile(join(dist, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'content-length': data.length });
      res.end(data);
    } catch {
      plain(res, 404, '404');
    }
  }
}
