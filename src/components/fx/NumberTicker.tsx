import { useEffect, useState } from 'react';

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

interface NumberTickerProps {
  value: number;
  /** 小数位 */
  dec?: number;
}

/**
 * 数字滚动（§7.4 动效表：rAF + easeOutQuart，900–1200ms）。
 *
 * `duration` 带随机抖动，与原型一致 —— 四张统计卡同时停在整数上会显得机械。
 * 组件挂载即开始，所以「每次进入重播」是靠页面重挂载实现的（App 的 `key={active}`）。
 */
export default function NumberTicker({ value, dec = 0 }: NumberTickerProps) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const duration = 900 + Math.random() * 300;
    const t0 = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setShown(p < 1 ? value * easeOutQuart(p) : value);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown.toFixed(dec)}</>;
}
