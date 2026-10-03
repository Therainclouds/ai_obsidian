/**
 * 关联图的**本地坐标求解**（D34 / §6.2）。
 *
 * 位置已定案：**语义（谁和谁相关、多强）在云端算，坐标在本地算** ——
 * 把已知的强度摊成二维位置是数值迭代，不该交给语言模型。
 *
 * 用的是**以选中节点为中心的同心环**（不是力导向），两个理由：
 *  1. 结果**确定** —— 同一份数据每次画出来一样。力导向有随机初值，同一张图两次不一样，
 *     而这页是"看关系"用的，位置跳来跳去会让人以为数据变了
 *  2. 它**不需要迭代** —— 一圈算完就有坐标，没有"跑多少轮才收敛"这个问题
 *
 * 原型本身画的就是同心环（中心 + 两圈），所以这不是新设计。
 *
 * **力导向留给图谱页**（M6）：那里没有"选中节点"作为中心，环状的锚点不存在。
 */
import type { Association } from '../../shared/types';

export type GraphKind = 'material' | 'distilled';

export interface GraphInputNode {
  id: string;
  label: string;
  kind: GraphKind;
}

export interface PlacedNode extends GraphInputNode {
  depth: number;
  x: number;
  y: number;
  /** 半径 */
  r: number;
}

export interface PlacedEdge {
  a: string;
  b: string;
  /** 边的强弱。**置信度就是它** —— 图上不另造一套"重要程度" */
  weight: number;
  /** 是否是"近期活跃"的边（画流光的那几条） */
  hot: boolean;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  /** 没有连上中心、因而没被画出来的节点数。**要报出来**，否则像是丢了数据 */
  dropped: number;
}

/** 每圈半径。第一圈 150、第二圈 250 —— 与原型的疏密一致 */
const RING = [0, 150, 250, 320];
const MAX_DEPTH = RING.length - 1;
/** 半径随层递减。原型里中心 15、直接 11、次级 5–6 */
const RADIUS = [15, 11, 9, 6];

export function radialLayout(
  centerId: string | null,
  nodes: GraphInputNode[],
  associations: Association[],
  width: number,
  height: number,
): Layout {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 只画**已建立关联** —— 候选不进图谱（D35）。这条不在这层判，调用方已经过滤过；
  // 这里再兜一次是因为"候选混进来"是静默的，界面上看不出。
  const established = associations.filter((a) => a.state === 'established');

  if (!centerId || !byId.has(centerId)) {
    return { nodes: [], edges: [], dropped: nodes.length };
  }

  // --- BFS 分层 ---
  const adj = new Map<string, string[]>();
  for (const a of established) {
    if (!adj.has(a.a)) adj.set(a.a, []);
    if (!adj.has(a.b)) adj.set(a.b, []);
    adj.get(a.a)!.push(a.b);
    adj.get(a.b)!.push(a.a);
  }

  const depth = new Map<string, number>([[centerId, 0]]);
  let frontier = [centerId];
  for (let d = 1; d <= MAX_DEPTH && frontier.length > 0; d += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const peer of adj.get(id) ?? []) {
        if (!depth.has(peer)) {
          depth.set(peer, d);
          next.push(peer);
        }
      }
    }
    frontier = next;
  }

  const rings: string[][] = Array.from({ length: MAX_DEPTH + 1 }, () => []);
  const droppedIds: string[] = [];
  for (const n of nodes) {
    const d = depth.get(n.id);
    if (d === undefined) droppedIds.push(n.id);
    else rings[d].push(n.id);
  }

  // --- 摆位置 ---
  const cx = width / 2;
  const cy = height / 2;
  const placed: PlacedNode[] = [];

  rings.forEach((ids, d) => {
    // 同一圈内按 id 排序：**顺序稳定**，否则节点间的相对位置会随数据顺序漂
    const sorted = [...ids].sort();
    const radius = RING[d];
    // 相邻圈错开半个扇区，避免连线正好穿过节点
    const offset = d % 2 === 0 ? 0 : Math.PI / Math.max(1, sorted.length);

    sorted.forEach((id, i) => {
      const n = byId.get(id)!;
      const angle = sorted.length === 1 && d === 0
        ? 0
        : offset + (2 * Math.PI * i) / sorted.length - Math.PI / 2;
      placed.push({
        ...n,
        depth: d,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        r: RADIUS[Math.min(d, RADIUS.length - 1)],
      });
    });
  });

  // --- 只留两端都被画出来的边 ---
  const shown = new Set(placed.map((p) => p.id));
  const edges: PlacedEdge[] = established
    .filter((a) => shown.has(a.a) && shown.has(a.b))
    .map((a) => ({
      a: a.a,
      b: a.b,
      weight: a.confidence ?? 0.5,
      // "近期活跃"的口径现在只能是**置信度高** —— 真正的活跃度要等演化记录带时间戳进来
      hot: (a.confidence ?? 0) >= 0.8,
    }));

  return { nodes: placed, edges, dropped: droppedIds.length };
}
