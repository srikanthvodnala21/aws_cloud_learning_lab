import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

export interface Timeline {
  step: number;
  t: number; // 0..1 progress inside current step
  playing: boolean;
  auto: boolean; // auto-advance to next step
  speed: number;
  play: () => void;
  pause: () => void;
  restart: () => void;
  next: () => void;
  prev: () => void;
  goto: (i: number) => void;
  setSpeed: (s: number) => void;
  done: boolean;
}

/**
 * requestAnimationFrame-driven timeline.
 * - play: runs and auto-advances through steps
 * - next/prev: runs only that step then pauses (step-by-step execution)
 * - speed: multiplier (0.25 = slow motion)
 */
export function useTimeline(durations: number[], opts: { autoStart?: boolean } = {}): Timeline {
  const count = durations.length;
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!!opts.autoStart);
  const [auto, setAuto] = useState(true);
  const [speed, setSpeed] = useState(1);

  const ref = useRef({ step: 0, t: 0, playing: !!opts.autoStart, auto: true, speed: 1 });
  ref.current.speed = speed;

  const durRef = useRef(durations);
  durRef.current = durations;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const r = ref.current;
      const d = durRef.current[r.step] ?? 2600;
      let nt = r.t + (dt * r.speed) / d;
      let ns = r.step;
      let stillPlaying = true;
      if (nt >= 1) {
        if (r.auto && ns < durRef.current.length - 1) {
          ns += 1;
          nt = 0;
        } else {
          nt = 1;
          stillPlaying = false;
        }
      }
      r.t = nt;
      r.step = ns;
      setT(nt);
      setStep(ns);
      if (!stillPlaying) {
        r.playing = false;
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const apply = useCallback((s: number, nt: number, p: boolean, a: boolean) => {
    ref.current.step = s;
    ref.current.t = nt;
    ref.current.auto = a;
    ref.current.playing = p;
    setStep(s);
    setT(nt);
    setAuto(a);
    setPlaying(p);
  }, []);

  const play = useCallback(() => {
    const r = ref.current;
    const atEnd = r.step >= count - 1 && r.t >= 1;
    if (atEnd) apply(0, 0, true, true);
    else if (r.t >= 1 && r.step < count - 1) apply(r.step + 1, 0, true, true);
    else apply(r.step, r.t, true, true);
  }, [apply, count]);

  const pause = useCallback(() => {
    ref.current.playing = false;
    setPlaying(false);
  }, []);

  const restart = useCallback(() => apply(0, 0, true, true), [apply]);
  const next = useCallback(() => {
    const r = ref.current;
    if (r.t < 1 && !r.playing) apply(r.step, r.t, true, false); // finish current step first
    else apply(Math.min(count - 1, r.step + 1), 0, true, false);
  }, [apply, count]);
  const prev = useCallback(() => apply(Math.max(0, ref.current.step - 1), 0, true, false), [apply]);
  const goto = useCallback((i: number) => apply(Math.max(0, Math.min(count - 1, i)), 0, true, false), [apply, count]);

  return {
    step,
    t,
    playing,
    auto,
    speed,
    play,
    pause,
    restart,
    next,
    prev,
    goto,
    setSpeed,
    done: step >= count - 1 && t >= 1,
  };
}
