import { useMemo, useRef, useState } from 'react';
import { Bell, Pause, Play, Plus, Trash2, Mail } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useInterval } from '../animation/useLoop';
import { axisTick, chartTooltip } from '../components/chartStyles';
import { Badge, Callout, Tabs } from '../components/ui';

type MetricId = 'cpu' | 'req' | 'err' | 'lat';
const METRICS: Record<MetricId, { label: string; ns: string; name: string; unit: string; color: string; stat: string }> = {
  cpu: { label: 'CPUUtilization', ns: 'AWS/EC2', name: 'CPUUtilization', unit: '%', color: '#ff9900', stat: 'Average' },
  req: { label: 'RequestCount', ns: 'AWS/ApplicationELB', name: 'RequestCount', unit: 'count', color: '#4aa8ff', stat: 'Sum' },
  err: { label: 'HTTPCode_Target_5XX_Count', ns: 'AWS/ApplicationELB', name: 'HTTPCode_Target_5XX_Count', unit: 'count', color: '#f0524d', stat: 'Sum' },
  lat: { label: 'TargetResponseTime (p99)', ns: 'AWS/ApplicationELB', name: 'TargetResponseTime', unit: 'ms', color: '#a78bfa', stat: 'p99' },
};

type AState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
interface Alarm {
  id: number;
  name: string;
  metric: MetricId;
  threshold: number;
  m: number;
  n: number;
  state: AState;
  history: { t: number; from: AState; to: AState; reason: string }[];
}
interface Point {
  t: number;
  cpu: number | null;
  req: number | null;
  err: number | null;
  lat: number | null;
}
interface LogLine {
  t: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}
interface Trail {
  t: number;
  event: string;
  user: string;
  source: string;
  detail: string;
}

type Incident = 'none' | 'cpu' | 'errors' | 'latency' | 'stopped';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PATHS = ['/api/orders', '/api/cart', '/api/users/me', '/health', '/api/products?page=2'];

let aid = 3;

