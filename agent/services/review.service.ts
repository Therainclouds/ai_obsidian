/**
 * 周期回顾的**组装**（§5.3 · D43）。
 *
 * ## 它是什么、不是什么
 *
 * **周期回顾是视图，不是知识点**（ADR-0007 / D30）：不落盘为实体、不产生来源关系、
 * 不进演化记录、不计入统计。所以这里产出的东西**不是内容**，是可以随时丢掉的派生数据。
 *
 * ## 两条来源
 *
 * D43 定的是**由生成层在打开那一刻写**（一次云端往返，完整三态）。那条路要 agent 运行时
 * 与模型凭据。本文件现在实现的是**第二条**：
 *
 * - `local` —— 按**演化记录**数出事实，拼成一两句陈述。**只报事实，不写叙述**。
 * - `model` —— 未实现。见文件末的「缺口」。
 *
 * ## 「阶段」这个概念
 *
 * `span` 是**每条条目的粒度**，不是"只看这一段"：
 * 日档列出最近几天、周档列出最近几周，以此类推。一个桶一条。
 * 桶里没有演化记录就**不出现** —— 空桶不是"那天什么都没有"，是"那天没有走过演化"，
 * 画出来只会让人以为系统在骗他。
 */
import type {
  Association,
  EvolutionRecord,
  Iso,
  KnowledgePoint,
  ReviewEntry,
  ReviewSpan,
} from '../../shared/types.ts';

/** 最多几条。**这是展示选择，不是数据事实** —— 面板高度决定的，改它不用改别处 */
export const ENTRY_LIMIT = 4;

export interface ReviewInput {
  span: ReviewSpan;
  now: Date;
  evolutions: EvolutionRecord[];
  knowledge: KnowledgePoint[];
  associations: Association[];
}

/* ================================================================== *
 * 分桶
 * ================================================================== */

