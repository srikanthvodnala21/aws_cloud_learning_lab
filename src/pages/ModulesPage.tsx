import { Link } from 'react-router-dom';
import { CircleCheck, Trophy } from 'lucide-react';
import { MODULES } from '../content/modules';
import { useProgress } from '../store/progress';
import { Badge, PageHeader } from '../components/ui';
import { Icon } from '../components/icons';

export default function ModulesPage() {
  const { completed, quizzes, experiments } = useProgress();
  return (
    <div>
      <PageHeader eyebrow="Curriculum" title="AWS learning modules" desc="Each module has a beginner-friendly explanation, step-by-step animations, an interactive experiment, real-world examples, a quiz and a summary." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => {
          const done = completed.includes(m.id);
          const q = quizzes[m.id];
          return (
            <Link key={m.id} to={`/modules/${m.id}`} className={`card p-5 flex flex-col hover:border-faint transition-colors ${done ? 'border-ok/40' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon name={m.icon} size={20} />
                </div>
                <div className="flex items-center gap-2">
                  {q && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Trophy size={12} className="text-warn" /> {q.score}/{q.total}
                    </span>
                  )}
                  {done && <CircleCheck size={18} className="text-ok" />}
                </div>
              </div>
              <div className="mt-3 text-[11px] mono text-faint">MODULE {m.num}</div>
              <div className="text-[16px] font-semibold">{m.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted line-clamp-3">{m.intro}</p>
              <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                <Badge tone={m.level === 'Beginner' ? 'ok' : 'sky'}>{m.level}</Badge>
                <Badge>{m.minutes} min</Badge>
                <Badge>{m.animations.length} animations</Badge>
                {m.experiment && <Badge tone={experiments.includes(m.experiment) ? 'ok' : 'violet'}>{experiments.includes(m.experiment) ? 'Lab done' : 'Lab'}</Badge>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
