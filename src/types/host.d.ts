import type { StreamFrame } from '../../shared/ipc';

/**
 * `window.host` —— 渲染器访问宿主的唯一入口，由 `electron/preload.cjs` 经
 * `contextBridge` 挂上（ADR-0009 §2）。
 *
 * 它是**白名单**：这里列出的就是渲染器全部的能力面。
 * 方法名（`channel`）取自 `shared/ipc` 的常量，**业务代码不得手写字符串**。
 */
declare global {
  interface Window {
    host?: {
      invoke<T>(channel: string, payload?: unknown): Promise<T>;
      /** 返回取消函数。`onEvent` 会被调用多次 */
      stream(
        channel: string,
        payload: unknown,
        onEvent: (event: string, data: unknown) => void,
      ): () => void;
    };
  }
}

export type { StreamFrame };
