import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'attention';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/**
 * 状态语义色走三色，不引入红绿黄（D19）：
 * 成功/行动 = 主色 · 需注意·失败·待配置 = 点缀色 · 中性 = 墨灰。
 */
const VARIANTS: Record<Variant, string> = {
  // 暗色下主色是浅色，因此文字必须用 --on-brand，不能写死 #fff（D10）
  primary: 'bg-brand text-brand-on hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  attention: 'bg-accent text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-[30px] px-2.5 text-[12.5px]',
  md: 'h-[34px] px-3.5 text-[13.5px]',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      // 触控热区 ≥44px：小按钮用 ::after 补一层不可见热区（§8）
      className={[
        'relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium',
        'transition-[opacity,background-color,color] duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'after:absolute after:-inset-[7px] after:content-[""] sm:after:hidden',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
