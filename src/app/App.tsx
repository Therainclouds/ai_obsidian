import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ContentShell from '../components/layout/ContentShell';
import { ROUTES } from './routes';
import { useTheme } from '../lib/useTheme';
import { useHostHealth } from '../lib/useHostHealth';
import { useHost } from '../lib/useHost';
import { activateSpace, listSpaces } from '../api/host';
import Orb from '../features/assistant/Orb';
import type { RouteKey, Space } from '../../shared/types';

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

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const hash = useHash();
  const health = useHostHealth();

  // 知识空间来自宿主（ADR-0006）。**这里原来写死了三个假的** —— 那也是假数据，
  // 而且它比页面里的更隐蔽：看上去像"产品还没有空间"这个正常状态。
  const spacesQ = useHost('spaces', listSpaces, [] as Space[]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const activeSpace =
    spacesQ.data.find((s) => s.id === spaceId) ??
    spacesQ.data.find((s) => s.active) ??
    spacesQ.data[0];
  const spaceOptions = spacesQ.data.map((s) => ({
    name: s.name,
    meta: `${s.materialCount} 素材 · ${s.knowledgeCount} 知识点`,
  }));

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
        spaces={spaceOptions}
        space={activeSpace?.name ?? '（没有知识空间）'}
        onSpaceChange={(name) => {
          const hit = spacesQ.data.find((s) => s.name === name);
          if (!hit) return;
          setSpaceId(hit.id);
          // 切空间要不要重载 agent **仍未实测**（ADR-0006 待验证项）——
          // 接口已经在了，行为等实测结果再补
          void activateSpace(hit.id).then(spacesQ.reload);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="content">
        {/* key 变化触发 pageIn 重放，与原型一致的页面进入动效 */}
        <section className="page" key={active}>
          <ContentShell
            title={route.name}
            desc={route.pageDesc}
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
          title="本地宿主（Electron 主进程）的连通状态"
        >
          {health ? `host ok · ${activeSpace?.name ?? '—'}` : 'host offline'}
        </div>
      )}
    </div>
  );
}
