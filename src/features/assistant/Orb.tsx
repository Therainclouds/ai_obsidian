import { useEffect, useState } from 'react';

interface OrbProps {
  /** 原则 5：一个 AI，两个入口。小窗必须明示当前读的是哪一页。 */
  currentPage: string;
}

/**
 * 全局 AI 悬浮球（§4.1：右下 58px，position fixed）。
 * M0 只落球体、角标与一次性引导气泡；聊天小窗在 M5 的后续里接。
 */
export default function Orb({ currentPage }: OrbProps) {
  const [hint, setHint] = useState(false);

  // 首次进入 1.1s 后浮现，4.6s 后消失（原型）
  useEffect(() => {
    const show = setTimeout(() => setHint(true), 1100);
    const hide = setTimeout(() => setHint(false), 1100 + 4600);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="ai-fab"
        aria-label={`打开 AI 助手，当前页面：${currentPage}`}
        aria-haspopup="dialog"
        aria-expanded={false}
      >
        <span className="fab-orb" aria-hidden="true" />
        <span className="fab-badge">1</span>
      </button>
      <div className={hint ? 'fab-hint show' : 'fab-hint'}>点我 · 我会读懂你当前这一页</div>
    </>
  );
}
