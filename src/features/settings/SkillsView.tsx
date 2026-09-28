/**
 * 技能面板（ADR-0005 + 2026-09-23 修订）
 *
 * 两个命名空间**必须分区展示，不得合并成一个列表**：
 *  · 产品技能 —— 随版本发布、住我们仓库、产品点名调用，只读
 *  · 用户技能 —— 住 `~/.hermes/skills/`，agent 自主触发，产品不 review 但要标出来
 *
 * 三项产品义务也都在这里：① 标记来源 ② 拦截脚本面 ③ 告知 token 成本。
 */
export default function SkillsView() {
  return (
    <div className="s-view active">
      <h2>技能</h2>
      <p className="s-desc">Agent 的行为说明文件。系统自带一个，你也可以自己添加</p>

      <div className="s-section">
        <div className="s-section-title">产品技能 · 1 个 · 随系统更新</div>
        <div className="skill-card">
          <div className="skill-head">
            <b>蒸馏写作规范</b>
            <span className="st-tag">只读</span>
          </div>
          <div className="skill-body">
            决定知识点正文的质量标准与输出契约。不包含「什么时候写、按什么顺序写」——那两条归系统编排，技能改不了。
          </div>
          <div className="skill-foot">
            <button className="ghost-btn" type="button">
              查看内容
            </button>
          </div>
        </div>
      </div>

      <div className="s-section">
        <div className="s-section-title">用户技能 · 2 个 · 你自己添加的，系统不保证</div>

        <div className="skill-card mine">
          <div className="skill-head">
            <b>会议纪要整理</b>
            <span className="st-tag">已启用</span>
          </div>
          {/* 义务 ③：告知 token 成本 */}
          <div className="skill-body">来源：你在对话中创建的。可能被闲聊触发，会消耗云端模型的 token。</div>
          <div className="skill-foot">
            <button className="ghost-btn" type="button">
              停用
            </button>
            <button className="ghost-btn" type="button">
              编辑
            </button>
          </div>
        </div>

        <div className="skill-card mine">
          <div className="skill-head">
            <b>小红书爆款标题</b>
            <span className="st-tag warn">已阻止</span>
          </div>
          {/* 义务 ①：标记来源 */}
          <div className="skill-body">来源：从外部导入。</div>
          {/* 义务 ②：拦截脚本面，并说明原因 */}
          <div className="s-blocked">
            <span className="co-mark">!</span>
            <div>
              这份技能声明了脚本执行，已被拒绝加载。技能是高信任载体，带脚本的技能等于把设备控制权交出去。
            </div>
          </div>
          <div className="skill-foot">
            <button className="ghost-btn" type="button">
              查看原因
            </button>
            <button className="ghost-btn" type="button">
              删除
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="ghost-btn" type="button">
            + 让 AI 帮我写一个
          </button>
          <button className="ghost-btn" type="button">
            + 手动添加
          </button>
        </div>
      </div>

      <div className="s-section">
        <div className="callout info">
          <span className="co-mark">i</span>
          <div>
            技能只影响<b>知识点怎么写</b>。<b>要不要入库</b>由决策层判断、<b>什么时候写</b>
            由系统编排——技能改不了这两件事，也写不出知识空间里的任何文件。
          </div>
        </div>
      </div>
    </div>
  );
}
