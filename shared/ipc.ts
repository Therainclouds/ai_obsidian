/**
 * 渲染器 ↔ 宿主的唯一通道（ADR-0009 · DESIGN-SPEC §9.1.3）。
 *
 * 这一层定义的是**方法名与信封**，不是传输实现。现在挂在 IPC 上；
 * 若目标机证实无图形栈（ADR-0009 未定项 3），可以在同一张方法表上再挂一个
 * HTTP 适配器 —— **方法表不用改**（见 `agent/ipc.ts`）。
 *
 * **状态：接口先定，实现留空。** 下面列的方法**全部已定名**，实现进度见
 * `docs/接口规范.md` §4。方法表里没实现的会**明确抛"尚未实现"**，而不是"未知方法" ——
 * 两者要分得开：前者是没做，后者是名字写错了。
 */

/* ============================================================
   IPC 信封（**不是业务方法名**）
   ============================================================ */

/**
 * ⚠ **下面几个是信封名，`electron/preload.cjs` 里也写了一遍。**
 *
 * 为什么不在 preload 里 import 本文件：preload 跑在渲染进程的沙箱里，
 * **不走 Node 的模块加载器**，type stripping 不适用，所以它必须是普通 CJS。
 * 改这几个名字时**两个文件一起改**——这类"两处必须一致"是本项目反复吃亏的地方
 * （见 `.workbuddy/memory/MEMORY.md`），所以两边都留了这条注释。
 */
export const HOST_INVOKE = 'host:invoke';
export const HOST_STREAM = 'host:stream';
export const HOST_CANCEL = 'host:cancel';
export const HOST_STREAM_PREFIX = 'host:stream:';
/** 宿主 → 渲染器的**全局事件**（ADR-0009 §3：IPC 天生有推送，不需要常驻连接） */
export const HOST_EVENT = 'host:event';

/** 流的一帧。`event` 取自 `shared/events.ts` 的事件名 */
export interface StreamFrame {
  event: string;
  data: unknown;
}

/** 宿主向渲染器推的通道名（一次流一个，避免多流互相串帧） */
export function streamChannel(reqId: string): string {
  return HOST_STREAM_PREFIX + reqId;
}

/* ============================================================
   业务方法名：`<域>.<资源>`（接口规范 §3.1）
   域与 DESIGN-SPEC §5 的模块分区一致；渲染器侧只用这些名字。
   ============================================================ */

/** **知识空间** —— 内容边界（ADR-0006） */
export const CH_SPACE_LIST = 'space.list';
export const CH_SPACE_CREATE = 'space.create';
/** 只改显示名，**不动路径**（ADR-0006） */
export const CH_SPACE_RENAME = 'space.rename';
export const CH_SPACE_REMOVE = 'space.remove';
export const CH_SPACE_ACTIVATE = 'space.activate';

/** **文件夹** —— 用户自己建的、只装文件素材，可嵌套任意层（D45） */
export const CH_FOLDER_LIST = 'folder.list';
export const CH_FOLDER_CREATE = 'folder.create';
export const CH_FOLDER_RENAME = 'folder.rename';
/** 移动文件夹 = 改 `parentId`。**要防循环** —— 不能把父夹移进自己的子孙 */
export const CH_FOLDER_MOVE = 'folder.move';
export const CH_FOLDER_REMOVE = 'folder.remove';

/** **素材** —— 文件素材与对话素材共用一套方法，靠 `folderId` 区分 */
export const CH_MATERIAL_LIST = 'material.list';
export const CH_MATERIAL_GET = 'material.get';
export const CH_MATERIAL_IMPORT = 'material.import';
/** **点击式移动**（D46）：多选 + 目标文件夹。**不依赖拖拽** */
export const CH_MATERIAL_MOVE = 'material.move';
/** 进回收站（软删）。回收站是筛选胶囊之一（§5.1） */
export const CH_MATERIAL_REMOVE = 'material.remove';
export const CH_MATERIAL_RESTORE = 'material.restore';

/** **知识点** —— 跨文件夹的产出（D12）。**没有文件夹归属** */
export const CH_KNOWLEDGE_LIST = 'knowledge.list';
export const CH_KNOWLEDGE_GET = 'knowledge.get';
export const CH_KNOWLEDGE_REMOVE = 'knowledge.remove';
/** 它的**来源关系**（知识点 ← 素材）。只读 —— 来源关系用户不能否认 */
export const CH_KNOWLEDGE_SOURCES = 'knowledge.sources';

