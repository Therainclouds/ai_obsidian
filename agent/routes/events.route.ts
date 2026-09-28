/**
 * GET /api/events —— 全局事件流，宿主主动推的事件走这条（docs/接口规范.md §3.3）
 *
 * 与 `POST /api/agent/chat` 的响应体分开：对话是"我问你答"，事件是"系统自己发生的事"。
 * 混在一条流里，"哪条消息属于哪一轮"就得靠 id 猜。
 *
 * **当前只保持连接** —— 除 agent.* 外的生产端仍在留空清单里。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sseComment, sseOpen } from '../lib/http.ts';

const KEEPALIVE_MS = 15_000;

export function handleEvents(req: IncomingMessage, res: ServerResponse): void {
  sseOpen(res);
  sseComment(res, 'connected');
  const timer = setInterval(() => sseComment(res, 'ping'), KEEPALIVE_MS);
  req.on('close', () => clearInterval(timer));
}
