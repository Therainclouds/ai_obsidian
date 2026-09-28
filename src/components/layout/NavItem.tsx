import type { ComponentType } from 'react';

interface NavItemProps {
  Icon: ComponentType<{ size?: number }>;
  name: string;
  /** 一句话解释。原则 2：任何一级入口都必须自带解释，不允许只放名词。 */
  desc: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ Icon, name, desc, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={['nav-item', active ? 'active' : ''].join(' ')}
    >
      <Icon size={17} />
      <span className="nav-text">
        <b>{name}</b>
        <small>{desc}</small>
      </span>
    </button>
  );
}
