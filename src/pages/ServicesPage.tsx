import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../data/services';
import { MODULE_MAP } from '../content/modules';
import { Badge, Callout, PageHeader } from '../components/ui';
import type { Scope } from '../types';

const SCOPE_TONE: Record<Scope, 'accent' | 'ok' | 'sky' | 'violet' | 'warn' | 'default'> = {
  Global: 'violet',
  Regional: 'sky',
  Zonal: 'accent',
  Edge: 'ok',
  'Account / Org': 'warn',
  Hybrid: 'default',
};

export default function ServicesPage() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope | 'All'>('All');
  const cats = useMemo(() => Array.from(new Set(SERVICES.map((s) => s.category))), []);
  const list = SERVICES.filter((s) => (scope === 'All' || s.scope === scope) && `${s.name} ${s.short} ${s.desc}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="Reference" title="Service catalog" desc={`${SERVICES.length} AWS services and concepts covered in the lab, with their scope – a frequent source of design mistakes.`} />
      <div className="mb-4">
        <Callout kind="info" title="Global vs Regional vs Zonal">
          <b>Global</b> services are not tied to one Region (IAM, Route 53, CloudFront). <b>Regional</b> resources live in one Region and AWS spreads them across AZs for you (S3, DynamoDB, Lambda, VPC). <b>Zonal</b> resources live in a single AZ and you must duplicate them yourself for high availability (EC2 instances, EBS volumes, subnets, NAT Gateways).
        </Callout>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input w-64" placeholder="Filter services…" value={q} onChange={(e) => setQ(e.target.value)} />
        {(['All', 'Global', 'Regional', 'Zonal', 'Edge', 'Account / Org', 'Hybrid'] as const).map((s) => (
          <button key={s} className={`btn btn-sm ${scope === s ? 'btn-active' : ''}`} onClick={() => setScope(s)}>
            {s}
          </button>
        ))}
      </div>
      {cats.map((c) => {
        const items = list.filter((s) => s.category === c);
        if (!items.length) return null;
        return (
          <div key={c} className="mb-6">
            <div className="label mb-2">{c}</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <Link key={s.id} to={`/modules/${s.module}`} className="card p-3.5 hover:border-faint">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13.5px] font-semibold">{s.name}</div>
                    <Badge tone={SCOPE_TONE[s.scope]}>{s.scope}</Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted leading-relaxed">{s.desc}</p>
                  <div className="mt-2 text-[11px] text-faint">Module: {MODULE_MAP[s.module]?.title}</div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
