import type { ReactNode } from 'react';

interface ContentShellProps {
  title: string;
  desc: string;
  actions?: ReactNode;
  /** 聊天页是居中满屏的，没有页头（对齐原型 #page-chat） */
  header?: boolean;
  /** false = 页面自己管布局与滚动（左右分栏 / 需要占满高度的页面用） */
  scroll?: boolean;
  children: ReactNode;
}

/** 页头（标题 / 说明 / 操作）+ 页身。对齐原型的 .p-head / .p-body / .p-scroll */
export default function ContentShell({
  title,
  desc,
  actions,
  header = true,
  scroll = true,
  children,
}: ContentShellProps) {
  return (
    <>
      {header && (
        <div className="p-head">
          <span className="p-title">{title}</span>
          <span className="p-desc">{desc}</span>
          {actions && <div className="p-actions">{actions}</div>}
        </div>
      )}
      {scroll ? (
        <div className="p-body">
          <div className="p-scroll">{children}</div>
        </div>
      ) : (
        <div className="p-body-col">{children}</div>
      )}
    </>
  );
}
