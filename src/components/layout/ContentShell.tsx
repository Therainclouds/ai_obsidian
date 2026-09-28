import type { ReactNode } from 'react';

interface ContentShellProps {
  title: string;
  desc: string;
  children: ReactNode;
}

/** 页头（标题 / 描述 / 操作）+ 页面主体（各页自有分栏与滚动），见 §4.1 */
export default function ContentShell({ title, desc, children }: ContentShellProps) {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-line px-6 py-4">
        <h1 className="font-display text-[17px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{desc}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </main>
  );
}
