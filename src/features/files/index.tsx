import { useMemo, useState } from 'react';
import GraphView from './GraphView';
import {
  listAssociations,
  listFolders,
  listKnowledge,
  listMaterials,
  knowledgeTagGroups,
  statsSummary,
} from '../../api/host';
import { useHost } from '../../lib/useHost';
import { useHostHealth } from '../../lib/useHostHealth';
import { relTime } from '../../lib/relTime';
import { materialKind } from '../../lib/materialKind';
import { formatBytes } from '../../lib/format';
import type {
  Association,
  Folder,
  KnowledgePoint,
  Material,
  MaterialView,
  StatsSummary,
  Tag,
} from '../../../shared/types';
import type { GraphInputNode } from '../../lib/radialLayout';

type ChipKey = 'all' | 'recent' | 'tag' | 'fav' | 'trash' | 'know';
type ViewKey = 'list' | 'graph';

/** 关联图一次要的三样：节点、已建立关联、以及（由布局算出的）坐标 */
interface GraphData {
  nodes: GraphInputNode[];
  assoc: Association[];
}

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

/** 胶囊 → 接口视图的映射。**「知识点」不在其中** —— 它走 `knowledge.list`，不是素材视图 */
const VIEW_OF: Record<Exclude<ChipKey, 'know'>, MaterialView> = {
  all: 'all',
  recent: 'recent',
  tag: 'tag',
  fav: 'favorite',
  trash: 'trash',
};

/**
 * 模块 ② · 文件管理（DESIGN-SPEC §5.2）
 *
 * 两条容易做错的边界，都在这里体现了：
 *  · **第一层是用户自己建的文件夹**，不是按类型自动分组（D11）
 *  · **知识点不属于任何文件夹** —— 它是跨文件夹视图，所以走「知识点」胶囊切左栏，
 *    而不是在文件夹树里多一个节点（D12 / ADR-0007）
 *
 * **数据全部经 `src/api/host.ts` 从本地宿主来**（IPC，ADR-0009）。
 * 页面这一层不 import 任何假数据 —— 那样会掩盖接口问题：页面显示的"对"，
 * 证明不了接口是对的。
 */
