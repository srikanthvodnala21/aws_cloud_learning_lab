import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Pencil, Eye, ArrowUpCircle, RotateCcw } from 'lucide-react';
import { useInterval, useLoop } from '../animation/useLoop';
import { Badge, Callout, CodeBlock, Slider, Tabs, Toggle } from '../components/ui';

/* ------------------------------------------------------------------ RDS */

type Role = 'primary' | 'standby' | 'replica' | 'standalone';
interface DbNode {
  id: string;
  az: string;
  role: Role;
  up: boolean;
  version: number; // last applied write version
}

function RdsLab() {
  const [multiAz, setMultiAz] = useState(true);
  const [replicaCount, setReplicaCount] = useState(1);
  const [lag, setLag] = useState(3);
  const [nodes, setNodes] = useState<DbNode[]>([
    { id: 'db-1', az: 'us-east-1a', role: 'primary', up: true, version: 1 },
    { id: 'db-2', az: 'us-east-1b', role: 'standby', up: true, version: 1 },
    { id: 'replica-1', az: 'us-east-1c', role: 'replica', up: true, version: 1 },
  ]);
  const [failover, setFailover] = useState<number | null>(null); // seconds left
  const [outage, setOutage] = useState(0);
  const [pending, setPending] = useState<{ v: number; at: number }[]>([]);
  const [clock, setClock] = useState(0);
  const [log, setLog] = useState<string[]>(['t=0s Writer endpoint mydb.cluster-abc123.us-east-1.rds.amazonaws.com → db-1 (us-east-1a)']);
  const [readResult, setReadResult] = useState<string | null>(null);
  const counter = useRef(1);
  const { t } = useLoop(1400);

  const say = (m: string) => setLog((l) => [`t=${clock}s ${m}`, ...l].slice(0, 14));
  const primary = nodes.find((x) => x.role === 'primary' && x.up) ?? nodes.find((x) => x.role === 'standalone') ?? nodes.find((x) => x.role === 'primary');
  const standby = nodes.find((x) => x.role === 'standby');
  const replicas = nodes.filter((x) => x.role === 'replica');
  const writable = !!primary?.up && failover === null;

  useInterval(() => {
    const now = clock + 1;
    setClock(now);
    // asynchronous replication to read replicas
    setNodes((ns) => ns.map((x) => (x.role === 'replica' && x.up ? { ...x, version: Math.max(x.version, ...pending.filter((p) => p.at <= now).map((p) => p.v), x.version) } : x)));
    setPending((ps) => ps.filter((p) => p.at > now));
    if (failover !== null) {
      if (failover <= 1) {
        setFailover(null);
        setNodes((ns) => {
          const old = ns.find((x) => x.role === 'primary')!;
          const sb = ns.find((x) => x.role === 'standby')!;
          return ns.map((x) => (x.id === sb.id ? { ...x, role: 'primary' as Role } : x.id === old.id ? { ...x, role: 'standby' as Role, up: true, version: sb.version } : x));
        });
        setLog((l) => [`t=${now}s ✓ Failover complete. Writer endpoint DNS now points to the former standby. A new standby is being rebuilt in the old AZ. No data lost (synchronous replication).`, ...l].slice(0, 14));
      } else setFailover(failover - 1);
    }
    if (outage > 0) {
      if (outage === 1) {
        setNodes((ns) => ns.map((x) => (x.role === 'primary' || x.role === 'standalone' ? { ...x, up: true } : x)));
        setLog((l) => [`t=${now}s Single-AZ instance recovered on new hardware (writes since the last backup could be at risk in a real storage failure).`, ...l].slice(0, 14));
      }
      setOutage(outage - 1);
    }
  }, 1000);

  const write = () => {
    if (!writable) {
      setReadResult(`✕ Write failed: ${failover !== null ? 'failover in progress – connections dropped, the app must retry.' : 'the database is unavailable.'}`);
      return;
    }
    counter.current += 1;
    const v = counter.current;
    const p = primary!;
    setNodes((ns) => ns.map((x) => (x.id === p.id || (p.role === 'primary' && x.role === 'standby') ? { ...x, version: v } : x)));
    if (p.role === 'primary') setPending((ps) => [...ps, { v, at: clock + lag }]);
    say(`UPDATE users SET plan='pro-v${v}' – committed on primary${standby ? ' and synchronously on standby' : ''}. Replicas will apply it asynchronously (~${lag}s).`);
    setReadResult(`✓ Write v${v} committed`);
  };

  const read = (target: 'writer' | 'reader') => {
    if (target === 'writer') {
      if (!writable) return setReadResult('✕ Read via writer endpoint failed – no primary available right now.');
      return setReadResult(`Writer endpoint → ${primary!.id}: plan = 'pro-v${primary!.version}' (latest)`);
    }
    const rp = replicas.filter((x) => x.up);
    if (rp.length === 0) return setReadResult('✕ No read replicas – the reader endpoint has nothing to route to.');
    const x = rp[Math.floor(Math.random() * rp.length)];
    const stale = x.version < counter.current;
    setReadResult(`Reader endpoint → ${x.id}: plan = 'pro-v${x.version}' ${stale ? `⚠ STALE (latest is v${counter.current}) – replication lag` : '(up to date)'}`);
  };

  const failPrimary = () => {
    if (!primary?.up) return;
    setNodes((ns) => ns.map((x) => (x.id === primary.id ? { ...x, up: false } : x)));
    if (multiAz && standby) {
      setFailover(6);
      say(`⚡ ${primary.id} in ${primary.az} failed. Multi-AZ: RDS detects it and starts automatic failover to ${standby.id} (${standby.az}). Typically 60–120 s (simulated as 6 s).`);
    } else {
      setOutage(12);
      say(`⚡ ${primary.id} failed. No standby (Single-AZ) – the database is DOWN until RDS recovers the instance or you restore from a backup.`);
    }
  };

  const promote = () => {
    const rp = replicas[0];
    if (!rp) return;
    setNodes((ns) => ns.map((x) => (x.id === rp.id ? { ...x, role: 'standalone' as Role } : x)));
    say(`Promoted ${rp.id} to a standalone DB instance. Replication stops – it now accepts writes, but it is a separate database (a manual DR step, not automatic failover). Writes not yet replicated are lost.`);
  };

  const reconfigure = (m: boolean, rc: number) => {
    setMultiAz(m);
    setReplicaCount(rc);
    setFailover(null);
    setOutage(0);
    counter.current = 1;
    setPending([]);
    const base: DbNode[] = [{ id: 'db-1', az: 'us-east-1a', role: 'primary', up: true, version: 1 }];
    if (m) base.push({ id: 'db-2', az: 'us-east-1b', role: 'standby', up: true, version: 1 });
    for (let i = 0; i < rc; i++) base.push({ id: `replica-${i + 1}`, az: ['us-east-1c', 'us-east-1b', 'us-east-1a'][i % 3], role: 'replica', up: true, version: 1 });
    setNodes(base);
    setReadResult(null);
    setLog([`t=${clock}s Configuration: ${m ? 'Multi-AZ' : 'Single-AZ'} with ${rc} read replica(s)`]);
  };

  // diagram positions
  const W = 760;
  const H = 280;
  const posOf = (nd: DbNode, i: number) => {
    if (nd.role === 'standalone') return { x: 640, y: 215 };
    if (nd.role === 'primary') return { x: 400, y: 80 };
    if (nd.role === 'standby') return { x: 620, y: 80 };
    return { x: 330 + i * 150, y: 215 };
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-line bg-bg/60">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <rect x={20} y={50} width={130} height={60} rx={8} style={{ fill: 'var(--color-panel2)', stroke: 'var(--color-line)' }} />
            <text x={85} y={76} textAnchor="middle" style={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 600 }}>
              App servers
            </text>
            <text x={85} y={93} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 10 }}>
              writes + reads
            </text>
            <text x={210} y={70} textAnchor="middle" className="mono" style={{ fill: '#ff9900', fontSize: 9.5 }}>
              writer endpoint
            </text>
            <text x={210} y={200} textAnchor="middle" className="mono" style={{ fill: '#4aa8ff', fontSize: 9.5 }}>
              reader endpoint
            </text>
            {primary && (
              <line x1={150} y1={80} x2={posOf(primary, 0).x - 60} y2={80} style={{ stroke: writable ? '#ff9900' : '#f0524d', strokeWidth: 1.8, strokeDasharray: writable ? undefined : '5 4' }} />
            )}
            {writable && <circle cx={150 + (400 - 60 - 150) * t} cy={80} r={3.5} style={{ fill: '#ff9900' }} />}
            {replicas.map((rp, i) => {
              const ps = posOf(rp, i);
              return <path key={rp.id} d={`M150 100 C 200 210, 230 ${ps.y}, ${ps.x - 60} ${ps.y}`} style={{ fill: 'none', stroke: '#4aa8ff', strokeWidth: 1.2, opacity: 0.7 }} />;
            })}
            {primary && standby && <line x1={460} y1={80} x2={560} y2={80} style={{ stroke: primary.up ? '#2fbf71' : '#64748b', strokeWidth: 2 }} />}
            {primary && standby && (
              <text x={510} y={70} textAnchor="middle" style={{ fill: '#2fbf71', fontSize: 9.5 }}>
                synchronous
              </text>
            )}
            {primary &&
              replicas.map((rp, i) => {
                const ps = posOf(rp, i);
                return (
                  <g key={rp.id}>
                    <line x1={400} y1={110} x2={ps.x} y2={ps.y - 30} style={{ stroke: '#a78bfa', strokeWidth: 1.2, strokeDasharray: '4 3' }} />
                    <circle cx={400 + (ps.x - 400) * ((t * 0.8) % 1)} cy={110 + (ps.y - 30 - 110) * ((t * 0.8) % 1)} r={2.5} style={{ fill: '#a78bfa' }} />
                  </g>
                );
              })}
            {nodes.map((nd) => {
              const i = replicas.indexOf(nd);
              const ps = posOf(nd, i);
              const color = !nd.up ? '#f0524d' : nd.role === 'standby' ? '#94a3b8' : nd.role === 'replica' ? '#4aa8ff' : '#ff9900';
              return (
                <g key={nd.id}>
                  <rect x={ps.x - 60} y={ps.y - 30} width={120} height={60} rx={8} style={{ fill: 'var(--color-panel)', stroke: color, strokeWidth: 1.8 }} />
                  <text x={ps.x} y={ps.y - 12} textAnchor="middle" style={{ fill: color, fontSize: 9.5, fontWeight: 700 }}>
                    {!nd.up ? 'FAILED' : nd.role.toUpperCase()}
                  </text>
                  <text x={ps.x} y={ps.y + 3} textAnchor="middle" className="mono" style={{ fill: 'var(--color-ink)', fontSize: 10.5 }}>
                    {nd.id}
                  </text>
                  <text x={ps.x} y={ps.y + 17} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 9.5 }}>
                    {nd.az} · v{nd.version}
                  </text>
                </g>
              );
            })}
            {failover !== null && (
              <text x={510} y={140} textAnchor="middle" style={{ fill: '#f5a524', fontSize: 12, fontWeight: 600 }}>
                Failover in progress… {failover}s
              </text>
            )}
            {outage > 0 && (
              <text x={400} y={140} textAnchor="middle" style={{ fill: '#f0524d', fontSize: 12, fontWeight: 600 }}>
                DATABASE DOWN – recovering ({outage}s)
              </text>
            )}
          </svg>
        </div>
        <div className="space-y-3">
          <Toggle checked={multiAz} onChange={(v) => reconfigure(v, replicaCount)} label="Multi-AZ (standby in another AZ)" />
          <Slider label="Read replicas" value={replicaCount} min={0} max={3} onChange={(v) => reconfigure(multiAz, v)} />
          <Slider label="Replica lag" value={lag} min={0} max={10} onChange={setLag} format={(v) => `${v}s`} />
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn btn-sm btn-primary" onClick={write}>
              <Pencil size={12} /> Write
            </button>
            <button className="btn btn-sm" onClick={() => read('writer')}>
              <Eye size={12} /> Read (writer)
            </button>
            <button className="btn btn-sm" onClick={() => read('reader')}>
              <Eye size={12} /> Read (replica)
            </button>
            <button className="btn btn-sm btn-danger" onClick={failPrimary} disabled={!primary?.up}>
              <Zap size={12} /> Fail primary
            </button>
            <button className="btn btn-sm col-span-2" onClick={promote} disabled={replicas.length === 0 || nodes.some((x) => x.role === 'standalone')}>
              <ArrowUpCircle size={12} /> Promote replica (manual DR)
            </button>
          </div>
          {readResult && <div className={`rounded-lg border px-2.5 py-2 text-[12px] mono ${readResult.startsWith('✕') ? 'border-bad/50 text-bad' : readResult.includes('STALE') ? 'border-warn/50 text-warn' : 'border-ok/50 text-ok'}`}>{readResult}</div>}
        </div>
      </div>
      <div className="mono text-[11px] text-muted max-h-40 overflow-auto space-y-0.5 rounded-lg border border-line p-2">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <Callout kind="info">
        <b>Multi-AZ standby</b> = high availability (synchronous, automatic failover, the standby does not serve reads in the classic Multi-AZ instance deployment). <b>Read replicas</b> = read scaling (asynchronous, can be stale, can be in other Regions, promotion is manual). Aurora and Multi-AZ DB clusters differ in details – see the docs.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------- DynamoDB */

