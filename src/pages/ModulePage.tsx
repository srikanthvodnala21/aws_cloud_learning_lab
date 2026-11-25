import { Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, FlaskConical } from 'lucide-react';
import { MODULES, MODULE_MAP } from '../content/modules';
import { SERVICE_MAP } from '../data/services';
import { useProgress } from '../store/progress';
import { Badge, Callout, CodeBlock, Loading, SectionTitle, SimNote } from '../components/ui';
import { Icon } from '../components/icons';
import { FlowPlayer } from '../animation/FlowPlayer';
import { Quiz } from '../components/Quiz';
import { EXPERIMENTS } from '../experiments/registry';
import NotFound from './NotFound';

const SECTIONS = [
  ['overview', 'Overview'],
  ['concepts', 'Concepts'],
  ['animations', 'Animations'],
  ['experiment', 'Experiment'],
  ['code', 'Examples'],
  ['real-world', 'Real world'],
  ['quiz', 'Quiz'],
  ['summary', 'Summary'],
] as const;

export default function ModulePage() {
  const { id = '' } = useParams();
  // remount per module so quiz answers, animation choice etc. reset
  return <ModuleContent key={id} id={id} />;
}

function ModuleContent({ id }: { id: string }) {
  const m = MODULE_MAP[id];
  const [params] = useSearchParams();
  const loc = useLocation();
  const { completed, toggleComplete, markVisited, experiments, markExperiment } = useProgress();
  const [anim, setAnim] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (m) markVisited(m.id);
    setAnim(0);
  }, [m, markVisited]);

  useEffect(() => {
    const c = params.get('c');
    if (c !== null) {
      setOpen(Number(c));
      setTimeout(() => document.getElementById(`concept-${c}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    } else setOpen(null);
  }, [params, id]);

  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 120);
  }, [loc.hash, id]);

  if (!m) return <NotFound />;
  const idx = MODULES.indexOf(m);
  const prev = MODULES[idx - 1];
  const next = MODULES[idx + 1];
  const done = completed.includes(m.id);
  const Experiment = m.experiment ? EXPERIMENTS[m.experiment] : undefined;
  const expDone = m.experiment ? experiments.includes(m.experiment) : false;

  return (
    <div>
      <div className="mb-1 text-[12px] text-muted">
        <Link to="/modules" className="hover:text-ink">
          Modules
        </Link>{' '}
        / Module {m.num}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name={m.icon} size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">{m.title}</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={m.level === 'Beginner' ? 'ok' : 'sky'}>{m.level}</Badge>
              <Badge>{m.minutes} min</Badge>
              <Badge>{m.animations.length} animations</Badge>
              {m.experiment && <Badge tone="violet">Interactive simulator</Badge>}
              <Badge>{m.quiz.length}-question quiz</Badge>
            </div>
          </div>
        </div>
        <button className={`btn ${done ? 'btn-active' : 'btn-primary'}`} onClick={() => toggleComplete(m.id)}>
          <CircleCheck size={15} /> {done ? 'Completed' : 'Mark module complete'}
        </button>
      </div>

      <nav className="sticky top-0 z-10 -mx-2 mt-5 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-2 py-2 backdrop-blur">
        {SECTIONS.filter(([k]) => (k === 'experiment' ? !!m.experiment : k === 'code' ? !!m.code?.length : true)).map(([k, label]) => (
          <button key={k} className="btn btn-sm" onClick={() => document.getElementById(k)?.scrollIntoView({ behavior: 'smooth' })}>
            {label}
          </button>
        ))}
      </nav>

      <SectionTitle id="overview">Overview</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5 text-[14.5px] leading-relaxed">{m.intro}</div>
        {m.analogy && (
          <Callout kind="tip" title="Everyday analogy">
            {m.analogy}
          </Callout>
        )}
      </div>

      <SectionTitle id="concepts" sub="Click a concept to expand it.">
        Key concepts
      </SectionTitle>
      <div className="grid gap-2 md:grid-cols-2">
        {m.concepts.map((c, i) => {
          const isOpen = open === i;
          return (
            <div id={`concept-${i}`} key={c.term} className={`card transition-colors ${isOpen ? 'border-accent/60' : ''}`}>
              <button className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : i)}>
                <span className="text-[14px] font-medium">{c.term}</span>
                <span className={`text-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-[13.5px] leading-relaxed text-muted prose-lab">
                  <p>{c.body}</p>
                  {c.facts && (
                    <ul className="mt-2 space-y-1">
                      {c.facts.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="text-accent">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SectionTitle id="animations" sub="Each animation is step-by-step: play, pause, slow down, or step through and read what happens at each stage.">
        Animated demonstrations
      </SectionTitle>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {m.animations.map((a, i) => (
          <button key={a.id} className={`btn btn-sm ${anim === i ? 'btn-active' : ''}`} onClick={() => setAnim(i)}>
            {a.title}
          </button>
        ))}
      </div>
      {m.animations[anim] && <FlowPlayer key={m.animations[anim].id} def={m.animations[anim]} />}

      {Experiment && (
        <>
          <SectionTitle id="experiment" sub={m.experimentBlurb}>
            <span className="flex items-center gap-2">
              <FlaskConical size={18} className="text-violet" /> Interactive experiment: {m.experimentTitle}
            </span>
          </SectionTitle>
          <div className="mb-3">
            <SimNote />
          </div>
          <Suspense fallback={<Loading />}>
            <Experiment />
          </Suspense>
          <div className="mt-3 flex justify-end">
            <button className={`btn btn-sm ${expDone ? 'btn-active' : ''}`} onClick={() => markExperiment(m.experiment!)}>
              <CircleCheck size={13} /> {expDone ? 'Experiment completed' : 'Mark experiment completed'}
            </button>
          </div>
        </>
      )}

      {m.code && m.code.length > 0 && (
        <>
          <SectionTitle id="code" sub="Real configuration examples with each element explained.">
            Examples
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {m.code.map((c) => (
              <div key={c.title} className="space-y-2">
                <div className="text-[13px] font-semibold">{c.title}</div>
                <CodeBlock code={c.code} lang={c.lang} />
                {c.notes && (
                  <div className="card divide-y divide-line">
                    {c.notes.map((nn) => (
                      <div key={nn.key} className="flex gap-3 px-3 py-2 text-[12.5px]">
                        <code className="mono text-sky shrink-0 min-w-24">{nn.key}</code>
                        <span className="text-muted">{nn.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle id="real-world">Real-world example</SectionTitle>
      <div className="card p-5">
        <div className="font-semibold">{m.realWorld.title}</div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{m.realWorld.story}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.realWorld.points.map((pt) => (
            <Badge key={pt} tone="accent">
              {pt}
            </Badge>
          ))}
        </div>
      </div>
      {m.limits && (
        <div className="mt-3">
          <Callout kind="warn" title="Important limits & gotchas">
            <ul className="space-y-1">
              {m.limits.map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      <SectionTitle id="quiz" sub="Explanations appear for both correct and incorrect answers. Your best score is saved.">
        Knowledge check
      </SectionTitle>
      <Quiz id={m.id} questions={m.quiz} />

      <SectionTitle id="summary">Summary</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <ul className="space-y-2 text-[13.5px]">
            {m.summary.map((s) => (
              <li key={s} className="flex gap-2">
                <CircleCheck size={15} className="mt-0.5 shrink-0 text-ok" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label mb-2">Related AWS services</div>
            <div className="flex flex-wrap gap-2">
              {m.related.map((sid) => {
                const s = SERVICE_MAP[sid];
                if (!s) return null;
                return (
                  <Link key={sid} to={`/modules/${s.module}`} title={s.desc} className="rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-[12px] hover:border-faint">
                    <span className="font-medium">{s.short}</span> <span className="text-faint">· {s.scope}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="card p-5">
            <div className="label mb-2">Official AWS documentation</div>
            <ul className="space-y-1.5 text-[13px]">
              {m.docs.map((d) => (
                <li key={d.url}>
                  <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky hover:underline">
                    {d.label} <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between gap-3 border-t border-line pt-5">
        {prev ? (
          <Link to={`/modules/${prev.id}`} className="btn">
            <ArrowLeft size={14} /> {prev.num}. {prev.short}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/modules/${next.id}`} className="btn btn-primary">
            {next.num}. {next.short} <ArrowRight size={14} />
          </Link>
        ) : (
          <Link to="/scenarios" className="btn btn-primary">
            Scenario Lab <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
