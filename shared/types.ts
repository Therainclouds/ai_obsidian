/**
 * 领域类型的**形状**（DESIGN-SPEC §9.3 的 `shared/`）。
 *
 * **状态：接口先定，实现留空。** 本文档定义"应该长什么样"，不描述"现在做到了没有"。
 * 实现进度见 `docs/接口规范.md` §4 的留空清单。
 *
 * 三条纪律：
 *  1. **字段名与 `CONTEXT.md` 的词必须一致** —— 用户看到的名字与代码里的字段是同一个词
 *  2. **不得出现 `_Avoid_` 里的词**（`link` / `clip` / `summary` / `引用` / `会话` …）
 *  3. **形状归 shared** —— 宿主只是产出者；渲染器要消费它，所以它不能住在 `agent/`
 */

/* ============================================================
   基础
   ============================================================ */

export type Id = string;

/** ISO 8601 带时区。**不用时间戳数字**：图谱与总结页要按天分组，本地时区语义必须显式 */
export type Iso = string;

/** 五个一级入口 + 全局 AI 层。命名与图标固定，不得随意增删（§1.3）。 */
export type RouteKey = 'chat' | 'files' | 'graph' | 'summary' | 'settings';

/* ============================================================
   内容实体
   ============================================================ */

/**
 * **只有两个取值**（ADR-0007）。
 *
 * `material` = 素材（文件素材 / 对话素材）；`distilled` = 知识点。
 * **不加第三个** —— 对话素材靠 `folderId === null` 与文件素材区分。
 */
export type ContentKind = 'material' | 'distilled';

/**
 * 标签。**来源必须能分辨**（D47）：
 * 知识点的标签由**蒸馏**顺手给出（那次产出的组成部分），素材的标签由**用户**打。
 *
 * 之所以 `origin` 是必需字段而不是由 `kind` 推出来：**用户可以在知识点上再加自己的标签**
 * （CONTEXT.md：「AI 给的用户可以改，用户给的算他自己的」）。所以同一条内容上两种来源可能并存。
 */
export interface Tag {
  name: string;
  origin: 'distilled' | 'user';
}

/** 用户自己建的、用来组织**文件素材**的容器。**可嵌套任意层**（D45）。 */
export interface Folder {
  id: Id;
  name: string;
  /** 父文件夹。顶层为 `null` */
  parentId: Id | null;
  /**
   * 这棵子树里的**文件素材**总数（**含子文件夹**）。
   *
   * 为什么是子树而不是直接子级：只数直接子级时，一个"里面只有子文件夹"的夹会显示 0，
   * 界面上和空文件夹长得一模一样 —— 用户会以为东西丢了。（这是截图暴露出来的。）
   * 推论：**不要把每个夹的数相加去求总数**，那会重复计数；总数看 `Space.materialCount`。
   */
  materialCount: number;
}

interface ContentBase {
  id: Id;
  title: string;
  tags: Tag[];
  createdAt: Iso;
  updatedAt: Iso;
  /** 非空即在回收站里 */
  deletedAt: Iso | null;
  favorite: boolean;
  /**
   * **已建立关联**的条数。列表视图要显示它，所以随实体一起下发（不叫 `linkCount` ——
   * 「链接」是**关联**的 `_Avoid_` 词）。
   *
   * **只数已建立**：候选关联**不进图谱、不计入统计**（D35），这个数必须与那个口径一致，
   * 否则界面上会出现一个"比图谱里多出来"的数。**候选另记 `candidateAssociationCount`，两者不相加。**
   */
  establishedAssociationCount: number;
  candidateAssociationCount: number;
}

/** 素材。按**归属**分两个子类，二者只差"有没有文件夹"（ADR-0007）。 */
export interface Material extends ContentBase {
  kind: 'material';
  /** 文件素材住文件夹；**对话素材恒为 `null`** —— 它没有文件夹、不进文件树 */
  folderId: Id | null;
  /** 文件事实（MIME / 扩展名 / 文件头），**不是判断** —— 定不了的标"未识别" */
  mimeType: string | null;
  sizeBytes: number | null;
}

/** 知识点 = AI 的整合产出。**没有文件夹归属** —— 靠「知识点」胶囊跨文件夹呈现（D12）。 */
export interface KnowledgePoint extends ContentBase {
  kind: 'distilled';
  /** 恒为 `null`。写成字面量而不是 `Id | null`，**让"知识点没有文件夹"成为类型层的不变量** */
  folderId: null;
  /** 蒸馏写出的正文 */
  body: string;
  /** 产出它的那次蒸馏给出的置信度。**与 `decidedBy` 一起存**（§9.1.2） */
  confidence: number | null;
  decidedBy: string | null;
}

/** 内容实体的联合。**一张表两种 kind**（ADR-0007），不是两个实体类 */
export type ContentEntity = Material | KnowledgePoint;

/* ============================================================
   关系：两层，**不得合并计数**
   ============================================================ */

/** **来源关系**：知识点 ← 素材。方向固定、由**蒸馏自动产生**、**用户不能否认**。 */
export interface SourceLink {
  knowledgeId: Id;
  materialId: Id;
}

