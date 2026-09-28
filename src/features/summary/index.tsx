import { useState, type MouseEvent, type ReactNode } from 'react';
import NumberTicker from '../../components/fx/NumberTicker';
import useGrow from '../../lib/useGrow';
import {
  HEAT,
  REVIEWS,
  REVIEW_TABS,
  STATS,
  TOP_KNOWLEDGE,
  type ReviewTab,
} from './demo';

/**
 * 鼠标跟随光斑（§7.4 动效表：`radial-gradient` 跟随鼠标，半径 240px，`--mx` / `--my`）。
 * 写的是 CSS 变量，不是 React 状态 —— 每帧改 state 会重渲染整张卡。
 */
function setSpotlight(e: MouseEvent<HTMLDivElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stat-card" onMouseMove={setSpotlight}>
      <div className="stat-label">{label}</div>
      {children}
    </div>
  );
}

/**
 * 模块 ④ · 知识总结（DESIGN-SPEC §5.3）
 *
 * 有一点必须记住：**「周期回顾」是视图，不是知识点**（ADR-0007 / D30）。
 * 它不是任何一次蒸馏的产出 —— 不落盘、不产生来源关系、不进演化记录、不计入统计。
 * 所以这一个面板里没有任何"生成知识点"的动作，它只是把已有知识点按时间重排给我看。
 *
 * 数据来自 `demo.ts`（统计卡与 TOP 6 照抄原型；周/月/年 三档条目是本次新拟，见该文件头）。
 * 真实数据经 `/api/stats/*` 与 `/api/review/*`，接口先定、实现留空。
 */
export default function SummaryPage() {
  const grown = useGrow();
  const [tab, setTab] = useState<ReviewTab>('day');
  const items = REVIEWS[tab];

  return (
    <>
      <div className="stat-strip stagger">
        <StatCard label="相识天数">
          <div className="stat-value">
            <NumberTicker value={STATS.days} />
            <small>天</small>
          </div>
          <div className="stat-sub">自 {STATS.since}起</div>
        </StatCard>

        <StatCard label="互动热度 · 近 14 天">
          <div className="heat-row">
            {HEAT.map((cell, i) => (
              <i
                key={i}
                className={cell.level}
                style={{
                  transform: grown ? `scaleY(${cell.height})` : undefined,
                  transitionDelay: `${80 + i * 45}ms`,
                }}
              />
            ))}
          </div>
          <div className="stat-sub" style={{ marginTop: 8 }}>
            今日已互动 <NumberTicker value={STATS.todayInteractions} /> 次
          </div>
        </StatCard>

        <StatCard label="知识资产">
          <div className="stat-value">
            <NumberTicker value={STATS.materials} />
            <small>文件</small>
          </div>
          <div className="stat-sub">
            <NumberTicker value={STATS.associations} /> 条关联 ·{' '}
            <NumberTicker value={STATS.knowledge} /> 个知识点
          </div>
        </StatCard>

        <StatCard label="存储空间">
          <div className="stat-value">
            <NumberTicker value={STATS.usedGb} dec={1} />
            <small>/ {STATS.totalGb} GB</small>
          </div>
          <div className="stat-bar">
            <i
              style={{
                width: grown ? `${STATS.usedPercent}%` : undefined,
                transitionDelay: '140ms',
              }}
            />
          </div>
        </StatCard>
      </div>

      <div className="summary-grid stagger">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">高频触发知识</span>
            <span className="panel-sub">最常被调用 TOP 6</span>
          </div>
          <div className="rank-list">
            {TOP_KNOWLEDGE.map((item, i) => (
              <div className="rank-row" key={item.name}>
                <span className="rank-no">{String(i + 1).padStart(2, '0')}</span>
                <div className="rank-body">
                  <div className="rank-name">{item.name}</div>
                  <div className="rank-bar">
                    <i
                      style={{
                        width: grown ? `${item.fill}%` : undefined,
                        transitionDelay: `${140 + (i + 1) * 60}ms`,
                      }}
                    />
                  </div>
                </div>
                <span className="rank-count">{item.count} 次</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            {/* 原名「AI 自动总结」，ADR-0007 全量改名为周期回顾（视图，不是知识点） */}
            <span className="panel-title">周期回顾</span>
            <div className="sum-tabs" role="tablist" aria-label="周期回顾时间跨度">
              {REVIEW_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={tab === t.key ? 'active' : ''}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sum-list">
            {items.map((item) => (
              <div className="sum-item" key={item.date + item.title}>
                <div className="sum-item-head">
                  <span className="sum-date">{item.date}</span>
                  <span className="sum-title">{item.title}</span>
                </div>
                <p className="sum-text">{item.text}</p>
                <div className="sum-tags">
                  {item.tags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {item.todos ? (
                    <span className="chip todo">待确认 {item.todos} 项</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
