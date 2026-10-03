/**
 * 内存存储 —— 方法表读写的那一层（docs/接口规范.md §4「夹具数据的放法与开关」）。
 *
 * **它是个接缝，不是临时脚手架**：方法表只认 `Store` 这个接口，不认实现。
 * 将来 `store/fs.ts`（真实落盘）就位后，换的是 `store/index.ts` 里的一行，
 * **`agent/ipc.ts` 一个字都不用改**。
 *
 * 两条它必须负责的事：
 *  1. **派生数一律由它算**（关联条数 / 文件夹素材数 / 知识空间的两个计数）。
 *     夹具不写这些 —— 手写一份再与实际对不上是必然的。
 *  2. **不变量在这里守**：知识点没有文件夹、对话素材不进文件树、候选关联不进统计。
 *     这些都在 `CONTEXT.md` 里写着，靠约定守不住，得靠代码。
 */
import type {
  Association,
  Conversation,
  ConversationMessage,
  EvolutionRecord,
  Folder,
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
} from '../../shared/types.ts';
import type { Seed, SeedKnowledge, SeedMaterial } from '../mock/seed.ts';

/** 写操作失败时抛它。**消息要能直接给用户看**（§6.3.3 要过五型翻译，但原因得先准） */
export class StoreError extends Error {}

/** 未定案/未实现的操作统一抛它 */
function todo(what: string): never {
  throw new StoreError(`${what} 尚未实现`);
}

/** 配额。专用设备上这是真实存在的边界；M0 阶段先给一个定值 */
const QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

export class MemoryStore {
  private spaces: Space[];
  private folders: Folder[];
  private materials: Material[];
  private knowledge: KnowledgePoint[];
  private sourceLinks: SourceLink[];
  private associations: Association[];
  /** **被否认的那一对**：永久压制，不再被提议（D35）。键是两个 id 排序后拼起来 */
  private suppressed = new Set<string>();
  private evolutions: EvolutionRecord[];
  private conversations: Conversation[];
  private messages: Record<string, ConversationMessage[]>;
  private model: ModelConfig;
  private skills: SkillInfo[];

  /** 夹具为 `null` 时是空态 —— 那本身也是要看的界面（§6.3 的 E1 首次空态） */
  constructor(seed: Seed | null) {
    this.spaces = (seed?.spaces ?? []).map((s) => ({ ...s, materialCount: 0, knowledgeCount: 0 }));
    this.folders = (seed?.folders ?? []).map((f) => ({ ...f, materialCount: 0 }));
    this.materials = (seed?.materials ?? []).map(toMaterial);
    this.knowledge = (seed?.knowledge ?? []).map(toKnowledge);
    this.sourceLinks = [...(seed?.sourceLinks ?? [])];
    this.associations = [...(seed?.associations ?? [])];
    this.evolutions = [...(seed?.evolutions ?? [])];
    this.conversations = [...(seed?.conversations ?? [])];
    this.messages = structuredClone(seed?.messages ?? {});
    this.skills = [...(seed?.skills ?? [])];
    // 空态时也得有个模型配置对象，否则设置页拿不到"未配置"的形态
    this.model = seed?.model ?? {
      decision: { baseUrl: '', model: '', keyMasked: null, configured: false },
      generation: { baseUrl: '', model: '', keyMasked: null, configured: false },
    };
    this.reindex();
  }

  /* ================================================================
     派生数：**只有这里算**
     ================================================================ */

