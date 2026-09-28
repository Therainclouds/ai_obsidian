import { useEffect, useState } from 'react';
import { hostHealth } from '../api/host';
import type { HealthPayload } from '../../shared/types';

/**
 * 确认「本地宿主在不在」。宿主 = Electron 主进程，通道是 IPC（§9.1.3）。
 *
 * 纯本地动作不加加载态（§6.2），所以首帧不显示骨架 —— 它只是个 10 秒一次的探活。
 */
export function useHostHealth(): HealthPayload | null {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await hostHealth();
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
