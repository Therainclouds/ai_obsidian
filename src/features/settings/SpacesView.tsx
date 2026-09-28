import { useState } from 'react';

/**
 * 知识空间面板（ADR-0006）
 *
 * 为什么它是一等设置项：知识空间是**内容边界**，不是分组标签。
 * 用户对「我的东西放在哪」的全部控制权集中在这里。
 *
 * 原型里那句「设备是 RK3528 / 4GB」与实测不符（实为 S905L3A / 1.94GB），
 * 已在 §5.4 与本文件里更正 —— 详见 ADR-0004 的 2026-09-28 实测节。
 */
interface Space {
  name: string;
  path: string;
  stat: string;
  current?: boolean;
}

const SPACES: Space[] = [
  { name: '我的空间', path: '/data/spaces/default', stat: '0 文件 · 0 知识点', current: true },
  { name: '工作', path: '/data/spaces/work', stat: '0 文件 · 0 知识点' },
  { name: '读书笔记', path: '/data/spaces/reading', stat: '0 文件 · 0 知识点' },
];

export default function SpacesView() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="s-view active">
      <h2>知识空间</h2>
      <p className="s-desc">每个空间是一套独立的内容：自己的文件树、知识点与演化图谱</p>

      <div className="s-section">
        <div className="s-section-title">我的空间 · {SPACES.length} 个</div>
        <div className="conn-card">
          {SPACES.map((s) => (
            <div key={s.name} className={s.current ? 'space-row on' : 'space-row'}>
              <span className="sp-dot" />
              <div className="sp-body">
                <div className="sp-name">{s.name}</div>
                <div className="sp-path">{s.path}</div>
              </div>
              <span className="sp-stat">{s.stat}</span>
              {s.current ? (
                <span className="st-tag">当前</span>
              ) : (
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: 11.5, flex: 'none' }} type="button">
                  切换
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="ghost-btn" type="button" onClick={() => setCreating(true)}>
            + 新建知识空间
          </button>
          <button className="ghost-btn" type="button">
            重命名当前空间
          </button>
        </div>

        {/* 新建流程：命名 → 建目录 → 切过去。空空间必须给引导，不能给三个空白框 */}
        {creating && (
          <div className="new-space-row">
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="空间名称，例如「读书笔记」"
              aria-label="新知识空间名称"
            />
            <button className="primary-btn" type="button" disabled={!name.trim()}>
              创建
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                setCreating(false);
                setName('');
              }}
            >
              取消
            </button>
          </div>
        )}

        <p className="field-hint" style={{ marginTop: 10 }}>
          切换空间会换掉整个内容上下文，agent 需要重新载入（约 3 秒）。空间之间内容不互通。
        </p>
      </div>

      <div className="s-section">
        <div className="s-section-title">高级 · Agent 实例</div>
        <p className="s-desc" style={{ margin: '0 0 10px', fontSize: 12 }}>
          默认所有知识空间共用同一个 agent 实例。它只有一份运行记忆与一套技能，与你的资料严格分开存放。
        </p>
        <div className="conn-card">
          <div className="role-row">
            <span className="r-name" style={{ width: 'auto' }}>
              实例
            </span>
            <span className="r-val">default · 全部空间共用</span>
            <span className="st-tag">运行中</span>
          </div>
          <div className="role-row">
            <span className="r-name" style={{ width: 'auto' }}>
              绑定独立 profile
            </span>
            <span className="r-val" style={{ fontFamily: 'inherit', color: 'var(--ink-3)' }}>
              未启用
            </span>
            <button
              className="ghost-btn"
              style={{ padding: '4px 11px', fontSize: 11.5, marginLeft: 'auto', flex: 'none' }}
              type="button"
            >
              开启
            </button>
          </div>
        </div>
        <div className="callout" style={{ marginTop: 12 }}>
          <span className="co-mark">!</span>
          <div>
            开启独立实例后：<b>内存占用增加</b>、<b>每次切换空间都要冷启动</b>、模型配置也要在那个实例里另行设置。
            设备实测内存只有 <b>1.94 GB</b>，建议保持共用。
          </div>
        </div>
      </div>

      <div className="s-section">
        <div className="s-section-title">危险区</div>
        <button
          className="ghost-btn"
          style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-mid)' }}
          type="button"
        >
          删除「读书笔记」
        </button>
        <p className="field-hint" style={{ marginTop: 8 }}>
          删除会连同该空间的文件树、知识点、关联与演化记录一起移除，不可撤销。
        </p>
      </div>
    </div>
  );
}
