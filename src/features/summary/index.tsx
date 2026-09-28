import Placeholder from '../../components/Placeholder';

/** 模块 ④ · 知识总结。周期回顾是视图，不是知识点（ADR-0007）。 */
export default function SummaryPage() {
  return (
    <Placeholder
      title="知识总结"
      items={[
        '统计条 + 高频知识点排名',
        '周期回顾：按日 / 周 / 月 / 年重排已有知识点',
        '注意：周期回顾是视图，不进图谱、不计入统计（D30）',
      ]}
    />
  );
}
