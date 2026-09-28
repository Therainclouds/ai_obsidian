import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ContentShell from '../components/layout/ContentShell';
import { ROUTES } from './routes';
import { useTheme } from '../lib/useTheme';
import { useHostHealth } from '../lib/useHostHealth';
import Orb from '../features/assistant/Orb';
import KitPage from '../features/kit';
import type { RouteKey } from '../../shared/types';

const isRouteKey = (v: string): v is RouteKey => ROUTES.some((r) => r.key === v);

/** hash 直达：#chat / #files / #graph / #summary / #settings / #kit。便于深链与验收。 */
function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ''));
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

const SPACES = [
  { name: '我的空间', meta: '0 文件 · 0 知识点' },
  { name: '工作', meta: '0 文件 · 0 知识点' },
  { name: '读书笔记', meta: '0 文件 · 0 知识点' },
];

export default function App() {
  const [space, setSpace] = useState(SPACES[0].name);
  const [theme, toggleTheme] = useTheme();
  const hash = useHash();
  const health = useHostHealth();

  const isKit = hash === 'kit';
  const active: RouteKey = isRouteKey(hash) ? hash : 'chat';
  const navigate = (key: RouteKey) => {
    window.location.hash = key;
  };

  const route = ROUTES.find((r) => r.key === active)!;
  const Page = route.Component;
  // 聊天页是居中满屏的：无页头、自己管滚动（对齐原型 #page-chat）
  const isChat = !isKit && active === 'chat';
  // 设置页有页头，但页身是左右分栏、自己管滚动（对齐原型 #page-settings）
  const isSettings = !isKit && active === 'settings';

  return (
    <div className="app">
      <Sidebar
        active={active}
        onNavigate={navigate}
        spaces={SPACES}
        space={space}
        onSpaceChange={setSpace}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="content">
        {/* key 变化触发 pageIn 重放，与原型一致的页面进入动效 */}
        <section className="page" key={isKit ? 'kit' : active}>
          <ContentShell
            title={isKit ? '组件库' : route.name}
            desc={isKit ? 'M1 产出 · hash #kit 直达，不属于一级入口' : route.desc}
            header={!isChat}
            scroll={!isChat && !isSettings}
            bodyClass={isSettings ? 'settings-body' : undefined}
          >
            {isKit ? <KitPage /> : <Page />}
          </ContentShell>
        </section>

        {/* 全局层：AI 悬浮球，不随页面切换（§1.3） */}
        <Orb currentPage={isKit ? '组件库' : route.name} />
      </main>

      {/* 开发期可见的宿主连通指示。生产构建里不出现 —— 原型没有这个元素 */}
      {import.meta.env.DEV && (
        <div
          className="composer-meta"
          style={{ position: 'fixed', left: 16, bottom: 12, zIndex: 80 }}
          title="本地宿主（agent/index.ts）的连通状态"
        >
          {health ? `host ok · ${space}` : 'host offline'}
        </div>
      )}
    </div>
  );
}
