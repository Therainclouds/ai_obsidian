/**
 * 宿主 API 客户端（DESIGN-SPEC §9.3 的 `src/api/`）。
 *
 * **渲染器不直接调 `window.host`** —— 都走这里。好处有两个：
 *  · 方法名集中引自 `shared/ipc`，业务代码里不会出现手写字符串
 *  · 宿主不在时（比如把 dist 直接丢进浏览器看）能给出人看得懂的错，而不是
 *    `Cannot read properties of undefined`
 *
 * **状态：接口先定，实现留空。** 这里的方法**全部已定名**，宿主侧多数还是桩
 * （会抛"尚未实现"）。这是刻意的 —— 形状先落定，页面可以照它写，不用等后端。
 * 实现进度见 `docs/接口规范.md` §4。
 *
 * 加载态由页面按 §6.2 三档自己给：纯本地动作为无、本地有耗时给骨架、云端往返给完整三态。
 */
import * as CH from '../../shared/ipc';
import type {
  AgentStatus,
  Association,
  Conversation,
  ConversationMessage,
  EvolutionRecord,
  Folder,
  HealthPayload,
  ImportMaterialRequest,
  KnowledgePoint,
  ListAssociationRequest,
  ListKnowledgeRequest,
  ListMaterialRequest,
  Material,
  ModelConfig,
  MoveMaterialRequest,
  ReviewResponse,
  ReviewSpan,
  SaveModelRequest,
  SkillInfo,
  SourceLink,
  Space,
  StatsSummary,
  Tag,
} from '../../shared/types';

const NOT_IN_SHELL =
  '这个页面不在桌面壳里 —— 宿主是 Electron 主进程，请用 npm start 启动，而不是用浏览器打开 dist/';

function bridge(): NonNullable<Window['host']> {
  const h = window.host;
  if (!h) throw new Error(NOT_IN_SHELL);
  return h;
}

/**
 * Electron 会给主进程抛的错套一层壳：`Error invoking remote method 'host:invoke': Error: 真正的消息`。
 * 那层壳对用户没有意义，而**宿主的报错本来就是中文的、可以直接显示**（§6.3.3 再按五型翻译）。
 * 所以在这里剥掉，让上层拿到的是干净的原因。
 */
function cleanHostError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, '');
}

/** 一问一答。**内部用；业务代码请用下面带名字的那组** */
function ask<T>(channel: string, payload?: unknown): Promise<T> {
  return bridge()
    .invoke<T>(channel, payload)
    .catch((e: unknown) => {
      throw new Error(cleanHostError(e));
    });
}

/* ============================================================
   宿主与 agent
   ============================================================ */

/** 宿主自身的存活，与 agent 在不在无关 */
export const hostHealth = (): Promise<HealthPayload> => ask(CH.CH_HEALTH);

/** agent 运行时的能力面。**懒启动**：调用它不会拉起子进程 */
export const agentStatus = (): Promise<AgentStatus> => ask(CH.CH_AGENT_STATUS);

/** 「重载 agent」—— 模型配置 / 技能 / 知识空间三处生效条件合并成的唯一入口（约 3 秒） */
export const agentReload = (): Promise<void> => ask(CH.CH_AGENT_RELOAD);

/**
 * 发一轮对话。返回取消函数。
 *
 * 流式：`onEvent` 会收到 `agent.stage` / `agent.delta` / `agent.done` / `agent.error`。
 * **结束由事件决定，不由 await 决定** —— 与 HTTP 时代不同。
 */
export function agentChat(
  text: string,
  onEvent: (event: string, data: unknown) => void,
): () => void {
  return bridge().stream(CH.CH_AGENT_CHAT, { text }, onEvent);
}

/**
 * 「**AI 整理**」—— 手动补跑解析器 + 关联器（D42）。
 * **幂等**：没有待处理的素材与节点时直接结束（UI 上按钮应禁用并说明）。
 */
export function agentArrange(onEvent: (event: string, data: unknown) => void): () => void {
  return bridge().stream(CH.CH_AGENT_ARRANGE, {}, onEvent);
}

/** 宿主主动推的**全局事件**（演化记录 / Hook 进度 / 素材入库）。返回取消订阅的函数 */
export const onHostEvent = (
  onEvent: (event: string, data: unknown) => void,
): (() => void) => bridge().on(onEvent);

/* ============================================================
   知识空间（ADR-0006）—— 内容边界
   ============================================================ */

export const listSpaces = (): Promise<Space[]> => ask(CH.CH_SPACE_LIST);
export const createSpace = (name: string): Promise<Space> => ask(CH.CH_SPACE_CREATE, { name });
/** 只改显示名，**不动路径**（ADR-0006） */
export const renameSpace = (id: string, name: string): Promise<Space> =>
  ask(CH.CH_SPACE_RENAME, { id, name });
export const removeSpace = (id: string): Promise<void> => ask(CH.CH_SPACE_REMOVE, { id });
/** 切空间要不要重载 agent 仍未实测（ADR-0006 待验证项）—— 这条接口先定，行为后补 */
export const activateSpace = (id: string): Promise<void> => ask(CH.CH_SPACE_ACTIVATE, { id });

/* ============================================================
   文件夹 —— 用户自己建的、只装文件素材，可嵌套任意层（D45）
   ============================================================ */

export const listFolders = (): Promise<Folder[]> => ask(CH.CH_FOLDER_LIST);
export const createFolder = (name: string, parentId: string | null): Promise<Folder> =>
  ask(CH.CH_FOLDER_CREATE, { name, parentId });
export const renameFolder = (id: string, name: string): Promise<Folder> =>
  ask(CH.CH_FOLDER_RENAME, { id, name });
