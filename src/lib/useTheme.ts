import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'theme';

/** 主题：`<html data-theme>` + localStorage 记忆。首屏防闪白由 index.html 的内联脚本注入。 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* 隐私模式下写不进去，忽略 */
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
