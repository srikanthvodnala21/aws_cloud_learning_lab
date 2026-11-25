import type { FlowDef } from './animation/flowTypes';

export type Level = 'Beginner' | 'Intermediate';

export type Scope = 'Global' | 'Regional' | 'Zonal' | 'Edge' | 'Account / Org' | 'Hybrid';

export interface Concept {
  term: string;
  body: string;
  facts?: string[];
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  /** Why the correct answer is correct */
  explain: string;
  /** Optional per-option explanation for wrong answers (same order as options) */
  why?: string[];
}

export interface CodeSample {
  title: string;
  lang: string;
  code: string;
  notes?: { key: string; text: string }[];
}

export interface DocLink {
  label: string;
  url: string;
}

export interface LearningModule {
  id: string;
  num: number;
  title: string;
  short: string;
  icon: string;
  level: Level;
  minutes: number;
  /** Beginner-friendly explanation */
  intro: string;
  analogy?: string;
  concepts: Concept[];
  animations: FlowDef[];
  /** key into the experiments registry */
  experiment?: string;
  experimentTitle?: string;
  experimentBlurb?: string;
  code?: CodeSample[];
  realWorld: { title: string; story: string; points: string[] };
  limits?: string[];
  summary: string[];
  related: string[];
  quiz: QuizQuestion[];
  docs: DocLink[];
}

export interface AwsService {
  id: string;
  name: string;
  short: string;
  category: string;
  scope: Scope;
  desc: string;
  module: string;
}
