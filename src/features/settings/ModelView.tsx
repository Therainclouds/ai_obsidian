import { useState } from 'react';

/**
 * AI 模型面板（DESIGN-SPEC §5.4）
 *
 * 四条硬约束（ADR-0002 / ADR-0003）在 UI 上的体现：
 *  1. 密钥单向 —— 接受输入、**永不回显明文**，只给掩码；「更换」是唯一编辑入口
 *  2. 不暴露工作目录 —— cwd 是安全边界，不是偏好
 *  3. 工具集只读 —— 白名单由 ADR-0002 冻结，面板只展示、不可改
 *  4. 保存后须重载 —— 配置在 agent 运行时启动时读取，面板必须说清生效条件
 *
 * **写入链路留空**（§9.4 M2）：接 agent 层后才打通。
 */
const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter（200+ 模型）' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'moonshot', label: 'Kimi / Moonshot' },
  { value: 'zhipu', label: '智谱 GLM' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'custom', label: '自定义 OpenAI 兼容端点' },
];

/**
 * 工具集白名单（ADR-0002 §1，**只读**）。
 * 名字以 Hermes 源码 `toolsets.py::TOOLSETS` 为准 —— 收的是**工具集名**，不是工具名。
 * 原规格书里把 `execute_code` / `delegate_task` 当成工具集名，那是工具名，已校正为
 * `code_execution` / `delegation`（见 ADR-0002 的 2026-09-28 修订节）。
 */
const TOOLSETS_ON = ['file · read', 'file · search', 'file · write ~/.hermes', 'skills', 'session_search', 'vision'];
const TOOLSETS_OFF = ['file · write 知识空间', 'terminal', 'code_execution', 'web', 'browser', 'memory', 'todo', 'delegation'];

type TestState = { kind: 'ok' | 'fail' | 'run'; text: string };

export default function ModelView() {
  const [provider, setProvider] = useState('anthropic');
  const [genTest, setGenTest] = useState<TestState>({ kind: 'ok', text: '连通 · 延迟 320ms · 模型可用' });
  const [decTest, setDecTest] = useState<TestState>({ kind: 'run', text: '尚未测试' });

  return (
    <div className="s-view active">
      <h2>AI 模型</h2>
      <p className="s-desc">知识系统需要两个模型：一个负责判断，一个负责写作。都跑在云端</p>

      {/* 连接状态概览 */}
      <div className="conn-card">
        <div className="conn-head">
          <span className="st-dot" />
          <b>生成层已就绪，决策层待配置</b>
          <time>上次检测 2 分钟前</time>
          <button className="ghost-btn" type="button">
            重新检测
          </button>
        </div>
        <div className="role-row">
          <span className="r-name">生成层</span>
          <span className="r-val">anthropic · claude-sonnet-4</span>
          <span className="st-tag">已配置</span>
        </div>
        <div className="role-row">
          <span className="r-name">决策层</span>
          <span className="r-val">未配置</span>
          <span className="st-tag warn">待配置</span>
        </div>
      </div>

      {/* 生成层 */}
      <div className="role-card">
        <div className="role-card-head">
          <b>生成层 · 写知识点正文</b>
          <p>由 Hermes Agent 驱动：读多份素材、蒸馏整合、写出知识点并落盘。</p>
        </div>
        <div className="role-card-body">
          <div className="form-row">
            <label htmlFor="gen-provider">服务商</label>
            <select id="gen-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {provider === 'custom' && (
            <div className="form-row">
              <label htmlFor="gen-base">Base URL</label>
              <input id="gen-base" defaultValue="https://your-host/v1" />
            </div>
          )}

          <div className="form-row">
            <label htmlFor="gen-model">模型</label>
            <input id="gen-model" defaultValue="claude-sonnet-4" />
            <span className="field-hint">可从服务商拉取可用列表，也可手动填写</span>
          </div>

          <div className="form-row">
            <label htmlFor="gen-key">API Key</label>
            <div className="key-input">
              {/* 单向：只给掩码，且 readonly —— 「更换」是唯一编辑入口（ADR-0003 硬约束 1） */}
              <input id="gen-key" type="password" value="sk-ant-••••3f2a" readOnly />
              <button className="ghost-btn" type="button">
                更换
              </button>
            </div>
            <span className="field-hint">加密存储在设备本地 · 界面上永不回显明文</span>
          </div>

          <div className="test-row">
            <button className="ghost-btn" type="button" onClick={() => setGenTest({ kind: 'ok', text: '连通 · 延迟 320ms · 模型可用' })}>
              测试连接
            </button>
            <span className={`test-result ${genTest.kind}`}>
              <i className="tick" />
              {genTest.text}
            </span>
          </div>
        </div>
      </div>

      {/* 决策层 */}
      <div className="role-card">
        <div className="role-card-head decide">
          <b>决策层 · 判断相关性与够不够蒸</b>
          <p>只返回类型化答案与置信度，不产出任何文字。按 OpenAI 兼容端点接入。</p>
        </div>
        <div className="role-card-body">
          <div className="callout">
            <span className="co-mark">!</span>
            <div>
              <b>还没配置。</b>缺少决策层时系统仍可对话与整理文件，但
              <b>不会自动建立关联、也不会蒸馏知识点</b>。
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="dec-base">Base URL</label>
            <input id="dec-base" defaultValue="https://your-host/v1" />
          </div>
          <div className="form-row">
            <label htmlFor="dec-model">模型</label>
            <input id="dec-model" defaultValue="open-jev-qwen3.5-9b" />
          </div>
          <div className="form-row">
            <label htmlFor="dec-key">API Key</label>
            <div className="key-input">
              <input id="dec-key" type="password" placeholder="sk-…" />
              <button className="ghost-btn" type="button">
                填入
              </button>
            </div>
          </div>
          <div className="test-row">
            <button className="ghost-btn" type="button" onClick={() => setDecTest({ kind: 'run', text: '尚未测试' })}>
              测试连接
            </button>
            <span className={`test-result ${decTest.kind}`}>
              <i className="tick" />
              {decTest.text}
            </span>
          </div>
        </div>
      </div>

      {/* 高级 */}
      <details className="adv">
        <summary>高级设置</summary>
        <div className="adv-body">
          <div className="form-row">
            <label htmlFor="adv-timeout">请求超时（秒）</label>
            <input id="adv-timeout" defaultValue="1800" />
          </div>
          <div className="form-row">
            <label htmlFor="adv-compress">上下文压缩阈值</label>
            <input id="adv-compress" defaultValue="50%" />
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>已启用的工具集</label>
            <p className="field-hint">
              安全边界：<b>知识空间根只读</b>、不可执行命令、不可自行上网。素材是不可信输入。
            </p>
            <div className="tool-grid">
              {TOOLSETS_ON.map((t) => (
                <span key={t} className="tool-pill on">
                  {t}
                </span>
              ))}
              {TOOLSETS_OFF.map((t) => (
                <span key={t} className="tool-pill off">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div className="save-row">
        <button className="primary-btn" type="button">
          保存
        </button>
        <span className="note">模型配置在服务启动时读取，保存后需重载 agent（约 3 秒）</span>
      </div>
    </div>
  );
}
