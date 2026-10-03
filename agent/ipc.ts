/**
 * 宿主的方法表（docs/接口规范.md §3.6）。
 *
 * **这一层与传输无关** —— 它只回答"有哪些方法、各自归谁"。
 * `electron/main.ts` 的 ipcMain 只是这张表的一个消费者：换传输不用改这里。
 *
 * **白名单**（ADR-0009 §2）：渲染进程能调用的**只有**这里列出的方法，
 * 表外的名字直接抛错 —— 渲染器连"随便发一个请求"的能力都没有。
 *
 * **状态：接口先定，实现留空。**
 * 已定的方法名全部注册（`ALL_CHANNELS`），未实现的抛**"尚未实现"**。
 * 这一点是刻意的：**"尚未实现"与"未知方法"必须分得开** ——
 * 前者是还没做，后者是名字写错了；混成一句话，调试时会浪费大量时间。
 */
import { AGENT_DELTA, AGENT_DONE, AGENT_ERROR, AGENT_STAGE } from '../shared/events.ts';
import {
  ALL_CHANNELS,
  CH_AGENT_ARRANGE,
  CH_AGENT_CHAT,
  CH_AGENT_STATUS,
  CH_ASSOCIATION_CONFIRM,
  CH_ASSOCIATION_DENY,
  CH_ASSOCIATION_LIST,
  CH_EVOLUTION_LIST,
  CH_FOLDER_CREATE,
  CH_FOLDER_LIST,
  CH_FOLDER_MOVE,
  CH_FOLDER_REMOVE,
  CH_FOLDER_RENAME,
  CH_HEALTH,
  CH_KNOWLEDGE_GET,
  CH_KNOWLEDGE_LIST,
  CH_KNOWLEDGE_REMOVE,
  CH_KNOWLEDGE_SOURCES,
  CH_MATERIAL_GET,
  CH_MATERIAL_LIST,
  CH_MATERIAL_MOVE,
  CH_MATERIAL_REMOVE,
  CH_MATERIAL_RESTORE,
  CH_SPACE_ACTIVATE,
  CH_SPACE_CREATE,
  CH_SPACE_LIST,
  CH_SPACE_REMOVE,
  CH_SPACE_RENAME,
  CH_STATS_SUMMARY,
} from '../shared/ipc.ts';
import type {
  AgentStatus,
  HealthPayload,
  ListAssociationRequest,
  ListKnowledgeRequest,
  ListMaterialRequest,
  MoveMaterialRequest,
} from '../shared/types.ts';
import { getStatus, hasSession, noteError, runChat } from './services/agent.service.ts';
import { isMock, store } from './store/index.ts';

/** 宿主往回推一帧。载荷里的 `event` 取自 shared/events.ts */
export type Emit = (event: string, data: unknown) => void;

/** 一问一答：调用一次，返回一次 */
export type InvokeHandler = (payload: unknown) => unknown | Promise<unknown>;

/** 带流的方法：宿主用 `emit` 分多次往回推，`resolve` 即结束 */
export type StreamHandler = (payload: unknown, emit: Emit) => Promise<void>;

/** 宿主自身的启动时刻 —— 只能在这里取，它是进程级事实 */
const startedAt = Date.now();

/** 未实现的方法统一抛这句话。**不要和"未知方法"混用** */
function notBuilt(channel: string): Error {
  return new Error(`${channel} 尚未实现（接口已定，见 docs/接口规范.md §4 留空清单）`);
}

/* ============================================================
   表：先全部铺成"尚未实现"，再把做好的覆盖上去
   ============================================================ */

/** 带流的方法。其余都是一问一答 */
const STREAM_CHANNELS = new Set<string>([CH_AGENT_CHAT, CH_AGENT_ARRANGE]);

export const INVOKE: Record<string, InvokeHandler> = {};
export const STREAM: Record<string, StreamHandler> = {};

for (const channel of ALL_CHANNELS) {
  if (STREAM_CHANNELS.has(channel)) {
    STREAM[channel] = async () => {
      throw notBuilt(channel);
    };
  } else {
    INVOKE[channel] = () => {
      throw notBuilt(channel);
    };
  }
}

/* ============================================================
   已实现的三条
   ============================================================ */

/** 宿主自身的存活，与 agent 在不在无关 */
INVOKE[CH_HEALTH] = (): HealthPayload => ({
  ok: true,
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  agentConnected: hasSession(),
  space: store.activeSpace()?.name ?? '（还没有知识空间）',
  // 界面据此标明"这段数据是示例"。**假数据不可见就会被当成设计**
  mock: isMock,
});

/** 存在性与能力面，**不触发会话**（懒启动） */
INVOKE[CH_AGENT_STATUS] = (): AgentStatus => getStatus();

