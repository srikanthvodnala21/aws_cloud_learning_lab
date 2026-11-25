import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, DollarSign, ShieldCheck, ListChecks } from 'lucide-react';
import { SCENARIOS, SCENARIO_MAP } from '../data/scenarios';
import { SERVICE_MAP } from '../data/services';
import { useProgress } from '../store/progress';
import { Badge, Callout, SectionTitle } from '../components/ui';
import { FlowPlayer } from '../animation/FlowPlayer';
import NotFound from './NotFound';

export default function ScenarioPage() {
  const { id = '' } = useParams();
  const s = SCENARIO_MAP[id];
  const { markVisited, experiments, markExperiment } = useProgress();
  useEffect(() => {
    if (s) markVisited(`scenario:${s.id}`);
  }, [s, markVisited]);
  if (!s) return <NotFound />;
  const idx = SCENARIOS.indexOf(s);
  const next = SCENARIOS[idx + 1];
  const prev = SCENARIOS[idx - 1];
  const key = `scenario:${s.id}`;
  const done = experiments.includes(key);
  return (
    <div>
      <div className="mb-1 text-[12px] text-muted">
        <Link to="/scenarios" className="hover:text-ink">
          Scenario Lab
        </Link>{' '}
        / Scenario {s.num}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">{s.title}</h1>
          <p className="mt-1.5 text-[14px] text-muted">{s.goal}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.services.map((sid) => (
              <Link key={sid} to={`/modules/${SERVICE_MAP[sid]?.module}`}>
                <Badge tone="accent">{SERVICE_MAP[sid]?.short ?? sid}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <button className={`btn ${done ? 'btn-active' : 'btn-primary'}`} onClick={() => markExperiment(key)}>
          <CircleCheck size={15} /> {done ? 'Scenario completed' : 'Mark scenario completed'}
        </button>
      </div>

      <SectionTitle sub="The last step of every flow shows a failure and how the architecture responds.">Architecture & request flow</SectionTitle>
      <FlowPlayer key={s.flow.id} def={s.flow} />

      <SectionTitle>Every component, and why it is used</SectionTitle>
      <div className="card overflow-x-auto">
        <table className="lab-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Role</th>
              <th>Why this service</th>
            </tr>
          </thead>
          <tbody>
            {s.components.map((c) => (
              <tr key={c.name}>
                <td className="font-medium whitespace-nowrap">{c.name}</td>
                <td className="text-muted">{c.role}</td>
                <td className="text-muted">{c.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Callout kind="warn" title={s.failure.title}>
          {s.failure.text}
        </Callout>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <DollarSign size={16} className="text-ok" /> Cost considerations
          </div>
          <ul className="space-y-1.5 text-[13px] text-muted">
            {s.cost.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-faint">
            Use the <Link to="/cost" className="text-sky">Cost Explorer simulator</Link> or the official AWS Pricing Calculator for estimates.
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <ShieldCheck size={16} className="text-bad" /> Security considerations
          </div>
          <ul className="space-y-1.5 text-[13px] text-muted">
            {s.security.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <ListChecks size={16} className="text-sky" /> Build checklist
          </div>
          <ol className="space-y-1.5 text-[13px] text-muted list-decimal ml-4">
            {s.tasks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <Link to="/playground" className="btn btn-sm mt-3">
            Recreate it in the playground
          </Link>
        </div>
      </div>

      <div className="mt-10 flex justify-between gap-3 border-t border-line pt-5">
        {prev ? (
          <Link to={`/scenarios/${prev.id}`} className="btn">
            <ArrowLeft size={14} /> Scenario {prev.num}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/scenarios/${next.id}`} className="btn btn-primary">
            Scenario {next.num}: {next.title.split(' ').slice(0, 4).join(' ')}… <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
