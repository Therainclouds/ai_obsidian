interface OrbProps {
  /** 原则 5：一个 AI，两个入口。小窗必须明示当前读的是哪一页。 */
  currentPage: string;
}

/** 全局 AI 悬浮球（§4.1：右下 58px，position fixed）。M0 只落位置与提示，小窗在 M5。 */
export default function Orb({ currentPage }: OrbProps) {
  return (
    <button
      type="button"
      aria-label={`打开 AI 小窗，当前页面：${currentPage}`}
      title={`已读取当前页面：${currentPage}`}
      className="fixed bottom-6 right-6 grid h-[58px] w-[58px] place-items-center rounded-full bg-brand text-brand-on shadow-3 transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className="font-display text-[18px] leading-none">
        ◉
      </span>
    </button>
  );
}