/** 桶的标识，用于比较"是不是同一个桶"（也是缓存键的一半） */
interface Bucket {
  key: string;
  /** 展示用的日期文字 */
  label: string;
  from: number;
  to: number;
  records: EvolutionRecord[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 该时刻所属桶的起点 */
function bucketStart(t: number, span: ReviewSpan): Date {
  const d = new Date(t);
  switch (span) {
    case 'day':
      return startOfDay(d);
    case 'week': {
      // 周一为一周之始（第 N 周按 ISO 的口径算，见 labelOf）
      const s = startOfDay(d);
      const wd = (s.getDay() + 6) % 7;
      s.setDate(s.getDate() - wd);
      return s;
    }
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'year':
      return new Date(d.getFullYear(), 0, 1);
    default: {
      const never: never = span;
      throw new Error(`未知的时段：${String(never)}`);
    }
  }
}

/** 下一个桶的起点 */
function nextBucket(t: number, span: ReviewSpan): Date {
  const s = bucketStart(t, span);
  switch (span) {
    case 'day':
      s.setDate(s.getDate() + 1);
      break;
    case 'week':
      s.setDate(s.getDate() + 7);
      break;
    case 'month':
      s.setMonth(s.getMonth() + 1);
      break;
    case 'year':
      s.setFullYear(s.getFullYear() + 1);
      break;
  }
  return s;
}

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** ISO 周号。**与周一为一周之始配套**，所以用 ISO 口径而不是"今年第几天/7" */
function isoWeek(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // 挪到那周的周四，那年就是 ISO 周所属的年
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function labelOf(start: Date, span: ReviewSpan, isCurrent: boolean): string {
  switch (span) {
    case 'day':
      return `${pad(start.getMonth() + 1)}-${pad(start.getDate())}${isCurrent ? ' 今日' : ''}`;
    case 'week':
      return `第 ${isoWeek(start)} 周${isCurrent ? ' 本周' : ''}`;
    case 'month':
      return `${start.getMonth() + 1} 月`;
    case 'year':
      return String(start.getFullYear());
  }
}

/** 把演化记录按 `span` 分桶，取最近的 `ENTRY_LIMIT` 个**非空**桶，新的在前 */
function bucketsOf(input: ReviewInput): Bucket[] {
  const { span, now, evolutions } = input;
  const byKey = new Map<string, Bucket>();

  for (const ev of evolutions) {
    const t = Date.parse(ev.at);
    if (Number.isNaN(t)) continue;
    const start = bucketStart(t, span);
    const key = start.toISOString();
    let b = byKey.get(key);
    if (!b) {
      const end = nextBucket(t, span);
      b = { key, label: '', from: start.getTime(), to: end.getTime(), records: [] };
      byKey.set(key, b);
    }
    b.records.push(ev);
  }

  const currentKey = bucketStart(now.getTime(), span).toISOString();
  return [...byKey.values()]
    .map((b) => {
      b.label = labelOf(new Date(b.from), span, b.key === currentKey);
      return b;
    })
    .sort((a, b) => b.from - a.from)
    .slice(0, ENTRY_LIMIT);
}

/* ================================================================== *
 * 本地拼装：**只报事实**
 * ================================================================== */

const TRIGGER_NOUN: Record<EvolutionRecord['trigger'], string> = {
  collector: '收集',
  parser: '解析',
  distiller: '蒸馏',
  linker: '关联',
};

/** 该桶里被**产出**的东西（演化记录的 outputs），按类型分开 */
function outputsOf(records: EvolutionRecord[]): {
  materials: string[];
  knowledge: string[];
  associations: string[];
} {
  const materials: string[] = [];
  const knowledge: string[] = [];
  const associations: string[] = [];
  for (const ev of records) {
    for (const o of ev.outputs) {
      if (o.kind === 'material') materials.push(o.label);
      else if (o.kind === 'distilled') knowledge.push(o.label);
      else if (o.kind === 'association') associations.push(o.label);
    }
  }
  return {
    materials: [...new Set(materials)],
    knowledge: [...new Set(knowledge)],
    associations: [...new Set(associations)],
  };
}

/**
 * 把一个桶说成一条。
 *
 * **严格按数据说话**：有几个知识点就说几个、点名到具体标题；没有任何推断、没有形容词。
 * 这不是保守 —— 是因为这些文字**在生成层接上之前由本地产生**，
 * 本地没有资格替用户"看出趋势"（那需要模型读内容）。
 */
function entryOf(bucket: Bucket, input: ReviewInput): ReviewEntry {
  const outs = outputsOf(bucket.records);
  const todoCount = bucket.records.reduce((n, ev) => n + ev.pending.length, 0);

  const kinds = bucket.records.map((ev) => TRIGGER_NOUN[ev.trigger]);
  const kindCount = new Map<string, number>();
  for (const k of kinds) kindCount.set(k, (kindCount.get(k) ?? 0) + 1);
  const kindText = [...kindCount.entries()].map(([k, n]) => `${k} ${n} 次`).join('、');

  const parts: string[] = [];
  if (outs.materials.length > 0) {
    parts.push(`收进 ${outs.materials.length} 份素材`);
  }
  if (outs.knowledge.length > 0) {
    const names = outs.knowledge.map((t) => `「${t}」`).join('、');
    parts.push(`蒸馏出 ${outs.knowledge.length} 个知识点：${names}`);
  }
  if (outs.associations.length > 0) {
    parts.push(`建立 ${outs.associations.length} 条关联`);
  }

  // 话题取**这桶里新产出知识点的标签** —— 它们是内容上的词，不是我们编的分组词。
  // 桶里没有新知识点时留空，**不要拿"全部标签"来填**：那会让每条看起来都差不多
  const tags: string[] = [];
  for (const ev of bucket.records) {
    for (const o of ev.outputs) {
      if (o.kind !== 'distilled') continue;
      const k = input.knowledge.find((x) => x.id === o.id);
      if (k) tags.push(...k.tags.map((t) => t.name));
    }
  }

  return {
    date: bucket.label,
    title: `走过 ${bucket.records.length} 次演化 · ${kindText}`,
    text: parts.length > 0 ? `${parts.join('，')}。` : '这段时间只发生了读取，没有产生新内容。',
    topics: [...new Set(tags)].slice(0, 3),
    todoCount,
  };
}

/** 本地拼装：从演化记录数出事实。**不调用任何模型** */
export function assembleReview(input: ReviewInput): ReviewEntry[] {
  return bucketsOf(input).map((b) => entryOf(b, input));
}

/* ================================================================== *
 * 缓存（D43）
 * ================================================================== */

/**
 * 缓存键 = **时段 + 当前桶 + 内容指纹**。
 *
 * D43 的失效规则原文是"该区间内的知识点集合变了就失效"。这里把**关联与演化记录**
 * 也算进指纹：回顾正文里会点名关联条数与演化次数，只盯知识点会让那两处停留在旧数上。
 *
 * 指纹取 id 集合的短哈希，不是全量比对 —— 缓存是会话级内存，不需要抗碰撞到那种程度。
 */
export function reviewCacheKey(input: ReviewInput): string {
  const ids = [
    // 知识点带上 `deletedAt` —— 删掉一个知识点时 `updatedAt` 不变，
    // 只看 updatedAt 的话缓存不会失效，回顾里会一直提着一个已经删掉的条目
    ...input.knowledge.map((k) => `k${k.id}${k.updatedAt}${k.deletedAt ?? ''}`),
    ...input.associations.map((a) => `a${a.id}${a.state}`),
    ...input.evolutions.map((e) => `e${e.id}`),
  ].sort();
  return `${input.span}|${bucketStart(input.now.getTime(), input.span).toISOString()}|${hash(
    ids.join(','),
  )}`;
}

/** djb2。只要稳定、够短；**不是密码学哈希，别拿去干别的** */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ================================================================== *
 * 缺口：生成层那一半（D43）
 * ================================================================== *
 *
 * D43 定的是**由生成层在打开那一刻写**，本文件现在只做了本地拼装那一半。
 * 补它的位置就在 `generateReview` 里 —— 拿到 `ReviewInput` 之后：
 *
 *  1. 把 `bucketsOf(input)` 的结果当**事实**喂给模型（不要让它自己去数，
 *     数数它不如代码准；让它做的是"把这几件事实串成一句话"）
 *  2. 要求**结构化输出**（每条一段，字段对齐 `ReviewEntry`）
 *  3. 成功后 `source: 'model'`，失败**落到本地**并把原因记进 `agentError`
 *
 * **它现在没写的理由**：那条路要 agent 运行时 + 模型凭据，而当前开发环境里
 * 跑不起来 —— 也就**没法验收**。按本项目"不写没测过的代码"的纪律，留成缺口比留成
 * 一段看着能用、其实没人跑过的代码好。`source` 字段就是为它留的：接上之后翻成 `model`，
 * 界面上那行"本地拼装"的标注随之消失。
 */

export function generateReview(input: ReviewInput): {
  entries: ReviewEntry[];
  source: 'model' | 'local';
} {
  return { entries: assembleReview(input), source: 'local' };
}

/** 给将来那条路用的区间描述（提示词里要说清"看的是哪一段"） */
export function spanRange(input: ReviewInput): { from: Iso; to: Iso } {
  const bs = bucketsOf(input);
  if (bs.length === 0) {
    return { from: input.now.toISOString(), to: input.now.toISOString() };
  }
  return { from: new Date(bs[bs.length - 1].from).toISOString(), to: new Date(bs[0].to).toISOString() };
}
