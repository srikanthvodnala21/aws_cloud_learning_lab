import { useMemo, useState } from 'react';
import { Plus, Trash2, Clock, Search, BarChart3 } from 'lucide-react';
import { FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef, FlowStep } from '../animation/flowTypes';
import { e, n, p, r } from '../animation/builders';
import { Badge, Callout, Toggle } from '../components/ui';

type RType = 'A' | 'AAAA' | 'CNAME' | 'ALIAS';
type Policy = 'simple' | 'weighted' | 'failover' | 'latency';

interface Rec {
  id: number;
  name: string; // relative: '@' or 'www'
  type: RType;
  value: string; // endpoint id for A/AAAA/ALIAS; hostname for CNAME
  ttl: number;
  policy: Policy;
  weight?: number;
  role?: 'PRIMARY' | 'SECONDARY';
  region?: string;
  health?: boolean; // evaluate target health
}

const ZONE = 'example.com';
const ENDPOINTS: Record<string, { label: string; region: string; ip: string; ip6: string }> = {
  'alb-use1': { label: 'ALB us-east-1', region: 'us-east-1', ip: '3.80.10.21', ip6: '2600:1f18::21' },
  'alb-euw1': { label: 'ALB eu-west-1', region: 'eu-west-1', ip: '52.30.2.14', ip6: '2a05:d018::14' },
  'alb-aps1': { label: 'ALB ap-south-1', region: 'ap-south-1', ip: '13.232.7.90', ip6: '2406:da1a::90' },
  'alb-canary': { label: 'ALB v2 canary (us-east-1)', region: 'us-east-1', ip: '3.80.99.5', ip6: '2600:1f18::99' },
  's3-site': { label: 'S3 static “sorry” site', region: 'us-east-1', ip: '52.217.4.10', ip6: '2600:1fa0::10' },
};
const CLIENTS = [
  { id: 'nyc', label: 'New York', lat: { 'us-east-1': 12, 'eu-west-1': 75, 'ap-south-1': 190 } },
  { id: 'dub', label: 'Dublin', lat: { 'us-east-1': 75, 'eu-west-1': 8, 'ap-south-1': 125 } },
  { id: 'blr', label: 'Bengaluru', lat: { 'us-east-1': 210, 'eu-west-1': 130, 'ap-south-1': 18 } },
] as const;

let rid = 100;
const DEFAULT_RECS: Rec[] = [
  { id: 1, name: '@', type: 'ALIAS', value: 'alb-use1', ttl: 60, policy: 'simple' },
  { id: 2, name: 'www', type: 'CNAME', value: 'example.com', ttl: 300, policy: 'simple' },
  { id: 3, name: 'api', type: 'A', value: 'alb-use1', ttl: 60, policy: 'latency', region: 'us-east-1', health: true },
  { id: 4, name: 'api', type: 'A', value: 'alb-euw1', ttl: 60, policy: 'latency', region: 'eu-west-1', health: true },
  { id: 5, name: 'api', type: 'A', value: 'alb-aps1', ttl: 60, policy: 'latency', region: 'ap-south-1', health: true },
  { id: 6, name: 'app', type: 'ALIAS', value: 'alb-use1', ttl: 60, policy: 'weighted', weight: 90, health: true },
  { id: 7, name: 'app', type: 'ALIAS', value: 'alb-canary', ttl: 60, policy: 'weighted', weight: 10, health: true },
  { id: 8, name: 'status', type: 'ALIAS', value: 'alb-euw1', ttl: 60, policy: 'failover', role: 'PRIMARY', health: true },
  { id: 9, name: 'status', type: 'ALIAS', value: 's3-site', ttl: 60, policy: 'failover', role: 'SECONDARY' },
  { id: 10, name: 'shop', type: 'CNAME', value: 'shops.myshopify.example', ttl: 3600, policy: 'simple' },
];

const fqdn = (name: string) => (name === '@' ? ZONE : `${name}.${ZONE}`);