  /**
   * 重算所有派生数。任何写操作之后都要调它。
   *
   * 三处口径都是**已定的决策**，不是随手写的：
   *  · 关联条数**只数已建立**（D35）—— 候选不进图谱、不计入统计，否则界面上会出现一个
   *    "比图谱里多出来"的数
   *  · 文件素材数**不含对话素材**（D31 / ADR-0007）—— 对话素材没有文件夹、不进文件树
   *  · 回收站里的**不计入**任何计数
   */
  private reindex(): void {
    const live = (x: { deletedAt: string | null }): boolean => x.deletedAt === null;

    for (const m of this.materials) {
      m.establishedAssociationCount = this.countAssoc(m.id, 'established');
      m.candidateAssociationCount = this.countAssoc(m.id, 'candidate');
    }
    for (const k of this.knowledge) {
      k.establishedAssociationCount = this.countAssoc(k.id, 'established');
      k.candidateAssociationCount = this.countAssoc(k.id, 'candidate');
    }

    // ★ **子树总数**，不是直接子级。只数直接子级时，一个"里面只有子文件夹"的夹会显示 0 ——
    //   界面上和空文件夹长得一模一样，用户会以为东西丢了。（截图里 `项目` 就是这么暴露的：
    //   它的两份素材在 `项目/知识系统` 里，于是它显示 0。）
    for (const f of this.folders) {
      f.materialCount = this.materials.filter(
        (m) => live(m) && m.folderId !== null && this.inSubtree(m.folderId, f.id),
      ).length;
    }

    // ★ **文件素材**，不是全部素材 —— 与 D31 的「全部」口径一致
    const fileMaterials = this.materials.filter((m) => live(m) && m.folderId !== null).length;
    const knowledgeCount = this.knowledge.filter(live).length;
    for (const s of this.spaces) {
      s.materialCount = fileMaterials;
      s.knowledgeCount = knowledgeCount;
    }
  }

  private countAssoc(id: string, state: Association['state']): number {
    return this.associations.filter(
      (a) => a.state === state && (a.a === id || a.b === id),
    ).length;
  }

  /* ================================================================
     知识空间
     ================================================================ */

  listSpaces(): Space[] {
    return this.spaces.map((s) => ({ ...s }));
  }

  activeSpace(): Space | null {
    return this.spaces.find((s) => s.active) ?? null;
  }

  createSpace(name: string): Space {
    const trimmed = name.trim();
    if (!trimmed) throw new StoreError('知识空间的名字不能为空');
    if (this.spaces.some((s) => s.name === trimmed)) {
      throw new StoreError(`已经有一个叫「${trimmed}」的知识空间了`);
    }
    const space: Space = {
      id: `sp-${Date.now().toString(36)}`,
      name: trimmed,
      // 内容根跟着名字走**只在这一刻**。之后重命名不动它（ADR-0006）
      root: `~/AI知识系统/${trimmed}`,
      materialCount: 0,
      knowledgeCount: 0,
      active: this.spaces.length === 0,
    };
    this.spaces.push(space);
    this.reindex();
    return { ...space };
  }

  /** **只改显示名，不动路径**（ADR-0006）。改路径会让 agent 的 cwd 与历史里的路径全部失效 */
  renameSpace(id: string, name: string): Space {
    const space = this.mustSpace(id);
    const trimmed = name.trim();
    if (!trimmed) throw new StoreError('名字不能为空');
    if (this.spaces.some((s) => s.id !== id && s.name === trimmed)) {
      throw new StoreError(`已经有一个叫「${trimmed}」的知识空间了`);
    }
    space.name = trimmed;
    return { ...space };
  }

  removeSpace(id: string): void {
    const space = this.mustSpace(id);
    if (this.spaces.length === 1) {
      throw new StoreError('至少要留一个知识空间');
    }
    this.spaces = this.spaces.filter((s) => s.id !== id);
    if (space.active && this.spaces.length > 0) this.spaces[0].active = true;
  }

  /**
   * 切空间。**要不要重载 agent 仍未实测**（ADR-0006 待验证项）——
   * 接口先定，这里只落"哪个是当前空间"这件事。
   */
  activateSpace(id: string): void {
    const space = this.mustSpace(id);
    for (const s of this.spaces) s.active = s.id === id;
    void space;
  }

  private mustSpace(id: string): Space {
    const found = this.spaces.find((s) => s.id === id);
    if (!found) throw new StoreError('找不到这个知识空间');
    return found;
  }

  /* ================================================================
     文件夹 —— 用户自己建的、只装文件素材，**可嵌套任意层**（D45）
     ================================================================ */

  listFolders(): Folder[] {
    return this.folders.map((f) => ({ ...f }));
  }

