import { useEffect, useRef, useState } from 'react';
import { IconArrowUp, IconAt, IconClose, IconPlus } from '../../components/icons';
import {
  AGENT_DELTA,
  AGENT_DONE,
  AGENT_ERROR,
  AGENT_STAGE,
  AGENT_STAGE_LABEL,
  AGENT_STAGE_ORDER,
  HOST_ERROR,
  type AgentStageKey,
} from '../../../shared/events';
import {
  agentChat,
  agentStatus,
  createConversation,
  getConversation,
  listConversations,
  statsSummary,
} from '../../api/host';
import { useHost } from '../../lib/useHost';
import type { Conversation, ConversationMessage, StatsSummary } from '../../../shared/types';

interface ErrShape {
  headline: string;
  detail: string;
}

/** 「AI 正在做」的三段，正对应演化记录的 trigger（§6.3.1）。顺序与文案都由 shared 定 */
const STAGES = AGENT_STAGE_ORDER.map((key) => ({ key, label: AGENT_STAGE_LABEL[key] }));

/** 宿主推来的 stage 字段先校验，不信任跨进程传来的字符串 */
function isAgentStage(v: unknown): v is AgentStageKey {
  return typeof v === 'string' && (AGENT_STAGE_ORDER as readonly string[]).includes(v);
}

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
 * **对话历史是真的**（D38）：消息由**宿主**写进对话历史，页面只读它。
 * 页面**不自己 append** —— 白名单里没有那个方法。这一条是刻意的：
 * 若渲染器也能写历史，它的本地副本与真实历史就能分叉，而"分叉之后谁对"没有答案。
 *
 * 走 DESIGN-SPEC §6.3 的三态规矩，而且是**真落地**：
 *  · 「AI 正在做」是一等状态（§6.3.1）—— 三段阶段回显
 *  · 失败不毁内容（§6.3.4）—— 用户那条消息**在跑 agent 之前就已写进历史**，
 *    所以失败时它一定还在（宿主那边保证）；草稿不清空、输入框不锁，出口是内联重试
 *
 * ⚠ **本轮没做的两处**（都需要新视觉，原型里没有，待设计确认）：
 *  · **对话历史左栏**（D39）—— 定了"默认收起的左栏"，但没定**怎么展开**。
 *    目标机是**触控**，没有 hover，所以"收起态与原型逐像素一致"这条**无法与
 *    "用户能发现入口"同时成立**。这一处要设计裁决。
 *  · **「依据」卡片**（D41）—— 原型占位回复里写着"正式版会给出可点开的依据卡片"，
 *    也就是原型里没有它的样式，同样要设计。
 * 两者都不影响本页现在能真跑：对话历史在写、在存、在显示。
 */
