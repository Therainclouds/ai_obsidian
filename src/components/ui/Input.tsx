import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 密钥类输入：单向，永不回显明文（ADR-0003 硬约束 1） */
  secret?: boolean;
}

export default function Input({ secret = false, className = '', ...rest }: InputProps) {
  return (
    <input
      type={secret ? 'password' : 'text'}
      autoComplete={secret ? 'off' : undefined}
      className={[
        'h-[34px] w-full rounded-md border border-line bg-surface px-2.5',
        'text-[13.5px] text-ink placeholder:text-ink-3',
        'transition-colors',
        'focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
