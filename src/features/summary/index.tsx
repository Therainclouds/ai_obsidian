import { useState, type MouseEvent, type ReactNode } from 'react';
import NumberTicker from '../../components/fx/NumberTicker';
import useGrow from '../../lib/useGrow';
import { useHost } from '../../lib/useHost';
import { formatBytes } from '../../lib/format';
import { reviewGet, statsSummary } from '../../api/host';
import type { ReviewResponse, ReviewSpan, StatsSummary } from '../../../shared/types';

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

/** 四个 tab。粒度取自数据模型（`ReviewSpan`），不是这里自造的一套 */
const TABS: Array<{ key: ReviewSpan; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
];

/**
 * 强度 → 颜色档位。**档位是视图的决定，不是数据的** ——
 * 宿主只给 0–1 的强度（`HeatCell.intensity`），配色留在这里，
 * 这样换配色不用改数据层，也不用动夹具。
 */
function heatLevel(i: number): 'l1' | 'l2' | 'l3' | 'l4' | 'hot' {
  if (i >= 0.85) return 'hot';
  if (i >= 0.6) return 'l4';
  if (i >= 0.4) return 'l3';
  if (i >= 0.2) return 'l2';
  return 'l1';
}

/**
 * 模块 ④ · 知识总结（DESIGN-SPEC §5.3）
 *
 * 有一点必须记住：**「周期回顾」是视图，不是知识点**（ADR-0007 / D30）。
 * 它不是任何一次蒸馏的产出 —— 不落盘、不产生来源关系、不进演化记录、不计入统计。
 * 所以这一个面板里没有任何"生成知识点"的动作，它只是把已有知识点按时间重排给我看。
 *
 * 数据全部来自宿主：统计与 TOP 6 走 `stats.summary`，回顾走 `review.get`。
 */
