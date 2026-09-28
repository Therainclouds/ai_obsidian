import { useEffect, useRef, useState } from 'react';
import { IconArrowUp, IconAt, IconClose, IconPlus } from '../../components/icons';

type Role = 'user' | 'assistant';
interface Msg {
  role: Role;
  text: string;
}
interface ErrShape {
  headline: string;
  detail: string;
}

/** 「AI 正在做」的三段，正对应演化记录的 trigger（§6.3.1） */
const STAGES = [
  { key: 'reading', label: '读取素材' },
  { key: 'linking', label: '整合与关联' },
  { key: 'writing', label: '写知识点' },
] as const;

const SUGGESTS: Array<{ label: string; q: string }> = [
  { label: '总结本周新增笔记', q: '帮我总结本周新增的笔记' },
  { label: '找出相关联的文件', q: '哪些文件之间存在关联？' },
  { label: '回顾昨天的讨论', q: '回顾我们昨天讨论的内容' },
  { label: '整理最近的灵感', q: '把最近的灵感整理成知识点' },
];

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 逐字浮现标题（原型 .bt + btIn） */
function Greeting() {
  const text = `${greetingWord()}，今天想整理点什么？`;
  const em = '整理';
  const emAt = text.indexOf(em);
  return (
    <h1 className="chat-greeting bt" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ animationDelay: `${Math.min(i, 14) * 32}ms` }}
          className={i >= emAt && i < emAt + em.length ? 'em' : undefined}
        >
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </h1>
  );
}

/**
 * 模块 ① · 聊天（AI 主界面）
 *
 * 走 DESIGN-SPEC §6.3 的三态规矩，而且是**真落地**：
 *  · 「AI 正在做」是一等状态（§6.3.1）—— 三段阶段回显
 *  · 失败不毁内容（§6.3.4）—— 用户那条消息留在对话里、草稿不清空、
 *    输入框不锁，出口是内联重试；错误条对齐消息左边缘（.msg-err）
 */
export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [err, setErr] = useState<ErrShape | null>(null);
  const [agentReady, setAgentReady] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const lastRef = useRef('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetch('/api/agent/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { initialized?: boolean }) => setAgentReady(Boolean(d.initialized)))
      .catch(() => setAgentReady(false));
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    lastRef.current = t;

    setMsgs((m) => [...m, { role: 'user', text: t }]); // ① 先入列，之后绝不撤回
    setDraft(''); // ② 草稿清空只因为已发出，不因失败而丢
    setErr(null);
    setBusy(true);
    setStage('reading');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      if (!res.body) throw new Error('宿主没有返回流');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let answer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        let sep: number;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const evLine = /^event:\s*(.+)$/m.exec(frame);
          const dataLine = /^data:\s*(.+)$/m.exec(frame);
          if (!evLine || !dataLine) continue;
          const ev = evLine[1].trim();
          const data = JSON.parse(dataLine[1]) as Record<string, unknown>;

          if (ev === 'stage') setStage(String(data.stage ?? ''));
          else if (ev === 'delta') {
            answer += String(data.text ?? '');
            setMsgs((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') next[next.length - 1] = { role: 'assistant', text: answer };
              else next.push({ role: 'assistant', text: answer });
              return next;
            });
          } else if (ev === 'error') {
            setErr({
              headline: String(data.message ?? '未知错误'),
              detail: data.code !== null && data.code !== undefined ? `acp · code ${data.code}` : 'acp',
            });
          }
        }
      }
    } catch (e) {
      setErr({ headline: (e as Error).message, detail: 'host' });
    } finally {
      setStage(null);
      setBusy(false);
      taRef.current?.focus();
    }
  }

  const empty = msgs.length === 0;

  return (
    <>
      <div className="chat-stage">
        {empty ? (
          <div className="chat-hero">
            <div className="orb-wrap">
              <div className="orb-ring" />
              <div className="orb-ring r2" />
              <div className="orb" />
            </div>
            <div className="chat-status">
              <span className="pulse" />
              {agentReady ? 'AI 就绪 · 已索引 0 个文件 · 0 条关联' : 'AI 未连接 · 宿主未就绪'}
            </div>
            <Greeting />
            <p className="chat-hint">我会读取你存入的文件和对话，帮你把散落的信息连成知识。</p>
          </div>
        ) : (
          <div className="chat-msgs">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'msg user' : 'msg ai'}>
                <span className="m-avatar" aria-hidden="true">
                  {m.role === 'user' ? '我' : 'AI'}
                </span>
                <div className="m-bubble">{m.text}</div>
              </div>
            ))}

            {/* 「AI 正在做」：三段阶段回显，不是转圈（§6.3.1） */}
            {stage && (
              <div className="msg ai">
                <span className="m-avatar" aria-hidden="true">
                  AI
                </span>
                <div className="think">
                  {STAGES.map((s) => {
                    const idx = STAGES.findIndex((x) => x.key === stage);
                    const on = STAGES.findIndex((x) => x.key === s.key) <= idx;
                    return (
                      <div key={s.key} className={on ? 'think-step on' : 'think-step'}>
                        <span className="dot" />
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 失败不毁内容：只挂一条，东西没丢 */}
            {err && (
              <div className="msg-err">
                <div className="err-bar" role="alert">
                  <span className="eb-ico" aria-hidden="true">
                    <IconClose size={15} />
                  </span>
                  <div className="eb-body">
                    <b>{err.headline}</b>
                    <div className="err-detail">{err.detail} · 你那条消息没有丢，重试即可继续</div>
                  </div>
                  <div className="eb-actions">
                    <button type="button" className="ghost-btn" onClick={() => void send(lastRef.current)}>
                      重试
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 建议胶囊：只在空对话时出现 */}
        {empty && (
          <div className="suggest-row">
            {SUGGESTS.map((s) => (
              <button key={s.q} type="button" className="suggest" onClick={() => void send(s.q)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 输入区：不做遮罩、不锁输入（§6.3.4） */}
      <div className="composer">
        <div className="composer-box">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="问点什么，或让我帮你整理知识…"
          />
          <div className="composer-foot">
            <button className="tool-btn" title="附加文件" type="button">
              <IconPlus size={16} />
            </button>
            <button className="tool-btn" title="引用知识" type="button">
              <IconAt size={16} />
            </button>
            <span className="composer-meta">上下文：全库</span>
            <button
              className="send-btn"
              title="发送"
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void send(draft)}
            >
              <IconArrowUp size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
