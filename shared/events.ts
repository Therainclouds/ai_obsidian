/**
 * 事件名与载荷类型（docs/接口规范.md §3.2 / §3.4）
 *
 * **状态：接口先定，实现留空。** 除 agent.* 四个之外，其余事件尚无生产端。
 *
 * 命名规则：`<域>.<事件>`，域与 HTTP 路径域一一对应；完成态用明确的过去分词。
 * 禁用的词见 CONTEXT.md 的 `_Avoid_` 列表 —— 类型名与字段名必须与用户看到的名字同词。
 */

/** agent 控制面：本机那个进程，不是云端模型 */
export const AGENT_STAGE = 'agent.stage' as const;
export const AGENT_DELTA = 'agent.delta' as const;
export const AGENT_ERROR = 'agent.error' as const;
export const AGENT_DONE = 'agent.done' as const;

/**
 * **通道自己报的错**，与 `agent.error` 分开：
 * 后者是 agent 运行时/云端那一段失败了；前者是"这个请求根本没走到 agent"——
 * 方法名不在白名单里、主进程抛了、壳没连上。
 *
 * 分开的理由和"来源关系 vs 关联不得合并计数"是同一条：**两种失败该给用户的出口不同**
 * （前者重试，后者是产品装坏了，§6.3.3 的 X5 本地型）。
 */
export const HOST_ERROR = 'host.error' as const;

/** 演化与四个 Hook 的产物 */
export const EVOLUTION_RECORDED = 'evolution.recorded' as const;
export const MATERIAL_COLLECTED = 'material.collected' as const;
export const MATERIAL_PARSED = 'material.parsed' as const;
export const KNOWLEDGE_DISTILLED = 'knowledge.distilled' as const;
export const RELATION_PROPOSED = 'relation.proposed' as const;

/**
 * 「AI 正在做」的三段，**正对应演化记录的 trigger**（DESIGN-SPEC §6.3.1）。
 * 聊天里看到的，和进化图谱里记下的，是同一件事。
 */
export const AGENT_STAGE_ORDER = ['reading', 'linking', 'writing'] as const;
export type AgentStageKey = (typeof AGENT_STAGE_ORDER)[number];

/** 用户可见的阶段名。宿主与渲染器共用一份，避免两边各写一遍 */
export const AGENT_STAGE_LABEL: Record<AgentStageKey, string> = {
  reading: '读取素材',
  linking: '整合与关联',
  writing: '写知识点',
};

export interface AgentStageEvent {
  stage: AgentStageKey;
  /** 用户可见的阶段名，如「读取素材」 */
  label: string;
}

export interface AgentDeltaEvent {
  text: string;
}

/** 错误分五型（§6.3.3）：X1 不可达 / X2 鉴权 / X3 额度 / X4 内容 / X5 本地 */
export type ErrorKind = 'X1' | 'X2' | 'X3' | 'X4' | 'X5';

export interface AgentErrorEvent {
  kind?: ErrorKind;
  /** ACP 的 JSON-RPC 错误码，可能没有 */
  code: number | null;
  /** 用户看得懂的一句话。**不说"网络错误"** —— 用户在局域网里（§6.3.4） */
  message: string;
}

export interface AgentDoneEvent {
  ok: boolean;
}

/* ---------- 以下类型已定，生产端留空 ---------- */

export interface EvolutionRecordedEvent {
  /** 演化记录 id。形状见 ADR-0001：trigger + inputs[] + outputs[] */
  recordId: string;
}

export interface MaterialCollectedEvent {
  count: number;
  /** 归属文件夹。**对话素材没有文件夹**（ADR-0007） */
  folderId: string | null;
}

export interface MaterialParsedEvent {
  count: number;
  /** 类型是文件事实（MIME / 扩展名 / 文件头），定不了标「未识别」—— 这不是判断 */
  unrecognized: number;
}

export interface KnowledgeDistilledEvent {
  knowledgeId: string;
  /** 一次蒸馏产出一个知识点；它的来源是 1..N 个素材（扇入） */
  sourceCount: number;
}

export interface RelationProposedEvent {
  /** **关联**（AI 提议，用户可确认或否认）—— 与**来源关系**不是一回事，不得合并计数 */
  associationId: string;
  /** 决策层给出的置信度。必须与 decidedBy 一起存（DESIGN-SPEC §9.1.2） */
  confidence: number | null;
  decidedBy: string | null;
}
