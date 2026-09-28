/**
 * 宿主的方法表（docs/接口规范.md §3.6）。
 *
 * **这一层与传输无关** —— 它只回答"有哪些方法、各自归谁"。
 * `electron/main.ts` 的 ipcMain 只是这张表的一个消费者：换传输不用改这里。
 *
 * v1.5 相比 v1.4 少了两层：
 *  · `routes/` 没了 —— 它原来的职责是"读 HTTP 体、拼 HTTP 响应"，IPC 下这些全消失，
 *    只剩"方法名 → 处理器"这张映射，那正是本文件
 *  · `lib/http.ts` 没了 —— json / sse 原语随 HTTP 一起删除
 *
 * 剩下的分层：**boot（electron/main）· 方法表（本文件）· 服务（services/）· 协议（acp-client）**。
 */
import { AGENT_DELTA, AGENT_DONE, AGENT_ERROR, AGENT_STAGE } from '../shared/events.ts';
import { CH_AGENT_CHAT, CH_AGENT_STATUS, CH_HEALTH } from '../shared/ipc.ts';
import type { AgentStatus, HealthPayload } from '../shared/types.ts';
import { getStatus, hasSession, noteError, runChat } from './services/agent.service.ts';

/** 宿主往回推一帧。载荷里的 `event` 取自 shared/events.ts */
export type Emit = (event: string, data: unknown) => void;

/** 一问一答：调用一次，返回一次 */
export type InvokeHandler = (payload: unknown) => unknown | Promise<unknown>;

/** 带流的方法：宿主用 `emit` 分多次往回推，`resolve` 即结束 */
export type StreamHandler = (payload: unknown, emit: Emit) => Promise<void>;

/** 宿主自身的启动时刻 —— 只能在这里取，它是进程级事实 */
const startedAt = Date.now();

/**
 * 方法表 = **白名单**。渲染器调用表外的名字会直接抛错。
 *
 * ADR-0009 §2：渲染进程跑在 `nodeIntegration: false` + `contextIsolation: true` 下，
 * 能调用的**只有**这里列出的方法。HTTP 时代它对 `/api/*` 是"能发请求就能试"；
 * 现在**连"随便发一个请求"的能力都没有**。
 */
export const INVOKE: Record<string, InvokeHandler> = {
  /** 宿主自身的存活，与 agent 在不在无关 */
  [CH_HEALTH]: (): HealthPayload => ({
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    agentConnected: hasSession(),
    space: '我的空间',
  }),

  /** 存在性与能力面，**不触发会话**（懒启动） */
  [CH_AGENT_STATUS]: (): AgentStatus => getStatus(),
};

/** 带流的方法表。与 INVOKE 同一把白名单，只是形状不同 */
export const STREAM: Record<string, StreamHandler> = {
  /**
   * 发一轮对话。失败**不吞** —— 翻成 `agent.error` 事件回流（§6.3.4 失败不毁内容）：
   * 用户那条消息留在对话里、草稿不清空、输入框不锁，出口是内联重试。
   */
  [CH_AGENT_CHAT]: async (payload, emit): Promise<void> => {
    const text = (payload as { text?: string } | null)?.text ?? '';
    if (!text.trim()) throw new Error('空消息');

    try {
      await runChat(text, {
        onStage: (stage, label) => emit(AGENT_STAGE, { stage, label }),
        onDelta: (delta) => emit(AGENT_DELTA, { text: delta }),
      });
      emit(AGENT_DONE, { ok: true });
    } catch (e) {
      const err = e as Error & { code?: number };
      noteError(err.message);
      emit(AGENT_ERROR, { code: err.code ?? null, message: err.message });
    }
  },
};

/** 这个方法存在吗（供 main.ts 在注册前自检） */
export function hasMethod(channel: string): boolean {
  return channel in INVOKE || channel in STREAM;
}