  createFolder(name: string, parentId: string | null): Folder {
    const trimmed = name.trim();
    if (!trimmed) throw new StoreError('文件夹名字不能为空');
    if (parentId) this.mustFolder(parentId);
    if (this.folders.some((f) => f.parentId === parentId && f.name === trimmed)) {
      throw new StoreError(`这一层已经有一个叫「${trimmed}」的文件夹了`);
    }
    const folder: Folder = {
      id: `fd-${Date.now().toString(36)}`,
      name: trimmed,
      parentId,
      materialCount: 0,
    };
    this.folders.push(folder);
    return { ...folder };
  }

  renameFolder(id: string, name: string): Folder {
    const folder = this.mustFolder(id);
    const trimmed = name.trim();
    if (!trimmed) throw new StoreError('文件夹名字不能为空');
    if (this.folders.some((f) => f.id !== id && f.parentId === folder.parentId && f.name === trimmed)) {
      throw new StoreError(`这一层已经有一个叫「${trimmed}」的文件夹了`);
    }
    folder.name = trimmed;
    return { ...folder };
  }

  /**
   * 改 `parentId`。**必须防循环** —— 不能把父夹移进自己的子孙，
   * 否则那棵子树会从根上断掉、再也访问不到（界面上表现为"凭空消失"）。
   */
  moveFolder(id: string, parentId: string | null): Folder {
    const folder = this.mustFolder(id);
    if (parentId === id) throw new StoreError('不能把文件夹移进它自己');
    if (parentId) {
      this.mustFolder(parentId);
      if (this.isDescendant(parentId, id)) {
        throw new StoreError('不能把文件夹移进它自己的子文件夹');
      }
      if (this.folders.some((f) => f.parentId === parentId && f.name === folder.name)) {
        throw new StoreError(`目标里已经有一个叫「${folder.name}」的文件夹了`);
      }
    }
    folder.parentId = parentId;
    // **移夹会改祖先的子树计数** —— 不重算的话旧父与新的祖先都会留着一个错的数
    this.reindex();
    return { ...folder };
  }

  /** `folderId` 是不是在 `rootId` 这棵子树里（含它自己） */
  private inSubtree(folderId: string, rootId: string): boolean {
    return this.isDescendant(folderId, rootId);
  }

  /** `maybeChild` 是不是 `ancestorId` 的子孙（含它自己） */
  private isDescendant(maybeChild: string, ancestorId: string): boolean {
    let cur: string | null = maybeChild;
    // 层数上限兜底：数据一旦有环，这个循环会永转
    for (let guard = 0; cur !== null && guard < 1000; guard += 1) {
      if (cur === ancestorId) return true;
      cur = this.folders.find((f) => f.id === cur)?.parentId ?? null;
    }
    return false;
  }

  /**
   * 删文件夹。**非空则拒绝** —— 静默连子夹带素材一起删是破坏性操作，
   * 得由界面明确地问一次。这条不是实现细节，是产品行为，写在这里免得被"顺手改成级联"。
   */
  removeFolder(id: string): void {
    const folder = this.mustFolder(id);
    const children = this.folders.filter((f) => f.parentId === id).length;
    const files = this.materials.filter((m) => m.deletedAt === null && m.folderId === id).length;
    if (children > 0 || files > 0) {
      const parts: string[] = [];
      if (children > 0) parts.push(`${children} 个子文件夹`);
      if (files > 0) parts.push(`${files} 份素材`);
      throw new StoreError(`「${folder.name}」里还有 ${parts.join('、')}，先移走或删掉它们`);
    }
    this.folders = this.folders.filter((f) => f.id !== id);
    this.reindex();
  }

  private mustFolder(id: string): Folder {
    const found = this.folders.find((f) => f.id === id);
    if (!found) throw new StoreError('找不到这个文件夹');
    return found;
  }

  /* ================================================================
     素材
     ================================================================ */