function validate(recs: Rec[]): string[] {
  const errs: string[] = [];
  recs.forEach((rc) => {
    if (rc.type === 'CNAME' && rc.name === '@') errs.push(`CNAME at the zone apex (${ZONE}) is not allowed by the DNS standard – use an ALIAS record instead.`);
    if (rc.type === 'CNAME' && recs.some((o) => o.id !== rc.id && o.name === rc.name)) errs.push(`${fqdn(rc.name)}: a CNAME cannot coexist with any other record of the same name.`);
    if (rc.policy === 'failover' && !rc.role) errs.push(`${fqdn(rc.name)}: failover records need a PRIMARY/SECONDARY role.`);
  });
  const groups = new Map<string, Rec[]>();
  recs.forEach((rc) => groups.set(`${rc.name}|${rc.type === 'ALIAS' ? 'A' : rc.type}`, [...(groups.get(`${rc.name}|${rc.type === 'ALIAS' ? 'A' : rc.type}`) ?? []), rc]));
  groups.forEach((g, k) => {
    const pols = new Set(g.map((x) => x.policy));
    if (pols.size > 1) errs.push(`${fqdn(k.split('|')[0])}: all records with the same name and type must use the same routing policy (found ${[...pols].join(', ')}).`);
    if (g.length > 1 && pols.has('simple')) errs.push(`${fqdn(k.split('|')[0])}: simple routing allows only one record set per name and type.`);
  });
  return [...new Set(errs)];
}

interface Answer {
  ok: boolean;
  chain: string[]; // explanation lines
  endpoint?: string;
  value?: string;
  ttl: number;
  rcode: 'NOERROR' | 'NXDOMAIN';
  external?: string;
}

function resolve(recs: Rec[], name: string, client: (typeof CLIENTS)[number], health: Record<string, boolean>, rand = Math.random, depth = 0): Answer {
  const rel = name === ZONE ? '@' : name.endsWith(`.${ZONE}`) ? name.slice(0, -ZONE.length - 1) : null;
  if (rel === null) return { ok: true, chain: [`${name} is outside this hosted zone – the resolver looks it up with that domain’s own name servers.`], ttl: 300, rcode: 'NOERROR', external: name, value: '198.51.100.80' };
  const set = recs.filter((x) => x.name === rel);
  if (set.length === 0) return { ok: false, chain: [`No record for ${name} in the hosted zone → NXDOMAIN.`], ttl: 900, rcode: 'NXDOMAIN' };
  const cname = set.find((x) => x.type === 'CNAME');
  if (cname) {
    if (depth > 4) return { ok: false, chain: ['CNAME loop detected.'], ttl: 0, rcode: 'NXDOMAIN' };
    const next = resolve(recs, cname.value, client, health, rand, depth + 1);
    return { ...next, chain: [`${name} CNAME → ${cname.value} (TTL ${cname.ttl}s). The resolver must now resolve ${cname.value}.`, ...next.chain], ttl: Math.min(cname.ttl, next.ttl) };
  }
  const a = set.filter((x) => x.type !== 'CNAME');
  const pol = a[0]?.policy ?? 'simple';
  const isHealthy = (x: Rec) => !x.health || health[x.value] !== false;
  let chosen: Rec | undefined;
  const why: string[] = [];
  if (pol === 'simple') {
    chosen = a[0];
    why.push(`Simple routing: return the single record${a[0].type === 'ALIAS' ? ' (ALIAS resolved internally by Route 53 to the target’s current IPs – no extra lookup for the client)' : ''}.`);
  } else if (pol === 'weighted') {
    const pool = a.filter(isHealthy);
    const total = pool.reduce((s, x) => s + (x.weight ?? 0), 0);
    if (pool.length < a.length) why.push(`Unhealthy weighted record(s) excluded: ${a.filter((x) => !isHealthy(x)).map((x) => ENDPOINTS[x.value].label).join(', ')}.`);
    let pick = rand() * total;
    for (const x of pool) {
      pick -= x.weight ?? 0;
      if (pick <= 0) {
        chosen = x;
        break;
      }
    }
    chosen = chosen ?? pool[pool.length - 1] ?? a[0];
    why.push(`Weighted routing: ${pool.map((x) => `${ENDPOINTS[x.value].label} weight ${x.weight}`).join(', ')} → picked ${ENDPOINTS[chosen.value].label} (probability ${Math.round(((chosen.weight ?? 0) / (total || 1)) * 100)}%).`);
  } else if (pol === 'failover') {
    const prim = a.find((x) => x.role === 'PRIMARY');
    const sec = a.find((x) => x.role === 'SECONDARY');
    if (prim && isHealthy(prim)) {
      chosen = prim;
      why.push(`Failover routing: PRIMARY (${ENDPOINTS[prim.value].label}) is healthy → return primary.`);
    } else {
      chosen = sec ?? prim;
      why.push(`Failover routing: PRIMARY health check is failing → return SECONDARY (${sec ? ENDPOINTS[sec.value].label : 'none'}).`);
    }
  } else {
    const pool = a.filter(isHealthy);
    const sorted = [...(pool.length ? pool : a)].sort((x, y) => (client.lat as Record<string, number>)[x.region ?? 'us-east-1'] - (client.lat as Record<string, number>)[y.region ?? 'us-east-1']);
    chosen = sorted[0];
    why.push(`Latency routing: measured latency from ${client.label}: ${a.map((x) => `${x.region} ~${(client.lat as Record<string, number>)[x.region ?? 'us-east-1']} ms${isHealthy(x) ? '' : ' (unhealthy)'}`).join(', ')} → ${chosen.region}.`);
  }
  if (!chosen) return { ok: false, chain: [...why, 'No usable record.'], ttl: 60, rcode: 'NXDOMAIN' };
  const ep = ENDPOINTS[chosen.value];
  const value = chosen.type === 'AAAA' ? ep.ip6 : ep.ip;
  return { ok: true, chain: why, endpoint: chosen.value, value, ttl: chosen.ttl, rcode: 'NOERROR' };
}

