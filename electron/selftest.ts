/**
 * 冒烟自检（`electron . --selftest`）。
 *
 * 为什么值得存在：桌面壳的问题是**静默失败**——窗口开出来了、页面也画出来了，
 * 但桥没挂上、方法表拼错、白名单太宽，肉眼看不出来。这一层不靠推断，靠测量。
 *
 * 它验四件事：
 *  1. `window.host` 挂上了（preload 的 contextBridge 生效）
 *  2. `health` 能往返（宿主方法表 + IPC 信封名两边一致）
 *  3. `agent.status` 能往返（懒启动没被误触发）
 *  4. **白名单外的名字被拒**（ADR-0009 §2：渲染器连"随便发一个请求"的能力都没有）
 *
 * 第 4 条是安全属性，**必须验** —— 它一旦悄悄失效，能力面就变宽了，而没有任何表现。
 */
import type { BrowserWindow } from 'electron';

const PROBE = `(async () => {
  const out = {
    bridge: false, health: null, healthErr: null, agent: null, agentErr: null,
    whitelist: 'unknown', stub: 'unknown', unknown: 'unknown',
  };
  if (typeof window.host !== 'object' || window.host === null) return out;
  out.bridge = true;

  try { out.health = await window.host.invoke('health'); }
  catch (e) { out.healthErr = String((e && e.message) || e); }

  try {
    const s = await window.host.invoke('agent.status');
    out.agent = { installed: s.installed, initialized: s.initialized, hasSession: s.hasSession };
  } catch (e) { out.agentErr = String((e && e.message) || e); }

  // ① 已定名但未实现 → 必须是"尚未实现"（与 ② 分得开）
  try { await window.host.invoke('space.list'); out.stub = 'ACCEPTED（不该通过）'; }
  catch (e) { out.stub = String((e && e.message) || e).includes('尚未实现') ? 'not-built' : 'wrong-msg'; }

  // ② 表外的名字 → 必须是"未知方法"（白名单，ADR-0009 §2）
  try { await window.host.invoke('__not_in_table__'); out.unknown = 'ACCEPTED（白名单失效！）'; }
  catch (e) { out.unknown = String((e && e.message) || e).includes('未知方法') ? 'rejected' : 'wrong-msg'; }

  out.whitelist = out.unknown;
  return out;
})()`;

export async function runSelfTest(win: BrowserWindow): Promise<void> {
  const result = (await win.webContents.executeJavaScript(PROBE)) as Record<string, unknown>;
  const ok =
    result.bridge === true &&
    result.health !== null &&
    result.agent !== null &&
    // 已定名但未实现 → "尚未实现"
    result.stub === 'not-built' &&
    // 表外的名字 → "未知方法"。**两者混成一句话就没法调试了**
    result.unknown === 'rejected';

  console.log(`[selftest] ${ok ? '通过' : '未通过'}`);
  console.log(`[selftest] 结果 ${JSON.stringify(result)}`);
  if (!ok) process.exitCode = 1;
}