  /**
   * 列表。**一律只返回文件素材**（`folderId !== null`）。
   *
   * 对话素材**不进这里** —— ADR-0007 说它"只作为**来源**出现在知识点里"。
   * 它仍然能被 `getMaterial` 取到，只是不出现在素材库里。
   */
  listMaterials(req: ListMaterialRequest): Material[] {
    const kw = (req.query ?? '').trim().toLowerCase();
    let rows = this.materials.filter((m) => m.folderId !== null);

    switch (req.view) {
      case 'all':
        rows = rows.filter((m) => m.deletedAt === null);
        break;
      case 'recent':
        rows = rows.filter((m) => m.deletedAt === null);
        break;
      case 'favorite':
        rows = rows.filter((m) => m.deletedAt === null && m.favorite);
        break;
      case 'trash':
        rows = rows.filter((m) => m.deletedAt !== null);
        break;
      case 'tag':
        rows = rows.filter(
          (m) => m.deletedAt === null && (req.tag ? m.tags.some((t) => t.name === req.tag) : true),
        );
        break;
      default: {
        // 穷尽检查：视图多一个时这里会编译不过（而不是静默落到某条分支）
        const never: never = req.view;
        throw new StoreError(`未知的视图：${String(never)}`);
      }
    }

    if (kw) {
      // 目前只搜标题与标签。**正文搜索是本地索引的活**（§6.2），等 indexer 就位再接
      rows = rows.filter(
        (m) =>
          m.title.toLowerCase().includes(kw) ||
          m.tags.some((t) => t.name.toLowerCase().includes(kw)),
      );
    }

    return rows
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((m) => ({ ...m }));
  }

  getMaterial(id: string): Material {
    const found = this.materials.find((m) => m.id === id);
    if (!found) throw new StoreError('找不到这份素材');
    return { ...found };
  }

  /** **点击式移动**（D46）：多选 + 目标夹。`folderId: null` = 移到顶层 */
  moveMaterials(req: MoveMaterialRequest): void {
    if (req.ids.length === 0) return;
    if (req.folderId) this.mustFolder(req.folderId);
    for (const id of req.ids) {
      const m = this.materials.find((x) => x.id === id);
      if (!m) throw new StoreError('要移动的素材里有一份找不到了');
      // 对话素材没有文件夹归属，移动它没有意义 —— 早失败比默默无操作好
      if (m.folderId === null) {
        throw new StoreError(`「${m.title}」是对话素材，它不属于任何文件夹`);
      }
      m.folderId = req.folderId;
      m.updatedAt = new Date().toISOString();
    }
    this.reindex();
  }

  /** 进回收站（软删）。**素材本身不消失** —— 它仍是来源关系的另一端 */
  removeMaterials(ids: string[]): void {
    const now = new Date().toISOString();
    for (const id of ids) {
      const m = this.materials.find((x) => x.id === id);
      if (!m) throw new StoreError('要删除的素材里有一份找不到了');
      m.deletedAt = now;
    }
    this.reindex();
  }

  restoreMaterials(ids: string[]): void {
    for (const id of ids) {
      const m = this.materials.find((x) => x.id === id);
      if (!m) throw new StoreError('要恢复的素材里有一份找不到了');
      m.deletedAt = null;
    }
    this.reindex();
  }

  /* ================================================================
     知识点 —— 跨文件夹的产出，**没有文件夹归属**
     ================================================================ */

  listKnowledge(req: ListKnowledgeRequest): KnowledgePoint[] {
    const kw = (req.query ?? '').trim().toLowerCase();
    let rows = this.knowledge.filter((k) => k.deletedAt === null);
    if (req.tag) rows = rows.filter((k) => k.tags.some((t) => t.name === req.tag));
    if (kw) {
      rows = rows.filter(
        (k) => k.title.toLowerCase().includes(kw) || k.body.toLowerCase().includes(kw),
      );
    }
    return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((k) => ({ ...k }));
  }

  /** 左栏的**标签分组**。按知识点计数，不把素材的标签混进来 */
  knowledgeTagGroups(): Array<{ tag: Tag; count: number }> {
    const byName = new Map<string, { tag: Tag; count: number }>();
    for (const k of this.knowledge) {
      if (k.deletedAt !== null) continue;
      for (const tag of k.tags) {
        const hit = byName.get(tag.name);
        if (hit) hit.count += 1;
        else byName.set(tag.name, { tag: { ...tag }, count: 1 });
      }
    }
    return [...byName.values()].sort((a, b) => b.count - a.count);
  }

  getKnowledge(id: string): KnowledgePoint {
    const found = this.knowledge.find((k) => k.id === id);
    if (!found) throw new StoreError('找不到这个知识点');
    return { ...found };
  }

