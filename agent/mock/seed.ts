/**
 * **夹具数据（Mock）** —— 全项目唯一一处假数据（docs/接口规范.md §4「夹具数据的放法与开关」）。
 *
 * 三条纪律：
 *
 * 1. **它只提供"实体本身"，不提供派生数**。列表视图要的 `establishedAssociationCount`、
 *    文件夹的 `materialCount`、知识空间的 `materialCount / knowledgeCount` **都由 store 算**——
 *    手写一份再与实际关联对不上，是必然的。
 * 2. **`--mock` 才装载**。不带它时宿主是**空态**（那本身也是要看的界面，§6.3 的 E1）。
 * 3. **它不会退场**。将来 `store/fs.ts`（真实落盘）就位后，本文件退成两个正式用途 ——
 *    新装设备的**示例知识空间**、端到端测试的**固定输入**。所以它值得写得像样。
 *
 * 内容取自 `design/prototype/index-final.html` 的示例数据，为的是**与原型截图逐项对得上**；
 * 但这里的形状是**真实数据模型的形状**（`shared/types.ts`），不是原型的展示结构。
 */
import type {
  Association,
  Conversation,
  ConversationMessage,
  EntityRef,
  EvolutionRecord,
  Folder,
  Iso,
  KnowledgePoint,
  Material,
  ModelConfig,
  SkillInfo,
  SourceLink,
  Space,
  Tag,
} from '../../shared/types.ts';

/* ------------------------------------------------------------------ *
 * 时间：夹具用"相对现在"算，否则截图里的"10 分钟前"过几天就变成"3 个月前"
 * ------------------------------------------------------------------ */

const NOW = Date.now();
/** n 分钟前 */
const ago = (min: number): Iso => new Date(NOW - min * 60_000).toISOString();
const agoDays = (d: number): Iso => ago(d * 24 * 60);

/* ------------------------------------------------------------------ *
 * 派生字段由 store 计算，夹具不写 —— 见文件头纪律 1
 * ------------------------------------------------------------------ */

/**
 * 夹具里的实体：**省掉那两个由 store 算出来的关联数**。
 *
 * ⚠ 别把这两个类型合并成 `Omit<Material | KnowledgePoint, K>`：`Omit` 取的是
 * `keyof (A | B)`，而联合类型的 `keyof` **只剩公共键** —— 那样会静默吃掉
 * `folderId` / `body` 这些只在一边有的字段，**夹具写成什么样都能通过**。
 * 分开写之后，`Material` 缺 `folderId`、`KnowledgePoint` 缺 `body` 都会当场报错。
 */
type Counted = 'establishedAssociationCount' | 'candidateAssociationCount';
export type SeedMaterial = Omit<Material, Counted>;
export type SeedKnowledge = Omit<KnowledgePoint, Counted>;

export interface Seed {
  /** 知识空间的派生数（素材数 / 知识点数）由 store 算 */
  spaces: Array<Omit<Space, 'materialCount' | 'knowledgeCount'>>;
  /** 文件夹的 `materialCount` 由 store 算 */
  folders: Array<Omit<Folder, 'materialCount'>>;
  materials: SeedMaterial[];
  knowledge: SeedKnowledge[];
  /** **来源关系**：知识点 ← 素材。方向固定、蒸馏自动产生、用户不能否认 */
  sourceLinks: SourceLink[];
  associations: Association[];
  evolutions: EvolutionRecord[];
  conversations: Conversation[];
  messages: Record<string, ConversationMessage[]>;
  model: ModelConfig;
  skills: SkillInfo[];
}

/* ------------------------------------------------------------------ *
 * 标签：两种来路必须分得清（D47）
 * ------------------------------------------------------------------ */

/** 蒸馏给的（挂在知识点上） */
const t = (name: string): Tag => ({ name, origin: 'distilled' });
/** 用户自己打的（挂在素材上） */
const u = (name: string): Tag => ({ name, origin: 'user' });

/* ------------------------------------------------------------------ *
 * 知识空间 / 文件夹
 * ------------------------------------------------------------------ */

const SPACE_ID = 'sp-1';

const folders: Seed['folders'] = [
  { id: 'fd-notes', name: '笔记', parentId: null },
  { id: 'fd-proj', name: '项目', parentId: null },
  { id: 'fd-inbox', name: '灵感', parentId: null },
  { id: 'fd-attach', name: '附件', parentId: null },
  // ★ 嵌套：演示 D45「可嵌套任意层」。原型只演示了一层，这里补上第二层，
  //   否则"能嵌套"这条在数据里看不出来，实现时容易又写回扁平。
  { id: 'fd-proj-ks', name: '知识系统', parentId: 'fd-proj' },
];

