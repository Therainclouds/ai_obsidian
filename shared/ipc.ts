/**
 * 渲染器 ↔ 宿主的唯一通道（ADR-0009 · DESIGN-SPEC §9.1.3）。
 *
 * 这一层定义的是**方法名与信封**，不是传输实现。现在挂在 IPC 上；
 * 若目标机证实无图形栈（ADR-0009 未定项 3），可以在同一张方法表上再挂一个
 * HTTP 适配器 —— **业务方法表不用改**（见 `agent/ipc.ts`）。
 */

/**
 * ⚠ **下面四个是 IPC 信封名，`electron/preload.cjs` 里也写了一遍。**
 *
 * 为什么不在 preload 里 import 本文件：preload 跑在渲染进程的沙箱里，
 * **不走 Node 的模块加载器**，type stripping 不适用，所以它必须是普通 CJS。
 * 改这四个名字时**两个文件一起改**——这类"两处必须一致"是本项目反复吃亏的地方
 * （见 `.workbuddy/memory/MEMORY.md`），所以两边都留了这条注释。
 *
 * 影响面很小：它们**不是业务方法名**，只是信封。业务方法名只在渲染器侧使用，
 * 由 `main.ts` 的方法表做白名单校验。
 */
export const HOST_INVOKE = 'host:invoke';
export const HOST_STREAM = 'host:stream';
export const HOST_CANCEL = 'host:cancel';
export const HOST_STREAM_PREFIX = 'host:stream:';

/**
 * 业务方法名：`<域>.<资源>`。
 * 域与 DESIGN-SPEC §5 的模块分区一致（接口规范 §3.1）；**渲染器侧只用这些名字**。
 */
export const CH_HEALTH = 'health';
export const CH_AGENT_STATUS = 'agent.status';
export const CH_AGENT_CHAT = 'agent.chat';

/** 流的一帧。`event` 取自 `shared/events.ts` 的事件名 */
export interface StreamFrame {
  event: string;
  data: unknown;
}

/** 宿主向渲染器推的通道名（一次流一个，避免多流互相串帧） */
export function streamChannel(reqId: string): string {
  return HOST_STREAM_PREFIX + reqId;
}
