import Placeholder from '../../components/Placeholder';

/** 模块 ③ · 进化图谱。展示「过程」而不是结果列表（§1.2）。 */
export default function GraphPage() {
  return (
    <Placeholder
      title="进化图谱"
      items={[
        '顶部四个 Hook 横向卡片条（收集 / 解析 / 关联 / 沉淀）',
        '演化记录 = trigger + inputs[] + outputs[]（ADR-0001）',
        '只收走过演化的东西；视图不进图谱（ADR-0007）',
      ]}
    />
  );
}