/* ------------------------------------------------------------------ *
 * 素材：文件素材（住文件夹）+ 对话素材（folderId 恒为 null）
 * ------------------------------------------------------------------ */

const files: SeedMaterial[] = [
  {
    id: 'm-1',
    kind: 'material',
    title: '增长模型.md',
    folderId: 'fd-notes',
    mimeType: 'text/markdown',
    sizeBytes: 18_432,
    tags: [u('增长')],
    createdAt: agoDays(30),
    updatedAt: ago(10),
    deletedAt: null,
    favorite: true,
  },
  {
    id: 'm-2',
    kind: 'material',
    title: '小红书运营手册.md',
    folderId: 'fd-notes',
    mimeType: 'text/markdown',
    sizeBytes: 42_118,
    tags: [u('运营')],
    createdAt: agoDays(60),
    updatedAt: ago(1_284),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-3',
    kind: 'material',
    title: 'AI 产品观察.md',
    folderId: 'fd-notes',
    mimeType: 'text/markdown',
    sizeBytes: 9_731,
    tags: [],
    createdAt: agoDays(12),
    updatedAt: ago(1_328),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-4',
    kind: 'material',
    title: '读书 · 认知觉醒.md',
    folderId: 'fd-notes',
    mimeType: 'text/markdown',
    sizeBytes: 61_004,
    tags: [u('读书')],
    createdAt: agoDays(90),
    updatedAt: agoDays(4),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-5',
    kind: 'material',
    title: '知识系统 v0.3.md',
    folderId: 'fd-proj-ks',
    mimeType: 'text/markdown',
    sizeBytes: 33_290,
    tags: [u('设计')],
    createdAt: agoDays(20),
    updatedAt: agoDays(1),
    deletedAt: null,
    favorite: true,
  },
  {
    id: 'm-6',
    kind: 'material',
    title: '竞品调研.pdf',
    folderId: 'fd-proj-ks',
    mimeType: 'application/pdf',
    sizeBytes: 2_411_264,
    tags: [u('调研')],
    createdAt: agoDays(15),
    updatedAt: agoDays(3),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-7',
    kind: 'material',
    title: 'Obsidian 图谱设计参考',
    folderId: 'fd-inbox',
    mimeType: 'text/html',
    sizeBytes: 78_900,
    tags: [],
    createdAt: agoDays(40),
    updatedAt: agoDays(7),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-8',
    kind: 'material',
    title: '白头脑暴照片.png',
    folderId: 'fd-inbox',
    mimeType: 'image/png',
    sizeBytes: 5_308_416,
    tags: [],
    createdAt: agoDays(38),
    updatedAt: agoDays(7),
    deletedAt: null,
    favorite: false,
  },
  // 回收站里的一条：让「回收站」胶囊有内容可看，也顺带验证软删
  {
    id: 'm-9',
    kind: 'material',
    title: '旧版选题清单.md',
    folderId: 'fd-notes',
    mimeType: 'text/markdown',
    sizeBytes: 4_120,
    tags: [],
    createdAt: agoDays(120),
    updatedAt: agoDays(20),
    deletedAt: agoDays(19),
    favorite: false,
  },
];

/**
 * **对话素材**：`folderId` 恒为 `null` —— 它没有文件夹归属、不进文件树（ADR-0007）。
 * 夹具里放两条，是为了让「全部只数文件素材」（D31）与「知识点不含素材」这两条能被验证：
 * 若哪天有人把对话素材算进文件数，这两条就会露出来。
 */
const dialogues: SeedMaterial[] = [
  {
    id: 'm-d1',
    kind: 'material',
    title: '关于低粉爆款的讨论',
    folderId: null,
    mimeType: null,
    sizeBytes: null,
    tags: [],
    createdAt: agoDays(2),
    updatedAt: agoDays(2),
    deletedAt: null,
    favorite: false,
  },
  {
    id: 'm-d2',
    kind: 'material',
    title: '关于图谱布局的讨论',
    folderId: null,
    mimeType: null,
    sizeBytes: null,
    tags: [],
    createdAt: agoDays(5),
    updatedAt: agoDays(5),
    deletedAt: null,
    favorite: false,
  },
];

