import { useEffect, useState } from 'react';

/**
 * 进度条 / 热度柱的生长开关（§7.4 动效表：`width` / `scaleY` 过渡，quart 缓动）。
 *
 * 首帧渲染成"未生长"，下一帧再翻成"已生长"——CSS 里的 `transition` 于是有起止两态可插值。
 * 若直接以终态渲染，浏览器只看到一次初始计算，过渡不会播。
 * 挂载即触发，因此「每次进入重播」由页面重挂载实现（App 的 `key={active}`）。
 */
export default function useGrow() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return grown;
}