/**
 * **关联**：AI 发现的相关性。**两个状态**（D35 / ADR-0010）。
 * 与**来源关系**是两回事 —— 前者 AI 提议、用户可确认或否认；后者不可否认。
 */
export interface Association {
  id: Id;
  /** 两端。**顺序无意义** —— 关联不是有向的，而来源关系有向 */
  a: Id;
  b: Id;
  state: 'established' | 'candidate';
  /** **必须与 `decidedBy` 一起存**：阈值可调 ⇒"当初为什么算数"必须可追溯（ADR-0010 §4） */
  confidence: number | null;
  decidedBy: string | null;
}

/* ============================================================
   演化
   ============================================================ */

/** 四个 Hook。**四个，不是三个** —— 早先规格书漏过收集器（ADR-0001） */
export type HookKey = 'collector' | 'parser' | 'linker' | 'distiller';

export type EntityRefKind = 'material' | 'distilled' | 'association';

/** 演化记录里指代一个实体的最小信息。带上 `label` 是为了**图谱不必再查一次** */
export interface EntityRef {
  kind: EntityRefKind;
  id: Id;
  label: string;
}

/**
 * **演化记录 = 事件模型**（ADR-0001，D13）：`trigger + inputs[] + outputs[]`。
 *
 * **不是固定三段链** —— 卡片布局由 `inputs.length × outputs.length` 决定，不由下标决定。
 * 记录里**没有 `confidence`**：只有关联器与沉淀器产生置信度，所以它属于**产出物**。
 */
export interface EvolutionRecord {
  id: Id;
  at: Iso;
  trigger: HookKey;
  inputs: EntityRef[];
  outputs: EntityRef[];
  /** **派生**（D37）：产出里有没有需要人决策的东西。见 `CandidateRef` */
  needsConfirm: boolean;
  /** `needsConfirm` 为真时，具体要人决策的是什么 */
  pending: CandidateRef[];
}

/** 待确认的具体对象。**挂在产出物上**，而 `needsConfirm` 挂在记录上（D37：两个维度） */
export interface CandidateRef {
  /** 今天只有 `association`；将来可能是"是否建立主题簇"之类 */
  kind: 'association';
  id: Id;
  label: string;
}

/* ============================================================
   对话
   ============================================================ */

/**
 * **对话历史**里的一条（D38）。**产品自己存** —— 不是 agent 运行时的**会话**（`state.db`，产品不读）。
 * 一个知识空间**一份**对话历史（D40）。
 */
export interface Conversation {
  id: Id;
  title: string;
  /** 最后活动时间，列表按它排序 */
  updatedAt: Iso;
  messageCount: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  at: Iso;
  /** 仅 assistant：这条回答的「**依据**」 */
  basis?: AnswerBasis[];
}

/**
 * 回答的「**依据**」—— 这次回答读了哪些**素材**。
 *
 * **它不是来源关系**（D41）：来源关系要求一端是**知识点**，而一条回答不是知识点（没走演化、不落盘）。
 * 数据上它就是那条**演化记录**的 `inputs[]`。**不得称它为「引用来源」**。
 */
export interface AnswerBasis {
  materialId: Id;
  title: string;
}

/* ============================================================
   知识空间与设置
   ============================================================ */

/** 知识空间 = **内容边界**（ADR-0006）。**不是 profile**（那是 agent 的身份） */
export interface Space {
  id: Id;
  name: string;
  /** 磁盘上的内容根。重命名**不改它**（ADR-0006：只改显示名，不动路径） */
  root: string;
  materialCount: number;
  knowledgeCount: number;
  /** 当前选中的空间 */
  active: boolean;
}

/** 一个模型位。**决策层与生成层分设、不得合并**（ADR-0003 / §9.1.2） */
export interface ModelSlotConfig {
  baseUrl: string;
  model: string;
  /** 密钥的**掩码**（如 `sk-ant-••••3f2a`）。**永不回显明文**，密钥不进前端存储 */
  keyMasked: string | null;
  configured: boolean;
}

export interface ModelConfig {
  /** 决策层：只做判断，返回类型化答案 + 置信度 */
  decision: ModelSlotConfig;
  /** 生成层：只写字。**Jev 不产出任何文字**，两者不可互相替代 */
  generation: ModelSlotConfig;
}

/** 技能。**两个命名空间**（ADR-0005 + 修订） */
export interface SkillInfo {
  /** `product` 全系统只有 1 个；`user` 数量不限、产品不 review */
  namespace: 'product' | 'user';
  name: string;
  description: string;
  enabled: boolean;
  /** 脚本面校验的结果：带可执行脚本或声明 `env_passthrough` → **拒绝加载并给出原因** */
  blockedReason: string | null;
}

/* ============================================================
   视图层（**不是内容实体** —— ADR-0007）
   ============================================================ */

/** 互动热度的一格。**只给强度**，颜色档位由视图决定 —— 不要在数据层配色 */
export interface HeatCell {
  date: Iso;
  /** 0–1 */
  intensity: number;
}

