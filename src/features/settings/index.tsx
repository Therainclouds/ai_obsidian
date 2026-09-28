import Placeholder from '../../components/Placeholder';

/** 模块 ⑤ · 设置 & 我的。9 个子项，其中 3 个已定义（知识空间 / AI 模型 / 技能）。 */
export default function SettingsPage() {
  return (
    <Placeholder
      title="设置 & 我的"
      items={[
        '知识空间：空间列表 + 新建 / 重命名 / 切换（ADR-0006）',
        'AI 模型：两个模型位（生成层 / 决策层），密钥单向（ADR-0003）',
        '技能：产品技能 1 个（只读）· 用户技能不限（ADR-0005 修订）',
      ]}
    />
  );
}
