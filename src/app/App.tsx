import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ContentShell from '../components/layout/ContentShell';
import { ROUTES } from './routes';
import { useTheme } from '../lib/useTheme';
import { useHostHealth } from '../lib/useHostHealth';
import Orb from '../features/assistant/Orb';
import type { RouteKey } from '../../shared/types';

const isRouteKey = (v: string): v is RouteKey => ROUTES.some((r) => r.key === v);

/** hash 直达：#chat / #files / #graph / #summary / #settings。便于深链与验收。 */
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

  const active: RouteKey = isRouteKey(hash) ? hash : 'chat';
  const navigate = (key: RouteKey) => {
    window.location.hash = key;
  };

  const route = ROUTES.find((r) => r.key === active)!;
  const Page = route.Component;
  // 聊天页是居中满屏的：无页头、自己管滚动（对齐原型 #page-chat）
  const isChat = active === 'chat';
  // 设置页有页头，但页身是左右分栏、自己管滚动（对齐原型 #page-settings）
  const isSettings = active === 'settings';
  // 文件管理同样是左右分栏 + 底部状态栏（对齐原型 #page-files）
  const isFiles = active === 'files';

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
        <section className="page" key={active}>
          <ContentShell
            title={route.name}
            desc={route.desc}
            header={!isChat}
            scroll={!isChat && !isSettings && !isFiles}
            bodyClass={isSettings ? 'settings-body' : isFiles ? 'files-body' : undefined}
            actions={
              isFiles ? (
                <>
                  <button className="ghost-btn" type="button">
                    导入文件
                  </button>
                  <button className="primary-btn" type="button">
                    AI 整理
                  </button>
                </>
              ) : undefined
            }
          >
            <Page />
          </ContentShell>
        </section>

        {/* 全局层：AI 悬浮球，不随页面切换（§1.3） */}
        <Orb currentPage={route.name} />
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
