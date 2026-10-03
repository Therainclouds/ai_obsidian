/**
 * 数字的展示格式化。**纯展示层** —— 数据层给的是字节数与原始计数。
 *
 * 存在的理由很具体：状态栏原来写死 `(bytes / 1GB).toFixed(1)`，而夹具的数据只有几 MB，
 * 于是显示成 **`0.0 / 10 GB`** —— 看着像功能坏了（截图暴露的）。单位要跟着量级走。
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** 按量级选单位。`0.0 GB` 那种"看着像坏了"的显示，根因就是没做这一步 */
export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(0)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}