interface Item {
  customerId: string;
  orderDate: string;
  total: number;
  status: string;
}

const ITEMS: Item[] = [
  { customerId: 'C#alice', orderDate: '2026-09-02', total: 42, status: 'SHIPPED' },
  { customerId: 'C#alice', orderDate: '2026-10-14', total: 18, status: 'SHIPPED' },
  { customerId: 'C#alice', orderDate: '2026-11-20', total: 99, status: 'PENDING' },
  { customerId: 'C#bob', orderDate: '2026-08-11', total: 250, status: 'SHIPPED' },
  { customerId: 'C#bob', orderDate: '2026-11-03', total: 12, status: 'CANCELLED' },
  { customerId: 'C#carol', orderDate: '2026-07-30', total: 75, status: 'SHIPPED' },
  { customerId: 'C#carol', orderDate: '2026-11-21', total: 33, status: 'PENDING' },
  { customerId: 'C#dave', orderDate: '2026-10-01', total: 61, status: 'SHIPPED' },
  { customerId: 'C#erin', orderDate: '2026-06-15', total: 140, status: 'SHIPPED' },
  { customerId: 'C#erin', orderDate: '2026-11-19', total: 8, status: 'PENDING' },
  { customerId: 'C#frank', orderDate: '2026-09-25', total: 300, status: 'SHIPPED' },
  { customerId: 'C#grace', orderDate: '2026-11-11', total: 55, status: 'SHIPPED' },
];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 3;