/* ------------------------------------------------------------------ *
 * 知识点：跨文件夹的产出，**没有文件夹归属**
 * ------------------------------------------------------------------ */

const knowledge: SeedKnowledge[] = [
  {
    id: 'k-1',
    kind: 'distilled',
    title: '低粉爆款三要素',
    folderId: null,
    body: '选题窄、封面直给、正文前两行给结果。三件事都指向同一件事：降低读者的判断成本。',
    tags: [t('爆款规律')],
    createdAt: agoDays(8),
    updatedAt: agoDays(1),
    deletedAt: null,
    favorite: false,
    confidence: 0.86,
    decidedBy: 'generation',
  },
  {
    id: 'k-2',
    kind: 'distilled',
    title: '小红书选题公式',
    folderId: null,
    body: '人群 + 场景 + 具体结果。越具体越像亲身经历，"所有人"等于没有人群。',
    tags: [t('爆款规律')],
    createdAt: agoDays(9),
    updatedAt: agoDays(1),
    deletedAt: null,
    favorite: true,
    confidence: 0.81,
    decidedBy: 'generation',
  },
  {
    id: 'k-3',
    kind: 'distilled',
    title: '增长模型 AARRR',
    folderId: null,
    body: '获取、激活、留存、收入、推荐。对内容产品真正卡人的是第二格——激活。',
    tags: [t('增长模型')],
    createdAt: agoDays(24),
    updatedAt: agoDays(3),
    deletedAt: null,
    favorite: false,
    confidence: 0.78,
    decidedBy: 'generation',
  },
  {
    id: 'k-4',
    kind: 'distilled',
    title: 'AI 笔记竞品对比',
    folderId: null,
    body: '四条线：纯编辑器、双向链接、AI 摘要、AI 建图。前两条已红海，第四条的差异在于"关联由谁判断"。',
    tags: [t('工具评测')],
    createdAt: agoDays(6),
    updatedAt: agoDays(4),
    deletedAt: null,
    favorite: false,
    confidence: 0.72,
    decidedBy: 'generation',
  },
  {
    id: 'k-5',
    kind: 'distilled',
    title: '习惯回路模型',
    folderId: null,
    body: '提示、惯常、奖赏。改掉一个习惯比建立一个习惯难，因为提示还在。',
    tags: [t('认知科学')],
    createdAt: agoDays(40),
    updatedAt: agoDays(7),
    deletedAt: null,
    favorite: false,
    confidence: 0.69,
    decidedBy: 'generation',
  },
  {
    id: 'k-6',
    kind: 'distilled',
    title: '封面图检查清单',
    folderId: null,
    body: '字要大、对比要够、留白要给。手机上只有拇指大小，看不清就是没有。',
    tags: [t('运营方法')],
    createdAt: agoDays(18),
    updatedAt: agoDays(7),
    deletedAt: null,
    favorite: false,
    confidence: 0.75,
    decidedBy: 'generation',
  },
];

/* ------------------------------------------------------------------ *
 * 来源关系：知识点 ← 素材
 * ------------------------------------------------------------------ */

const sourceLinks: SourceLink[] = [
  { knowledgeId: 'k-1', materialId: 'm-2' },
  { knowledgeId: 'k-1', materialId: 'm-d1' },
  { knowledgeId: 'k-2', materialId: 'm-2' },
  { knowledgeId: 'k-3', materialId: 'm-1' },
  { knowledgeId: 'k-3', materialId: 'm-4' },
  { knowledgeId: 'k-4', materialId: 'm-6' },
  { knowledgeId: 'k-4', materialId: 'm-3' },
  { knowledgeId: 'k-5', materialId: 'm-4' },
  { knowledgeId: 'k-6', materialId: 'm-2' },
];

/* ------------------------------------------------------------------ *
 * 关联：**两个状态**（D35）。夹具里两种都放，否则"候选不进图谱"这条验不了
 * ------------------------------------------------------------------ */

