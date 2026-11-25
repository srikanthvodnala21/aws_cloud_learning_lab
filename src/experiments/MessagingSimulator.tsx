import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Pause, Play, RotateCcw, Send, Skull } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useInterval } from '../animation/useLoop';
import { axisTick, chartTooltip } from '../components/chartStyles';
import { matchPattern, type Json } from '../simulations/eventPattern';
import { Badge, Callout, Slider, Tabs, Toggle } from '../components/ui';

/* ------------------------------------------------------------------ SQS */

interface Msg {
  id: number;
  group: string;
  receives: number;
  invisibleFor: number; // ticks until visible again (0 = visible)
  poison: boolean;
  consumer?: number;
  workLeft?: number;
}

const GROUPS = ['A', 'B', 'C'];
const GROUP_COLOR: Record<string, string> = { A: '#4aa8ff', B: '#2fbf71', C: '#e879f9' };

function SqsLab() {
  const [running, setRunning] = useState(true);
  const [fifo, setFifo] = useState(false);
  const [rate, setRate] = useState(2);
  const [consumers, setConsumers] = useState(2);
  const [procTicks, setProcTicks] = useState(3);
  const [visTimeout, setVisTimeout] = useState(6);
  const [maxReceive, setMaxReceive] = useState(3);
  const [dlqOn, setDlqOn] = useState(true);
  const [poisonPct, setPoisonPct] = useState(10);
  const [queue, setQueue] = useState<Msg[]>([]);
  const [done, setDone] = useState<Msg[]>([]);
  const [dlq, setDlq] = useState<Msg[]>([]);
  const [stats, setStats] = useState({ processed: 0, duplicates: 0, failed: 0, outOfOrder: 0 });
  const [hist, setHist] = useState<{ t: number; visible: number; inflight: number; dlq: number }[]>([]);
  const nextId = useRef(1);
  const tick = useRef(0);
  const lastDone = useRef<Record<string, number>>({});

  useInterval(
    () => {
      tick.current += 1;
      let q = queue.map((m) => ({ ...m }));
      const st = { ...stats };
      const finished: Msg[] = [];
      const toDlq: Msg[] = [];
      // produce
      for (let i = 0; i < rate; i++) q.push({ id: nextId.current++, group: GROUPS[Math.floor(Math.random() * GROUPS.length)], receives: 0, invisibleFor: 0, poison: Math.random() * 100 < poisonPct });
      // in-flight progress
      q.forEach((m) => {
        if (m.invisibleFor > 0) m.invisibleFor -= 1;
        if (m.consumer !== undefined && m.workLeft !== undefined) {
          m.workLeft -= 1;
          if (m.workLeft <= 0) {
            if (m.poison) {
              st.failed += 1; // consumer throws → message not deleted; reappears after the visibility timeout
              m.consumer = undefined;
              m.workLeft = undefined;
            } else {
              finished.push(m);
            }
          }
        }
        // visibility timeout expired while still processing → becomes visible again (duplicate delivery!)
        if (m.invisibleFor === 0 && m.consumer !== undefined && m.workLeft !== undefined && m.workLeft > 0) {
          st.duplicates += 1;
          m.consumer = undefined;
          m.workLeft = undefined;
        }
      });
      const finIds = new Set(finished.map((m) => m.id));
      q = q.filter((m) => !finIds.has(m.id));
      finished.forEach((m) => {
        st.processed += 1;
        if (lastDone.current[m.group] !== undefined && m.id < lastDone.current[m.group]) st.outOfOrder += 1;
        lastDone.current[m.group] = Math.max(lastDone.current[m.group] ?? 0, m.id);
      });
      // consumers receive
      const busy = new Set(q.filter((m) => m.consumer !== undefined).map((m) => m.consumer));
      const lockedGroups = new Set(q.filter((m) => m.invisibleFor > 0).map((m) => m.group));
      for (let c = 0; c < consumers; c++) {
        if (busy.has(c)) continue;
        let candidates = q.filter((m) => m.invisibleFor === 0 && m.consumer === undefined);
        if (fifo) {
          // FIFO: only the oldest message of a group that has nothing in flight
          candidates = GROUPS.filter((g) => !lockedGroups.has(g))
            .map((g) => q.filter((m) => m.group === g && m.invisibleFor === 0).sort((a, b) => a.id - b.id)[0])
            .filter(Boolean) as Msg[];
          candidates.sort((a, b) => a.id - b.id);
        } else {
          // Standard: best-effort ordering – pick roughly from the front
          candidates = candidates.slice(0, 4).sort(() => Math.random() - 0.5);
        }
        const m = candidates[0];
        if (!m) continue;
        if (dlqOn && m.receives >= maxReceive) {
          toDlq.push(m);
          q = q.filter((x) => x.id !== m.id);
          continue;
        }
        m.receives += 1;
        m.consumer = c;
        m.workLeft = procTicks;
        m.invisibleFor = visTimeout;
        lockedGroups.add(m.group);
        busy.add(c);
      }
      setQueue(q);
      if (finished.length) setDone((d) => [...finished, ...d].slice(0, 24));
      if (toDlq.length) setDlq((d) => [...toDlq, ...d].slice(0, 40));
      setStats(st);
      setHist((h) => [...h, { t: tick.current, visible: q.filter((m) => m.invisibleFor === 0).length, inflight: q.filter((m) => m.invisibleFor > 0).length, dlq: dlq.length + toDlq.length }].slice(-60));
    },
    running ? 700 : null,
  );

  const reset = () => {
    setQueue([]);
    setDone([]);
    setDlq([]);
    setHist([]);
    setStats({ processed: 0, duplicates: 0, failed: 0, outOfOrder: 0 });
    lastDone.current = {};
    tick.current = 0;
  };

  const visible = queue.filter((m) => m.invisibleFor === 0);
  const inflight = queue.filter((m) => m.invisibleFor > 0);

  const chip = (m: Msg) => (
    <motion.div
      layout
      layoutId={`m${m.id}`}
      key={m.id}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      className="flex h-6 items-center gap-1 rounded px-1.5 mono text-[10px] text-white"
      style={{ background: m.poison ? '#7f1d1d' : GROUP_COLOR[m.group] + 'cc', border: m.poison ? '1px solid #f0524d' : undefined }}
      title={`message ${m.id}${fifo ? ` · group ${m.group}` : ''} · received ${m.receives}×${m.poison ? ' · poison' : ''}`}
    >
      {m.poison && <Skull size={10} />}#{m.id}
      {m.receives > 1 && <span className="opacity-80">×{m.receives}</span>}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Toggle checked={fifo} onChange={(v) => { setFifo(v); reset(); }} label={<span>FIFO queue {fifo && <span className="mono text-[11px] text-faint">orders.fifo</span>}</span>} />
          </div>
          <Slider label="Producer rate" value={rate} min={0} max={8} onChange={setRate} format={(v) => `${v} msg/tick`} />
          <Slider label="Consumers" value={consumers} min={0} max={10} onChange={setConsumers} />
          <Slider label="Processing time" value={procTicks} min={1} max={12} onChange={setProcTicks} format={(v) => `${v} ticks`} />
          <Slider label="Visibility timeout" value={visTimeout} min={1} max={15} onChange={setVisTimeout} format={(v) => `${v} ticks`} />
          <Slider label="Poison messages" value={poisonPct} min={0} max={50} onChange={setPoisonPct} format={(v) => `${v}%`} />
          <Toggle checked={dlqOn} onChange={setDlqOn} label="Redrive policy → dead-letter queue" />
          {dlqOn && <Slider label="maxReceiveCount" value={maxReceive} min={1} max={10} onChange={setMaxReceive} />}
          <div className="flex gap-1.5">
            <button className="btn btn-sm btn-primary" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Pause' : 'Run'}
            </button>
            <button className="btn btn-sm" onClick={reset}>
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Badge tone="ok">processed {stats.processed}</Badge>
            <Badge tone="warn">duplicate deliveries {stats.duplicates}</Badge>
            <Badge tone="bad">consumer failures {stats.failed}</Badge>
            <Badge tone="violet">out-of-order (per group) {stats.outOfOrder}</Badge>
            <Badge>DLQ {dlq.length}</Badge>
          </div>
          {procTicks > visTimeout && <div className="text-[12px] text-warn">⚠ Processing takes longer than the visibility timeout – messages reappear while still being processed and are delivered again. Make consumers idempotent and set the timeout above your processing time.</div>}
          {poisonPct > 0 && !dlqOn && <div className="text-[12px] text-warn">⚠ Without a DLQ, poison messages are retried forever (until the retention period expires), wasting consumer time.</div>}
          <LayoutGroup>
            <div className="grid gap-2 md:grid-cols-4">
              {[
                { title: `Queue – visible (${visible.length})`, items: visible.slice(0, 40), cls: 'border-line' },
                { title: `In flight – invisible (${inflight.length})`, items: inflight, cls: 'border-sky/50' },
                { title: 'Processed & deleted', items: done.slice(0, 16), cls: 'border-ok/50' },
                { title: `Dead-letter queue (${dlq.length})`, items: dlq.slice(0, 24), cls: 'border-bad/50' },
              ].map((col) => (
                <div key={col.title} className={`min-h-48 rounded-lg border p-2 ${col.cls}`}>
                  <div className="label mb-1.5">{col.title}</div>
                  <div className="flex flex-wrap content-start gap-1">
                    <AnimatePresence>{col.items.map(chip)}</AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </LayoutGroup>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: consumers }).map((_, c) => {
              const m = queue.find((x) => x.consumer === c);
              return (
                <div key={c} className={`rounded border px-2 py-1 text-[11px] ${m ? 'border-accent text-ink' : 'border-line text-faint'}`}>
                  consumer {c + 1}: {m ? `#${m.id} (${m.workLeft} left)` : 'polling…'}
                </div>
              );
            })}
          </div>
          <div className="h-44 rounded-lg border border-line p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={axisTick} />
                <YAxis tick={axisTick} width={30} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="visible" name="ApproximateNumberOfMessagesVisible" stroke="#4aa8ff" fill="#4aa8ff33" isAnimationActive={false} />
                <Area dataKey="inflight" name="…NotVisible (in flight)" stroke="#ff9900" fill="#ff990033" isAnimationActive={false} />
                <Area dataKey="dlq" name="DLQ depth" stroke="#f0524d" fill="#f0524d22" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <Callout kind="info">
        {fifo
          ? 'FIFO: strict order and exactly-once processing within a message group. While a message of group A is in flight, no other message of group A is delivered – so groups are your unit of parallelism.'
          : 'Standard: nearly unlimited throughput, at-least-once delivery and best-effort ordering. Watch “out-of-order” and “duplicates” – your consumers must tolerate both.'}
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------------ SNS */

interface Sub {
  id: string;
  label: string;
  protocol: string;
  filter: Record<string, Json> | null;
}

const SUBS: Sub[] = [
  { id: 'email', label: 'ops@example.com', protocol: 'email', filter: null },
  { id: 'inv', label: 'inventory-queue', protocol: 'sqs', filter: { eventType: ['OrderPlaced'] } },
  { id: 'fraud', label: 'fraud-check', protocol: 'lambda', filter: { total: [{ numeric: ['>=', 500] }] } },
  { id: 'eu', label: 'eu-analytics', protocol: 'https', filter: { region: [{ prefix: 'eu-' }] } },
  { id: 'cancel', label: 'refunds-queue', protocol: 'sqs', filter: { eventType: ['OrderCancelled'] } },
];

function SnsLab() {
  const [eventType, setEventType] = useState('OrderPlaced');
  const [total, setTotal] = useState(120);
  const [region, setRegion] = useState('eu-west-1');
  const [shot, setShot] = useState(0);
  const [lastAttrs, setLastAttrs] = useState<Record<string, Json> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const publish = () => {
    const attrs = { eventType, total, region };
    setLastAttrs(attrs);
    setShot((s) => s + 1);
    const c = { ...counts };
    SUBS.forEach((s) => {
      if (!s.filter || matchPattern(s.filter, attrs).ok) c[s.id] = (c[s.id] ?? 0) + 1;
    });
    setCounts(c);
  };

  const results = useMemo(() => (lastAttrs ? SUBS.map((s) => ({ s, res: s.filter ? matchPattern(s.filter, lastAttrs) : { ok: true, traces: [] } })) : []), [lastAttrs]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2.5">
          <div className="text-[13px] font-semibold">Publish to topic <span className="mono text-accent">order-events</span></div>
          <div>
            <div className="label mb-1">Message attribute: eventType</div>
            <select className="select w-full" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {['OrderPlaced', 'OrderShipped', 'OrderCancelled'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <Slider label="total (Number)" value={total} min={0} max={2000} step={10} onChange={setTotal} format={(v) => `$${v}`} />
          <div>
            <div className="label mb-1">region</div>
            <select className="select w-full" value={region} onChange={(e) => setRegion(e.target.value)}>
              {['eu-west-1', 'eu-central-1', 'us-east-1', 'ap-south-1'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary w-full" onClick={publish}>
            <Send size={14} /> Publish
          </button>
        </div>
        <div className="relative rounded-lg border border-line bg-bg/60 p-4">
          <div className="grid grid-cols-[120px_1fr] items-center gap-6">
            <div className="rounded-lg border border-pink/60 bg-panel p-3 text-center">
              <div className="text-[12px] font-semibold">SNS topic</div>
              <div className="mono text-[10.5px] text-muted">order-events</div>
            </div>
            <div className="space-y-2">
              {SUBS.map((s) => {
                const r = results.find((x) => x.s.id === s.id);
                const delivered = r?.res.ok;
                return (
                  <div key={s.id} className="relative flex items-center gap-2">
                    <div className="relative h-0.5 flex-1 rounded bg-line">
                      {r && (
                        <motion.div key={`${shot}-${s.id}`} className="absolute -top-1.5 h-3.5 w-3.5 rounded-full" style={{ background: delivered ? '#e879f9' : '#f0524d' }} initial={{ left: '0%', opacity: 1 }} animate={{ left: delivered ? '96%' : '45%', opacity: delivered ? 1 : 0 }} transition={{ duration: delivered ? 0.9 : 0.6, ease: 'easeInOut' }} />
                      )}
                    </div>
                    <div className={`w-56 rounded border p-2 text-[11.5px] ${r ? (delivered ? 'border-ok/60 bg-ok/5' : 'border-line opacity-60') : 'border-line'}`}>
                      <div className="flex justify-between">
                        <span className="font-medium">{s.label}</span>
                        <Badge>{s.protocol}</Badge>
                      </div>
                      <div className="mono text-[10px] text-faint">{s.filter ? JSON.stringify(s.filter) : 'no filter policy – receives all'}</div>
                      <div className="text-[10.5px] text-muted">received: {counts[s.id] ?? 0}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {lastAttrs && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Filter evaluation</th>
                <th>Delivered?</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ s, res }) => (
                <tr key={s.id}>
                  <td className="text-[12px]">{s.label}</td>
                  <td className="mono text-[11px] text-muted">{s.filter ? res.traces.map((t) => `${t.path}: ${t.why}`).join('; ') : '—'}</td>
                  <td className={res.ok ? 'text-ok' : 'text-faint'}>{res.ok ? 'yes' : 'filtered out'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Callout kind="info">Fan-out: one publish, many independent subscribers. Filter policies are evaluated by SNS, so subscribers only receive (and pay for) what they need. SNS does not store messages – put an SQS queue behind a subscription when the consumer needs buffering or retries.</Callout>
    </div>
  );
}

/* ----------------------------------------------------------- EventBridge */

const EVENTS: { label: string; ev: Json }[] = [
  { label: 'EC2 instance stopped', ev: { source: 'aws.ec2', 'detail-type': 'EC2 Instance State-change Notification', region: 'us-east-1', detail: { 'instance-id': 'i-0abc123', state: 'stopped' } } },
  { label: 'EC2 instance running', ev: { source: 'aws.ec2', 'detail-type': 'EC2 Instance State-change Notification', region: 'eu-west-1', detail: { 'instance-id': 'i-0def456', state: 'running' } } },
  { label: 'Big order placed', ev: { source: 'com.acme.orders', 'detail-type': 'OrderPlaced', region: 'eu-west-1', detail: { orderId: 'o-991', total: 1250, customer: { tier: 'gold', country: 'IE' } } } },
  { label: 'Small test order', ev: { source: 'com.acme.orders', 'detail-type': 'OrderPlaced', region: 'us-east-1', detail: { orderId: 'test-17', total: 9, customer: { tier: 'basic', country: 'US' } } } },
  { label: 'S3 object created', ev: { source: 'aws.s3', 'detail-type': 'Object Created', region: 'us-east-1', detail: { bucket: { name: 'uploads' }, object: { key: 'images/cat.png', size: 48211 } } } },
];

const PATTERNS: Record<string, string> = {
  'EC2 stopped (exact)': `{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": { "state": ["stopped", "terminated"] }
}`,
  'Orders ≥ 1000 (numeric)': `{
  "source": ["com.acme.orders"],
  "detail": { "total": [{ "numeric": [">=", 1000] }] }
}`,
  'Not test orders (anything-but prefix)': `{
  "source": ["com.acme.orders"],
  "detail": { "orderId": [{ "anything-but": { "prefix": "test-" } }] }
}`,
  'PNG uploads (suffix)': `{
  "source": ["aws.s3"],
  "detail": { "object": { "key": [{ "suffix": ".png" }] } }
}`,
  'Gold customers (nested + exists)': `{
  "detail": {
    "customer": { "tier": ["gold"], "country": [{ "exists": true }] }
  }
}`,
};

function EventBridgeLab() {
  const [pattern, setPattern] = useState(PATTERNS['EC2 stopped (exact)']);
  const parsed = useMemo(() => {
    try {
      return { p: JSON.parse(pattern) as Json };
    } catch (e) {
      return { err: (e as Error).message };
    }
  }, [pattern]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2">
          <div className="text-[13px] font-semibold">Rule event pattern</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(PATTERNS).map(([k, v]) => (
              <button key={k} className={`btn btn-sm ${pattern === v ? 'btn-active' : ''}`} onClick={() => setPattern(v)}>
                {k}
              </button>
            ))}
          </div>
          <textarea className="input mono h-56 w-full text-[12px]" spellCheck={false} value={pattern} onChange={(e) => setPattern(e.target.value)} />
          {parsed.err ? <div className="text-[12px] text-bad">Invalid JSON: {parsed.err}</div> : <div className="text-[12px] text-ok">✓ Pattern parsed</div>}
          <p className="text-[11.5px] text-faint">Fields are ANDed; values inside an array are ORed. Fields not mentioned are ignored.</p>
        </div>
        <div className="space-y-2">
          <div className="text-[13px] font-semibold">Events arriving on the default event bus</div>
          {EVENTS.map(({ label, ev }) => {
            const res = parsed.p ? matchPattern(parsed.p, ev) : null;
            return (
              <div key={label} className={`rounded-lg border p-2 ${res?.ok ? 'border-ok/60 bg-ok/5' : 'border-line'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium">{label}</span>
                  {res && <Badge tone={res.ok ? 'ok' : 'default'}>{res.ok ? 'MATCH → target invoked' : 'no match'}</Badge>}
                </div>
                <div className="mono text-[10.5px] text-faint truncate">{JSON.stringify(ev)}</div>
                {res && (
                  <div className="mt-1 space-y-0.5">
                    {res.traces.map((t, i) => (
                      <div key={i} className={`mono text-[10.5px] ${t.ok ? 'text-ok' : 'text-bad'}`}>
                        {t.ok ? '✓' : '✕'} {t.path}: {t.why}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MessagingSimulator() {
  const [tab, setTab] = useState<'sqs' | 'sns' | 'eb'>('sqs');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'sqs', label: 'SQS queue' },
          { id: 'sns', label: 'SNS fan-out' },
          { id: 'eb', label: 'EventBridge rules' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'sqs' ? <SqsLab /> : tab === 'sns' ? <SnsLab /> : <EventBridgeLab />}
    </div>
  );
}
