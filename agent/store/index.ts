/**
 * 存储层的**接缝**（docs/接口规范.md §4）。
 *
 * 方法表与这一层之间的约定是：**它只认 `MemoryStore` 上那些方法，不认实现**。
 * 将来 `store/fs.ts`（真实落盘）就位后，**换的只是本文件里的一行**。
 * 这是"换实现不改调用方"那条纪律在本项目的落点。
 *
 * **开关**：`--mock` 装载夹具（`agent/mock/seed.ts`）；不带它是**空态** ——
 * 那本身也是要看的界面（§6.3 的 E1 首次空态）。两个都跑，才知道空态有没有做对。
 */
import { describeSeed, SEED } from '../mock/seed.ts';
import { MemoryStore } from './memory.ts';

export const MOCK = process.argv.includes('--mock');

export const store = new MemoryStore(MOCK ? SEED : null);

/** 是否在跑示例数据。**它会经 `health` 下发给界面，界面必须据此标明** */
export const isMock = MOCK;

/** 启动时打一行账。夹具是"看不见就会变味"的东西 */
export function describeStore(): string {
  return MOCK ? `示例数据（--mock）· ${describeSeed(SEED)}` : '空态（未带 --mock）';
}
