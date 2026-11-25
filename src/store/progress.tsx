import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Learning progress lives entirely in the browser (localStorage).
 * No account, no backend. Clearing site data resets it.
 */
const KEY = 'aws-lab-progress-v1';

export interface QuizResult {
  score: number;
  total: number;
  at: number;
}

export interface ProgressState {
  completed: string[]; // module ids
  visited: { id: string; at: number }[]; // recently explored (modules, scenarios, pages)
  experiments: string[]; // experiment / scenario ids completed
  quizzes: Record<string, QuizResult>;
  theme: 'dark' | 'light';
}

const initial: ProgressState = {
  completed: [],
  visited: [],
  experiments: [],
  quizzes: {},
  theme: 'dark',
};

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return { ...initial, ...parsed };
  } catch {
    return initial;
  }
}

interface Ctx extends ProgressState {
  toggleComplete: (id: string) => void;
  markVisited: (id: string) => void;
  markExperiment: (id: string) => void;
  saveQuiz: (id: string, score: number, total: number) => void;
  setTheme: (t: 'dark' | 'light') => void;
  reset: () => void;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or disabled – progress just won't persist */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', state.theme === 'light');
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  const toggleComplete = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.includes(id) ? s.completed.filter((c) => c !== id) : [...s.completed, id],
    }));
  }, []);

  const markVisited = useCallback((id: string) => {
    setState((s) => {
      if (s.visited[0]?.id === id) return s;
      const rest = s.visited.filter((v) => v.id !== id);
      return { ...s, visited: [{ id, at: Date.now() }, ...rest].slice(0, 12) };
    });
  }, []);

  const markExperiment = useCallback((id: string) => {
    setState((s) => (s.experiments.includes(id) ? s : { ...s, experiments: [...s.experiments, id] }));
  }, []);

  const saveQuiz = useCallback((id: string, score: number, total: number) => {
    setState((s) => {
      const prev = s.quizzes[id];
      // keep best score
      if (prev && prev.score >= score) return { ...s, quizzes: { ...s.quizzes, [id]: { ...prev, at: Date.now() } } };
      return { ...s, quizzes: { ...s.quizzes, [id]: { score, total, at: Date.now() } } };
    });
  }, []);

  const setTheme = useCallback((theme: 'dark' | 'light') => setState((s) => ({ ...s, theme })), []);
  const reset = useCallback(() => setState((s) => ({ ...initial, theme: s.theme })), []);

  const value = useMemo(
    () => ({ ...state, toggleComplete, markVisited, markExperiment, saveQuiz, setTheme, reset }),
    [state, toggleComplete, markVisited, markExperiment, saveQuiz, setTheme, reset],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
