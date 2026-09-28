import { useEffect, useState } from 'react';
import type { HealthPayload } from '../../shared/types';

/**
 * 确认「本地宿主在不在」。前端与宿主之间只有这一条通道（§9.1.3）。
 * 纯本地动作不加加载态（§6.2），所以首帧不显示骨架。
 */
export function useHostHealth(): HealthPayload | null {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const data = (await res.json()) as HealthPayload;
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth(null);
      }
    };
    void tick();
    const id = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return health;
}