export default function ChatPage() {
  const [convId, setConvId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<AgentStageKey | null>(null);
  const [err, setErr] = useState<ErrShape | null>(null);
  const [agentReady, setAgentReady] = useState(false);
  /** 这一轮**正在发**的那句话。宿主的副本要等结束后才读得到，所以先在本地说一次 */
  const [inFlight, setInFlight] = useState<string | null>(null);
  /** 正在流式回来的回答（半截，不落历史 —— 它是草稿，不是发生过的事） */
  const [streamText, setStreamText] = useState('');
  const lastRef = useRef('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const convsQ = useHost('conversations', listConversations, [] as Conversation[]);
  const msgsQ = useHost(
    `conversation:${convId ?? ''}`,
    async () => (convId ? getConversation(convId) : ([] as ConversationMessage[])),
    [] as ConversationMessage[],
  );
  const statsQ = useHost<StatsSummary | null>('stats', statsSummary, null);

  // 首次进来落到**最近那段**对话上 —— 历史是要看的，不该默认空着
  useEffect(() => {
    if (convId === null && convsQ.data.length > 0) setConvId(convsQ.data[0].id);
  }, [convId, convsQ.data]);

  useEffect(() => {
    void agentStatus()
      .then((d) => setAgentReady(Boolean(d.initialized)))
      .catch(() => setAgentReady(false));
  }, []);

  const history = msgsQ.data;

  /**
   * 发一轮。流是**推**来的（宿主分多次往回推），所以"结束"由事件决定，不由 await 决定。
   *
   * 必须**先有对话**再说话：宿主得有个门牌号才知道往哪写历史。
   * 第一句话之前没有对话，就先建一个 —— 这一步在这里做而不是在宿主里，
   * 是因为"要不要新开一段"是**用户的意图**，不该由宿主替他决定。
   */
  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;

    let target = convId;
    if (!target) {
      try {
        const conv = await createConversation();
        target = conv.id;
        setConvId(conv.id);
        convsQ.reload();
      } catch (e) {
        setErr({ headline: (e as Error).message, detail: 'host' });
        return;
      }
    }

    lastRef.current = t;
    setInFlight(t);
    setStreamText('');
    setDraft(''); // 草稿清空只因为已发出，不因失败而丢
    setErr(null);
    setBusy(true);
    setStage('reading');

    const finish = () => {
      setStage(null);
      setBusy(false);
      setInFlight(null);
      setStreamText('');
      // **以宿主为准**重新读一遍：它才是历史的作者，本地那份只是过程中的临时显示
      msgsQ.reload();
      convsQ.reload();
      taRef.current?.focus();
    };

    try {
      agentChat(t, target, (event, data) => {
        const d = data as Record<string, unknown>;

        if (event === AGENT_STAGE) {
          if (isAgentStage(d.stage)) setStage(d.stage);
          return;
        }
        if (event === AGENT_DELTA) {
          setStreamText((s) => s + String(d.text ?? ''));
          return;
        }
        if (event === AGENT_DONE) {
          finish();
          return;
        }
        if (event === AGENT_ERROR) {
          setErr({
            headline: String(d.message ?? '未知错误'),
            detail: d.code !== null && d.code !== undefined ? `acp · code ${d.code}` : 'acp',
          });
          finish();
          return;
        }
        if (event === HOST_ERROR) {
          setErr({ headline: String(d.message ?? '宿主没有响应'), detail: 'host' });
          finish();
        }
      });
    } catch (e) {
      // 同步抛出的那类：不在桌面壳里、网桥没挂上
      setErr({ headline: (e as Error).message, detail: 'host' });
      finish();
    }
  }

  const empty = history.length === 0 && inFlight === null;

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
              {agentReady
                ? `AI 就绪 · 已索引 ${statsQ.data?.materialCount ?? 0} 个文件 · ${
                    statsQ.data?.establishedAssociationCount ?? 0
                  } 条关联`
                : 'AI 未连接 · 宿主未就绪'}
            </div>
            <Greeting />
            <p className="chat-hint">我会读取你存入的文件和对话，帮你把散落的信息连成知识。</p>
          </div>
        ) : (
          <div className="chat-msgs show">
            {history.map((m, i) => (
              <div key={`h${i}`} className={m.role === 'user' ? 'msg user' : 'msg ai'}>
                <span className="m-avatar" aria-hidden="true">
                  {m.role === 'user' ? '我' : 'AI'}
                </span>
                <div className="m-bubble">{m.text}</div>
              </div>
            ))}

            {/* 本轮发出去的那句：宿主已经写了，但它要等这轮结束才读得到，先在本地说一次 */}
            {inFlight !== null && (
              <div className="msg user">
                <span className="m-avatar" aria-hidden="true">
                  我
                </span>
                <div className="m-bubble">{inFlight}</div>
              </div>
            )}

            {streamText && (
              <div className="msg ai">
                <span className="m-avatar" aria-hidden="true">
                  AI
                </span>
                <div className="m-bubble">{streamText}</div>
              </div>
            )}

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
