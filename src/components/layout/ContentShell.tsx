import type { ReactNode } from 'react';

interface ContentShellProps {
  title: string;
  desc: string;
  actions?: ReactNode;
  /** 聊天页是居中满屏的，没有页头（对齐原型 #page-chat） */
  header?: boolean;
  /** false = 页面自己管布局与滚动（左右分栏 / 需要占满高度的页面用） */
  scroll?: boolean;
  /**
   * `scroll=false` 时**叠加**在 `.p-body` 上的页面类（设置页 `settings-body`、文件页 `files-body`）。
   *
   * ⚠ 它是**叠加**不是替换 —— 原型写的是 `#page-files .p-body{...}`，也就是说
   * `.p-body` 一直在场，页面类只加"左右分栏 + 顶边框"这几条。
   * 撑开高度的是 `.p-body{flex:1;min-height:0}`；把它换掉，页面就只剩内容的高度
   * ——文件页的关联图被压成一小块、视图区冒滚动条，就是这么来的。
   */
  bodyClass?: string;
  children: ReactNode;
}

/** 页头（标题 / 说明 / 操作）+ 页身。对齐原型的 .p-head / .p-body / .p-scroll */
export default function ContentShell({
  title,
  desc,
  actions,
  header = true,
  scroll = true,
  bodyClass,
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
        // 有页面类 → `.p-body` 打底 + 页面类叠加；没有 → 用 p-body-col（聊天页那种自管布局）
        <div className={bodyClass ? `p-body ${bodyClass}` : 'p-body-col'}>{children}</div>
      )}
    </>
  );
}
