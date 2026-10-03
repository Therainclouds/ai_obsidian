/**
 * 从宿主取数的小 hook。
 *
 * **为什么不引 TanStack Query**：§9.1 定的状态方案里确实有它，但它要等"写操作 + 缓存失效"
 * 成为真问题才划算。现在只有读，且每次改动都靠 `reload()` 显式重取 —— 一个 60 行的 hook
 * 就够，而**多一个依赖要一直养着**（ADR-0004 §1）。
 *
 * 用 `key` 而不是 deps 数组：`key` 是**字符串**，它必须唯一地描述这次查询的参数。
 * 写错一个数组字面量（少一个元素）不会报错，只会静默不刷新 —— 那种 bug 很难查。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface HostQuery<T> {
  data: T;
  /** 宿主抛回来的原因。**可以直接给用户看** —— 宿主的报错本来就是中文的 */
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useHost<T>(key: string, load: () => Promise<T>, initial: T): HostQuery<T> {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // load 每次渲染都是新函数，用 ref 拿最新的一版，避免把它塞进依赖
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRef
      .current()
      .then((v) => {
        if (!alive) return;
        setData(v);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // key 唯一决定这次查询；tick 用来手动重取
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
