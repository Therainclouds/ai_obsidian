/**
 * ⚠ **原型的示例数据，不是真实数据。**
 *
 * 来源：`design/prototype/index-final.html` 的 `#page-files` markup（文件、文件夹、
 * 知识点标签、关联数与图谱坐标全部照抄）。用它只为**验证布局与视觉对齐**。
 *
 * 真实数据经 `/api/material/*` 与 `/api/knowledge/*` 从本地宿主取（docs/接口规范.md §3.1），
 * **接口先定、实现留空**。接上之后本文件整体删除。
 */

export interface MaterialItem {
  name: string;
  kind: 'Markdown' | 'PDF' | '图片' | '网页剪藏';
  badge: 'md' | 'pdf' | 'img' | 'url';
  badgeText: string;
  updatedAt: string;
  /** 关联数。注意这是**关联**，不是**来源关系** —— 两者不得合并计数（CONTEXT.md） */
  links: number;
}

export interface Folder {
  name: string;
  count: number;
  files: MaterialItem[];
}

export const FOLDERS: Folder[] = [
  {
    name: '笔记',
    count: 46,
    files: [
      { name: '增长模型.md', kind: 'Markdown', badge: 'md', badgeText: 'M', updatedAt: '10 分钟前', links: 6 },
      { name: '小红书运营手册.md', kind: 'Markdown', badge: 'md', badgeText: 'M', updatedAt: '昨天 21:04', links: 9 },
      { name: 'AI 产品观察.md', kind: 'Markdown', badge: 'md', badgeText: 'M', updatedAt: '昨天 18:32', links: 4 },
      { name: '读书 · 认知觉醒.md', kind: 'Markdown', badge: 'md', badgeText: 'M', updatedAt: '4 天前', links: 5 },
    ],
  },
  {
    name: '项目',
    count: 23,
    files: [
      { name: '知识系统 v0.3.md', kind: 'Markdown', badge: 'md', badgeText: 'M', updatedAt: '昨天', links: 7 },
      { name: '竞品调研.pdf', kind: 'PDF', badge: 'pdf', badgeText: 'P', updatedAt: '3 天前', links: 3 },
    ],
  },
  { name: '灵感', count: 38, files: [] },
  { name: '附件', count: 21, files: [] },
];

/** 全部素材（表格里「全部」胶囊的视图）。D31：「全部」只数文件素材，= 各文件夹之和 */
export const ALL_MATERIALS: MaterialItem[] = [
  ...FOLDERS[0].files,
  { name: '竞品调研.pdf', kind: 'PDF', badge: 'pdf', badgeText: 'P', updatedAt: '3 天前', links: 3 },
  { name: 'Obsidian 图谱设计参考', kind: '网页剪藏', badge: 'url', badgeText: 'L', updatedAt: '上周', links: 2 },
  { name: '白头脑暴照片.png', kind: '图片', badge: 'img', badgeText: 'I', updatedAt: '上周', links: 1 },
];

/** 知识点按标签分组（左栏）。知识点**不属于任何用户文件夹**，是跨文件夹视图（D12） */
export const KNOW_TAGS = [
  { tag: '# 爆款规律', count: 18 },
  { tag: '# 运营方法', count: 14 },
  { tag: '# 增长模型', count: 11 },
  { tag: '# 认知科学', count: 8 },
  { tag: '# 工具评测', count: 5 },
];

export interface KnowledgeItem {
  title: string;
  tag: string;
  updatedAt: string;
  links: number;
}

export const KNOWLEDGE_POINTS: KnowledgeItem[] = [
  { title: '低粉爆款三要素', tag: '# 爆款规律', updatedAt: '昨天', links: 12 },
  { title: '小红书选题公式', tag: '# 爆款规律', updatedAt: '昨天', links: 10 },
  { title: '增长模型 AARRR', tag: '# 增长模型', updatedAt: '3 天前', links: 8 },
  { title: 'AI 笔记竞品对比', tag: '# 工具评测', updatedAt: '4 天前', links: 7 },
  { title: '习惯回路模型', tag: '# 认知科学', updatedAt: '上周', links: 5 },
  { title: '封面图检查清单', tag: '# 运营方法', updatedAt: '上周', links: 4 },
];

/** 底部状态栏的数字（原型原值） */
export const STATUS = {
  materials: 128,
  knowledge: 56,
  /** **关联**条数。来源关系是另一个数，不在这里（不得合并计数） */
  associations: 342,
  used: '2.4 GB',
  total: '10 GB',
  note: '流光的边 · 近期活跃关联',
};