/**
 * 发一轮对话。失败**不吞** —— 翻成 `agent.error` 事件回流（§6.3.4 失败不毁内容）：
 * 用户那条消息留在对话里、草稿不清空、输入框不锁，出口是内联重试。
 */
STREAM[CH_AGENT_CHAT] = async (payload, emit): Promise<void> => {
  const text = (payload as { text?: string } | null)?.text ?? '';
  if (!text.trim()) throw new Error('空消息');

  try {
    await runChat(text, {
      onStage: (stage, label) => emit(AGENT_STAGE, { stage, label }),
      onDelta: (delta) => emit(AGENT_DELTA, { text: delta }),
    });
    emit(AGENT_DONE, { ok: true });
  } catch (e) {
    const err = e as Error & { code?: number };
    noteError(err.message);
    emit(AGENT_ERROR, { code: err.code ?? null, message: err.message });
  }
};

/* ============================================================
   S1 · 文件管理页的数据面
   `space` · `folder` · `material` · `knowledge` · `association` · `evolution` · `stats`
   ============================================================ */

/**
 * 载荷校验。**跨进程来的东西不能当可信** —— 类型只在编译期存在，
 * 渲染器传个 `null` 过来照样能进到这里。
 */
function req<T extends object>(payload: unknown, channel: string): T {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`${channel}：载荷必须是一个对象`);
  }
  return payload as T;
}

function str(payload: unknown, key: string, channel: string): string {
  const v = req<Record<string, unknown>>(payload, channel)[key];
  if (typeof v !== 'string' || !v) throw new Error(`${channel}：缺少 ${key}`);
  return v;
}

function idList(payload: unknown, channel: string): string[] {
  const v = req<Record<string, unknown>>(payload, channel).ids;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new Error(`${channel}：ids 必须是字符串数组`);
  }
  return v as string[];
}

/* ---------- space ---------- */

INVOKE[CH_SPACE_LIST] = () => store.listSpaces();
INVOKE[CH_SPACE_CREATE] = (p) => store.createSpace(str(p, 'name', CH_SPACE_CREATE));
/** 只改显示名，**不动路径**（ADR-0006） */
INVOKE[CH_SPACE_RENAME] = (p) =>
  store.renameSpace(str(p, 'id', CH_SPACE_RENAME), str(p, 'name', CH_SPACE_RENAME));
INVOKE[CH_SPACE_REMOVE] = (p) => {
  store.removeSpace(str(p, 'id', CH_SPACE_REMOVE));
};
INVOKE[CH_SPACE_ACTIVATE] = (p) => {
  store.activateSpace(str(p, 'id', CH_SPACE_ACTIVATE));
};

/* ---------- folder：**可嵌套任意层**（D45），宿主负责防循环 ---------- */

INVOKE[CH_FOLDER_LIST] = () => store.listFolders();
INVOKE[CH_FOLDER_CREATE] = (p) => {
  const r = req<{ name?: unknown; parentId?: unknown }>(p, CH_FOLDER_CREATE);
  return store.createFolder(String(r.name ?? ''), typeof r.parentId === 'string' ? r.parentId : null);
};
INVOKE[CH_FOLDER_RENAME] = (p) =>
  store.renameFolder(str(p, 'id', CH_FOLDER_RENAME), str(p, 'name', CH_FOLDER_RENAME));
INVOKE[CH_FOLDER_MOVE] = (p) => {
  const r = req<{ id?: unknown; parentId?: unknown }>(p, CH_FOLDER_MOVE);
  return store.moveFolder(String(r.id ?? ''), typeof r.parentId === 'string' ? r.parentId : null);
};
INVOKE[CH_FOLDER_REMOVE] = (p) => {
  store.removeFolder(str(p, 'id', CH_FOLDER_REMOVE));
};

/* ---------- material ---------- */

INVOKE[CH_MATERIAL_LIST] = (p) => store.listMaterials(req<ListMaterialRequest>(p, CH_MATERIAL_LIST));
INVOKE[CH_MATERIAL_GET] = (p) => store.getMaterial(str(p, 'id', CH_MATERIAL_GET));
/** **点击式移动**（D46）：多选 + 目标夹 */
INVOKE[CH_MATERIAL_MOVE] = (p) => {
  const r = req<{ ids?: unknown; folderId?: unknown }>(p, CH_MATERIAL_MOVE);
  store.moveMaterials({
    ids: Array.isArray(r.ids) ? (r.ids as string[]) : [],
    folderId: typeof r.folderId === 'string' ? r.folderId : null,
  } satisfies MoveMaterialRequest);
};
INVOKE[CH_MATERIAL_REMOVE] = (p) => {
  store.removeMaterials(idList(p, CH_MATERIAL_REMOVE));
};
INVOKE[CH_MATERIAL_RESTORE] = (p) => {
  store.restoreMaterials(idList(p, CH_MATERIAL_RESTORE));
};