/** 知识总结页的统计。全是**聚合数**，不产生新实体 */
export interface StatsSummary {
  daysSince: number;
  since: Iso;
  todayInteractions: number;
  /** 近 14 天 */
  heat: HeatCell[];
  materialCount: number;
  /** **只数已建立关联** —— 候选不进图谱（D35），统计口径与它对齐 */
  establishedAssociationCount: number;
  /** 候选另记一个数，**不与上面相加** */
  candidateAssociationCount: number;
  knowledgeCount: number;
  usedBytes: number;
  quotaBytes: number;
  /** TOP 6。**『调用』的口径仍未定**（§5.3 待定：AI 调用次数 or 用户查看次数） */
  topKnowledge: Array<{ knowledgeId: Id; title: string; calls: number }>;
}

export type ReviewSpan = 'day' | 'week' | 'month' | 'year';

/** **周期回顾**的一条。它是**视图**：不落盘为实体、不产生来源关系、不进演化记录、不计入统计 */
export interface ReviewEntry {
  date: string;
  title: string;
  text: string;
  /** **话题**，不是**标签** —— 它是这次回顾自己的分组词，不是内容上的那个 `Tag` */
  topics: string[];
  todoCount: number;
}

export interface ReviewResponse {
  span: ReviewSpan;
  /** 生成时刻。**打开时现生成 + 缓存**（D43）；缓存不等于落盘为实体 */
  generatedAt: Iso;
  entries: ReviewEntry[];
}

/* ============================================================
   请求载荷（接口规范 §3.4：`<动词><实体>Request`）
   ============================================================ */

/**
 * 文件管理的**六个胶囊是视图切换器**，不是过滤器（D12）。
 * 前五个走 `material.list`，第六个「知识点」走 `knowledge.list` —— 它跨文件夹、不含素材。
 */
export type MaterialView = 'all' | 'recent' | 'tag' | 'favorite' | 'trash';

export interface ListMaterialRequest {
  view: MaterialView;
  /** `view: 'tag'` 时生效 */
  tag?: string;
  /** 搜索：文件名 / 内容 / 标签（§5.1 工具栏）。**本地能力**，不出网 */
  query?: string;
}

/** **点击式移动**（D46）：多选 + 目标文件夹。`folderId: null` = 移到顶层 */
export interface MoveMaterialRequest {
  ids: Id[];
  folderId: Id | null;
}

export interface ImportMaterialRequest {
  /** 落进哪个文件夹。`null` = 顶层 */
  folderId: Id | null;
  /** 系统文件对话框选出的绝对路径。渲染器拿不到文件系统，由宿主弹窗 */
  paths: string[];
}

export interface ListKnowledgeRequest {
  /** 按标签分组时传它；不传 = 全部知识点（跨文件夹） */
  tag?: string;
  query?: string;
  /** 要左栏的**标签分组**而不是条目本身（§5.1 的「知识点」视图左栏） */
  groupByTag?: boolean;
}

/** 关联的两态各自查（D35）。**候选的入口在进化图谱的「待确认卡片」** */
export interface ListAssociationRequest {
  state: 'established' | 'candidate';
  /** 以某个节点为中心（关联图 / 图谱页都用到） */
  around?: Id;
}

export interface SaveModelRequest {
  decision: { baseUrl: string; model: string; /** **只在更换时传**；不传 = 保持原密钥 */ key?: string };
  generation: { baseUrl: string; model: string; key?: string };
}

/* ============================================================
   宿主自身的状态
   ============================================================ */

/** 本地宿主的健康检查响应。 */
export interface HealthPayload {
  ok: boolean;
  /** 宿主进程启动至今的秒数 */
  uptimeSec: number;
  /** 是否已建立会话（不是"装没装"——那是 agentStatus 的事） */
  agentConnected: boolean;
  /** 当前知识空间的显示名 */
  space: string;
  /**
   * **当前数据是不是示例数据**（`--mock`）。
   *
   * 界面**必须据此标明**。理由：**假数据不可见就会被当成设计** —— 本项目已经吃过一次
   * （原型里的示例结构差点被当作真实数据模型）。这个字段存在的唯一目的就是让它可见。
   */
  mock: boolean;
}

/**
 * agent 运行时的能力面。**形状归 shared/**：它是宿主与渲染器之间的线上形状，
 * 不属于宿主实现（`agent/services/` 只是它的产出者）。
 *
 * 字段是 ACP `initialize` 结果的一个**子集**——只带渲染器真会用的那些，
 * 不把整个 InitializeResult 漏出去（那是宿主的内部协议）。
 */
export interface AgentStatus {
  /** 本机找不找得到 agent 运行时的可执行文件 */
  installed: boolean;
  /** 定位结果，供设置页显示"它在哪" */
  resolved: { py: string; cli: string; home: string };
  /** 是否已握手（懒启动：第一次真要用时才拉起） */
  initialized: boolean;
  agentInfo: { name: string; version: string } | null;
  capabilities: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean };
    sessionCapabilities?: { fork?: object; list?: object; resume?: object };
  } | null;
  hasSession: boolean;
  /** 上一次失败的原始消息。**渲染器不得直接显示它** —— 要过 §6.3.3 的五型翻译 */
  error: string | null;
}
