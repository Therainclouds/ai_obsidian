/**
 * 图标 —— 逐条从 design/prototype/index-final.html 的 markup 抄过来（尺寸 / viewBox / stroke 全同）。
 * 原型是唯一基准，不要在这里自创形状。
 */
type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'aria-hidden': true as const,
});

export const IconChat = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z" />
  </svg>
);

export const IconFiles = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

export const IconGraph = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <circle cx="6" cy="7" r="2.6" />
    <circle cx="18" cy="7" r="2.6" />
    <circle cx="12" cy="18" r="2.6" />
    <path d="M8.2 8.6l2.6 7M15.8 8.6l-2.6 7M8.6 7h6.8" />
  </svg>
);

export const IconSummary = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);

export const IconSettings = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14.6H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 7a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.4V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.3 1.8v.1a1.6 1.6 0 001.5 1h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
  </svg>
);

/** 知识空间标记（六边形立方体） */
export const IconSpace = ({ size = 15 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinejoin="round">
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);

export const IconCaret = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2} strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconSun = ({ size = 15 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = ({ size = 15 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

export const IconPlus = ({ size = 17 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconAt = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8" />
  </svg>
);

export const IconArrowUp = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2} strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

/** 悬浮球的引导气泡里那个小箭头 */
export const IconClose = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2} strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
