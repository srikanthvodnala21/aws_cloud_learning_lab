import { Link } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { SCENARIOS } from '../data/scenarios';
import { SERVICE_MAP } from '../data/services';
import { useProgress } from '../store/progress';
import { Badge, PageHeader } from '../components/ui';
import { Icon } from '../components/icons';

export default function ScenariosPage() {
  const { experiments } = useProgress();
  return (
    <div>
      <PageHeader eyebrow="Scenario Lab" title="Real-world architecture scenarios" desc="Practical designs you will build in real jobs. Each one animates the request flow, explains every component, shows what happens on failure, and covers cost and security considerations." />
      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <Link key={s.id} to={`/scenarios/${s.id}`} className="card p-5 hover:border-faint transition-colors">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet/15 text-violet">
                <Icon name={s.icon} size={20} />
              </div>
              {experiments.includes(`scenario:${s.id}`) && <CircleCheck size={18} className="text-ok" />}
            </div>
            <div className="mt-3 text-[11px] mono text-faint">SCENARIO {s.num}</div>
            <div className="text-[16px] font-semibold">{s.title}</div>
            <p className="mt-1 text-[13px] text-muted">{s.goal}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.services.map((id) => (
                <Badge key={id}>{SERVICE_MAP[id]?.short ?? id}</Badge>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