export default function SummaryPage() {
  const grown = useGrow();
  const [tab, setTab] = useState<ReviewSpan>('day');

  const statsQ = useHost<StatsSummary | null>('stats', statsSummary, null);
  const reviewQ = useHost<ReviewResponse | null>(`review:${tab}`, () => reviewGet(tab), null);
  const s = statsQ.data;

  if (!s) {
    return (
      <div className="empty">
        <div className="empty-title">{statsQ.error ? '统计读不出来' : '正在读取…'}</div>
        <div className="empty-desc">
          {statsQ.error ?? '统计是由已有内容算出来的，不需要单独生成。'}
        </div>
      </div>
    );
  }

  // 存储卡：单位跟着量级走（写死 GB 时几 MB 会显示成 0.0 GB，看着像坏了）
  const usedGb = s.usedBytes / 1024 ** 3;
  const inGb = usedGb >= 1;
  const usedValue = inGb ? usedGb : s.usedBytes / 1024 ** 2;
  const usedUnit = inGb ? 'GB' : 'MB';
  const usedPercent = s.quotaBytes > 0 ? Math.min(100, (s.usedBytes / s.quotaBytes) * 100) : 0;

  const topMax = s.topKnowledge.reduce((m, t) => Math.max(m, t.calls), 0);
  const since = new Date(s.since);
  const sinceText = `${since.getMonth() + 1} 月 ${since.getDate()} 日`;

  const entries = reviewQ.data?.entries ?? [];

  return (
    <>
      <div className="stat-strip stagger">
        <StatCard label="相识天数">
          <div className="stat-value">
            <NumberTicker value={s.daysSince} />
            <small>天</small>
          </div>
          <div className="stat-sub">自 {sinceText}起</div>
        </StatCard>

        <StatCard label="互动热度 · 近 14 天">
          <div className="heat-row">
            {s.heat.map((cell, i) => (
              <i
                key={cell.date}
                className={heatLevel(cell.intensity)}
                title={`${cell.date.slice(0, 10)} · 强度 ${cell.intensity.toFixed(2)}`}
                style={{
                  // 0 强度也留一道很矮的柱：**不留空**，否则那一天看起来像"数据缺失"
                  transform: grown ? `scaleY(${Math.max(0.12, cell.intensity)})` : undefined,
                  transitionDelay: `${80 + i * 45}ms`,
                }}
              />
            ))}
          </div>
          <div className="stat-sub" style={{ marginTop: 8 }}>
            今日已互动 <NumberTicker value={s.todayInteractions} /> 次
          </div>
        </StatCard>

        <StatCard label="知识资产">
          <div className="stat-value">
            <NumberTicker value={s.materialCount} />
            <small>文件</small>
          </div>
          <div className="stat-sub">
            <NumberTicker value={s.establishedAssociationCount} /> 条关联 ·{' '}
            <NumberTicker value={s.knowledgeCount} /> 个知识点
          </div>
        </StatCard>

        <StatCard label="存储空间">
          <div className="stat-value">
            <NumberTicker value={usedValue} dec={1} />
            <small>
              {usedUnit} / {formatBytes(s.quotaBytes)}
            </small>
          </div>
          <div className="stat-bar">
            <i
              style={{
                width: grown ? `${Math.max(usedPercent, 1)}%` : undefined,
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
            {s.topKnowledge.length === 0 && (
              <div className="empty sm">
                <div className="empty-title">还没有知识点</div>
                <div className="empty-desc">蒸馏出第一个知识点之后，这里会排出最常被用到的那些。</div>
              </div>
            )}
            {s.topKnowledge.map((item, i) => (
              <div className="rank-row" key={item.knowledgeId}>
                <span className="rank-no">{String(i + 1).padStart(2, '0')}</span>
                <div className="rank-body">
                  <div className="rank-name">{item.title}</div>
                  <div className="rank-bar">
                    <i
                      style={{
                        width: grown ? `${topMax > 0 ? (item.calls / topMax) * 100 : 0}%` : undefined,
                        transitionDelay: `${140 + (i + 1) * 60}ms`,
                      }}
                    />
                  </div>
                </div>
                <span className="rank-count">{item.calls} 次</span>
              </div>
            ))}
          </div>
          {/* 『调用』的口径**仍未定**（§5.3：AI 调用次数 or 用户查看次数）。
              现在这个数是**已建立关联数**的代理 —— 不说清楚，它就像一个有明确定义的指标。
              **没有内容时不挂这条**：空态下它只是噪音 */}
          {s.topKnowledge.length > 0 && (
            <div className="stat-sub" style={{ padding: '0 18px 14px' }}>
              「被调用」的口径尚未定案，当前显示的是该知识点的关联数
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            {/* 原名「AI 自动总结」，ADR-0007 全量改名为周期回顾（视图，不是知识点） */}
            <span className="panel-title">周期回顾</span>
            <div className="sum-tabs" role="tablist" aria-label="周期回顾时间跨度">
              {TABS.map((t) => (
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

          {reviewQ.error && (
            <div className="err-bar" style={{ margin: '0 18px 14px' }}>
              <span>{reviewQ.error}</span>
            </div>
          )}

          <div className="sum-list">
            {!reviewQ.error && entries.length === 0 && (
              <div className="empty sm">
                <div className="empty-title">
                  {reviewQ.loading ? '正在生成回顾…' : '这一档还没有可回顾的'}
                </div>
                <div className="empty-desc">
                  {reviewQ.loading
                    ? '回顾由演化记录数出来，不用等太久。'
                    : '走过演化之后才会有痕迹 —— 导入素材、或和 AI 聊一次。'}
                </div>
              </div>
            )}
            {entries.map((item) => (
              <div className="sum-item" key={item.date}>
                <div className="sum-item-head">
                  <span className="sum-date">{item.date}</span>
                  <span className="sum-title">{item.title}</span>
                </div>
                <p className="sum-text">{item.text}</p>
                <div className="sum-tags">
                  {item.topics.map((topic) => (
                    <span className="chip" key={topic}>
                      {topic}
                    </span>
                  ))}
                  {item.todoCount > 0 ? (
                    <span className="chip todo">待确认 {item.todoCount} 项</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* **这段文字是谁写的，必须标出来**：数出来的与写出来的分量完全不同。
              生成层接上之后 `source` 翻成 model，这一行随之消失（见 ReviewResponse.source）。
              同样：**没有条目时不挂** —— 那时没有"这份回顾"可言 */}
          {entries.length > 0 && reviewQ.data?.source === 'local' && (
            <div className="stat-sub" style={{ padding: '10px 18px 14px' }}>
              这份回顾由本地按演化记录数出，不是模型写的 —— 导览文字由生成层负责，尚未接入
            </div>
          )}
        </div>
      </div>
    </>
  );
}
