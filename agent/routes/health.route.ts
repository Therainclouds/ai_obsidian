/**
 * GET /api/health —— 宿主自身的存活，与 agent 在不在无关（docs/接口规范.md §3.1）
 */
import type { ServerResponse } from 'node:http';
import { json } from '../lib/http.ts';
import { hasSession } from '../services/agent.service.ts';
import type { HealthPayload } from '../../shared/types.ts';

const startedAt = Date.now();

export function handleHealth(res: ServerResponse): void {
  const body: HealthPayload = {
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    agentConnected: hasSession(),
    space: '我的空间',
  };
  json(res, 200, body);
}
