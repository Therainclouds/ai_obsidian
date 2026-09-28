/** @type {import('tailwindcss').Config} */
// Token → Tailwind 映射，照 DESIGN-SPEC §9.2。色值一律来自 palette-gen.py，禁止手改。
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        line: { DEFAULT: 'var(--line)', soft: 'var(--line-soft)' },
        brand: {
          DEFAULT: 'var(--brand)',
          deep: 'var(--brand-deep)',
          soft: 'var(--brand-soft)',
          ink: 'var(--brand-ink)',
          mid: 'var(--brand-mid)',
          on: 'var(--on-brand)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
          mid: 'var(--accent-mid)',
        },
        node: {
          1: 'var(--node-1)',
          2: 'var(--node-2)',
          3: 'var(--node-3)',
          4: 'var(--node-4)',
        },
      },
      borderRadius: {
        lg: 'var(--r-lg)',
        md: 'var(--r-md)',
        sm: 'var(--r-sm)',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(.22,1,.36,1)',
        quart: 'cubic-bezier(.25,1,.5,1)',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
