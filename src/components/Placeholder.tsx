interface PlaceholderProps {
  title: string;
  items: string[];
}

/**
 * M0 骨架占位。刻意保持中性（不用插画、不引第四色）——三态的完整规格在 §6.3，实现在 M7。
 */
export default function Placeholder({ title, items }: PlaceholderProps) {
  return (
    <div className="max-w-[640px] rounded-lg border border-line bg-surface p-5 shadow-1">
      <div className="text-[13px] font-medium">{title} · M0 骨架</div>
      <ul className="mt-3 space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-[12.5px] text-ink-2">
            <span aria-hidden="true" className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand-mid" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line-soft pt-3 font-mono text-[11.5px] text-ink-3">
        视觉基准：design/prototype/index-final.html · 勿重新设计
      </p>
    </div>
  );
}