function buildFlow(q: string, ans: Answer, cached: boolean, runId: number, healthy: boolean): FlowDef {
  const nodes = [
    n('client', 'Browser / OS', 80, 150, 'user', 'stub resolver', { w: 120 }),
    n('res', 'Recursive resolver', 270, 150, 'dns', 'ISP / Route 53 Resolver', { w: 150 }),
    n('root', 'Root servers', 470, 50, 'dns', '“.”', { w: 120 }),
    n('tld', '.com TLD servers', 470, 150, 'dns', 'gtld-servers.net', { w: 130 }),
    n('r53', 'Route 53', 470, 250, 'dns', 'ns-1234.awsdns-12.org', { w: 150, icon: 'globe' }),
    n('ep', ans.endpoint ? ENDPOINTS[ans.endpoint].label : ans.external ?? 'NXDOMAIN', 700, 150, ans.endpoint === 's3-site' ? 'storage' : 'network', ans.value ?? '', { w: 160 }),
  ];
  const edges = [e('c-r', 'client', 'res'), e('r-root', 'res', 'root'), e('r-tld', 'res', 'tld'), e('r-53', 'res', 'r53'), e('c-ep', 'client', 'ep', { curve: -120, dashed: true })];
  const steps: FlowStep[] = [{ title: 'Query', text: `The browser asks its configured recursive resolver: “What is the address of ${q}?”`, packets: [p('c-r', 'blue', q)], log: `query ${q} A` }];
  if (cached) {
    steps.push({ title: 'Cache hit', text: `The resolver already has ${q} in its cache (remaining TTL). It answers immediately – no queries to root, TLD or Route 53. Changes made in Route 53 are not seen until the TTL expires.`, packets: [r('c-r', 'green', ans.value ?? ans.rcode)], focus: ['res'], badges: { res: 'cached' } });
  } else {
    steps.push({ title: 'Ask a root server', text: 'Cache miss. The resolver asks a root server, which does not know the answer but refers it to the .com TLD servers. (Referrals are cached too, so this step is often skipped.)', packets: [p('r-root', 'blue', q), r('r-root', 'purple', 'referral: .com', { at: 0.5 })], focus: ['root'] });
    steps.push({ title: 'Ask the .com TLD', text: `The .com servers reply with the NS records for ${ZONE}: the four Route 53 name servers assigned to the hosted zone (set at your domain registrar).`, packets: [p('r-tld', 'blue', q), r('r-tld', 'purple', 'NS awsdns', { at: 0.5 })], focus: ['tld'] });
    steps.push({ title: 'Ask Route 53 (authoritative)', text: ans.chain.join(' '), packets: [p('r-53', 'blue', q), r('r-53', ans.ok ? 'green' : 'red', ans.ok ? ans.value : ans.rcode, { at: 0.5 })], focus: ['r53'], badges: { r53: ans.rcode } });
    steps.push({ title: 'Answer & cache', text: ans.ok ? `The resolver returns ${ans.value} and caches it for ${ans.ttl}s (the TTL).` : `NXDOMAIN is returned and negatively cached (SOA minimum TTL).`, packets: [r('c-r', ans.ok ? 'green' : 'red', ans.ok ? ans.value : 'NXDOMAIN')], focus: ['res'] });
  }
  if (ans.ok)
    steps.push({
      title: healthy ? 'Connect' : 'Connect – endpoint down!',
      text: healthy ? `The browser opens a connection to ${ans.value}. DNS is only the lookup – actual traffic goes directly to the endpoint.` : `The cached answer points to an endpoint that is now unhealthy. Clients keep using it until the TTL expires – this is why failover records use short TTLs.`,
      packets: [p('c-ep', healthy ? 'blue' : 'red', 'HTTPS', healthy ? {} : { dropAt: 0.85 })],
      focus: ['ep'],
      set: healthy ? {} : { ep: 'fail' },
    });
  return { id: `dns-${runId}`, title: `Resolving ${q}`, description: cached ? 'answered from resolver cache' : 'full recursive resolution', width: 820, height: 310, nodes, edges, steps, initial: ans.ok ? {} : { ep: 'off', 'c-ep': 'hidden' } };
}

