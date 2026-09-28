import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ContentShell from '../components/layout/ContentShell';
import { ROUTES } from './routes';
import { useTheme } from '../lib/useTheme';
import { useHostHealth } from '../lib/useHostHealth';
import Orb from '../features/assistant/Orb';
import KitPage from '../features/kit';
import type { RouteKey } from '../../shared/types';

/** 组件库页不是一级入口（侧栏固定 5 项，§1.3），用 hash 直达 */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ''));
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const [active, setActive] = useState<RouteKey>('chat');
  const [space, setSpace] = useState('我的空间');
  const [theme, toggleTheme] = useTheme();
  const hash = useHashRoute();
  const health = useHostHealth();

  const route = ROUTES.find((r) => r.key === active)!;
  const Page = route.Component;
  const isKit = hash === 'kit';

  return (
    <div className="flex h-full">
      <Sidebar
        active={active}
        onNavigate={setActive}
        space={space}
        onSpaceChange={setSpace}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <ContentShell
        title={isKit ? '组件库' : route.name}
        desc={isKit ? 'M1 产出 · hash #kit 直达，不属于一级入口' : route.desc}
      >
        {isKit ? <KitPage /> : <Page />}
      </ContentShell>

      {/* 全局层：AI 悬浮球 + 宿主连通指示 */}
      <Orb currentPage={isKit ? '组件库' : route.name} />

      <div
        className="fixed bottom-6 left-6 font-mono text-[11px] text-ink-3"
        title="本地宿主（agent/index.ts）的连通状态"
      >
        <span
          aria-hidden="true"
          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
            health ? 'bg-brand-mid' : 'bg-accent'
          }`}
        />
        {health ? `宿主在线 · ${space}` : '宿主未连接'}
      </div>
    </div>
  );
}
