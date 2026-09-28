interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** 副说明。一级入口必须有解释（原则 2），开关也一样 */
  desc?: string;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, label, desc, disabled }: SwitchProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative mt-[3px] h-[20px] w-[34px] shrink-0 rounded-full border transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          'disabled:cursor-not-allowed disabled:opacity-45',
          checked ? 'border-brand bg-brand' : 'border-line bg-surface-2',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all duration-150',
            checked ? 'left-[17px] bg-brand-on' : 'left-[2px] bg-ink-3',
          ].join(' ')}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ink">{label}</span>
        {desc && <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">{desc}</span>}
      </span>
    </label>
  );
}