  removeKnowledge(id: string): void {
    const found = this.knowledge.find((k) => k.id === id);
    if (!found) throw new StoreError('找不到这个知识点');
    found.deletedAt = new Date().toISOString();
    this.reindex();
  }

  /** **来源关系**（知识点 ← 素材）。只读 —— 它由蒸馏自动产生，**用户不能否认** */
  knowledgeSources(id: string): SourceLink[] {
    this.getKnowledge(id);
    return this.sourceLinks.filter((s) => s.knowledgeId === id).map((s) => ({ ...s }));
  }

  /* ================================================================
     关联 —— 两态（D35 / ADR-0010）
     ================================================================ */

  listAssociations(req: ListAssociationRequest): Association[] {
    return this.associations
      .filter((a) => a.state === req.state)
      .filter((a) => !this.suppressed.has(pairKey(a.a, a.b)))
      .filter((a) => (req.around ? a.a === req.around || a.b === req.around : true))
      .map((a) => ({ ...a }));
  }

  /** 确认 → 升为**已建立关联**，进进化图谱 */
  confirmAssociation(id: string): Association {
    const found = this.associations.find((a) => a.id === id);
    if (!found) throw new StoreError('找不到这条关联');
    if (found.state === 'established') return { ...found };
    found.state = 'established';
    // 人确认过的，置信度记满 —— 它不再是一个"猜测"了
    found.confidence = 1;
    found.decidedBy = 'user';
    this.reindex();
    return { ...found };
  }

  /** 否认 → **这一对不再被提议**（永久压制，不是"下次再问"） */
  denyAssociation(id: string): void {
    const found = this.associations.find((a) => a.id === id);
    if (!found) throw new StoreError('找不到这条关联');
    this.suppressed.add(pairKey(found.a, found.b));
    this.associations = this.associations.filter(
      (a) => pairKey(a.a, a.b) !== pairKey(found.a, found.b),
    );
    // 连带把引用它的「待确认」收掉 —— 否则待确认列表里会留一条点开是空的
    for (const ev of this.evolutions) {
      ev.pending = ev.pending.filter((p) => p.id !== found.id);
      ev.needsConfirm = ev.pending.length > 0;
    }
    this.reindex();
  }

  /* ================================================================
     演化记录（ADR-0001）
     ================================================================ */

  listEvolutions(): EvolutionRecord[] {
    return [...this.evolutions]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map((ev) => ({ ...ev, inputs: [...ev.inputs], outputs: [...ev.outputs], pending: [...ev.pending] }));
  }

  /* ================================================================
     统计（**视图层**，不产生新实体 —— ADR-0007）
     ================================================================ */

  statsSummary(): StatsSummary {
    const liveMaterials = this.materials.filter((m) => m.deletedAt === null && m.folderId !== null);
    const liveKnowledge = this.knowledge.filter((k) => k.deletedAt === null);
    const established = this.associations.filter((a) => a.state === 'established');
    const candidates = this.associations.filter((a) => a.state === 'candidate');
    const since = this.evolutions.reduce(
      (min, ev) => (ev.at < min ? ev.at : min),
      new Date().toISOString(),
    );

    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const heat = Array.from({ length: 14 }, (_, i) => {
      const dayStart = now - (13 - i) * dayMs;
      const count = this.evolutions.filter((ev) => {
        const t = Date.parse(ev.at);
        return t >= dayStart - dayMs / 2 && t < dayStart + dayMs / 2;
      }).length;
      // **只给强度 0–1**，颜色档位由视图决定 —— 不在数据层配色
      return { date: new Date(dayStart).toISOString(), intensity: Math.min(1, count / 4) };
    });

    return {
      daysSince: Math.max(1, Math.round((now - Date.parse(since)) / dayMs)),
      since,
      todayInteractions: this.evolutions.filter(
        (ev) => now - Date.parse(ev.at) < dayMs,
      ).length,
      heat,
      materialCount: liveMaterials.length,
      establishedAssociationCount: established.length,
      candidateAssociationCount: candidates.length,
      knowledgeCount: liveKnowledge.length,
      usedBytes: liveMaterials.reduce((sum, m) => sum + (m.sizeBytes ?? 0), 0),
      quotaBytes: QUOTA_BYTES,
      /**
       * TOP 6。**`calls` 的口径仍未定**（§10.2：AI 调用次数 or 用户查看次数）——
       * 这里暂时拿**已建立关联数**当代理指标，**它是一个占位，不是答案**。
       * 口径定下来之前，界面上不该把它说成"被调用次数"。
       */
      topKnowledge: [...liveKnowledge]
        .sort((a, b) => b.establishedAssociationCount - a.establishedAssociationCount)
        .slice(0, 6)
        .map((k) => ({ knowledgeId: k.id, title: k.title, calls: k.establishedAssociationCount })),
    };
  }

