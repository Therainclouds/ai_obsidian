import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ContentShell from '../components/layout/ContentShell';
import { ROUTES } from './routes';
import { useTheme } from '../lib/useTheme';
import Orb from '../features/assistant/Orb';
import type { RouteKey } from '../../shared/types';

export default function App() {
  const [active, setActive] = useState<RouteKey>('chat');
  const [space, setSpace] = useState('我的空间');
  const [theme, toggleTheme] = useTheme();

  const route = ROUTES.find((r) => r.key === active)!;
  const Page = route.Component;

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
      <ContentShell title={route.name} desc={route.desc}>
        <Page />
      </ContentShell>

      {/* 全局层：AI 悬浮球。不随页面切换（§1.3） */}
      <Orb currentPage={route.name} />
    </div>
  );
}
