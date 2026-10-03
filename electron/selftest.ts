/**
 * 冒烟自检（`electron . --selftest [--mock]`）。
 *
 * 为什么值得存在：桌面壳的问题是**静默失败** —— 窗口开出来了、页面也画出来了，
 * 但桥没挂上、方法表拼错、白名单太宽、派生数没重算，肉眼看不出来。
 * 这一层不靠推断，靠测量。
 *
 * 它分两段：
 *  · **基础**（两种模式都跑）—— 桥、白名单、"尚未实现"与"未知方法"分得开
 *  · **S1 数据面**（只在 `--mock` 下跑）—— 夹具装载、**读**的口径、**写**的回路
 *
 * 断言写在**页面上下文**里（`executeJavaScript`），因为要验的正是"渲染器能不能做到"。
 * 主进程只看结果，不替它判断。
 */
import type { BrowserWindow } from 'electron';

const PROBE = `(async () => {
  const out = { checks: [] };
  const add = (name, ok, detail) => out.checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

  /* ---------- 基础 ---------- */
  if (typeof window.host !== 'object' || window.host === null) {
    add('preload 桥已挂上', false, 'window.host 不存在');
    return out;
  }
  add('preload 桥已挂上', true);

  const H = window.host;
  /** 期望它**抛错**，且错误里含某句话。返回 '' 表示符合预期 */
  const why = async (fn, needle) => {
    try { await fn(); return '没有抛错（但预期会）'; }
    catch (e) { const m = String((e && e.message) || e); return m.includes(needle) ? '' : m; }
  };
  /** 期望它**成功**。返回 '' 表示符合预期 */
  const fine = async (fn) => {
    try { await fn(); return ''; }
    catch (e) { return String((e && e.message) || e); }
  };

  add('health 往返', await H.invoke('health').then((h) => h && h.ok === true).catch(() => false));

  // ① 已定名但未实现 → 「尚未实现」（与 ② 必须分得开）
  add('未实现的方法报"尚未实现"', (await why(() => H.invoke('skill.list'), '尚未实现')) === '');
  // ② 表外的名字 → 「未知方法」（白名单，ADR-0009 §2）
  add('表外方法被白名单拒绝', (await why(() => H.invoke('__not_in_table__'), '未知方法')) === '');

  /* ---------- S1 数据面（只有装了夹具才有东西可验） ---------- */
  const spaces = await H.invoke('space.list').catch(() => []);
  if (!spaces.length) {
    add('S1 跳过（当前是空态）', true, '未带 --mock');
    return out;
  }

  const health = await H.invoke('health');
  add('health 标明这是示例数据', health.mock === true, String(health.mock));

  const folders = await H.invoke('folder.list');
  const nested = folders.filter((f) => f.parentId !== null);
  add('文件夹可嵌套（D45）', nested.length > 0, nested.map((f) => f.name).join(','));

  const all = await H.invoke('material.list', { view: 'all' });
  add('素材列表不含对话素材（ADR-0007）', all.every((m) => m.folderId !== null), '共 ' + all.length + ' 份');
  // D31：「全部」只数文件素材，**等于各文件夹之和**。注意**只对顶层求和** ——
  // 文件夹计数是子树计数，把每一层都加起来会重复算
  const sumTop = folders
    .filter((f) => f.parentId === null)
    .reduce((n, f) => n + f.materialCount, 0);
  add('全部 = 顶层文件夹之和（D31）', sumTop === all.length, sumTop + ' vs ' + all.length);
  // 子树计数：有子夹的夹**不能显示 0**（这条是看截图才发现的，之前显示 0 像空夹）
  const withChild = folders.filter((f) => folders.some((c) => c.parentId === f.id));
  add('有子夹的文件夹不显示 0（子树计数）',
    withChild.every((f) => f.materialCount > 0),
    withChild.map((f) => f.name + ':' + f.materialCount).join(' '));

  const trash = await H.invoke('material.list', { view: 'trash' });
  add('回收站视图只含已删除', trash.length > 0 && trash.every((m) => m.deletedAt !== null), '共 ' + trash.length + ' 份');

  const fav = await H.invoke('material.list', { view: 'favorite' });
  add('收藏视图只含已收藏', fav.every((m) => m.favorite), '共 ' + fav.length + ' 份');

  const groups = await H.invoke('knowledge.list', { groupByTag: true });
  add('知识点标签分组', Array.isArray(groups) && groups.length > 0 && groups[0].count > 0,
    groups.map((g) => g.tag.name + ':' + g.count).join(' '));

  const know = await H.invoke('knowledge.list', {});
  add('知识点没有文件夹归属（D12）', know.every((k) => k.folderId === null), '共 ' + know.length + ' 个');

  const est = await H.invoke('association.list', { state: 'established' });
  const cand = await H.invoke('association.list', { state: 'candidate' });
  add('关联分成两态（D35）', est.length > 0 && cand.length > 0, '已建立 ' + est.length + ' / 候选 ' + cand.length);

  const evs = await H.invoke('evolution.list');
  const triggers = new Set(evs.map((e) => e.trigger));
  add('四种 trigger 都出现过（ADR-0001）', triggers.size === 4, [...triggers].join(','));
  add('needsConfirm 与 pending 一致（D37）',
    evs.every((e) => e.needsConfirm === (e.pending.length > 0)));

  const stats = await H.invoke('stats.summary');
  add('统计的素材数与列表一致', stats.materialCount === all.length,
    stats.materialCount + ' vs ' + all.length);
  add('统计的关联数只数已建立', stats.establishedAssociationCount === est.length,
    stats.establishedAssociationCount + ' vs ' + est.length);
  add('候选不与已建立相加', stats.candidateAssociationCount === cand.length && cand.length !== est.length);

  /* ---------- 写回路 ---------- */
  const created = await H.invoke('folder.create', { name: '自检临时夹', parentId: null });
  add('新建文件夹', !!created.id, created.name);

  // 防循环：不能把父夹移进自己的子孙
  const parent = folders.find((f) => folders.some((c) => c.parentId === f.id));
  const child = folders.find((f) => f.parentId === parent.id);
  add('文件夹移动防循环（D45）',
    (await why(() => H.invoke('folder.move', { id: parent.id, parentId: child.id }), '子文件夹')) === '');

  const first = all[0];
  await H.invoke('material.move', { ids: [first.id], folderId: created.id });
  const afterMove = await H.invoke('material.list', { view: 'all' });
  add('移动素材改的是归属（D46）',
    afterMove.find((m) => m.id === first.id).folderId === created.id);

  await H.invoke('material.remove', { ids: [first.id] });
  const afterRemove = await H.invoke('stats.summary');
  add('软删之后统计跟着变（派生数重算）', afterRemove.materialCount === stats.materialCount - 1,
    afterRemove.materialCount + ' vs ' + (stats.materialCount - 1));

  await H.invoke('material.restore', { ids: [first.id] });
  const afterRestore = await H.invoke('stats.summary');
  add('恢复之后统计回到原值', afterRestore.materialCount === stats.materialCount);

  const one = cand[0];
  await H.invoke('association.confirm', { id: one.id });
  const afterConfirm = await H.invoke('association.list', { state: 'established' });
  add('确认候选 → 升为已建立（D35）', afterConfirm.some((a) => a.id === one.id));

  const declined = cand[1];
  await H.invoke('association.deny', { id: declined.id });
  const afterDeny = await H.invoke('association.list', { state: 'candidate' });
  add('否认 → 这一对不再被提议', !afterDeny.some((a) => a.id === declined.id));

  // 非空文件夹不能删 —— 静默连子带母一起删是破坏性操作
  add('非空文件夹拒绝删除',
    (await why(() => H.invoke('folder.remove', { id: created.id }), '还有')) === '');

  await H.invoke('material.move', { ids: [first.id], folderId: first.folderId });
  add('清理回原状（空夹可以删）', (await fine(() => H.invoke('folder.remove', { id: created.id }))) === '');

  /* ---------- S2 · 知识总结页 ---------- */
  const stats2 = await H.invoke('stats.summary');
  add('统计卡有相识天数与起始日', stats2.daysSince >= 1 && !!stats2.since,
    stats2.daysSince + ' 天');
  add('热度柱正好 14 格', Array.isArray(stats2.heat) && stats2.heat.length === 14);
  add('热度是 0–1 的强度（配色留给视图）',
    stats2.heat.every((c) => c.intensity >= 0 && c.intensity <= 1 && !!c.date));
  add('TOP 6 不超过 6 条且降序',
    stats2.topKnowledge.length <= 6 &&
      stats2.topKnowledge.every((t, i, a) => i === 0 || a[i - 1].calls >= t.calls),
    stats2.topKnowledge.length + ' 条');

  const spans = ['day', 'week', 'month', 'year'];
  const reviews = {};
  for (const sp of spans) {
    reviews[sp] = await H.invoke('review.get', { span: sp });
  }
  add('日/周/月/年 四档都能取', spans.every((sp) => Array.isArray(reviews[sp].entries)));
  add('每档都有条目（夹具里各时段都走过演化）',
    spans.every((sp) => reviews[sp].entries.length > 0),
    spans.map((sp) => sp + ':' + reviews[sp].entries.length).join(' '));
  // ⚠ 这条是 D43 那一半的可见标记：模型那一半还没接，必须如实说
  add('回顾标明来源（本地数出 vs 模型写的）',
    spans.every((sp) => reviews[sp].source === 'local'),
    reviews['day'].source);
  // 条目形状：视图不是知识点（ADR-0007）
  const day0 = reviews['day'].entries[0];
  add('回顾条目形状正确',
    typeof day0.date === 'string' && typeof day0.title === 'string' &&
      typeof day0.text === 'string' && Array.isArray(day0.topics) &&
      typeof day0.todoCount === 'number');

  // ★ 最要紧的一条：**取回顾不许产生新实体**（ADR-0007 / D30）
  const before = await H.invoke('stats.summary');
  for (const sp of spans) await H.invoke('review.get', { span: sp });
  const afterReview = await H.invoke('stats.summary');
  add('取回顾不产生新实体（ADR-0007）',
    afterReview.knowledgeCount === before.knowledgeCount &&
      afterReview.establishedAssociationCount === before.establishedAssociationCount &&
      afterReview.materialCount === before.materialCount,
    before.knowledgeCount + '→' + afterReview.knowledgeCount);

  // 缓存命中：同一档连续两次，生成时刻不变
  const c1 = await H.invoke('review.get', { span: 'day' });
  const c2 = await H.invoke('review.get', { span: 'day' });
  add('同一档重复取走缓存（D43）', c1.generatedAt === c2.generatedAt, c1.generatedAt);

  // 缓存失效：改一条关联的状态 → 指纹变 → 重新生成
  await new Promise((r) => setTimeout(r, 20));
  const left = await H.invoke('association.list', { state: 'candidate' });
  if (left.length > 0) await H.invoke('association.confirm', { id: left[0].id });
  const c3 = await H.invoke('review.get', { span: 'day' });
  add('内容变了缓存失效（D43）', c3.generatedAt !== c2.generatedAt);

  /* ---------- S3 · 聊天页 ---------- */
  const convs0 = await H.invoke('conversation.list');
  add('对话历史列表能读（D38）', Array.isArray(convs0), convs0.length + ' 段');

  const conv = convs0[0];
  const msgs0 = await H.invoke('conversation.get', { id: conv.id });
  add('对话能取到消息', Array.isArray(msgs0) && msgs0.length === conv.messageCount,
    msgs0.length + ' / ' + conv.messageCount);
  add('消息带角色与时刻',
    msgs0.every((m) => (m.role === 'user' || m.role === 'assistant') && !!m.at));
  // 「依据」是数据里的东西（D41 要的那张卡片就靠它）
  add('助手消息带「依据」（D41 的数据面）',
    msgs0.some((m) => m.role === 'assistant' && Array.isArray(m.basis) && m.basis.length > 0));

  // ★ 宿主是唯一写入者（ADR-0008 边界 2）：渲染器**没有**写历史的办法
  add('渲染器不能自己写对话历史',
    (await why(() => H.invoke('conversation.append', { id: conv.id }), '未知方法')) === '');

  const fresh = await H.invoke('conversation.create', {});
  add('新建对话的标题是占位「新对话」', fresh.title === '新对话', fresh.title);
  add('新建后列表变长',
    (await H.invoke('conversation.list')).length === convs0.length + 1);

  /*
   * ★★ 最要紧的一条：**失败不毁内容，且顺序不能反**（§6.3.4）。
   *
   * 宿主在**跑 agent 之前**就把用户那条写进历史 —— 所以无论这一轮成功还是失败、
   * 甚至 agent 根本不在，用户那句话都必须已经躺在历史里。
   * 本机正好是最严的那种情形：agent 多半跑不起来，正是这条断言该被验的时候。
   */
  const probe = '自检用的那句话，不该丢';
  await new Promise((resolve) => {
    H.stream('agent.chat', { text: probe, conversationId: fresh.id }, (event) => {
      if (event === 'agent.done' || event === 'agent.error' || event === 'host.error') resolve(null);
    });
  });
  const after = await H.invoke('conversation.get', { id: fresh.id });
  add('发出去之后用户那条一定在历史里',
    after.some((m) => m.role === 'user' && m.text === probe), after.length + ' 条');

  /*
   * 助手那条有没有写进去，取决于 agent 到底能不能跑 —— **这条不是断言"一定成功"**，
   * 而是把结果如实报出来：能跑就报出行首几十个字（等于端到端验了一次模型往返），
   * 不能跑就报"没跑起来"。绿色不代表模型可用，红色也不代表代码坏了。
   */
  const reply = after.find((m) => m.role === 'assistant');
  add(
    '助手那条：agent 能跑就写、跑不了就不写（§6.3.4 的另一半）',
    true,
    // ⚠ 这里不能用模板字符串：整段探针本身就在一个模板字符串里，反引号会把外层套破。
    // 用拼接 —— 美元花括号在字符串里也照样会被外层插值。
    reply
      ? '已写 ' + reply.text.length + ' 字 · ' + reply.text.slice(0, 28) + '…'
      : '这轮没产出回复，历史里只有用户那条',
  );
  add('标题自动取第一句用户话（用户不必先给对话起名）',
    (await H.invoke('conversation.list')).find((c) => c.id === fresh.id).title === probe.slice(0, 24));

  await H.invoke('conversation.remove', { id: fresh.id });
  add('删除对话', (await H.invoke('conversation.list')).length === convs0.length);
  add('删掉的对话取不到了',
    (await why(() => H.invoke('conversation.get', { id: fresh.id }), '找不到')) === '');

  return out;
})()`;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runSelfTest(win: BrowserWindow): Promise<void> {
  const result = (await win.webContents.executeJavaScript(PROBE)) as { checks: Check[] };
  const checks = result.checks ?? [];
  const failed = checks.filter((c) => !c.ok);

  for (const c of checks) {
    const mark = c.ok ? '✓' : '✗';
    console.log(`[selftest] ${mark} ${c.name}${c.detail ? `（${c.detail}）` : ''}`);
  }
  console.log(`[selftest] ${failed.length === 0 ? '全部通过' : `未通过 ${failed.length} 项`} · 共 ${checks.length} 项`);
  if (failed.length > 0) process.exitCode = 1;
}
