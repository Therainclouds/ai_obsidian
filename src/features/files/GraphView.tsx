/**
 * 关联图视图 —— markup 与 `design/prototype/index-final.html` 的 `#graphView` 逐条对齐，
 * 但**坐标由数据算出来**（`src/lib/radialLayout.ts`），不再是硬编码的示例值。
 *
 * 三个已经定案的边界，都体现在这里：
 *  · **候选关联不进这张图**（D35）—— 它不占位置。入口在进化图谱的「待确认卡片」
 *  · **坐标在本地算**，语义在云端算（D34）。这一页只消费"谁和谁相关、多强"
 *  · **四色全部来自 token**（`--node-1..4`），没有第五色
 *
 * 一圈一圈的疏密取自原型：中心 + 两圈。**顺序稳定**（同圈内按 id 排）——
 * 力导向会随机抖，而这页是"看关系"的，位置跳动会让人以为数据变了。
 */
import { radialLayout, type GraphInputNode } from '../../lib/radialLayout';
import type { Association } from '../../../shared/types';

const W = 900;
const H = 560;

/** 流光只画在**最强的几条**边上。全画会糊成一片，反而看不出主次 */
const HOT_FLOWS = 3;
const COOL_FLOWS = 2;

interface Props {
  /** 当前选中的节点。为 `null` 时画不出图（环要有圆心） */
  centerId: string | null;
  nodes: GraphInputNode[];
  associations: Association[];
}

/** 颜色按**圈**分，按原型的图例语义 —— 不是按类型随手给的 */
function colorOf(depth: number, kind: GraphInputNode['kind']): string {
  if (depth === 0) return 'var(--node-1)';
  if (depth === 1) return kind === 'distilled' ? 'var(--node-3)' : 'var(--node-2)';
  return 'var(--node-4)';
}

export default function GraphView({ centerId, nodes, associations }: Props) {
  const { nodes: placed, edges, dropped } = radialLayout(
    centerId,
    nodes,
    associations,
    W,
    H,
  );

  if (placed.length === 0) {
    return (
      <div className="graph-view">
        <div className="empty">
          <div className="empty-title">还没有可画的关系</div>
          <div className="empty-desc">
            关联图以当前选中的素材为中心。选一份素材，或等 AI 建立关联。
          </div>
        </div>
      </div>
    );
  }

  const pos = new Map(placed.map((n) => [n.id, n]));
  // 强的排前面：流光的条数有限，要让最该动的那几条动起来
  const ordered = [...edges].sort((a, b) => b.weight - a.weight);
  const flowing = [
    ...ordered.slice(0, HOT_FLOWS).map((e) => ({ e, cls: 'flow', dur: 2.8 })),
    ...ordered.slice(HOT_FLOWS, HOT_FLOWS + COOL_FLOWS).map((e) => ({ e, cls: 'flow-2', dur: 4.2 })),
  ];

  return (
    <div className="graph-view">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {edges.map((e, i) => {
          const a = pos.get(e.a)!;
          const b = pos.get(e.b)!;
          return (
            <line
              key={`e${i}`}
              id={`fe${i}`}
              className={e.hot ? 'g-edge hot' : 'g-edge'}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          );
        })}

        {/* 沿边运行的光：走的是"近期活跃关联"。只给最强的几条 */}
        {flowing.map(({ e, cls, dur }, i) => {
          const idx = edges.indexOf(e);
          return (
            <circle key={`f${i}`} className={cls} r={cls === 'flow' ? 3.4 : 2.6}>
              <animateMotion dur={`${dur + i * 0.3}s`} repeatCount="indefinite">
                <mpath href={`#fe${idx}`} />
              </animateMotion>
            </circle>
          );
        })}

        {placed.map((n) => (
          <g className="g-node" key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r} style={{ fill: colorOf(n.depth, n.kind) }} />
            <text
              className={n.depth === 0 ? 'strong' : undefined}
              // 中心节点的标签放下方（它是"当前文件"，视觉重量最大），其余放上方
              x={n.x}
              y={n.depth === 0 ? n.y + n.r + 17 : n.y - n.r - 7}
              textAnchor="middle"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="graph-legend">
        <span>
          <i style={{ background: 'var(--node-1)' }} />
          当前{placed[0]?.kind === 'distilled' ? '知识点' : '素材'}
        </span>
        <span>
          <i style={{ background: 'var(--node-2)' }} />
          直接关联
        </span>
        <span>
          <i style={{ background: 'var(--node-3)' }} />
          知识点
        </span>
        <span>
          <i style={{ background: 'var(--node-4)' }} />
          次级关联
        </span>
      </div>

      {dropped > 0 && (
        <div className="graph-note">
          另有 {dropped} 个节点与当前选中没有已建立的关联，未画出
        </div>
      )}
    </div>
  );
}
