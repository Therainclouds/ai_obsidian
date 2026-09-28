/**
 * 本地宿主进程 · boot（DESIGN-SPEC §9.1.3 · ADR-0008 · docs/接口规范.md §3.6）
 *
 * 这一层**只做组合与启动**：拼路由、起 HTTP、托管前端产物。
 * 业务在 services/，HTTP 关注点在 routes/，协议在 acp-client.ts。
 *
 * 它是**知识空间唯一的写入者**（M0 阶段还没有写任何文件）。
 * 依赖克制：只用 node:http，不引 express —— ADR-0004 §1「内存是硬预算 · 白名单之外不再装依赖」。
 */
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_PORT } from '../shared/ports.ts';
import { createRouter } from './http.ts';
import { hermesAvailable, resolveHermes } from './acp-client.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const server = createServer(createRouter({ dist: DIST }));

server.listen(HOST_PORT, '127.0.0.1', () => {
  const { py, cli } = resolveHermes();
  console.log(`[host] 本地宿主已启动  http://127.0.0.1:${HOST_PORT}`);
  console.log(`[host] 前端产物: ${DIST}`);
  console.log(`[host] agent 运行时: ${hermesAvailable() ? `已就绪（${py}）` : `未找到（${cli}）`}`);
});
