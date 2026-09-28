import type { ReactNode } from 'react';

interface ChipProps {
  /** 筛选胶囊是「视图切换器」，不是过滤器（D12） */
  active?: boolean;
  /** 右侧数字。注意：数字必须与其视图口径一致（D31：「全部」只数文件素材） */
  count?: number;
  onClick?: () => void;
  children: ReactNode;
}

export default function Chip({ active = false, count, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px]',
        'border transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        'after:relative',
        active
          ? 'border-brand bg-brand-soft text-brand-ink font-medium'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      )}
    </button>
  );
}
