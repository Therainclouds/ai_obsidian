import NavItem from './NavItem';
import SpaceSwitch, { type Space } from './SpaceSwitch';
import { ROUTES } from '../../app/routes';
import type { RouteKey } from '../../../shared/types';
import type { Theme } from '../../lib/useTheme';
import { IconMoon, IconSun } from '../icons';

interface SidebarProps {
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  spaces: Space[];
  space: string;
  onSpaceChange: (space: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Sidebar({
  active,
  onNavigate,
  spaces,
  space,
  onSpaceChange,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-text">
          <span className="brand-name">知识系统</span>
          <span className="brand-sub">个人 AI 知识管家</span>
        </span>
        <span className="brand-tag">v1.0</span>
      </div>

      <div className="nav-group">
        <SpaceSwitch spaces={spaces} current={space} onChange={onSpaceChange} />
        <nav className="nav" aria-label="主导航">
          {ROUTES.filter((r) => r.group === 'space').map((r) => (
            <NavItem
              key={r.key}
              Icon={r.Icon}
              name={r.name}
              desc={r.desc}
              active={r.key === active}
              onClick={() => onNavigate(r.key)}
            />
          ))}
        </nav>
      </div>

      <div className="nav-group">
        <div className="nav-group-label">系统</div>
        <nav className="nav" aria-label="系统">
          {ROUTES.filter((r) => r.group === 'system').map((r) => (
            <NavItem
              key={r.key}
              Icon={r.Icon}
              name={r.name}
              desc={r.desc}
              active={r.key === active}
              onClick={() => onNavigate(r.key)}
            />
          ))}
        </nav>
      </div>

      <div className="sidebar-foot">
        <button type="button" className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? <IconMoon size={16} /> : <IconSun size={16} />}
          <span>{theme === 'dark' ? '切换白天' : '切换黑夜'}</span>
        </button>
      </div>
    </aside>
  );
}