export default function FilesPage() {
  const [chip, setChip] = useState<ChipKey>('all');
  const [view, setView] = useState<ViewKey>('list');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [knowTag, setKnowTag] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  // 只为状态栏那个「示例数据」标记。**假数据不可见就会被当成设计**
  const health = useHostHealth();

  const isKnow = chip === 'know';
  const isGraph = view === 'graph';

  /* ---------- 取数。key 唯一描述这次查询的参数 ---------- */

  const foldersQ = useHost('folders', listFolders, [] as Folder[]);
  // 树要显示全部文件素材；表格按当前胶囊另取一次
  const treeQ = useHost('materials:tree', () => listMaterials({ view: 'all' }), [] as Material[]);
  // 「知识点」**不能走这里** —— 它没有文件夹归属，是 `knowledge.list` 的事（D12 / ADR-0007）。
  // 早先没加这道闸，于是 `VIEW_OF['know']` 是 undefined，直接打到宿主那句
  // 「未知的视图」上（截图里露出来的）。
  const rowsQ = useHost(
    `materials:${chip}:${query}`,
    () =>
      isKnow
        ? Promise.resolve([] as Material[])
        : listMaterials({ view: VIEW_OF[chip as Exclude<ChipKey, 'know'>], query }),
    [] as Material[],
  );
  const tagsQ = useHost('knowTags', knowledgeTagGroups, [] as Array<{ tag: Tag; count: number }>);
  const knowQ = useHost(
    `knowledge:${knowTag ?? ''}:${query}`,
    () => listKnowledge({ tag: knowTag ?? undefined, query }),
    [] as KnowledgePoint[],
  );
  const statsQ = useHost<StatsSummary | null>('stats', statsSummary, null);

  // 关联图要的是**整张图**，不是当前列表 —— 它以选中节点为圆心，其余按圈铺开
  const emptyGraph: GraphData = { nodes: [], assoc: [] };
  const graphQ = useHost<GraphData>(`graph:${isGraph}`, async () => {
    if (!isGraph) return emptyGraph;
    const [ms, ks, as] = await Promise.all([
      listMaterials({ view: 'all' }),
      listKnowledge({}),
      // **只要已建立的**（D35）—— 候选不进图谱，也不该进来凑数
      listAssociations({ state: 'established' }),
    ]);
    return {
      nodes: [
        ...ms.map((m) => ({ id: m.id, label: m.title, kind: 'material' as const })),
        ...ks.map((k) => ({ id: k.id, label: k.title, kind: 'distilled' as const })),
      ],
      assoc: as,
    };
  }, emptyGraph);

  const error = foldersQ.error ?? rowsQ.error ?? knowQ.error ?? statsQ.error;

  /* ---------- 树：按 parentId 递归（**可嵌套任意层**，D45） ---------- */

  const byFolder = useMemo(() => {
    const map = new Map<string | 'root', Material[]>();
    for (const m of treeQ.data) {
      const key = m.folderId ?? 'root';
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [treeQ.data]);

  const knowTags = tagsQ.data;
  // 默认选第一个标签，但**不写进 state** —— 写进去会在标签加载完成时覆盖用户的选择
  const activeKnowTag = knowTag ?? knowTags[0]?.tag.name ?? null;

  const rows: Array<Material | KnowledgePoint> = isKnow ? knowQ.data : rowsQ.data;
  const empty = rows.length === 0;
  const treeEmpty = treeQ.data.length === 0;

  /**
   * 关联图的**圆心**。没选中时也必须有一个 —— 否则首屏画不出任何东西，
   * 而在有已建立关联的情况下那是错的（截图暴露过：6 条关联、图却空白，
   * 用户得先猜到"要选一个节点"）。
   *
   * 默认取**关联最多的那个** —— 它天然回答"该从哪儿看起"。
   */
  const centerId = useMemo(() => {
    if (selectedId) return selectedId;
    let best: string | null = null;
    let bestN = 0;
    for (const n of graphQ.data.nodes) {
      const deg = graphQ.data.assoc.filter((a) => a.a === n.id || a.b === n.id).length;
      if (deg > bestN) {
        bestN = deg;
        best = n.id;
      }
    }
    return best;
  }, [selectedId, graphQ.data]);

  function renderFolder(folder: Folder, depth: number): JSX.Element {
    const children = foldersQ.data.filter((f) => f.parentId === folder.id);
    const files = byFolder.get(folder.id) ?? [];
    const open = openIds.includes(folder.id);
    return (
      <div className="tree-folder" key={folder.id}>
        <button
          type="button"
          className="tree-row"
          aria-expanded={open}
          style={depth > 0 ? { paddingLeft: `${8 + depth * 15}px` } : undefined}
          onClick={() =>
            setOpenIds((prev) =>
              prev.includes(folder.id) ? prev.filter((x) => x !== folder.id) : [...prev, folder.id],
            )
          }
        >
          <span className="t-icon">{open ? '▾' : '▸'}</span>
          {folder.name}
          <span className="tree-count">{folder.materialCount}</span>
        </button>
        {open && (
          <div className="tree-children">
            {children.map((c) => renderFolder(c, depth + 1))}
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                className={f.id === selectedId ? 'tree-row active' : 'tree-row'}
                onClick={() => setSelectedId(f.id)}
              >
                <span className="t-icon">·</span>
                {f.title}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
              className={['f-chip', c.know ? 'know' : '', chip === c.key ? 'active' : '']
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
              {knowTags.map((t) => (
                <button
                  key={t.tag.name}
                  type="button"
                  className={t.tag.name === activeKnowTag ? 'know-tag-row active' : 'know-tag-row'}
                  onClick={() => setKnowTag(t.tag.name)}
                >
                  <span># {t.tag.name}</span>
                  <span className="tree-count">{t.count}</span>
                </button>
              ))}
              {knowTags.length === 0 && (
                <div className="empty sm">
                  <div className="empty-title">还没有知识点</div>
                  <div className="empty-desc">蒸馏之后，这里会按标签把它们分好。</div>
                </div>
              )}
            </div>
          ) : treeEmpty ? (
            /* E1 首次空态：树这一栏也要空，但不能是空白框 */
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
            foldersQ.data.filter((f) => f.parentId === null).map((f) => renderFolder(f, 0))
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

        {error && (
          <div className="err-bar">
            <span>{error}</span>
          </div>
        )}

        <div className="files-view">
          {isGraph ? (
            <GraphView
              centerId={centerId}
              nodes={graphQ.data.nodes}
              associations={graphQ.data.assoc}
            />
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
                  ? (rows as KnowledgePoint[]).map((k) => (
                      <tr key={k.id}>
                        <td>
                          <div className="f-name">
                            <span className="f-badge b-know">知</span>
                            {k.title}
                          </div>
                        </td>
                        <td className="f-meta">
                          {k.tags.map((t) => `# ${t.name}`).join('  ')}
                        </td>
                        <td className="f-meta">{relTime(k.updatedAt)}</td>
                        <td className="f-links">◈ {k.establishedAssociationCount}</td>
                      </tr>
                    ))
                  : (rows as Material[]).map((m) => {
                      const kind = materialKind(m.mimeType, m.title);
                      return (
                        <tr
                          key={m.id}
                          className={m.id === selectedId ? 'active' : undefined}
                          onClick={() => setSelectedId(m.id)}
                        >
                          <td>
                            <div className="f-name">
                              <span className={`f-badge b-${kind.badge}`}>{kind.letter}</span>
                              {m.title}
                            </div>
                          </td>
                          <td className="f-meta">{kind.label}</td>
                          <td className="f-meta">{relTime(m.updatedAt)}</td>
                          <td className="f-links">◈ {m.establishedAssociationCount}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          )}
        </div>

        <div className="files-statusbar">
          {statsQ.data && (
            <span>
              素材 {statsQ.data.materialCount} · 知识点 {statsQ.data.knowledgeCount} ·{' '}
              {statsQ.data.establishedAssociationCount} 条关联 ·{' '}
              {/* 单位跟着量级走。写死 GB 时夹具的几 MB 会显示成 `0.0 GB`，看着像坏了 */}
              {formatBytes(statsQ.data.usedBytes)} / {formatBytes(statsQ.data.quotaBytes)}
              {/* 候选另记，**不与上面相加**（D35） */}
              {statsQ.data.candidateAssociationCount > 0 &&
                ` · 另有 ${statsQ.data.candidateAssociationCount} 条候选待确认`}
            </span>
          )}
          <span className="right">
            {/* **示例数据必须可见** —— 不可见就会被当成设计。
                放在这里是因为它是状态栏本来就有的文字位，不新增视觉元素 */}
            {health?.mock && '示例数据 · '}
            流光的边 · 近期活跃关联
          </span>
        </div>
      </div>
    </>
  );
}
