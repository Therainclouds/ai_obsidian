/**
 * 宿主的方法表（docs/接口规范.md §3.6）。
 *
 * **这一层与传输无关** —— 它只回答"有哪些方法、各自归谁"。
 * `electron/main.ts` 的 ipcMain 只是这张表的一个消费者：换传输不用改这里。
 *
 * **白名单**（ADR-0009 §2）：渲染进程能调用的**只有**这里列出的方法，
 * 表外的名字直接抛错 —— 渲染器连"随便发一个请求"的能力都没有。
 *
 * **状态：接口先定，实现留空。**
 * 已定的方法名全部注册（`ALL_CHANNELS`），未实现的抛**"尚未实现"**。
 * 这一点是刻意的：**"尚未实现"与"未知方法"必须分得开** ——
 * 前者是还没做，后者是名字写错了；混成一句话，调试时会浪费大量时间。
 */
import { AGENT_DELTA, AGENT_DONE, AGENT_ERROR, AGENT_STAGE } from '../shared/events.ts';
import {
  ALL_CHANNELS,
  CH_AGENT_ARRANGE,
  CH_AGENT_CHAT,
  CH_AGENT_STATUS,
  CH_HEALTH,
} from '../shared/ipc.ts';
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

/** 未实现的方法统一抛这句话。**不要和"未知方法"混用** */
function notBuilt(channel: string): Error {
  return new Error(`${channel} 尚未实现（接口已定，见 docs/接口规范.md §4 留空清单）`);
}

/* ============================================================
   表：先全部铺成"尚未实现"，再把做好的覆盖上去
   ============================================================ */

/** 带流的方法。其余都是一问一答 */
const STREAM_CHANNELS = new Set<string>([CH_AGENT_CHAT, CH_AGENT_ARRANGE]);

export const INVOKE: Record<string, InvokeHandler> = {};
export const STREAM: Record<string, StreamHandler> = {};

for (const channel of ALL_CHANNELS) {
  if (STREAM_CHANNELS.has(channel)) {
    STREAM[channel] = async () => {
      throw notBuilt(channel);
    };
  } else {
    INVOKE[channel] = () => {
      throw notBuilt(channel);
    };
  }
}

/* ============================================================
   已实现的三条
   ============================================================ */

/** 宿主自身的存活，与 agent 在不在无关 */
INVOKE[CH_HEALTH] = (): HealthPayload => ({
  ok: true,
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  agentConnected: hasSession(),
  space: '我的空间',
});

/** 存在性与能力面，**不触发会话**（懒启动） */
INVOKE[CH_AGENT_STATUS] = (): AgentStatus => getStatus();

/**
 * 发一轮对话。失败**不吞** —— 翻成 `agent.error` 事件回流（§6.3.4 失败不毁内容）：
 * 用户那条消息留在对话里、草稿不清空、输入框不锁，出口是内联重试。
 */
STREAM[CH_AGENT_CHAT] = async (payload, emit): Promise<void> => {
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
};

/* ============================================================
   查询
   ============================================================ */

/** **已实现**的方法。表里其余的名字虽已注册，但仍是桩（抛"尚未实现"） */
const IMPLEMENTED = new Set<string>([CH_HEALTH, CH_AGENT_STATUS, CH_AGENT_CHAT]);

/** 这个方法存在吗（白名单校验用；main.ts 在注册前自检） */
export function hasMethod(channel: string): boolean {
  return channel in INVOKE || channel in STREAM;
}

/** 这个方法实现了没有。`--selftest` 用它算"接口完备度"，并在启动时打一行账 */
export function isImplemented(channel: string): boolean {
  return IMPLEMENTED.has(channel);
}

/** 接口面的账：已实现 / 已定名。启动时打一行，省得每次去数 */
export function channelCoverage(): { done: number; total: number; pending: string[] } {
  const pending = ALL_CHANNELS.filter((c) => !IMPLEMENTED.has(c));
  return { done: ALL_CHANNELS.length - pending.length, total: ALL_CHANNELS.length, pending };
}
