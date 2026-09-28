import NavItem from './NavItem';
import { ROUTES } from '../../app/routes';
import type { RouteKey } from '../../../shared/types';
import type { Theme } from '../../lib/useTheme';

interface SidebarProps {
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  /** 知识空间切换器（ADR-0006：知识空间是实体，不是分组标题） */
  space: string;
  onSpaceChange: (space: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const SPACES = ['我的空间', '工作', '读书笔记'];

export default function Sidebar({
  active,
  onNavigate,
  space,
  onSpaceChange,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-4 pb-3 pt-4">
        <div className="font-display text-[15px] font-semibold tracking-tight">个人 AI 知识系统</div>
        <div className="mt-0.5 text-[11.5px] text-ink-3">对话 · 素材 · 知识点，自动连成网络</div>
      </div>

      <div className="mx-3 mb-2">
        <label className="block text-[11px] text-ink-3" htmlFor="space-switch">
          知识空间
        </label>
        <select
          id="space-switch"
          value={space}
          onChange={(e) => onSpaceChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {SPACES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="主导航">
        {(['space', 'system'] as const).map((group) => (
          <div key={group} className="mb-3">
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-ink-3">
              {group === 'space' ? '知识空间' : '系统'}
            </div>
            <div className="space-y-0.5">
              {ROUTES.filter((r) => r.group === group).map((r) => (
                <NavItem
                  key={r.key}
                  icon={r.icon}
                  name={r.name}
                  desc={r.desc}
                  active={r.key === active}
                  onClick={() => onNavigate(r.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full rounded-md px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {theme === 'dark' ? '☀ 切换到白天' : '☾ 切换到夜晚'}
        </button>
      </div>
    </aside>
  );
}
