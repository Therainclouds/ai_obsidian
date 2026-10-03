/**
 * 相对时间。**纯展示层** —— 数据层一律给 ISO（`shared/types.ts` 的 `Iso`），
 * 换算成人话是界面的事。
 *
 * 为什么不放在宿主：同一份 ISO 在不同地方要有不同说法（列表里"3 天前"、
 * 提示气泡里"3 天前 14:02"），而且它**不该过 IPC** —— 那是把展示逻辑塞进数据层。
 *
 * 档位取自原型（`#page-files` 的示例数据）：`10 分钟前` / `昨天 21:04` / `4 天前` / `上周`。
 * 原型里"昨天"两种写法都出现过（带时刻与不带），这里统一**带时刻** —— 信息更多，
 * 且不会出现"昨天"到底是昨天几点这种没法回答的问题。
 */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 同一天（按本地时区） */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function relTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const then = new Date(t);
  const diff = now.getTime() - t;

  if (diff < MIN) return '刚刚';
  if (diff < 60 * MIN) return `${Math.floor(diff / MIN)} 分钟前`;
  if (sameDay(then, now)) return `${pad(then.getHours())}:${pad(then.getMinutes())}`;

  const yesterday = new Date(now.getTime() - DAY);
  if (sameDay(then, yesterday)) {
    return `昨天 ${pad(then.getHours())}:${pad(then.getMinutes())}`;
  }

  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days} 天前`;
  if (days < 14) return '上周';
  return `${then.getMonth() + 1} 月 ${then.getDate()} 日`;
}
