/**
 * agent 控制面的可复用行为（docs/接口规范.md §3.6）
 *
 * 这一层**不碰 req / res** —— 它只做事情，不做 HTTP。
 * 路由层负责把结果翻译成响应；适配器（acp-client）只在 boot 之外被本文件使用。
 *
 * 「一个 home 一个 agent」（ADR-0002 §5），因此这里维持**单例**并串行化复用。
 */
import {
  AGENT_STAGE_LABEL,
  type AgentStageKey,
} from '../../shared/events.ts';
import { AcpClient, hermesAvailable, resolveHermes, type InitializeResult } from '../acp-client.ts';

export interface AgentStatus {
  installed: boolean;
  resolved: { py: string; cli: string; home: string };
  initialized: boolean;
  agentInfo: InitializeResult['agentInfo'] | null;
  capabilities: InitializeResult['agentCapabilities'] | null;
  hasSession: boolean;
  error: string | null;
}

let client: AcpClient | null = null;
let initResult: InitializeResult | null = null;
let sessionId: string | null = null;
let agentError: string | null = null;

/** 进度回调。载荷文字由本层给出，路由层只负责转发 */
export interface ChatSink {
  onStage: (key: AgentStageKey, label: string) => void;
  onDelta: (text: string) => void;
}

export function getStatus(): AgentStatus {
  return {
    installed: hermesAvailable(),
    resolved: resolveHermes(),
    initialized: Boolean(initResult),
    agentInfo: initResult?.agentInfo ?? null,
    capabilities: initResult?.agentCapabilities ?? null,
    hasSession: Boolean(sessionId),
    error: agentError,
  };
}

export function hasSession(): boolean {
  return Boolean(sessionId);
}

/** 懒启动：第一次真要用 agent 时才拉起子进程 */
async function ensure(): Promise<AcpClient> {
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

/**
 * 发一轮对话。失败**不吞异常** —— 由路由层翻译成 `agent.error`（§6.3.4 失败不毁内容）。
 * 三段阶段的顺序取自 shared，不在这里写死。
 */
export async function runChat(text: string, sink: ChatSink): Promise<void> {
  sink.onStage('reading', AGENT_STAGE_LABEL.reading);
  const c = await ensure();
  sink.onStage('linking', AGENT_STAGE_LABEL.linking);

  c.setUpdateHandler((u) => {
    const t = u.update?.content?.text;
    if (typeof t === 'string' && t) sink.onDelta(t);
  });

  try {
    sink.onStage('writing', AGENT_STAGE_LABEL.writing);
    await c.prompt(sessionId!, text);
    agentError = null;
  } finally {
    c.setUpdateHandler(null);
  }
}

export function noteError(message: string): void {
  agentError = message;
}
