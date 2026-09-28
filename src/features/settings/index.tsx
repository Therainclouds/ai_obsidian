import { useState } from 'react';
import ProfileView from './ProfileView';
import ModelView from './ModelView';
import SpacesView from './SpacesView';
import SkillsView from './SkillsView';
import PlaceholderView from './PlaceholderView';

/**
 * 模块 ⑤ · 设置 & 我的（DESIGN-SPEC §5.4）
 *
 * 9 个子项，其中 3 个已定义（知识空间 / AI 模型 / 技能），加上原型已有的个人资料。
 * 其余四项在原型里点了没反应（没有对应视图），这里给一个 `.s-placeholder` 占位 ——
 * 那是原型自己的组件，不是新东西；死点击比占位更糟。
 *
 * **写入链路留空**（§9.4 M2）：面板先落 UI，接 agent 层才打通读写。
 */
type ViewKey = 'profile' | 'appearance' | 'spaces' | 'model' | 'skills' | 'storage' | 'keys' | 'notify' | 'about';

interface NavDef {
  key: ViewKey;
  label: string;
  /** 有实现的面板；没有的走占位 */
  View?: () => JSX.Element;
  placeholder?: { title: string; body: string };
}

const NAV: Array<NavDef | 'sep'> = [
  { key: 'profile', label: '个人资料', View: ProfileView },
  {
    key: 'appearance',
    label: '外观主题',
    placeholder: { title: '外观主题', body: '主题切换在侧栏底部；这里是主题细节的落点，待设计' },
  },
  { key: 'spaces', label: '知识空间', View: SpacesView },
  { key: 'model', label: 'AI 模型', View: ModelView },
  { key: 'skills', label: '技能', View: SkillsView },
  {
    key: 'storage',
    label: '存储与同步',
    placeholder: { title: '存储与同步', body: '框架已预留，等布局确认后逐个填充具体功能项' },
  },
  'sep',
  {
    key: 'keys',
    label: '快捷键',
    placeholder: { title: '快捷键', body: '框架已预留，等布局确认后逐个填充具体功能项' },
  },
  {
    key: 'notify',
    label: '通知',
    placeholder: { title: '通知', body: '框架已预留，等布局确认后逐个填充具体功能项' },
  },
  {
    key: 'about',
    label: '关于',
    placeholder: { title: '关于', body: '框架已预留，等布局确认后逐个填充具体功能项' },
  },
];

export default function SettingsPage() {
  const [active, setActive] = useState<ViewKey>('profile');
  const current = NAV.find((n) => n !== 'sep' && n.key === active) as NavDef | undefined;

  return (
    <>
      <aside className="settings-nav">
        {NAV.map((n, i) =>
          n === 'sep' ? (
            <div key={`sep-${i}`} className="s-nav-sep" />
          ) : (
            <button
              key={n.key}
              type="button"
              className={n.key === active ? 's-nav-item active' : 's-nav-item'}
              onClick={() => setActive(n.key)}
            >
              {n.label}
            </button>
          ),
        )}
      </aside>

      <div className="settings-detail">
        {current?.View ? (
          <current.View />
        ) : (
          <PlaceholderView title={current?.placeholder?.title ?? ''} body={current?.placeholder?.body ?? ''} />
        )}
      </div>
    </>
  );
}