/** 改 `parentId`。**宿主必须防循环** —— 不能把父夹移进自己的子孙 */
export const moveFolder = (id: string, parentId: string | null): Promise<Folder> =>
  ask(CH.CH_FOLDER_MOVE, { id, parentId });
export const removeFolder = (id: string): Promise<void> => ask(CH.CH_FOLDER_REMOVE, { id });

/* ============================================================
   素材 —— 文件素材与对话素材共用，靠 folderId 区分（ADR-0007）
   ============================================================ */

export const listMaterials = (req: ListMaterialRequest): Promise<Material[]> =>
  ask(CH.CH_MATERIAL_LIST, req);
export const getMaterial = (id: string): Promise<Material> => ask(CH.CH_MATERIAL_GET, { id });
export const importMaterials = (req: ImportMaterialRequest): Promise<Material[]> =>
  ask(CH.CH_MATERIAL_IMPORT, req);
/** **点击式移动**（D46）：多选 + 目标夹。不依赖拖拽 */
export const moveMaterials = (req: MoveMaterialRequest): Promise<void> =>
  ask(CH.CH_MATERIAL_MOVE, req);
/** 进回收站（软删） */
export const removeMaterials = (ids: string[]): Promise<void> =>
  ask(CH.CH_MATERIAL_REMOVE, { ids });
export const restoreMaterials = (ids: string[]): Promise<void> =>
  ask(CH.CH_MATERIAL_RESTORE, { ids });

/* ============================================================
   知识点 —— 跨文件夹的产出（D12），没有文件夹归属
   ============================================================ */

export const listKnowledge = (req: ListKnowledgeRequest = {}): Promise<KnowledgePoint[]> =>
  ask(CH.CH_KNOWLEDGE_LIST, req);
export const getKnowledge = (id: string): Promise<KnowledgePoint> =>
  ask(CH.CH_KNOWLEDGE_GET, { id });
export const removeKnowledge = (id: string): Promise<void> =>
  ask(CH.CH_KNOWLEDGE_REMOVE, { id });
/** 它的**来源关系**（知识点 ← 素材）。只读 —— 来源关系用户不能否认 */
export const knowledgeSources = (id: string): Promise<SourceLink[]> =>
  ask(CH.CH_KNOWLEDGE_SOURCES, { id });

/** 左栏「知识点」视图按标签分组要用的聚合（§5.1） */
export const knowledgeTagGroups = (): Promise<Array<{ tag: Tag; count: number }>> =>
  ask(CH.CH_KNOWLEDGE_LIST, { groupByTag: true } satisfies ListKnowledgeRequest);

/* ============================================================
   关联 —— 两态（D35 / ADR-0010）
   ============================================================ */

export const listAssociations = (req: ListAssociationRequest): Promise<Association[]> =>
  ask(CH.CH_ASSOCIATION_LIST, req);
/** 确认 → 升为**已建立关联**，进进化图谱 */
export const confirmAssociation = (id: string): Promise<Association> =>
  ask(CH.CH_ASSOCIATION_CONFIRM, { id });
/** 否认 → **这一对**不再被提议（永久压制，不是"下次再问"） */
export const denyAssociation = (id: string): Promise<void> =>
  ask(CH.CH_ASSOCIATION_DENY, { id });

/* ============================================================
   演化记录（ADR-0001）
   ============================================================ */

export const listEvolutions = (): Promise<EvolutionRecord[]> =>
  ask(CH.CH_EVOLUTION_LIST);

/* ============================================================
   对话历史 —— 产品自己存（D38），不是 agent 运行时的会话
   ============================================================ */

export const listConversations = (): Promise<Conversation[]> =>
  ask(CH.CH_CONVERSATION_LIST);
export const getConversation = (id: string): Promise<ConversationMessage[]> =>
  ask(CH.CH_CONVERSATION_GET, { id });
export const createConversation = (title?: string): Promise<Conversation> =>
  ask(CH.CH_CONVERSATION_CREATE, { title });
export const removeConversation = (id: string): Promise<void> =>
  ask(CH.CH_CONVERSATION_REMOVE, { id });

/* ============================================================
   视图层 —— 不产生新实体（ADR-0007）
   ============================================================ */

export const statsSummary = (): Promise<StatsSummary> => ask(CH.CH_STATS_SUMMARY);
/** **周期回顾**：打开时现生成 + 缓存（D43）。缓存不是落盘为实体 */
export const reviewGet = (span: ReviewSpan): Promise<ReviewResponse> =>
  ask(CH.CH_REVIEW_GET, { span });

/* ============================================================
   设置
   ============================================================ */

export const modelConfig = (): Promise<ModelConfig> => ask(CH.CH_MODEL_CONFIG);
export const saveModel = (req: SaveModelRequest): Promise<ModelConfig> =>
  ask(CH.CH_MODEL_SAVE, req);
/** 测试连接。**有自己的三态**（§5.4：401 / 缺 Base URL / 缺 Key） */
export const testModel = (slot: 'decision' | 'generation'): Promise<{ ok: boolean; reason?: string }> =>
  ask(CH.CH_MODEL_TEST, { slot });

export const listSkills = (): Promise<SkillInfo[]> => ask(CH.CH_SKILL_LIST);
export const toggleSkill = (name: string, enabled: boolean): Promise<SkillInfo> =>
  ask(CH.CH_SKILL_TOGGLE, { name, enabled });
/** 「让 AI 帮我写一个」—— 落盘流程仍未定（§10.2），接口先占位 */
export const createSkill = (description: string): Promise<SkillInfo> =>
  ask(CH.CH_SKILL_CREATE, { description });
export const importSkill = (source: string): Promise<SkillInfo> =>
  ask(CH.CH_SKILL_IMPORT, { source });
export const removeSkill = (name: string): Promise<void> => ask(CH.CH_SKILL_REMOVE, { name });
