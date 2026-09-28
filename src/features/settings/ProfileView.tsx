import { useTokenHex } from '../../lib/useTokenHex';

/**
 * 个人资料 —— 含三色展示与「配色黄金律」说明（原型 #view-profile）。
 * 色值从 CSS 变量实时读，**不在这里写死十六进制**（原则 4：颜色由算法派生）。
 */
export default function ProfileView() {
  const hex = useTokenHex(['--ink', '--brand', '--accent']);

  return (
    <div className="s-view active">
      <h2>个人资料</h2>
      <p className="s-desc">昵称、头像与基础信息</p>

      <div className="s-section">
        <div className="profile-card beam-card">
          <div className="avatar">暖</div>
          <div>
            <div className="profile-name">暖暖</div>
            <div className="profile-meta">加入 47 天 · 0 文件 · 0 知识点</div>
          </div>
          <button className="ghost-btn" style={{ marginLeft: 'auto' }} type="button">
            更换头像
          </button>
        </div>
      </div>

      <div className="s-section">
        <div className="s-section-title">主体色 · 仅三色</div>
        <div className="swatch-row">
          <div className="swatch">
            <div className="sw-bar" style={{ background: 'var(--ink)' }} />
            <div className="sw-meta">
              <b>墨 Ink</b>
              <code>{hex['--ink'] ?? '—'}</code>
            </div>
          </div>
          <div className="swatch">
            <div className="sw-bar" style={{ background: 'var(--brand)' }} />
            <div className="sw-meta">
              <b>靛 Indigo</b>
              <code>{hex['--brand'] ?? '—'}</code>
            </div>
          </div>
          <div className="swatch">
            <div className="sw-bar" style={{ background: 'var(--accent)' }} />
            <div className="sw-meta">
              <b>黄金角点缀</b>
              <code>{hex['--accent'] ?? '—'}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="s-section">
        <div className="s-section-title">配色黄金律 · 三色由此算出</div>
        <div className="rule-list">
          <div className="rule-row">
            <span className="rule-no">律 1</span>
            <div className="rule-body">
              <b>面积比 60 : 30 : 10</b>
              <p>
                中性面 60% · 文字与结构 30% · 主色 6.5% + 点缀 3.5%。点缀色面积越小越像「信号」，而不是「装饰」。
              </p>
              <div className="area-bar" aria-hidden="true">
                <i className="a1" />
                <i className="a2" />
                <i className="a3" />
                <i className="a4" />
              </div>
            </div>
          </div>
          <div className="rule-row">
            <span className="rule-no">律 2</span>
            <div className="rule-body">
              <b>中性面由主色派生</b>
              <p>
                底色、卡片、分割线、文字灰阶全部取主色的同一色相 <em>271.3°</em>，彩度压到 0.014
                以下、只动明度。背景因此永远与主色同频，不会再出现「冷主色坐在暖米黄上」。
              </p>
            </div>
          </div>
          <div className="rule-row">
            <span className="rule-no">律 3</span>
            <div className="rule-body">
              <b>点缀色 = 主色色相 + 137.5°（黄金角）</b>
              <p>
                主色 <em>271.3°</em> → 点缀 <em>48.8°</em>。黄金角让点缀既与主色「同族」，又能被最大程度地区分出来。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="s-section">
        <div className="s-section-title">基本信息</div>
        <div className="form-row">
          <label htmlFor="pf-name">昵称</label>
          <input id="pf-name" defaultValue="暖暖" />
        </div>
        <div className="form-row">
          <label htmlFor="pf-mail">邮箱</label>
          <input id="pf-mail" defaultValue="nuan@example.com" />
        </div>
        <button className="primary-btn" type="button">
          保存修改
        </button>
      </div>

      <div className="s-section">
        <div className="s-section-title">待设计模块</div>
        <div className="s-placeholder">
          <b>存储同步 · 快捷键 · 通知</b>
          框架已预留，等布局确认后逐个填充具体功能项
        </div>
      </div>
    </div>
  );
}
