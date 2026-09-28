interface PlaceholderProps {
  title: string;
  items: string[];
}

/**
 * M0 骨架占位。刻意保持中性：只用三色 token、不用插画、不引第四色。
 * 完整的空态四型在 §6.3.2，实现在 M7。
 */
export default function Placeholder({ title, items }: PlaceholderProps) {
  return (
    <div
      style={{
        maxWidth: 620,
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: '17px 18px',
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{title} · 待实现</div>
      <ul style={{ margin: '11px 0 0', padding: 0, listStyle: 'none' }}>
        {items.map((t) => (
          <li
            key={t}
            style={{ display: 'flex', gap: 9, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.62, padding: '3px 0' }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 5,
                height: 5,
                marginTop: 7,
                borderRadius: '50%',
                background: 'var(--brand-mid)',
              }}
            />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 13,
          paddingTop: 11,
          borderTop: '1px solid var(--line-soft)',
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 10.5,
          color: 'var(--ink-3)',
        }}
      >
        视觉基准：design/prototype/index-final.html · 勿重新设计
      </div>
    </div>
  );
}
