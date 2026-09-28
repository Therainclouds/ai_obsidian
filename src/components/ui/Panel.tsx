import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  desc?: string;
  /** 右上角操作区 */
  actions?: ReactNode;
  children: ReactNode;
}

/** 卡片：纸感中性面 + 发丝级分割线。禁止卡片套卡片（设计上下文·拒绝清单） */
export default function Panel({ title, desc, actions, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-line bg-surface shadow-1">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0">
            {title && <div className="text-[13.5px] font-medium text-ink">{title}</div>}
            {desc && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{desc}</div>}
          </div>
          {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
        </div>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