  /* ================================================================
     本阶段之外：显式留空（S2 / S3 / S4 各自接手）
     ================================================================ */

  reviewGet(_span: ReviewSpan): ReviewResponse {
    // S2：打开时现生成 + 缓存（D43）。生成层是**云端往返**，要有完整三态
    return todo('周期回顾的生成');
  }

  listConversations(): Conversation[] {
    return this.conversations.map((c) => ({ ...c }));
  }

  getConversation(id: string): ConversationMessage[] {
    const found = this.conversations.find((c) => c.id === id);
    if (!found) throw new StoreError('找不到这段对话');
    return structuredClone(this.messages[id] ?? []);
  }

  createConversation(title?: string): Conversation {
    const conv: Conversation = {
      id: `cv-${Date.now().toString(36)}`,
      title: title?.trim() || '新对话',
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };
    this.conversations.unshift(conv);
    this.messages[conv.id] = [];
    return { ...conv };
  }

  removeConversation(id: string): void {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    delete this.messages[id];
  }

  modelConfig(): ModelConfig {
    return structuredClone(this.model);
  }

  saveModel(req: SaveModelRequest): ModelConfig {
    for (const slot of ['decision', 'generation'] as const) {
      const next = req[slot];
      this.model[slot].baseUrl = next.baseUrl.trim();
      this.model[slot].model = next.model.trim();
      this.model[slot].configured = Boolean(next.baseUrl.trim() && next.model.trim());
      // 密钥**单向**：给了就换成新掩码，没给就保持原样。**永不回显明文**
      if (next.key) {
        const tail = next.key.slice(-4);
        this.model[slot].keyMasked = `${next.key.slice(0, 6)}••••${tail}`;
      }
    }
    return structuredClone(this.model);
  }

  listSkills(): SkillInfo[] {
    return this.skills.map((s) => ({ ...s }));
  }

  toggleSkill(name: string, enabled: boolean): SkillInfo {
    const found = this.skills.find((s) => s.name === name);
    if (!found) throw new StoreError('找不到这个技能');
    if (found.blockedReason) throw new StoreError(found.blockedReason);
    found.enabled = enabled;
    return { ...found };
  }

  createSkill(_description: string): SkillInfo {
    // S4：「让 AI 帮我写一个」的**落盘流程仍未定**（§10.2）
    return todo('「让 AI 帮我写一个」的落盘流程');
  }

  importSkill(_source: string): SkillInfo {
    return todo('导入外部技能');
  }

  removeSkill(name: string): void {
    const found = this.skills.find((s) => s.name === name);
    if (!found) throw new StoreError('找不到这个技能');
    if (found.namespace === 'product') throw new StoreError('产品技能不能删除');
    this.skills = this.skills.filter((s) => s.name !== name);
  }
}

/* ================================================================== *
 * 工具
 * ================================================================== */

/**
 * 把夹具里省掉的派生数补成 0 —— 真正的值由 `reindex()` 算。
 * **补 0 而不是补一个像样的数**：这样"忘了调 reindex"会立刻表现成一片 0，
 * 而不是表现成一堆看着合理的旧值。
 */
function toMaterial(src: SeedMaterial): Material {
  return { ...src, establishedAssociationCount: 0, candidateAssociationCount: 0 };
}

function toKnowledge(src: SeedKnowledge): KnowledgePoint {
  return { ...src, establishedAssociationCount: 0, candidateAssociationCount: 0 };
}

/** 关联的"这一对"：**顺序无意义**，所以排序后再做键 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