const associations: Association[] = [
  // 已建立（过阈值）—— 这些才进图谱、才计入统计
  { id: 'a-1', a: 'k-1', b: 'k-2', state: 'established', confidence: 0.91, decidedBy: 'linker' },
  { id: 'a-2', a: 'k-1', b: 'm-2', state: 'established', confidence: 0.88, decidedBy: 'linker' },
  { id: 'a-3', a: 'k-3', b: 'k-5', state: 'established', confidence: 0.83, decidedBy: 'linker' },
  { id: 'a-4', a: 'k-3', b: 'm-1', state: 'established', confidence: 0.86, decidedBy: 'linker' },
  { id: 'a-5', a: 'k-4', b: 'm-6', state: 'established', confidence: 0.79, decidedBy: 'linker' },
  { id: 'a-6', a: 'k-6', b: 'm-2', state: 'established', confidence: 0.82, decidedBy: 'linker' },
  // 候选（未过阈值）—— **不进图谱、不占位置**，入口在进化图谱的「待确认卡片」
  { id: 'a-7', a: 'k-2', b: 'k-6', state: 'candidate', confidence: 0.52, decidedBy: 'linker' },
  { id: 'a-8', a: 'k-5', b: 'm-4', state: 'candidate', confidence: 0.47, decidedBy: 'linker' },
  { id: 'a-9', a: 'k-4', b: 'k-3', state: 'candidate', confidence: 0.44, decidedBy: 'linker' },
];

/* ------------------------------------------------------------------ *
 * 演化记录：`trigger + inputs[] + outputs[]`（ADR-0001）
 * **四个 trigger 都要出现** —— 少写一个，图谱的颜色/筛选就验不到那条分支
 * ------------------------------------------------------------------ */

const ref = (kind: EntityRef['kind'], id: string, label: string): EntityRef => ({ kind, id, label });

const evolutions: EvolutionRecord[] = [
  {
    id: 'ev-1',
    at: ago(30),
    trigger: 'collector',
    inputs: [],
    outputs: [ref('material', 'm-1', '增长模型.md'), ref('material', 'm-2', '小红书运营手册.md')],
    needsConfirm: false,
    pending: [],
  },
  {
    id: 'ev-2',
    at: ago(28),
    trigger: 'parser',
    inputs: [ref('material', 'm-1', '增长模型.md')],
    outputs: [ref('material', 'm-1', '增长模型.md')],
    needsConfirm: false,
    pending: [],
  },
  {
    id: 'ev-3',
    at: ago(26),
    trigger: 'distiller',
    // 扇入：一次蒸馏吃了两份素材 + 一条对话
    inputs: [
      ref('material', 'm-2', '小红书运营手册.md'),
      ref('material', 'm-d1', '关于低粉爆款的讨论'),
    ],
    outputs: [ref('distilled', 'k-1', '低粉爆款三要素')],
    needsConfirm: false,
    pending: [],
  },
  {
    id: 'ev-4',
    at: ago(25),
    trigger: 'linker',
    inputs: [ref('distilled', 'k-1', '低粉爆款三要素')],
    // 扇出：一次关联产出两条边
    outputs: [
      ref('association', 'a-1', '低粉爆款三要素 ↔ 小红书选题公式'),
      ref('association', 'a-2', '低粉爆款三要素 ↔ 小红书运营手册.md'),
    ],
    needsConfirm: false,
    pending: [],
  },
  {
    id: 'ev-5',
    at: ago(240),
    trigger: 'linker',
    inputs: [ref('distilled', 'k-2', '小红书选题公式')],
    outputs: [
      ref('association', 'a-7', '小红书选题公式 ↔ 封面图检查清单'),
    ],
    // ★ **待确认**：这条记录的产出里含**候选关联** —— `needsConfirm` 是**派生**的（D37）
    needsConfirm: true,
    pending: [{ kind: 'association', id: 'a-7', label: '小红书选题公式 ↔ 封面图检查清单' }],
  },
  {
    id: 'ev-6',
    at: ago(4_400),
    trigger: 'distiller',
    inputs: [ref('material', 'm-1', '增长模型.md'), ref('material', 'm-4', '读书 · 认知觉醒.md')],
    outputs: [ref('distilled', 'k-3', '增长模型 AARRR')],
    needsConfirm: false,
    pending: [],
  },
  {
    id: 'ev-7',
    at: ago(4_500),
    trigger: 'linker',
    inputs: [ref('distilled', 'k-3', '增长模型 AARRR')],
    outputs: [ref('association', 'a-9', 'AI 笔记竞品对比 ↔ 增长模型 AARRR')],
    needsConfirm: true,
    pending: [{ kind: 'association', id: 'a-9', label: 'AI 笔记竞品对比 ↔ 增长模型 AARRR' }],
  },
];

