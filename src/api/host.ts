/**
 * 宿主 API 客户端（DESIGN-SPEC §9.3 的 `src/api/`）。
 *
 * **渲染器不直接调 `window.host`** —— 都走这里。好处有两个：
 *  · 方法名集中引自 `shared/ipc`，业务代码里不会出现手写字符串
 *  · 宿主不在时（比如把 dist 直接丢进浏览器看）能给出人看得懂的错，而不是
 *    `Cannot read properties of undefined`
 *
 * 返回值都是 Promise / 取消函数；**加载态由页面按 §6.2 的三档自己给**
 * （纯本地动作不给、本地有耗时给骨架、云端往返给完整三态）。
 */
import { CH_AGENT_CHAT, CH_AGENT_STATUS, CH_HEALTH } from '../../shared/ipc';
import type { AgentStatus, HealthPayload } from '../../shared/types';

const NOT_IN_SHELL =
  '这个页面不在桌面壳里 —— 宿主是 Electron 主进程，请用 npm start 启动，而不是用浏览器打开 dist/';

function bridge(): NonNullable<Window['host']> {
  const h = window.host;
  if (!h) throw new Error(NOT_IN_SHELL);
  return h;
}

/** 宿主自身的存活，与 agent 在不在无关 */
export function hostHealth(): Promise<HealthPayload> {
  return bridge().invoke<HealthPayload>(CH_HEALTH);
}

/** agent 运行时的能力面。**懒启动**：调用它不会拉起子进程 */
export function hostAgentStatus(): Promise<AgentStatus> {
  return bridge().invoke<AgentStatus>(CH_AGENT_STATUS);
}

/** 发一轮对话。返回取消函数 —— 见 preload 里那条"取消只标记、不承诺中断"的说明 */
export function hostAgentChat(
  text: string,
  onEvent: (event: string, data: unknown) => void,
): () => void {
  return bridge().stream(CH_AGENT_CHAT, { text }, onEvent);
}
