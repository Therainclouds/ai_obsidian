/**
 * contextBridge 白名单 —— **渲染器能调的宿主方法，能力面全由这里决定**（ADR-0009 §2）。
 *
 * 为什么是普通 CommonJS（`.cjs`）而不是 TypeScript：preload 跑在渲染进程的沙箱里，
 * **不走 Node 的模块加载器**，所以 Electron 主进程那条 type stripping 不适用于它。
 * 这一层只做转发、没有任何业务逻辑（判断在 `agent/ipc.ts`），
 * 因此不值得为它引入一个构建步骤。
 *
 * ⚠ **下面四个信封名在 `shared/ipc.ts` 里也写了一遍**（同样因为不能用 import）。
 * 改的时候两个文件一起改。它们只是信封；**业务方法名由渲染器侧给出**，
 * 并在主进程的方法表里做白名单校验 —— 表外的名字直接抛错。
 */
const { contextBridge, ipcRenderer } = require('electron');

const HOST_INVOKE = 'host:invoke';
const HOST_STREAM = 'host:stream';
const HOST_CANCEL = 'host:cancel';
const HOST_STREAM_PREFIX = 'host:stream:';
const HOST_EVENT = 'host:event';

/** 流的序号。一次流一个通道，避免多条流互相串帧 */
let seq = 0;

contextBridge.exposeInMainWorld('host', {
  /** 一问一答。`channel` 是业务方法名，如 `'health'` */
  invoke(channel, payload) {
    return ipcRenderer.invoke(HOST_INVOKE, channel, payload);
  },

  /**
   * 宿主主动推的**全局事件**（演化记录 / Hook 进度 / 素材入库），返回取消订阅的函数。
   *
   * 与 `stream` 分开的理由（§3.3）：对话是"我问你答"，事件是"**系统自己发生的事**"。
   * 混在一条流里，"哪条消息属于哪一轮"就得靠 id 猜。
   */
  on(cb) {
    const listener = (_e, frame) => cb(frame.event, frame.data);
    ipcRenderer.on(HOST_EVENT, listener);
    return () => ipcRenderer.removeListener(HOST_EVENT, listener);
  },

  /**
   * 带流的方法。`onEvent(event, data)` 会被调用多次；返回一个取消函数。
   *
   * 取消只标记"别再往回推"，不承诺能中断云端生成 ——
   * 真要中途打断，得 ACP 那边支持（DESIGN-SPEC §6.3.1）。
   */
  stream(channel, payload, onEvent) {
    const reqId = `r${++seq}`;
    const chan = HOST_STREAM_PREFIX + reqId;

    const listener = (_e, frame) => onEvent(frame.event, frame.data);
    ipcRenderer.on(chan, listener);

    ipcRenderer.invoke(HOST_STREAM, channel, payload, reqId).catch((err) => {
      // 方法表里没有、或主进程抛了 —— 也得让渲染器看得见，否则是静默卡住
      onEvent('host.error', {
        message: String(err && err.message ? err.message : err),
      });
    });

    return () => {
      ipcRenderer.removeListener(chan, listener);
      ipcRenderer.invoke(HOST_CANCEL, reqId);
    };
  },
});
