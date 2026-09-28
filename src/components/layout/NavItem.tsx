interface NavItemProps {
  icon: string;
  name: string;
  /** 一句话解释。原则 2：任何一级入口都必须自带解释，不允许只放名词。 */
  desc: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ icon, name, desc, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'group w-full text-left rounded-md px-3 py-2 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      <span className="flex items-baseline gap-2">
        <span aria-hidden="true" className="font-mono text-[13px] opacity-70">
          {icon}
        </span>
        <span className="text-[13.5px] font-medium">{name}</span>
      </span>
      <span className="mt-0.5 block pl-[22px] text-[11.5px] leading-snug text-ink-3">{desc}</span>
    </button>
  );
}
