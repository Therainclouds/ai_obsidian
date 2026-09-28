import { useEffect, useState } from 'react';

/**
 * 从 CSS 变量里读出**当前主题下**的真实色值。
 *
 * 为什么不在代码里写死十六进制：色值只由 `design/palette-gen.py` 生成（原则 4，
 * 「颜色由算法派生，不手工挑色」）。写死一份等于把 token 复制到 JS 里，
 * 换主色时就会有一处悄悄不同步。这里直接问浏览器要。
 */
export function useTokenHex(varNames: string[]): Record<string, string> {
  const [hex, setHex] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const n of varNames) next[n] = cs.getPropertyValue(n).trim().toUpperCase();
      setHex(next);
    };
    read();

    // 主题切换是改 <html data-theme>，属性变化即可重读
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varNames.join(',')]);

  return hex;
}
