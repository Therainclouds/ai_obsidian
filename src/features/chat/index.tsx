import { useRef, useState } from 'react';
import Button from '../../components/ui/Button';

type Role = 'user' | 'assistant';
interface Msg {
  role: Role;
  text: string;
}
type Stage = { stage: string; label: string } | null;
type Err = { message: string; code: number | null } | null;

/**
 * 模块 ① · 聊天
 *
 * 走 DESIGN-SPEC §6.3 的三态规矩，而且是**真落地**不是占位：
 *  · 「AI 正在做」是一等状态（§6.3.1）—— 三段阶段回显，正对应演化记录的 trigger
 *  · 失败不毁内容（§6.3.4）—— 用户那条消息留在对话里，错误只在对应位置挂一条，
 *    输入框不锁、草稿不清空，出口是内联重试
 */
export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>(null);
  const [err, setErr] = useState<Err>(null);
  const lastRef = useRef('');

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    lastRef.current = t;

    setMsgs((m) => [...m, { role: 'user', text: t }]); // ① 用户写的先入列，之后绝不撤回
    setDraft(''); // ② 草稿清空只因为已发出，不因失败而丢
    setErr(null);
    setBusy(true);

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

          if (ev === 'stage') setStage(data as unknown as Stage);
          else if (ev === 'delta') {
            answer += String(data.text ?? '');
            setMsgs((m) => {
              const next = [...m];
              if (next.length && next[next.length - 1].role === 'assistant') {
                next[next.length - 1] = { role: 'assistant', text: answer };
              } else {
                next.push({ role: 'assistant', text: answer });
              }
              return next;
            });
          } else if (ev === 'error') {
            setErr({ message: String(data.message ?? '未知错误'), code: (data.code as number) ?? null });
          }
        }
      }
    } catch (e) {
      setErr({ message: (e as Error).message, code: null });
    } finally {
      setStage(null);
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="pt-6 text-[13px] text-ink-3">
            把想法丢进来。AI 会理解、建立关联，有价值的会被蒸馏成知识点。
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={[
                'max-w-[76%] whitespace-pre-wrap rounded-lg px-3.5 py-2 text-[13px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-brand text-brand-on'
                  : 'border border-line bg-surface text-ink',
              ].join(' ')}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* 「AI 正在做」：三段阶段回显，不是转圈（§6.3.1） */}
        {stage && (
          <div className="flex items-center gap-2 pl-1 text-[12px] text-ink-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            {stage.label}
            <span className="text-ink-3">…</span>
          </div>
        )}

        {/* 错误：只挂一条，陶色（零第四色 · D19）。东西没丢，出口是内联重试 */}
        {err && (
          <div className="rounded-lg border border-accent-mid bg-accent-soft px-3.5 py-2.5">
            <div className="text-[12.5px] text-accent-ink">{err.message}</div>
            <div className="mt-0.5 font-mono text-[11px] text-accent-ink opacity-80">
              {err.code !== null ? `acp · code ${err.code} · ` : ''}你那条消息没有丢，重试即可继续
            </div>
            <div className="mt-2">
              <Button size="sm" variant="attention" onClick={() => void send(lastRef.current)}>
                重试
              </Button>
            </div>
          </div>
        )}
      </div>

      <form
        className="mt-3 flex shrink-0 items-end gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          placeholder="说点什么… （Enter 发送，Shift+Enter 换行）"
          className="min-h-[34px] flex-1 resize-none rounded-md border border-line bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        />
        <Button variant="primary" disabled={busy || !draft.trim()} type="submit">
          {busy ? '进行中' : '发送'}
        </Button>
      </form>
    </div>
  );
}
