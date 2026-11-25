import { Link, useParams } from 'react-router-dom';
import { COMPARISONS, COMPARISON_MAP } from '../data/comparisons';
import { MODULE_MAP } from '../content/modules';
import { Callout, PageHeader } from '../components/ui';
import { Icon } from '../components/icons';
import { FlowPlayer } from '../animation/FlowPlayer';

export default function ComparePage() {
  const { id } = useParams();
  const c = (id && COMPARISON_MAP[id]) || COMPARISONS[0];
  return (
    <div>
      <PageHeader eyebrow="Service comparison" title="Which service should I use?" desc="Side-by-side comparisons of services that are commonly confused, with a diagram and a decision table." />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {COMPARISONS.map((x) => (
          <Link key={x.id} to={`/compare/${x.id}`} className={`btn btn-sm ${x.id === c.id ? 'btn-active' : ''}`}>
            {x.title}
          </Link>
        ))}
      </div>
      <h2 className="text-xl font-bold mb-3">{c.title}</h2>
      <div className={`grid gap-3 ${c.items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {c.items.map((it) => (
          <div key={it.name} className="card p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={it.icon} size={18} />
              </div>
              <div>
                <div className="font-semibold text-[14px]">{it.name}</div>
                <div className="text-[12px] text-muted">{it.tagline}</div>
              </div>
            </div>
            <div className="label mt-3 mb-1">Best for</div>
            <ul className="space-y-1 text-[13px]">
              {it.bestFor.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-ok">✓</span> {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <FlowPlayer key={c.diagram.id} def={c.diagram} compact autoStart />
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="lab-table">
          <thead>
            <tr>
              <th>Aspect</th>
              {c.items.map((it) => (
                <th key={it.name}>{it.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.aspect}>
                <td className="font-medium whitespace-nowrap">{r.aspect}</td>
                {r.values.map((v, i) => (
                  <td key={i} className="text-muted">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Callout kind="tip" title="Rule of thumb">
          {c.verdict}{' '}
          <Link to={`/modules/${c.module}`} className="text-sky hover:underline">
            Learn more in {MODULE_MAP[c.module]?.title} →
          </Link>
        </Callout>
      </div>
    </div>
  );
}