/* ---------- knowledge：**跨文件夹的产出**，没有文件夹归属（D12） ---------- */

INVOKE[CH_KNOWLEDGE_LIST] = (p) => {
  const r = req<ListKnowledgeRequest & { groupByTag?: boolean }>(p, CH_KNOWLEDGE_LIST);
  // 左栏的标签分组与条目列表是两种形状 —— 用 `groupByTag` 分开，
  // 而不是让调用方从条目里自己聚合（那样每个页面都要写一遍，且口径会飘）
  if (r.groupByTag) return store.knowledgeTagGroups();
  return store.listKnowledge(r);
};
INVOKE[CH_KNOWLEDGE_GET] = (p) => store.getKnowledge(str(p, 'id', CH_KNOWLEDGE_GET));
INVOKE[CH_KNOWLEDGE_REMOVE] = (p) => {
  store.removeKnowledge(str(p, 'id', CH_KNOWLEDGE_REMOVE));
};
/** **来源关系**（知识点 ← 素材）。只读 —— 用户不能否认它 */
INVOKE[CH_KNOWLEDGE_SOURCES] = (p) => store.knowledgeSources(str(p, 'id', CH_KNOWLEDGE_SOURCES));

/* ---------- association：**两态**（D35），候选的入口不在这 ---------- */

INVOKE[CH_ASSOCIATION_LIST] = (p) =>
  store.listAssociations(req<ListAssociationRequest>(p, CH_ASSOCIATION_LIST));
INVOKE[CH_ASSOCIATION_CONFIRM] = (p) =>
  store.confirmAssociation(str(p, 'id', CH_ASSOCIATION_CONFIRM));
INVOKE[CH_ASSOCIATION_DENY] = (p) => {
  store.denyAssociation(str(p, 'id', CH_ASSOCIATION_DENY));
};

/* ---------- evolution ---------- */

INVOKE[CH_EVOLUTION_LIST] = () => store.listEvolutions();

/* ---------- stats：**视图层**，不产生新实体（ADR-0007） ---------- */

INVOKE[CH_STATS_SUMMARY] = () => store.statsSummary();

/* ============================================================
   查询
   ============================================================ */

/**
 * **已实现**的方法。表里其余的名字虽已注册，但仍是桩（抛"尚未实现"）。
 *
 * 分两批：
 *  · `agent` 域三条 —— 桌面壳阶段就有的
 *  · **S1 的 24 条** —— 文件管理页的数据面（space / folder / material / knowledge /
 *    association / evolution / stats）。**`material.import` 刻意不在里面**：
 *    它要弹系统文件对话框，是独立的一件事，等它自己那一步
 */
const IMPLEMENTED = new Set<string>([
  // agent 域
  CH_HEALTH,
  CH_AGENT_STATUS,
  CH_AGENT_CHAT,
  // space
  CH_SPACE_LIST,
  CH_SPACE_CREATE,
  CH_SPACE_RENAME,
  CH_SPACE_REMOVE,
  CH_SPACE_ACTIVATE,
  // folder
  CH_FOLDER_LIST,
  CH_FOLDER_CREATE,
  CH_FOLDER_RENAME,
  CH_FOLDER_MOVE,
  CH_FOLDER_REMOVE,
  // material（缺 import）
  CH_MATERIAL_LIST,
  CH_MATERIAL_GET,
  CH_MATERIAL_MOVE,
  CH_MATERIAL_REMOVE,
  CH_MATERIAL_RESTORE,
  // knowledge
  CH_KNOWLEDGE_LIST,
  CH_KNOWLEDGE_GET,
  CH_KNOWLEDGE_REMOVE,
  CH_KNOWLEDGE_SOURCES,
  // association
  CH_ASSOCIATION_LIST,
  CH_ASSOCIATION_CONFIRM,
  CH_ASSOCIATION_DENY,
  // evolution
  CH_EVOLUTION_LIST,
  // stats
  CH_STATS_SUMMARY,
]);

/** 这个方法存在吗（白名单校验用；main.ts 在注册前自检） */
export function hasMethod(channel: string): boolean {
  return channel in INVOKE || channel in STREAM;
}

/** 这个方法实现了没有。`--selftest` 用它算"接口完备度"，并在启动时打一行账 */
export function isImplemented(channel: string): boolean {
  return IMPLEMENTED.has(channel);
}

/** 接口面的账：已实现 / 已定名。启动时打一行，省得每次去数 */
export function channelCoverage(): { done: number; total: number; pending: string[] } {
  const pending = ALL_CHANNELS.filter((c) => !IMPLEMENTED.has(c));
  return { done: ALL_CHANNELS.length - pending.length, total: ALL_CHANNELS.length, pending };
}
