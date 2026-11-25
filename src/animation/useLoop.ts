import { useEffect, useRef, useState } from 'react';

/**
 * Returns a value t that loops 0 → 1 every `ms` milliseconds, plus a cycle counter.
 * Used by live simulators that re-render a FlowCanvas continuously.
 */
export function useLoop(ms: number, running = true) {
  const [state, setState] = useState({ t: 0, cycle: 0 });
  const start = useRef(performance.now());
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    start.current = performance.now() - state.t * ms;
    const tick = (now: number) => {
      const el = now - start.current;
      setState({ t: (el % ms) / ms, cycle: Math.floor(el / ms) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, running]);
  return state;
}

/** setInterval that always calls the latest callback */
export function useInterval(cb: () => void, ms: number | null) {
  const saved = useRef(cb);
  saved.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