export default function DnsSimulator() {
  const [recs, setRecs] = useState<Rec[]>(DEFAULT_RECS);
  const [client, setClient] = useState<(typeof CLIENTS)[number]>(CLIENTS[1]);
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [clock, setClock] = useState(0);
  const [cache, setCache] = useState<Record<string, { ans: Answer; exp: number }>>({});
  const [query, setQuery] = useState('api.example.com');
  const [result, setResult] = useState<{ def: FlowDef; ans: Answer; cached: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const [hist, setHist] = useState<Record<string, number> | null>(null);
  const errs = useMemo(() => validate(recs), [recs]);

  const names = useMemo(() => [...new Set([...recs.map((x) => fqdn(x.name)), 'missing.example.com'])], [recs]);

  const doQuery = (q = query) => {
    const key = `${q}|${client.id}`;
    const c = cache[key];
    const cached = !!c && c.exp > clock;
    const ans = cached ? c.ans : resolve(recs, q, client, health);
    if (!cached) setCache((m) => ({ ...m, [key]: { ans, exp: clock + ans.ttl } }));
    const nr = run + 1;
    setRun(nr);
    const epHealthy = !ans.endpoint || health[ans.endpoint] !== false;
    setResult({ def: buildFlow(q, ans, cached, nr, epHealthy), ans, cached });
  };

  const sample = () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const a = resolve(recs, query, client, health);
      const k = a.endpoint ? ENDPOINTS[a.endpoint].label : a.rcode;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    setHist(counts);
  };

  const upd = (id: number, patch: Partial<Rec>) => setRecs((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[13px] font-semibold">
              Hosted zone <span className="mono text-accent">{ZONE}</span> <Badge>public</Badge>
            </div>
            <div className="flex gap-1.5">
              <button className="btn btn-sm" onClick={() => setRecs((rs) => [...rs, { id: rid++, name: 'new', type: 'A', value: 'alb-use1', ttl: 300, policy: 'simple' }])}>
                <Plus size={12} /> Record
              </button>
              <button className="btn btn-sm" onClick={() => setRecs([...DEFAULT_RECS, { id: rid++, name: '@', type: 'CNAME', value: 'lb.example.net', ttl: 300, policy: 'simple' }])}>
                Try: CNAME at apex
              </button>
              <button className="btn btn-sm" onClick={() => setRecs(DEFAULT_RECS)}>
                Reset
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value / target</th>
                  <th>TTL</th>
                  <th>Policy</th>
                  <th>Policy setting</th>
                  <th>Health</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recs.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <input className="input w-20 mono text-[11.5px]" value={x.name} onChange={(ev) => upd(x.id, { name: ev.target.value.trim() || '@' })} />
                    </td>
                    <td>
                      <select className="select text-[11.5px]" value={x.type} onChange={(ev) => upd(x.id, { type: ev.target.value as RType, value: ev.target.value === 'CNAME' ? 'example.com' : 'alb-use1' })}>
                        {(['A', 'AAAA', 'CNAME', 'ALIAS'] as RType[]).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {x.type === 'CNAME' ? (
                        <input className="input w-40 mono text-[11.5px]" value={x.value} onChange={(ev) => upd(x.id, { value: ev.target.value })} />
                      ) : (
                        <select className="select text-[11.5px]" value={x.value} onChange={(ev) => upd(x.id, { value: ev.target.value })}>
                          {Object.entries(ENDPOINTS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {x.type === 'ALIAS' ? v.label : `${x.type === 'AAAA' ? v.ip6 : v.ip} (${v.label})`}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <input className="input w-16 mono text-[11.5px]" type="number" value={x.ttl} onChange={(ev) => upd(x.id, { ttl: Number(ev.target.value) })} disabled={x.type === 'ALIAS'} title={x.type === 'ALIAS' ? 'ALIAS records use the target’s TTL' : ''} />
                    </td>
                    <td>
                      <select className="select text-[11.5px]" value={x.policy} onChange={(ev) => upd(x.id, { policy: ev.target.value as Policy, role: ev.target.value === 'failover' ? 'PRIMARY' : undefined, weight: ev.target.value === 'weighted' ? 50 : undefined, region: ev.target.value === 'latency' ? 'us-east-1' : undefined })}>
                        {(['simple', 'weighted', 'failover', 'latency'] as Policy[]).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {x.policy === 'weighted' && <input className="input w-16 mono text-[11.5px]" type="number" value={x.weight ?? 0} onChange={(ev) => upd(x.id, { weight: Number(ev.target.value) })} />}
                      {x.policy === 'failover' && (
                        <select className="select text-[11.5px]" value={x.role} onChange={(ev) => upd(x.id, { role: ev.target.value as 'PRIMARY' | 'SECONDARY' })}>
                          <option>PRIMARY</option>
                          <option>SECONDARY</option>
                        </select>
                      )}
                      {x.policy === 'latency' && (
                        <select className="select text-[11.5px]" value={x.region} onChange={(ev) => upd(x.id, { region: ev.target.value })}>
                          {['us-east-1', 'eu-west-1', 'ap-south-1'].map((rg) => (
                            <option key={rg}>{rg}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{x.type !== 'CNAME' && <input type="checkbox" checked={!!x.health} onChange={(ev) => upd(x.id, { health: ev.target.checked })} title="Evaluate target health" />}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setRecs((rs) => rs.filter((y) => y.id !== x.id))} aria-label="Delete record">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errs.length > 0 ? (
            <div className="mt-2 space-y-1">
              {errs.map((er) => (
                <div key={er} className="text-[12px] text-bad">
                  ✕ {er}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-ok">✓ Zone is valid</div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="label mb-1">Client location</div>
            <div className="flex gap-1.5">
              {CLIENTS.map((c) => (
                <button key={c.id} className={`btn btn-sm ${client.id === c.id ? 'btn-active' : ''}`} onClick={() => setClient(c)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">Endpoint health (Route 53 health checks)</div>
            <div className="grid grid-cols-1 gap-1">
              {Object.entries(ENDPOINTS).map(([k, v]) => (
                <Toggle key={k} checked={health[k] !== false} onChange={(val) => setHealth((h) => ({ ...h, [k]: val }))} label={<span className={health[k] === false ? 'text-bad' : ''}>{v.label}</span>} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select className="select flex-1 mono text-[12px]" value={query} onChange={(ev) => setQuery(ev.target.value)}>
              {names.map((nm) => (
                <option key={nm}>{nm}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" disabled={errs.length > 0} onClick={() => doQuery()}>
              <Search size={12} /> Resolve
            </button>
            <button className="btn btn-sm" disabled={errs.length > 0} onClick={sample}>
              <BarChart3 size={12} /> 1,000 queries
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-muted">
              Resolver clock: <b className="mono text-ink">{clock}s</b>
            </span>
            {[30, 300].map((s) => (
              <button key={s} className="btn btn-sm" onClick={() => setClock((c) => c + s)}>
                <Clock size={12} /> +{s}s
              </button>
            ))}
            <button className="btn btn-sm" onClick={() => setCache({})}>
              Flush cache
            </button>
          </div>
          <div className="rounded-lg border border-line p-2">
            <div className="label mb-1">Resolver cache ({client.label})</div>
            {Object.entries(cache).filter(([k]) => k.endsWith(`|${client.id}`)).length === 0 && <div className="text-[11.5px] text-faint">empty</div>}
            {Object.entries(cache)
              .filter(([k]) => k.endsWith(`|${client.id}`))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between mono text-[11px]">
                  <span>{k.split('|')[0]}</span>
                  <span className={v.exp > clock ? 'text-ok' : 'text-faint line-through'}>
                    {v.ans.value ?? v.ans.rcode} · {v.exp > clock ? `${v.exp - clock}s left` : 'expired'}
                  </span>
                </div>
              ))}
          </div>
          {hist && (
            <div className="rounded-lg border border-line p-2 space-y-1">
              <div className="label">1,000 fresh queries for {query}</div>
              {Object.entries(hist).map(([k, v]) => (
                <div key={k} className="text-[11.5px]">
                  <div className="flex justify-between">
                    <span>{k}</span>
                    <span className="mono">{(v / 10).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-panel3">
                    <div className="h-1.5 rounded bg-accent" style={{ width: `${v / 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {result ? <FlowPlayer key={result.def.id} def={result.def} autoStart /> : <Callout kind="tip">Resolve <b>api.example.com</b> from Dublin, then from Bengaluru. Resolve it twice to see the cache. Mark the eu-west-1 ALB unhealthy and resolve <b>status.example.com</b> to watch failover. Use “1,000 queries” on <b>app.example.com</b> to see the 90/10 weighted split.</Callout>}
    </div>
  );
}
