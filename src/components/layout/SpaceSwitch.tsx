import { useEffect, useRef, useState } from 'react';
import { IconCaret, IconSpace } from '../icons';

export interface Space {
  name: string;
  /** 下拉里的等宽摘要行 */
  meta: string;
}

interface SpaceSwitchProps {
  spaces: Space[];
  current: string;
  onChange: (name: string) => void;
}

/**
 * 知识空间切换器（ADR-0006）：原「分组标题」升格为实体入口。
 * 它同时承担"当前在哪"与"能换到哪"两件事。
 */
export default function SpaceSwitch({ spaces, current, onChange }: SpaceSwitchProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="nav-group" ref={boxRef}>
      <button
        type="button"
        className="space-switch"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sp-mark">
          <IconSpace size={15} />
        </span>
        <span className="sp-name">{current}</span>
        <span className="sp-caret">
          <IconCaret size={12} />
        </span>
      </button>

      <div className={['space-menu', open ? 'open' : ''].join(' ')} role="listbox" aria-label="切换知识空间">
        {spaces.map((s) => (
          <button
            key={s.name}
            type="button"
            role="option"
            aria-selected={s.name === current}
            className={['space-item', s.name === current ? 'active' : ''].join(' ')}
            onClick={() => {
              onChange(s.name);
              setOpen(false);
            }}
          >
            <span className="sp-label">{s.name}</span>
            <span className="sp-meta">{s.meta}</span>
          </button>
        ))}
        <div className="space-sep" />
        <button type="button" role="option" className="space-item new">
          <span className="sp-label">+ 新建知识空间</span>
          <span className="sp-meta">每个空间是一套独立的内容</span>
        </button>
      </div>
    </div>
  );
}