export default function CloudWatchDashboard() {
  const [running, setRunning] = useState(true);
  const [incident, setIncident] = useState<Incident>('none');
  const [data, setData] = useState<Point[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [trail, setTrail] = useState<Trail[]>([{ t: 0, event: 'RunInstances', user: 'ci-deploy-role', source: 'ec2.amazonaws.com', detail: 'i-0abc123 t3.medium' }]);
  const [alarms, setAlarms] = useState<Alarm[]>([
    { id: 1, name: 'HighCPU', metric: 'cpu', threshold: 80, m: 3, n: 3, state: 'INSUFFICIENT_DATA', history: [] },
    { id: 2, name: '5xxErrors', metric: 'err', threshold: 10, m: 2, n: 3, state: 'INSUFFICIENT_DATA', history: [] },
  ]);
  const [inbox, setInbox] = useState<{ t: number; subject: string; body: string }[]>([]);
  const [tab, setTab] = useState<'metrics' | 'logs' | 'trail' | 'compare'>('metrics');
  const [filter, setFilter] = useState('ERROR');
  const [form, setForm] = useState({ name: 'HighLatency', metric: 'lat' as MetricId, threshold: 500, m: 2, n: 3 });
  const tick = useRef(0);

  const audit = (event: string, detail: string, user = 'alice (console)', source = 'monitoring.amazonaws.com') => setTrail((tr) => [{ t: tick.current, event, user, source, detail }, ...tr].slice(0, 40));

  useInterval(
    () => {
      tick.current += 1;
      const t = tick.current;
      let pt: Point;
      if (incident === 'stopped') pt = { t, cpu: null, req: null, err: null, lat: null };
      else {
        const req = Math.round(rnd(900, 1200));
        const cpu = incident === 'cpu' ? rnd(88, 99) : rnd(25, 45);
        const err = incident === 'errors' ? Math.round(rnd(25, 60)) : Math.random() < 0.2 ? 1 : 0;
        const lat = incident === 'latency' ? rnd(700, 1400) : incident === 'cpu' ? rnd(300, 600) : rnd(80, 160);
        pt = { t, cpu: Math.round(cpu), req, err, lat: Math.round(lat) };
      }
      const next = [...data, pt].slice(-40);
      setData(next);

      // logs
      if (incident !== 'stopped') {
        const lines: LogLine[] = [];
        for (let i = 0; i < 3; i++) {
          const path = PATHS[Math.floor(Math.random() * PATHS.length)];
          const isErr = (pt.err ?? 0) > 5 && i === 0;
          lines.push(isErr ? { t, level: 'ERROR', msg: `${path} 500 Internal Server Error – ConnectionTimeout: pool exhausted (db-prod.cluster-xyz:5432)` } : pt.lat! > 500 && i === 1 ? { t, level: 'WARN', msg: `${path} slow response ${pt.lat} ms` } : { t, level: 'INFO', msg: `${path} 200 ${Math.round(rnd(20, 140))} ms` });
        }
        setLogs((l) => [...lines.reverse(), ...l].slice(0, 120));
      }

      // alarm evaluation
      const notes: { t: number; subject: string; body: string }[] = [];
      setAlarms(
        alarms.map((a) => {
          const window = next.slice(-a.n);
          const vals = window.map((p) => p[a.metric]);
          let s: AState;
          let reason: string;
          if (window.length < a.n || vals.every((v) => v === null)) {
            s = 'INSUFFICIENT_DATA';
            reason = 'Not enough datapoints (missing data treated as missing).';
          } else {
            const breaching = vals.filter((v) => v !== null && v > a.threshold).length;
            s = breaching >= a.m ? 'ALARM' : 'OK';
            reason = `${breaching} of last ${a.n} datapoints [${vals.map((v) => (v === null ? '–' : v)).join(', ')}] > ${a.threshold} (need ${a.m}).`;
          }
          if (s === a.state) return a;
          if (s === 'ALARM') notes.push({ t, subject: `ALARM: "${a.name}" in US East (N. Virginia)`, body: `${METRICS[a.metric].label} – ${reason}` });
          if (s === 'OK' && a.state === 'ALARM') notes.push({ t, subject: `OK: "${a.name}" recovered`, body: reason });
          return { ...a, state: s, history: [{ t, from: a.state, to: s, reason }, ...a.history].slice(0, 6) };
        }),
      );
      if (notes.length) setInbox((ib) => [...notes, ...ib].slice(0, 20));
    },
    running ? 1000 : null,
  );

  const inject = (i: Incident) => {
    setIncident(i);
    if (i === 'stopped') audit('StopInstances', 'i-0abc123', 'bob (CLI)', 'ec2.amazonaws.com');
    if (i === 'none' && incident === 'stopped') audit('StartInstances', 'i-0abc123', 'bob (CLI)', 'ec2.amazonaws.com');
    if (i === 'errors') audit('ModifyDBInstance', 'db-prod max_connections parameter changed', 'carol (console)', 'rds.amazonaws.com');
  };

  const filtered = useMemo(() => logs.filter((l) => !filter || `${l.level} ${l.msg}`.toLowerCase().includes(filter.toLowerCase())), [logs, filter]);
  const metricFilterCount = useMemo(() => {
    const byT = new Map<number, number>();
    logs.forEach((l) => {
      if (filter && `${l.level} ${l.msg}`.toLowerCase().includes(filter.toLowerCase())) byT.set(l.t, (byT.get(l.t) ?? 0) + 1);
    });
    return data.map((d) => ({ t: d.t, count: byT.get(d.t) ?? 0 }));
  }, [logs, data, filter]);

  const stateTone = (s: AState) => (s === 'OK' ? 'ok' : s === 'ALARM' ? 'bad' : 'default');

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Pause' : 'Resume'}
        </button>
        <span className="label">Inject incident:</span>
        {(
          [
            ['none', 'Normal'],
            ['cpu', 'CPU spike'],
            ['errors', '5xx error burst'],
            ['latency', 'Latency spike'],
            ['stopped', 'Stop instance (no data)'],
          ] as [Incident, string][]
        ).map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${incident === k ? (k === 'none' ? 'btn-active' : 'btn-danger') : ''}`} onClick={() => inject(k)}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">1 tick = 1 one-minute period (sped up)</span>
      </div>

      <Tabs
        tabs={[
          { id: 'metrics', label: 'Metrics & alarms' },
          { id: 'logs', label: 'Logs' },
          { id: 'trail', label: 'CloudTrail' },
          { id: 'compare', label: 'CloudWatch vs CloudTrail vs Config' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'metrics' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(METRICS) as MetricId[]).map((m) => {
              const al = alarms.filter((a) => a.metric === m);
              return (
                <div key={m} className="rounded-lg border border-line p-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[12px] font-semibold">{METRICS[m].label}</div>
                    <span className="mono text-[10px] text-faint">
                      {METRICS[m].ns} · {METRICS[m].stat}
                    </span>
                  </div>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                        <XAxis dataKey="t" tick={axisTick} />
                        <YAxis tick={axisTick} width={36} />
                        <Tooltip contentStyle={chartTooltip} />
                        {al.map((a) => (
                          <ReferenceLine key={a.id} y={a.threshold} stroke={a.state === 'ALARM' ? '#f0524d' : '#f5a524'} strokeDasharray="4 3" label={{ value: a.name, fill: '#f5a524', fontSize: 10, position: 'insideTopLeft' }} />
                        ))}
                        <Line dataKey={m} stroke={METRICS[m].color} dot={false} isAnimationActive={false} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-line p-3 space-y-2">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <Bell size={14} /> Alarms
              </div>
              {alarms.map((a) => (
                <div key={a.id} className={`rounded border p-2 ${a.state === 'ALARM' ? 'border-bad/60 bg-bad/10' : 'border-line'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">{a.name}</span>
                    <div className="flex items-center gap-1">
                      <Badge tone={stateTone(a.state)}>{a.state}</Badge>
                      <button className="btn btn-sm" onClick={() => { setAlarms((as) => as.filter((x) => x.id !== a.id)); audit('DeleteAlarms', a.name); }} aria-label="Delete alarm">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted">
                    {METRICS[a.metric].label} &gt; {a.threshold} for {a.m} of {a.n} datapoints → SNS topic ops-alerts
                  </div>
                  {a.history[0] && <div className="mt-1 text-[10.5px] text-faint">{a.history[0].reason}</div>}
                </div>
              ))}
              <div className="border-t border-line pt-2 space-y-1.5">
                <div className="label">Create alarm</div>
                <input className="input w-full text-[12px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div className="flex gap-1.5">
                  <select className="select flex-1 text-[12px]" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as MetricId })}>
                    {(Object.keys(METRICS) as MetricId[]).map((m) => (
                      <option key={m} value={m}>
                        {METRICS[m].label}
                      </option>
                    ))}
                  </select>
                  <input className="input w-20 text-[12px]" type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} title="threshold (greater than)" />
                </div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  <input className="input w-12" type="number" min={1} max={form.n} value={form.m} onChange={(e) => setForm({ ...form, m: Math.min(form.n, Math.max(1, Number(e.target.value))) })} />
                  of
                  <input className="input w-12" type="number" min={1} max={10} value={form.n} onChange={(e) => setForm({ ...form, n: Math.max(1, Number(e.target.value)), m: Math.min(form.m, Math.max(1, Number(e.target.value))) })} />
                  datapoints
                  <button
                    className="btn btn-sm btn-primary ml-auto"
                    onClick={() => {
                      setAlarms((as) => [...as, { id: aid++, ...form, state: 'INSUFFICIENT_DATA', history: [] }]);
                      audit('PutMetricAlarm', form.name);
                    }}
                  >
                    <Plus size={12} /> Create
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold mb-1">
                <Mail size={14} /> SNS e-mail inbox (simulated)
              </div>
              <div className="max-h-48 overflow-auto space-y-1.5">
                {inbox.length === 0 && <div className="text-[11.5px] text-faint">No notifications yet. Inject an incident.</div>}
                {inbox.map((m, i) => (
                  <div key={i} className="rounded border border-line p-1.5">
                    <div className={`text-[11.5px] font-semibold ${m.subject.startsWith('ALARM') ? 'text-bad' : 'text-ok'}`}>{m.subject}</div>
                    <div className="text-[10.5px] text-muted">{m.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[12px] text-muted">Log group /app/orders-api · stream i-0abc123</span>
            <input className="input mono text-[12px]" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter pattern e.g. ERROR" />
            {['ERROR', 'WARN', 'timeout', '/api/cart', ''].map((f) => (
              <button key={f || 'all'} className={`btn btn-sm ${filter === f ? 'btn-active' : ''}`} onClick={() => setFilter(f)}>
                {f || 'all'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="h-80 overflow-auto rounded-lg border border-line bg-bg p-2 mono text-[11px] leading-relaxed">
              {filtered.map((l, i) => (
                <div key={i}>
                  <span className="text-faint">2026-11-25T09:{String(l.t % 60).padStart(2, '0')}:00Z</span> <span className={l.level === 'ERROR' ? 'text-bad' : l.level === 'WARN' ? 'text-warn' : 'text-sky'}>{l.level}</span> {l.msg}
                </div>
              ))}
              {filtered.length === 0 && <div className="text-faint">No matching events.</div>}
            </div>
            <div className="rounded-lg border border-line p-2">
              <div className="text-[12px] font-semibold">Metric filter → custom metric</div>
              <div className="text-[11px] text-muted mb-1">
                Pattern <span className="mono text-accent">“{filter || '(all)'}”</span> → metric <span className="mono">App/MatchingLines</span>. You can alarm on it like any metric.
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricFilterCount}>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={axisTick} />
                    <YAxis tick={axisTick} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Line dataKey="count" stroke="#2dd4bf" dot={false} isAnimationActive={false} type="stepAfter" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'trail' && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-muted">CloudTrail records <b>API calls</b> – who did what, when, from where. Actions in this lab (stop instance, create/delete alarm, the DB change during the error burst) appear here.</p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Event time</th>
                  <th>Event name</th>
                  <th>User name</th>
                  <th>Event source</th>
                  <th>Resource / details</th>
                </tr>
              </thead>
              <tbody>
                {trail.map((x, i) => (
                  <tr key={i}>
                    <td className="mono text-[11.5px]">09:{String(x.t % 60).padStart(2, '0')}:00</td>
                    <td className="mono text-[11.5px] text-accent">{x.event}</td>
                    <td className="text-[12px]">{x.user}</td>
                    <td className="mono text-[11.5px] text-muted">{x.source}</td>
                    <td className="text-[12px] text-muted">{x.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout kind="tip">Incident investigation pattern: CloudWatch tells you <i>something is wrong</i> (5xx alarm) → Logs tell you <i>what</i> (connection pool exhausted) → CloudTrail tells you <i>who changed what</i> just before (ModifyDBInstance by carol).</Callout>
        </div>
      )}

      {tab === 'compare' && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="lab-table">
            <thead>
              <tr>
                <th />
                <th>Amazon CloudWatch</th>
                <th>AWS CloudTrail</th>
                <th>AWS Config</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Question it answers', 'How is it performing? Is it healthy?', 'Who did what, when, from where?', 'What does my resource configuration look like, and is it compliant?'],
                ['Data', 'Metrics, logs, alarms, dashboards, traces (with X-Ray / Application Signals)', 'API call events (management + optional data events)', 'Configuration items, history, relationships, rule evaluations'],
                ['Example', 'CPU > 80% for 3 minutes → alarm', 'bob called StopInstances at 09:14 from 203.0.113.7', 'Security group sg-123 allowed 0.0.0.0/0 on port 22 → NON_COMPLIANT'],
                ['Acts by', 'Alarms → SNS, Auto Scaling, EC2 actions', 'Trails to S3/CloudWatch Logs; EventBridge rules', 'Config rules, remediation via SSM Automation'],
                ['Scope', 'Regional (cross-account/Region dashboards possible)', 'Regional events; trails can cover all Regions + Organizations', 'Regional; aggregators for multi-account/Region'],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((c, i) => (
                    <td key={i} className={i === 0 ? 'font-medium' : 'text-muted text-[12.5px]'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