/** **关联** —— 两态（D35）。**候选的入口在进化图谱的「待确认卡片」**，不在这 */
export const CH_ASSOCIATION_LIST = 'association.list';
export const CH_ASSOCIATION_CONFIRM = 'association.confirm';
export const CH_ASSOCIATION_DENY = 'association.deny';

/** **演化记录** —— 图谱的数据源（ADR-0001） */
export const CH_EVOLUTION_LIST = 'evolution.list';

/** **对话历史** —— 产品自己存（D38）。**不是 agent 运行时的会话** */
export const CH_CONVERSATION_LIST = 'conversation.list';
export const CH_CONVERSATION_GET = 'conversation.get';
export const CH_CONVERSATION_CREATE = 'conversation.create';
export const CH_CONVERSATION_REMOVE = 'conversation.remove';

/** **统计与回顾** —— 视图层，不产生新实体（ADR-0007） */
export const CH_STATS_SUMMARY = 'stats.summary';
export const CH_REVIEW_GET = 'review.get';

/** **设置** */
export const CH_MODEL_CONFIG = 'model.config';
export const CH_MODEL_SAVE = 'model.save';
/** 测试连接。它有**自己的三态**（§5.4：401 / 缺 Base URL / 缺 Key） */
export const CH_MODEL_TEST = 'model.test';
export const CH_SKILL_LIST = 'skill.list';
export const CH_SKILL_TOGGLE = 'skill.toggle';
/** 「让 AI 帮我写一个」—— 落盘流程仍未定（§10.2） */
export const CH_SKILL_CREATE = 'skill.create';
export const CH_SKILL_IMPORT = 'skill.import';
export const CH_SKILL_REMOVE = 'skill.remove';

/* ---------- agent 控制面：**这两个是流**，因为它们都有阶段可回显 ---------- */

/** 发一轮对话。三段阶段 + 流式增量 + 依据（§6.3.1） */
export const CH_AGENT_CHAT = 'agent.chat';
/** 「**AI 整理**」—— 手动补跑解析器 + 关联器（D42）。幂等：没待处理项时直接结束 */
export const CH_AGENT_ARRANGE = 'agent.arrange';

/* ---------- 一问一答 ---------- */

export const CH_HEALTH = 'health';
/** agent 运行时的能力面。**懒启动**：调用它不会拉起子进程 */
export const CH_AGENT_STATUS = 'agent.status';
/** 「重载 agent」—— 三处生效条件合并成一个动作（设置页只出现一次，约 3 秒） */
export const CH_AGENT_RELOAD = 'agent.reload';

/** 所有方法名（供方法表注册与自检用；**顺序即建议的实现顺序**） */
export const ALL_CHANNELS = [
  CH_HEALTH,
  CH_AGENT_STATUS,
  CH_AGENT_RELOAD,
  CH_AGENT_CHAT,
  CH_AGENT_ARRANGE,
  CH_SPACE_LIST,
  CH_SPACE_CREATE,
  CH_SPACE_RENAME,
  CH_SPACE_REMOVE,
  CH_SPACE_ACTIVATE,
  CH_FOLDER_LIST,
  CH_FOLDER_CREATE,
  CH_FOLDER_RENAME,
  CH_FOLDER_MOVE,
  CH_FOLDER_REMOVE,
  CH_MATERIAL_LIST,
  CH_MATERIAL_GET,
  CH_MATERIAL_IMPORT,
  CH_MATERIAL_MOVE,
  CH_MATERIAL_REMOVE,
  CH_MATERIAL_RESTORE,
  CH_KNOWLEDGE_LIST,
  CH_KNOWLEDGE_GET,
  CH_KNOWLEDGE_REMOVE,
  CH_KNOWLEDGE_SOURCES,
  CH_ASSOCIATION_LIST,
  CH_ASSOCIATION_CONFIRM,
  CH_ASSOCIATION_DENY,
  CH_EVOLUTION_LIST,
  CH_CONVERSATION_LIST,
  CH_CONVERSATION_GET,
  CH_CONVERSATION_CREATE,
  CH_CONVERSATION_REMOVE,
  CH_STATS_SUMMARY,
  CH_REVIEW_GET,
  CH_MODEL_CONFIG,
  CH_MODEL_SAVE,
  CH_MODEL_TEST,
  CH_SKILL_LIST,
  CH_SKILL_TOGGLE,
  CH_SKILL_CREATE,
  CH_SKILL_IMPORT,
  CH_SKILL_REMOVE,
] as const;
