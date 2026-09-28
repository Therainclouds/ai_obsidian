/**
 * 路由表（薄）—— 只做 path → handler 的映射（docs/接口规范.md §3.6）
 *
 * 这一层**不写业务判断**。路径形状见 §3.1：`/api/<域>/<资源>`。
 * 新增一个域时，在这里加一行 + 在 routes/ 下加一个文件，别把逻辑写回来。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from './lib/http.ts';
import { handleAgentChat, handleAgentStatus } from './routes/agent.route.ts';
import { handleEvents } from './routes/events.route.ts';
import { handleHealth } from './routes/health.route.ts';
import { handleStatic } from './routes/static.route.ts';

type Method = 'GET' | 'POST';

interface RouteDef {
  method: Method;
  path: string;
  handle: (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>;
}

export interface RouterDeps {
  /** 前端产物目录 —— 由 boot 传进来，路由层不自己推路径 */
  dist: string;
}

export function createRouter(deps: RouterDeps) {
  const ROUTES: RouteDef[] = [
    { method: 'GET', path: '/api/health', handle: (_req, res) => handleHealth(res) },
    { method: 'GET', path: '/api/agent/status', handle: (_req, res) => handleAgentStatus(res) },
    { method: 'POST', path: '/api/agent/chat', handle: handleAgentChat },
    { method: 'GET', path: '/api/events', handle: handleEvents },
  ];

  return async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`);
    const hit = ROUTES.find((r) => r.path === url.pathname && r.method === req.method);

    if (hit) {
      await hit.handle(req, res, url);
      return;
    }

    // 命中已知路径但方法不对 → 405，不要掉进静态回退（那会返回 index.html，最难查）
    if (ROUTES.some((r) => r.path === url.pathname)) {
      json(res, 405, { error: `方法 ${req.method} 不被支持`, path: url.pathname });
      return;
    }

    await handleStatic(res, deps.dist, url.pathname);
  };
}
