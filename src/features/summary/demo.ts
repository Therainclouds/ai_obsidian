/**
 * ⚠ **示例数据，不是真实数据。**
 *
 * 来源与可信度分两档：
 *
 * - **照抄原型**（`design/prototype/index-final.html` 的 `#page-summary`）：
 *   统计卡四张的数值、热度柱 14 档强度、TOP 6 排名与次数、「日」档的三条回顾条目。
 * - **本次为演示布局新拟**（原型里没有）：周 / 月 / 年 三档的条目。
 *   原因：原型的日/周/月/年四个 tab 是「仅视觉态」，点了不换内容；而 §5.3 的交互要求
 *   「切换回顾列表」。要让这条真的能切，就得有内容 —— 但这些文字是**我编的**，
 *   不是设计产出。**周期回顾的导览文字由谁生成、什么时候生成仍是待定项**（§5.3 待定）。
 *
 * 真实数据经 `/api/stats/*` 与 `/api/review/*` 从本地宿主取（docs/接口规范.md）。
 * 接上之后本文件整体删除。
 */

export interface StatNumbers {
  /** 相识天数 */
  days: number;
  since: string;
  /** 今日互动次数 */
  todayInteractions: number;
  materials: number;
  associations: number;
  knowledge: number;
  /** 已用 / 总配额，单位 GB */
  usedGb: number;
  totalGb: number;
  /** 进度条百分比 */
  usedPercent: number;
}

export const STATS: StatNumbers = {
  days: 47,
  since: '8 月 6 日',
  todayInteractions: 23,
  materials: 128,
  associations: 342,
  knowledge: 56,
  usedGb: 2.4,
  totalGb: 10,
  usedPercent: 24,
};

/** 近 14 天互动强度。`level` 决定颜色档位，`height` 是柱高（0–1） */
export interface HeatCell {
  level: 'l1' | 'l2' | 'l3' | 'l4' | 'hot';
  height: number;
}

export const HEAT: HeatCell[] = [
  { level: 'l1', height: 0.34 },
  { level: 'l2', height: 0.56 },
  { level: 'l1', height: 0.3 },
  { level: 'l3', height: 0.78 },
  { level: 'l2', height: 0.6 },
  { level: 'l4', height: 1 },
  { level: 'l3', height: 0.82 },
  { level: 'l2', height: 0.5 },
  { level: 'l3', height: 0.74 },
  { level: 'hot', height: 0.95 },
  { level: 'l3', height: 0.7 },
  { level: 'hot', height: 1 },
  { level: 'l2', height: 0.52 },
  { level: 'hot', height: 0.88 },
];

/** 高频触发知识 TOP 6。`fill` 是条形百分比 —— **口径未定**：AI 引用次数还是用户查看次数？（§5.3 待定） */
export interface RankItem {
  name: string;
  count: number;
  fill: number;
}

export const TOP_KNOWLEDGE: RankItem[] = [
  { name: '低粉爆款三要素', count: 38, fill: 100 },
  { name: '小红书选题公式', count: 29, fill: 76 },
  { name: '增长模型 · AARRR', count: 24, fill: 63 },
  { name: 'AI 笔记产品竞品对比', count: 18, fill: 47 },
  { name: '习惯回路模型', count: 13, fill: 34 },
  { name: '封面图设计 checklist', count: 10, fill: 26 },
];

export type ReviewTab = 'day' | 'week' | 'month' | 'year';

export const REVIEW_TABS: Array<{ key: ReviewTab; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
];

/** 周期回顾的一条。它是**视图**：不落盘、不产生来源关系、不进演化记录（ADR-0007） */
export interface ReviewItem {
  date: string;
  title: string;
  text: string;
  tags: string[];
  /** 待确认项数。>0 时挂一个陶色 chip */
  todos?: number;
}

export const REVIEWS: Record<ReviewTab, ReviewItem[]> = {
  // ↓ 三条照抄原型
  day: [
    {
      date: '09-22 今日',
      title: '围绕「增长」的一天',
      text: '今天 23 次互动中，14 次与增长模型相关。你将《竞品调研.pdf》并入知识网络，新增 3 条关联。',
      tags: ['增长', '竞品'],
      todos: 1,
    },
    {
      date: '09-21',
      title: '小红书运营知识持续加密',
      text: '「低粉爆款三要素」被调用 6 次，成为本周最高频知识点，与「选题公式」之间出现新的潜在关联。',
      tags: ['小红书', '爆款'],
    },
    {
      date: '09-20',
      title: '碎片灵感开始聚拢',
      text: '过去三天随手记录的 9 条灵感中，5 条指向「AI 工具设计」方向，已自动归拢为候选主题。',
      tags: ['灵感', 'AI 工具'],
    },
  ],
  // ↓ 以下三档为本次新拟，只为让 tab 真的能切（见文件头说明）
  week: [
    {
      date: '第 39 周',
      title: '关联从 4 条长到 12 条',
      text: '本周新增 5 份素材，蒸馏出 8 个知识点。四条新的关联围绕「增长模型」形成一个小簇。',
      tags: ['增长', '聚类'],
      todos: 2,
    },
    {
      date: '第 38 周',
      title: '第一次出现「被反复调用」的知识点',
      text: '「低粉爆款三要素」本周被调用 11 次，是它第一次进入高频触发榜前列。',
      tags: ['爆款'],
    },
  ],
  month: [
    {
      date: '9 月',
      title: '知识网络开始有形状',
      text: '本月新增 42 份素材、19 个知识点。图谱从零散的星状变成两三个可辨认的簇。',
      tags: ['全月', '结构'],
      todos: 3,
    },
    {
      date: '8 月',
      title: '起步的一个月',
      text: '从 8 月 6 日至今共积累 86 份素材。前两周以导入为主，第三周开始出现跨文件夹的关联。',
      tags: ['起步'],
    },
  ],
  year: [
    {
      date: '2026',
      title: '第一个完整年度的雏形',
      text: '这一年你存进 128 份素材、56 个知识点、342 条关联。最早的一份素材来自 8 月 6 日。',
      tags: ['年度'],
      todos: 3,
    },
  ],
};
