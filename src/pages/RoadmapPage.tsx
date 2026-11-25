import { Link } from 'react-router-dom';
import { CircleCheck, ArrowRight } from 'lucide-react';
import { ROADMAP } from '../content/roadmap';
import { MODULE_MAP } from '../content/modules';
import { useProgress } from '../store/progress';
import { PageHeader, ProgressBar } from '../components/ui';
import { Icon } from '../components/icons';

export default function RoadmapPage() {
  const { completed, toggleComplete, quizzes } = useProgress();
  const total = ROADMAP.reduce((a, s) => a + s.modules.length, 0);
  const done = ROADMAP.reduce((a, s) => a + s.modules.filter((m) => completed.includes(m)).length, 0);
  const current = ROADMAP.find((s) => s.modules.some((m) => !completed.includes(m)));
  return (
    <div>
      <PageHeader
        eyebrow="Learning path"
        title="Beginner → intermediate AWS roadmap"
        desc="A recommended order. Each step builds on the previous ones – IAM before resources, networking before databases, and so on. Mark modules complete to track your progress (stored in localStorage)."
        right={
          <div className="w-56">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted">Overall</span>
              <span className="mono">
                {done}/{total}
              </span>
            </div>
            <ProgressBar value={done / total} />
          </div>
        }
      />
      <ol className="relative ml-4 border-l-2 border-line">
        {ROADMAP.map((s) => {
          const stageDone = s.modules.every((m) => completed.includes(m));
          const isCurrent = current?.step === s.step;
          return (
            <li key={s.step} className="mb-6 ml-8">
              <span className={`absolute -left-[17px] grid h-8 w-8 place-items-center rounded-full border-2 text-[12px] font-bold ${stageDone ? 'border-ok bg-ok text-white' : isCurrent ? 'border-accent bg-accent text-black' : 'border-line bg-panel text-muted'}`}>
                {stageDone ? <CircleCheck size={16} /> : s.step}
              </span>
              <div className={`card p-4 ${isCurrent ? 'border-accent/60' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[16px] font-semibold">
                    {s.title} {isCurrent && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-accent">You are here</span>}
                  </div>
                </div>
                <p className="text-[13px] text-muted mt-0.5">{s.why}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {s.modules.map((id) => {
                    const m = MODULE_MAP[id];
                    const d = completed.includes(id);
                    const q = quizzes[id];
                    return (
                      <div key={id} className="flex items-center gap-3 rounded-lg border border-line bg-panel2 p-2.5">
                        <Icon name={m.icon} size={17} className="text-accent" />
                        <Link to={`/modules/${id}`} className="flex-1 min-w-0 hover:underline">
                          <div className="text-[13px] font-medium truncate">
                            {m.num}. {m.title}
                          </div>
                          <div className="text-[11px] text-muted">
                            {m.minutes} min{q ? ` · quiz ${q.score}/${q.total}` : ''}
                          </div>
                        </Link>
                        <button className={`btn btn-sm ${d ? 'btn-active' : ''}`} onClick={() => toggleComplete(id)}>
                          {d ? 'Done ✓' : 'Mark done'}
                        </button>
                      </div>
                    );
                  })}
                  {s.extras?.map((x) => (
                    <Link key={x.to} to={x.to} className="flex items-center gap-2 rounded-lg border border-dashed border-line p-2.5 text-[13px] hover:bg-panel2">
                      <Icon name="flask" size={16} className="text-violet" /> {x.label} <ArrowRight size={13} className="ml-auto text-faint" />
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
