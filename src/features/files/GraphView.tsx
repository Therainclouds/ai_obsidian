/**
 * 关联图视图 —— SVG 逐条抄自 `design/prototype/index-final.html` 的 `#graphView`。
 *
 * ⚠ **这里画的是「坐标已算好」的结果，节点坐标是硬编码的示例值。**
 *
 * 计算位置**已定案（D34 / §6.2）**：**语义分析（谁和谁相关、多强）走云端大模型，
 * 坐标（把已知强度摊成二维位置）在本地算**。所以真实布局的输入有两段——
 * 云端那段的产物是"边与权重"，本地这段的产物才是坐标。
 *
 * 之所以还没写真实布局，不是决策未定，而是**输入还没有**：没有真实的关联数据，
 * 也没有云端那一段。等接上真实数据再落（见 DESIGN-SPEC §9.4 的"竖切"注）。
 * 落的时候两条边界：节点数大时本地 O(N²) 扛不住 → Barnes-Hut 近似 + 显示上限；
 * 且**必须有骨架**（§6.2 把「重排图谱」归为本地有耗时，只给加载态）。
 *
 * 四色节点全部来自 token（`--node-1..4`），没有第四色。
 */
export default function GraphView() {
  return (
    <div className="graph-view">
      <svg viewBox="0 0 900 560">
        <line className="g-edge hot" id="fe1" x1="450" y1="260" x2="300" y2="160" />
        <line className="g-edge hot" id="fe2" x1="450" y1="260" x2="610" y2="170" />
        <line className="g-edge hot" id="fe3" x1="450" y1="260" x2="330" y2="380" />
        <line className="g-edge" id="fe4" x1="450" y1="260" x2="590" y2="370" />
        <line className="g-edge" id="fe5" x1="300" y1="160" x2="200" y2="250" />
        <line className="g-edge" id="fe6" x1="610" y1="170" x2="710" y2="260" />
        <line className="g-edge" id="fe7" x1="330" y1="380" x2="200" y2="420" />
        <line className="g-edge" id="fe8" x1="590" y1="370" x2="710" y2="420" />
        <line className="g-edge" id="fe9" x1="300" y1="160" x2="180" y2="110" />
        <line className="g-edge" id="fe10" x1="610" y1="170" x2="740" y2="120" />

        {/* 沿边运行的光：走的是"近期活跃关联" */}
        <circle className="flow" r="3.4">
          <animateMotion dur="2.8s" repeatCount="indefinite">
            <mpath href="#fe1" />
          </animateMotion>
        </circle>
        <circle className="flow" r="3.4">
          <animateMotion dur="3.4s" repeatCount="indefinite">
            <mpath href="#fe2" />
          </animateMotion>
        </circle>
        <circle className="flow" r="3.4">
          <animateMotion dur="3.1s" repeatCount="indefinite">
            <mpath href="#fe3" />
          </animateMotion>
        </circle>
        <circle className="flow-2" r="2.6">
          <animateMotion dur="4.2s" repeatCount="indefinite">
            <mpath href="#fe5" />
          </animateMotion>
        </circle>
        <circle className="flow-2" r="2.6">
          <animateMotion dur="4.6s" repeatCount="indefinite">
            <mpath href="#fe6" />
          </animateMotion>
        </circle>

        <g className="g-node">
          <circle cx="450" cy="260" r="15" style={{ fill: 'var(--node-1)' }} />
          <text className="strong" x="450" y="292" textAnchor="middle">
            增长模型.md
          </text>
        </g>
        <g className="g-node">
          <circle cx="300" cy="160" r="11" style={{ fill: 'var(--node-2)' }} />
          <text x="300" y="140" textAnchor="middle">
            小红书运营手册
          </text>
        </g>
        <g className="g-node">
          <circle cx="610" cy="170" r="11" style={{ fill: 'var(--node-2)' }} />
          <text x="610" y="150" textAnchor="middle">
            AI 产品观察
          </text>
        </g>
        <g className="g-node">
          <circle cx="330" cy="380" r="10" style={{ fill: 'var(--node-3)' }} />
          <text x="330" y="408" textAnchor="middle">
            认知觉醒
          </text>
        </g>
        <g className="g-node">
          <circle cx="590" cy="370" r="9" style={{ fill: 'var(--node-3)' }} />
          <text x="590" y="396" textAnchor="middle">
            竞品调研.pdf
          </text>
        </g>
        <g className="g-node">
          <circle cx="200" cy="250" r="6" style={{ fill: 'var(--node-4)' }} />
          <text x="200" y="272" textAnchor="middle">
            爆款公式
          </text>
        </g>
        <g className="g-node">
          <circle cx="710" cy="260" r="6" style={{ fill: 'var(--node-4)' }} />
          <text x="710" y="282" textAnchor="middle">
            Agent 趋势
          </text>
        </g>
        <g className="g-node">
          <circle cx="200" cy="420" r="5" style={{ fill: 'var(--node-4)' }} />
          <text x="200" y="440" textAnchor="middle">
            习惯回路
          </text>
        </g>
        <g className="g-node">
          <circle cx="710" cy="420" r="5" style={{ fill: 'var(--node-4)' }} />
          <text x="710" y="440" textAnchor="middle">
            Notion AI
          </text>
        </g>
        <g className="g-node">
          <circle cx="180" cy="110" r="5" style={{ fill: 'var(--node-4)' }} />
          <text x="180" y="96" textAnchor="middle">
            选题库
          </text>
        </g>
        <g className="g-node">
          <circle cx="740" cy="120" r="5" style={{ fill: 'var(--node-4)' }} />
          <text x="740" y="106" textAnchor="middle">
            RAG 笔记
          </text>
        </g>
      </svg>

      <div className="graph-legend">
        <span>
          <i style={{ background: 'var(--node-1)' }} />
          当前文件
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
    </div>
  );
}
