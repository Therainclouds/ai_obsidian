import { useState } from 'react';
import GraphView from './GraphView';
import {
  ALL_MATERIALS,
  FOLDERS,
  KNOWLEDGE_POINTS,
  KNOW_TAGS,
  STATUS,
  type MaterialItem,
} from './demo';

type ChipKey = 'all' | 'recent' | 'tag' | 'fav' | 'trash' | 'know';
type ViewKey = 'list' | 'graph';

/**
 * 筛选胶囊 = **视图切换器**，不是过滤器（D12）。
 * 「全部」只数文件素材（D31）；「知识点」走点缀色，因为它是跨文件夹的**产出视图**。
 */
const CHIPS: Array<{ key: ChipKey; label: string; know?: boolean }> = [
  { key: 'all', label: '全部' },
  { key: 'recent', label: '最近' },
  { key: 'tag', label: '标签' },
  { key: 'fav', label: '收藏' },
  { key: 'trash', label: '回收站' },
  { key: 'know', label: '知识点', know: true },
];

/**
 * 模块 ② · 文件管理（DESIGN-SPEC §5.2）
 *
 * 两条容易做错的边界，都在这里体现了：
 *  · **第一层是用户自己建的文件夹**，不是按类型自动分组（D11）
 *  · **知识点不属于任何文件夹** —— 它是跨文件夹视图，所以走「知识点」胶囊切左栏，
 *    而不是在文件夹树里多一个节点（D12 / ADR-0007）
 *
 * 数据来自 `demo.ts`（原型示例值）；真实数据经 `/api/material/*` · `/api/knowledge/*`，
 * 接口先定、实现留空（docs/接口规范.md §3.1）。
 */
export default function FilesPage() {
  const [chip, setChip] = useState<ChipKey>('all');
  const [view, setView] = useState<ViewKey>('list');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>('增长模型.md');
  const [knowTag, setKnowTag] = useState(KNOW_TAGS[0].tag);
  const [openFolders, setOpenFolders] = useState<string[]>(['笔记', '项目']);

  const isKnow = chip === 'know';

  // 素材视图：按胶囊切换。除了「知识点」，其余胶囊在当前阶段都落到同一份素材集
  const materials: MaterialItem[] = ALL_MATERIALS.filter((m) =>
    query ? m.name.toLowerCase().includes(query.toLowerCase()) : true,
  );
  const knowPoints = KNOWLEDGE_POINTS.filter(
    (k) => k.tag === knowTag && (query ? k.title.toLowerCase().includes(query.toLowerCase()) : true),
  );

  const empty = isKnow ? knowPoints.length === 0 : materials.length === 0;

  return (
    <>
      <aside className="files-tree">
        <div className="tree-head">
          <span>{isKnow ? '知识点' : '素材库'}</span>
          <button type="button" title="新建">
            ＋
          </button>
        </div>

        <div className="f-chip-row">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={chip === c.key}
              className={[
                'f-chip',
                c.know ? 'know' : '',
                chip === c.key ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setChip(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="tree">
          {isKnow ? (
            /* 知识点视图的左栏：按标签分组的产出列表，替代文件夹树 */
            <div>
              {KNOW_TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  className={t.tag === knowTag ? 'know-tag-row active' : 'know-tag-row'}
                  onClick={() => setKnowTag(t.tag)}
                >
                  <span>{t.tag}</span>
                  <span className="tree-count">{t.count}</span>
                </button>
              ))}
            </div>
          ) : materials.length === 0 ? (
            /* E1 首次空态 / E4 搜索无果：树这一栏也要空，但不能是空白框 */
            <div className="empty sm">
              <div className="empty-mark mute">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 7.5A1.5 1.5 0 014.5 6h4l2 2.5h7A1.5 1.5 0 0119 10v7.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 013 17.5z" />
                </svg>
              </div>
              <div className="empty-title">{query ? '没有匹配' : '还没有文件'}</div>
              <div className="empty-desc">
                {query ? '换个关键词试试。' : '导入后 AI 会自动解析并连接它们。'}
              </div>
            </div>
          ) : (
            /* 第一层 = 用户自己建的文件夹（D11） */
            FOLDERS.map((f) => {
              const open = openFolders.includes(f.name);
              return (
                <div className="tree-folder" key={f.name}>
                  <button
                    type="button"
                    className="tree-row"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenFolders((prev) =>
                        prev.includes(f.name) ? prev.filter((x) => x !== f.name) : [...prev, f.name],
                      )
                    }
                  >
                    <span className="t-icon">{open ? '▾' : '▸'}</span>
                    {f.name}
                    <span className="tree-count">{f.count}</span>
                  </button>
                  {open && f.files.length > 0 && (
                    <div className="tree-children">
                      {f.files.map((file) => (
                        <button
                          key={file.name}
                          type="button"
                          className={file.name === selected ? 'tree-row active' : 'tree-row'}
                          onClick={() => setSelected(file.name)}
                        >
                          <span className="t-icon">·</span>
                          {file.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div className="files-main">
        <div className="files-toolbar">
          <div className="view-toggle" role="tablist" aria-label="视图切换">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
            >
              列表
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'graph'}
              className={view === 'graph' ? 'active' : ''}
              onClick={() => setView('graph')}
            >
              关联图
            </button>
          </div>
          <input
            className="files-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件名、内容、标签…"
            aria-label="搜索"
          />
          <div className="spacer" />
          <button className="ghost-btn" type="button">
            按更新时间
          </button>
        </div>

        <div className="files-view">
          {view === 'graph' ? (
            <GraphView />
          ) : empty ? (
            /* E3 筛选后 / E4 搜索无果：用户知道东西还在，只是没露出来 → 只给一个出口 */
            <div className="state-layer">
              <div className="empty">
                <div className="empty-mark mute">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="M16 16l4.5 4.5" />
                  </svg>
                </div>
                <div className="empty-title">
                  {query ? (
                    <>
                      没找到 <em>{query}</em>
                    </>
                  ) : (
                    '这里是空的'
                  )}
                </div>
                <div className="empty-desc">
                  {query ? '换个关键词，或清空搜索看看全部。' : '这个视图下还没有内容。'}
                </div>
                <div className="empty-actions">
                  <button className="ghost-btn" type="button" onClick={() => setQuery('')}>
                    清空搜索
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>名称</th>
                  <th>{isKnow ? '标签' : '类型'}</th>
                  <th>更新时间</th>
                  <th>关联</th>
                </tr>
              </thead>
              <tbody>
                {isKnow
                  ? knowPoints.map((k) => (
                      <tr key={k.title}>
                        <td>
                          <div className="f-name">
                            <span className="f-badge b-know">知</span>
                            {k.title}
                          </div>
                        </td>
                        <td className="f-meta">{k.tag}</td>
                        <td className="f-meta">{k.updatedAt}</td>
                        <td className="f-links">◈ {k.links}</td>
                      </tr>
                    ))
                  : materials.map((m) => (
                      <tr key={m.name}>
                        <td>
                          <div className="f-name">
                            <span className={`f-badge b-${m.badge}`}>{m.badgeText}</span>
                            {m.name}
                          </div>
                        </td>
                        <td className="f-meta">{m.kind}</td>
                        <td className="f-meta">{m.updatedAt}</td>
                        <td className="f-links">◈ {m.links}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="files-statusbar">
          <span>
            素材 {STATUS.materials} · 知识点 {STATUS.knowledge} · {STATUS.associations} 条关联 ·{' '}
            {STATUS.used} / {STATUS.total}
          </span>
          <span className="right">{STATUS.note}</span>
        </div>
      </div>
    </>
  );
}
