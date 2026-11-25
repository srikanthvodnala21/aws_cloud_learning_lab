import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheck, Clock } from 'lucide-react';
import { MODULES, MODULE_MAP } from '../content/modules';
import { ROADMAP } from '../content/roadmap';
import { SERVICES } from '../data/services';
import { SCENARIOS, SCENARIO_MAP } from '../data/scenarios';
import { useProgress } from '../store/progress';
import { Badge, ProgressBar, SectionTitle, Stat } from '../components/ui';
import { Icon } from '../components/icons';
import { FlowPlayer } from '../animation/FlowPlayer';
import { globalInfra } from '../content/modules/m02-global';

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export default function Dashboard() {
  const { completed, visited, experiments, quizzes, toggleComplete, reset } = useProgress();
  const pct = completed.length / MODULES.length;
  const currentStage = ROADMAP.find((s) => s.modules.some((m) => !completed.includes(m))) ?? ROADMAP[ROADMAP.length - 1];
  const orderedModules = ROADMAP.flatMap((s) => s.modules);
  const nextModules = orderedModules.filter((m) => !completed.includes(m)).slice(0, 3);
  const quizVals = Object.values(quizzes);
  const avgQuiz = quizVals.length ? Math.round((quizVals.reduce((a, q) => a + q.score / q.total, 0) / quizVals.length) * 100) : null;
  const totalExperiments = MODULES.filter((m) => m.experiment).length + SCENARIOS.length;
  const heroAnim = globalInfra.animations.find((a) => a.id === 'm2-failover')!;

  return (
    <div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr] items-start">
        <div className="pt-2">
          <Badge tone="accent">Interactive · browser-only · free</Badge>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Don’t just read how AWS works.
            <br />
            <span className="text-accent">Watch it. Break it. Fix it.</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted max-w-xl">
            {MODULES.length} modules, {MODULES.reduce((a, m) => a + m.animations.length, 0)} step-by-step animations, {MODULES.filter((m) => m.experiment).length} interactive simulators, {SCENARIOS.length} real-world scenarios and an architecture playground – all simulated locally in your browser. Progress is saved on this device.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={`/modules/${nextModules[0] ?? 'cloud-fundamentals'}`} className="btn btn-primary">
              {completed.length ? 'Continue learning' : 'Start with Module 1'} <ArrowRight size={15} />
            </Link>
            <Link to="/playground" className="btn">
              <Icon name="puzzle" size={15} /> Open the playground
            </Link>
            <Link to="/roadmap" className="btn">
              <Icon name="map" size={15} /> View roadmap
            </Link>
          </div>
        </div>
        <FlowPlayer def={heroAnim} compact autoStart />
      </div>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="AWS services covered" value={SERVICES.length} hint={`across ${MODULES.length} modules`} />
        <Stat label="Learning progress" value={`${Math.round(pct * 100)}%`} hint={<ProgressBar value={pct} className="mt-2" />} tone="var(--color-accent)" />
        <Stat label="Completed modules" value={`${completed.length}/${MODULES.length}`} hint={avgQuiz !== null ? `avg quiz score ${avgQuiz}%` : 'no quizzes taken yet'} />
        <Stat label="Experiments completed" value={`${experiments.length}/${totalExperiments}`} hint="simulators + scenarios" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="label">Current learning path</div>
              <div className="mt-1 text-lg font-semibold">
                Step {currentStage.step}: {currentStage.title}
              </div>
              <p className="text-[13px] text-muted mt-0.5">{currentStage.why}</p>
            </div>
            <Link to="/roadmap" className="btn btn-sm">
              Roadmap <ArrowRight size={13} />
            </Link>
          </div>
          <div className="mt-4 flex gap-1">
            {ROADMAP.map((s) => {
              const done = s.modules.every((m) => completed.includes(m));
              const cur = s.step === currentStage.step;
              return <div key={s.step} title={`${s.step}. ${s.title}`} className={`h-2 flex-1 rounded-full ${done ? 'bg-ok' : cur ? 'bg-accent' : 'bg-panel3'}`} />;
            })}
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            {currentStage.modules.map((id) => {
              const m = MODULE_MAP[id];
              const done = completed.includes(id);
              return (
                <div key={id} className="flex items-center gap-3 rounded-lg border border-line bg-panel2 p-3">
                  <Icon name={m.icon} size={18} className="text-accent" />
                  <Link to={`/modules/${id}`} className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{m.title}</div>
                    <div className="text-[11px] text-muted">
                      {m.level} · {m.minutes} min
                    </div>
                  </Link>
                  <button className={`btn btn-sm ${done ? 'btn-active' : ''}`} onClick={() => toggleComplete(id)}>
                    {done ? <CircleCheck size={13} /> : null} {done ? 'Done' : 'Mark done'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="label">Recommended next</div>
          <div className="mt-3 space-y-2">
            {nextModules.map((id) => {
              const m = MODULE_MAP[id];
              return (
                <Link key={id} to={`/modules/${id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-panel2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent">
                    <Icon name={m.icon} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{m.title}</div>
                    <div className="text-[11px] text-muted">{m.experimentTitle}</div>
                  </div>
                  <ArrowRight size={14} className="text-faint" />
                </Link>
              );
            })}
            {nextModules.length === 0 && <p className="text-[13px] text-muted">All modules completed – try the Scenario Lab and design your own architectures in the playground.</p>}
            <Link to={`/scenarios/${SCENARIOS.find((s) => !experiments.includes(`scenario:${s.id}`))?.id ?? SCENARIOS[0].id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-panel2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-violet/15 text-violet">
                <Icon name="flask" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">Try a scenario</div>
                <div className="text-[11px] text-muted truncate">{SCENARIOS.find((s) => !experiments.includes(`scenario:${s.id}`))?.title ?? 'Revisit a scenario'}</div>
              </div>
              <ArrowRight size={14} className="text-faint" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="label mb-3">Recently explored</div>
          {visited.length === 0 && <p className="text-[13px] text-muted">Nothing yet. Open a module and it will show up here.</p>}
          <div className="space-y-1">
            {visited.slice(0, 6).map((v) => {
              const m = MODULE_MAP[v.id];
              const s = SCENARIO_MAP[v.id.replace('scenario:', '')];
              const title = m ? m.title : s ? s.title : v.id;
              const to = m ? `/modules/${m.id}` : s ? `/scenarios/${s.id}` : '/';
              return (
                <Link key={v.id} to={to} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-panel2 text-[13px]">
                  <Icon name={m?.icon ?? s?.icon ?? 'box'} size={15} className="text-muted" />
                  <span className="flex-1 truncate">{title}</span>
                  <span className="flex items-center gap-1 text-[11px] text-faint">
                    <Clock size={11} /> {timeAgo(v.at)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="card p-5">
          <div className="label mb-3">Practical experiments</div>
          <div className="grid grid-cols-2 gap-1.5">
            {MODULES.filter((m) => m.experiment).map((m) => {
              const done = experiments.includes(m.experiment!);
              return (
                <Link key={m.id} to={`/modules/${m.id}#experiment`} className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-panel2">
                  {done ? <CircleCheck size={13} className="text-ok shrink-0" /> : <span className="h-3 w-3 rounded-full border border-line shrink-0" />}
                  <span className="truncate text-muted">{m.experimentTitle}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <SectionTitle sub="Modules in recommended order. Click any to start.">All modules</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((m) => (
          <Link key={m.id} to={`/modules/${m.id}`} className="card p-4 hover:border-faint transition-colors">
            <div className="flex items-center justify-between">
              <Icon name={m.icon} size={20} className="text-accent" />
              {completed.includes(m.id) ? <CircleCheck size={16} className="text-ok" /> : <span className="mono text-[11px] text-faint">#{m.num}</span>}
            </div>
            <div className="mt-2 text-[14px] font-semibold">{m.short}</div>
            <div className="text-[12px] text-muted">
              {m.level} · {m.minutes} min · {m.animations.length} animations
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm('Reset all learning progress stored in this browser?')) reset();
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  );
}