type Op = 'get' | 'query' | 'queryRange' | 'scan' | 'scanFilter';

function DynamoLab() {
  const [op, setOp] = useState<Op>('get');
  const [cust, setCust] = useState('C#alice');
  const [run, setRun] = useState(0);
  const parts = useMemo(() => [0, 1, 2].map((pi) => ITEMS.filter((i) => hash(i.customerId) === pi)), []);

  const res = useMemo(() => {
    const k = (i: Item) => `${i.customerId}|${i.orderDate}`;
    let read: Item[] = [];
    let ret: Item[] = [];
    let code = '';
    let note = '';
    if (op === 'get') {
      const it = ITEMS.find((i) => i.customerId === cust) ?? ITEMS[0];
      read = ret = [it];
      code = `aws dynamodb get-item --table-name Orders \\\n  --key '{"customerId":{"S":"${it.customerId}"},"orderDate":{"S":"${it.orderDate}"}}'`;
      note = `Full primary key given → DynamoDB hashes the partition key to one partition and reads exactly one item. Single-digit-millisecond latency at any table size.`;
    } else if (op === 'query') {
      read = ret = ITEMS.filter((i) => i.customerId === cust);
      code = `aws dynamodb query --table-name Orders \\\n  --key-condition-expression "customerId = :c" \\\n  --expression-attribute-values '{":c":{"S":"${cust}"}}'`;
      note = `Query needs the partition key. Only that customer’s item collection (one partition) is read, sorted by orderDate.`;
    } else if (op === 'queryRange') {
      read = ret = ITEMS.filter((i) => i.customerId === cust && i.orderDate >= '2026-10-01');
      code = `aws dynamodb query --table-name Orders \\\n  --key-condition-expression "customerId = :c AND orderDate >= :d" \\\n  --expression-attribute-values '{":c":{"S":"${cust}"},":d":{"S":"2026-10-01"}}'`;
      note = `Sort-key conditions (=, <, >, BETWEEN, begins_with) narrow the read inside the partition – you only pay for what is read.`;
    } else if (op === 'scan') {
      read = ret = ITEMS;
      code = `aws dynamodb scan --table-name Orders`;
      note = `Scan reads EVERY item in EVERY partition. Fine for 12 items; at millions of items it is slow and consumes huge read capacity.`;
    } else {
      read = ITEMS;
      ret = ITEMS.filter((i) => i.status === 'PENDING');
      code = `aws dynamodb scan --table-name Orders \\\n  --filter-expression "#s = :p" \\\n  --expression-attribute-names '{"#s":"status"}' \\\n  --expression-attribute-values '{":p":{"S":"PENDING"}}'`;
      note = `A filter is applied AFTER reading: ${ITEMS.length} items read (and billed), ${ret.length} returned. Model a GSI on status instead for this access pattern.`;
    }
    return { readKeys: new Set(read.map(k)), retKeys: new Set(ret.map(k)), code, note, read: read.length, ret: ret.length, partitionsTouched: new Set(read.map((i) => hash(i.customerId))).size, k };
  }, [op, cust]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          tabs={[
            { id: 'get', label: 'GetItem' },
            { id: 'query', label: 'Query (PK)' },
            { id: 'queryRange', label: 'Query (PK + SK range)' },
            { id: 'scan', label: 'Scan' },
            { id: 'scanFilter', label: 'Scan + filter' },
          ]}
          value={op}
          onChange={(v) => {
            setOp(v);
            setRun((r) => r + 1);
          }}
        />
        {op !== 'scan' && op !== 'scanFilter' && (
          <select className="select mono text-[12px]" value={cust} onChange={(e) => { setCust(e.target.value); setRun((r) => r + 1); }}>
            {[...new Set(ITEMS.map((i) => i.customerId))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <button className="btn btn-sm" onClick={() => setRun((r) => r + 1)}>
          <RotateCcw size={12} /> Replay
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {parts.map((items, pi) => (
          <div key={pi} className={`rounded-lg border p-2 ${items.some((i) => res.readKeys.has(res.k(i))) ? 'border-accent' : 'border-line'}`}>
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="font-semibold">Partition {pi + 1}</span>
              <span className="text-faint">hash(customerId)</span>
            </div>
            <div className="space-y-1">
              {items.map((i, idx) => {
                const key = res.k(i);
                const read = res.readKeys.has(key);
                const ret = res.retKeys.has(key);
                return (
                  <motion.div
                    key={`${key}-${run}`}
                    initial={{ opacity: 0.5, scale: 0.98 }}
                    animate={{ opacity: read || res.read === 0 ? 1 : 0.35, scale: 1 }}
                    transition={{ delay: read ? idx * 0.08 : 0 }}
                    className={`rounded border px-2 py-1 mono text-[10.5px] ${ret ? 'border-ok bg-ok/10' : read ? 'border-warn bg-warn/10' : 'border-line'}`}
                  >
                    <span className="text-accent">{i.customerId}</span> · <span className="text-sky">{i.orderDate}</span> · ${i.total} · {i.status}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge tone="warn">items read: {res.read}</Badge>
        <Badge tone="ok">items returned: {res.ret}</Badge>
        <Badge tone="sky">partitions touched: {res.partitionsTouched}</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <CodeBlock code={res.code} lang="shell" title="AWS CLI equivalent (not executed)" />
        <Callout kind="info">{res.note}</Callout>
      </div>
      <div className="rounded-xl border border-line p-3">
        <div className="text-[13px] font-semibold mb-2">The JOIN question: relational vs DynamoDB</div>
        <div className="grid gap-3 lg:grid-cols-2">
          <CodeBlock
            lang="text"
            title="Relational (RDS PostgreSQL)"
            code={`SELECT c.name, o.order_date, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.id = 'alice'
ORDER BY o.order_date;

-- Normalised tables, joined at query time.
-- Flexible ad-hoc queries; scale up + read replicas.`}
          />
          <CodeBlock
            lang="text"
            title="DynamoDB (single-table design)"
            code={`PK=C#alice  SK=PROFILE           name=Alice, email=…
PK=C#alice  SK=ORDER#2026-09-02  total=42
PK=C#alice  SK=ORDER#2026-10-14  total=18

Query PK = "C#alice"
  -> profile + all orders in ONE request.
-- No JOINs: design keys around access patterns,
-- pre-join (denormalise) at write time.`}
          />
        </div>
      </div>
    </div>
  );
}

export default function DbSimulator() {
  const [tab, setTab] = useState<'rds' | 'ddb'>('rds');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'rds', label: 'RDS: Multi-AZ & read replicas' },
          { id: 'ddb', label: 'DynamoDB: access patterns' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'rds' ? <RdsLab /> : <DynamoLab />}
    </div>
  );
}