/* ------------------------------------------------------------------ *
 * 对话历史：**产品自己存**（D38），不是 agent 运行时的会话
 * ------------------------------------------------------------------ */

const conversations: Conversation[] = [
  { id: 'cv-1', title: '关于低粉爆款的讨论', updatedAt: agoDays(2), messageCount: 4 },
  { id: 'cv-2', title: '关于图谱布局的讨论', updatedAt: agoDays(5), messageCount: 2 },
];

const messages: Record<string, ConversationMessage[]> = {
  'cv-1': [
    { role: 'user', text: '我最近在看小红书爆款，感觉它们有个共同点。', at: agoDays(2) },
    {
      role: 'assistant',
      text: '说说看。我先把《小红书运营手册.md》与这份讨论一起读一遍。',
      at: agoDays(2),
      basis: [{ materialId: 'm-2', title: '小红书运营手册.md' }],
    },
    { role: 'user', text: '选题都很窄，封面直接给结果，正文前两行就把答案说了。', at: agoDays(2) },
    {
      role: 'assistant',
      text: '这三条指向同一件事：降低读者的判断成本。已蒸馏成知识点「低粉爆款三要素」。',
      at: agoDays(2),
      basis: [
        { materialId: 'm-2', title: '小红书运营手册.md' },
        { materialId: 'm-d1', title: '关于低粉爆款的讨论' },
      ],
    },
  ],
  'cv-2': [
    { role: 'user', text: '关联图应该用什么布局？', at: agoDays(5) },
    {
      role: 'assistant',
      text: '语义（谁和谁相关、多强）在云端算；坐标在本地算——那是数值迭代，不该交给语言模型。',
      at: agoDays(5),
    },
  ],
};

/* ------------------------------------------------------------------ *
 * 设置：模型配置（ADR-0003：**两个模型位分设、不得合并**）与技能
 * ------------------------------------------------------------------ */

const model: ModelConfig = {
  decision: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    keyMasked: 'sk-ant-••••3f2a',
    configured: true,
  },
  generation: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-opus-4-1',
    keyMasked: 'sk-ant-••••9c17',
    configured: true,
  },
};

const skills: SkillInfo[] = [
  {
    namespace: 'product',
    name: '沉淀器的写作规范',
    description: '产品技能：决定知识点怎么写。全系统只有 1 个。',
    enabled: true,
    blockedReason: null,
  },
  {
    namespace: 'user',
    name: '我的选题检查表',
    description: '用户技能：每次蒸馏选题类内容时追加的检查项。',
    enabled: true,
    blockedReason: null,
  },
  {
    namespace: 'user',
    name: '带脚本的旧技能',
    description: '用户技能：声明了 env_passthrough，已拒绝加载。',
    enabled: false,
    // ★ 脚本面校验：带可执行脚本或声明 env_passthrough → **拒绝加载并给出原因**
    blockedReason: '声明了 env_passthrough，会让技能读到模型密钥，已拒绝加载（ADR-0005 修订）',
  },
];

/* ------------------------------------------------------------------ *
 * 夹具本体
 * ------------------------------------------------------------------ */

export const SEED: Seed = {
  spaces: [
    {
      id: SPACE_ID,
      name: '我的空间',
      // 专用设备上的内容根。**重命名不改它**（ADR-0006）
      root: '~/AI知识系统/我的空间',
      active: true,
    },
  ],
  folders,
  materials: [...files, ...dialogues],
  knowledge,
  sourceLinks,
  associations,
  evolutions,
  conversations,
  messages,
  model,
  skills,
};

/** 启动时打一行，说明装载了什么。夹具是"看不见就会变味"的东西，所以要报账 */
export function describeSeed(seed: Seed): string {
  const fileMaterials = seed.materials.filter((m) => m.folderId !== null).length;
  const dialogues = seed.materials.length - fileMaterials;
  return [
    `${seed.spaces.length} 个知识空间`,
    `${seed.folders.length} 个文件夹`,
    `${fileMaterials} 份文件素材 + ${dialogues} 份对话素材`,
    `${seed.knowledge.length} 个知识点`,
    `${seed.sourceLinks.length} 条来源关系`,
    `${seed.associations.filter((a) => a.state === 'established').length} 条已建立关联 + ${seed.associations.filter((a) => a.state === 'candidate').length} 条候选`,
    `${seed.evolutions.length} 条演化记录`,
    `${seed.conversations.length} 段对话历史`,
  ].join(' · ');
}
