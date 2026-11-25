import { useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useInterval } from '../animation/useLoop';
import { FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef } from '../animation/flowTypes';
import { e, n, p, r } from '../animation/builders';
import { axisTick, chartTooltip } from '../components/chartStyles';
import { SAMPLE, PRICING_DISCLAIMER } from '../data/pricing';
import { Badge, Callout, CodeBlock, Slider } from '../components/ui';

interface Env {
  id: number;
  kind: 'provisioned' | 'ondemand';
  initLeft: number; // ticks left in INIT
  idle: number; // ticks idle
  busy: boolean;
}

interface Pt {
  t: number;
  concurrency: number;
  cold: number;
  throttled: number;
}

const TRIGGERS = {
  s3: {
    label: 'S3 object uploaded',
    source: 'Amazon S3',
    kind: 'storage' as const,
    mode: 'asynchronous',
    dest: 'Thumbnail written to S3',
    event: `{
  "Records": [{
    "eventSource": "aws:s3",
    "eventName": "ObjectCreated:Put",
    "awsRegion": "us-east-1",
    "s3": {
      "bucket": { "name": "photo-uploads" },
      "object": { "key": "cat.jpg", "size": 482113 }
    }
  }]
}`,
  },
  api: {
    label: 'HTTP request via API Gateway',
    source: 'API Gateway',
    kind: 'network' as const,
    mode: 'synchronous',
    dest: 'Response 200 JSON to client',
    event: `{
  "version": "2.0",
  "routeKey": "GET /orders/{id}",
  "rawPath": "/orders/42",
  "pathParameters": { "id": "42" },
  "requestContext": { "http": { "method": "GET" } }
}`,
  },
  sqs: {
    label: 'SQS batch (event source mapping)',
    source: 'Amazon SQS',
    kind: 'integration' as const,
    mode: 'poll-based',
    dest: 'Batch deleted from queue on success',
    event: `{
  "Records": [
    { "messageId": "1f3c…", "body": "{\\"orderId\\":101}",
      "eventSource": "aws:sqs" },
    { "messageId": "8a2d…", "body": "{\\"orderId\\":102}",
      "eventSource": "aws:sqs" }
  ]
}`,
  },
  cron: {
    label: 'EventBridge schedule (every 5 min)',
    source: 'EventBridge',
    kind: 'integration' as const,
    mode: 'asynchronous',
    dest: 'Report e-mailed via SNS',
    event: `{
  "source": "aws.scheduler",
  "detail-type": "Scheduled Event",
  "time": "2026-11-25T09:05:00Z",
  "detail": {}
}`,
  },
};
type TriggerId = keyof typeof TRIGGERS;

function triggerFlow(id: TriggerId, warm: boolean, run: number): FlowDef {
  const tr = TRIGGERS[id];
  return {
    id: `lambda-trig-${id}-${run}`,
    title: tr.label,
    description: `${tr.mode} invocation · ${warm ? 'warm start' : 'cold start'}`,
    width: 820,
    height: 230,
    nodes: [n('src', tr.source, 90, 110, tr.kind, tr.mode, { w: 130 }), n('svc', 'Lambda service', 290, 110, 'compute', 'routes invocation', { w: 140, icon: 'zap' }), n('env', 'Execution environment', 500, 110, 'compute', warm ? 'warm (reused)' : 'new – cold start', { w: 170 }), n('dst', tr.dest, 720, 110, 'generic', '', { w: 150 })],
    edges: [e('a', 'src', 'svc'), e('b', 'svc', 'env'), e('c', 'env', 'dst')],
    initial: warm ? {} : { env: 'new' },
    steps: [
      { title: 'Event emitted', text: `${tr.source} invokes the function (${tr.mode}). The event JSON is passed to your handler as the first argument.`, packets: [p('a', 'purple', 'event')] },
      warm
        ? { title: 'Warm environment reused', text: 'An idle execution environment already exists, so Lambda sends the event straight to it. Only the handler runs – no init. Global variables and /tmp from the previous invocation are still there.', packets: [p('b', 'purple')], focus: ['env'], badges: { env: '~ms overhead' } }
        : { title: 'Cold start: INIT phase', text: 'No idle environment is available. Lambda creates a micro-VM (Firecracker), downloads your code, starts the runtime and runs code outside the handler (imports, SDK clients, DB connections). This adds latency – from ~100 ms to seconds.', packets: [p('b', 'purple')], focus: ['env'], set: { env: 'warn' }, badges: { env: 'INIT' }, duration: 3200 },
      { title: 'Handler runs', text: 'The handler executes with the configured memory (CPU scales with memory). You are billed per millisecond of duration.', focus: ['env'], set: { env: 'active' } },
      { title: 'Result', text: id === 'api' ? 'The return value is sent back synchronously to API Gateway and on to the client.' : id === 'sqs' ? 'On success the Lambda poller deletes the batch from the queue; on failure messages return to the queue after the visibility timeout.' : 'Asynchronous: the caller already got a 202. Lambda retries twice on error and can send failures to a destination/DLQ.', packets: [p('c', 'green', 'done'), ...(id === 'api' ? [r('a', 'green', '200', { at: 0.3 })] : [])], set: { env: 'ok' } },
    ],
  };
}

let envId = 1;

export default function LambdaSimulator() {
  const [running, setRunning] = useState(true);
  const [rps, setRps] = useState(20);
  const [baseMs, setBaseMs] = useState(400);
  const [memory, setMemory] = useState(512);
  const [initMs, setInitMs] = useState(800);
  const [accountLimit, setAccountLimit] = useState(100);
  const [reserved, setReserved] = useState(0);
  const [provisioned, setProvisioned] = useState(0);
  const [envs, setEnvs] = useState<Env[]>([]);
  const [hist, setHist] = useState<Pt[]>([]);
  const [trig, setTrig] = useState<{ id: TriggerId; def: FlowDef } | null>(null);
  const tick = useRef(0);
  const runN = useRef(0);

  // CPU scales with memory → duration shrinks up to a point
  const durationMs = Math.round(Math.max(baseMs * 0.3, baseMs * Math.pow(1024 / memory, 0.75)));
  const limit = reserved > 0 ? reserved : accountLimit;

  useInterval(
    () => {
      tick.current += 1;
      const need = Math.ceil(rps * (durationMs / 1000));
      const allowed = Math.min(need, limit);
      const throttled = need > limit ? Math.round((need - limit) / (durationMs / 1000)) : 0;
      let list = envs.map((x) => ({ ...x, initLeft: Math.max(0, x.initLeft - 1) }));
      // provisioned environments
      const prov = list.filter((x) => x.kind === 'provisioned');
      if (prov.length < provisioned) for (let i = prov.length; i < provisioned; i++) list.push({ id: envId++, kind: 'provisioned', initLeft: 0, idle: 0, busy: false });
      if (prov.length > provisioned) {
        let drop = prov.length - provisioned;
        list = list.filter((x) => !(x.kind === 'provisioned' && drop-- > 0));
      }
      // assign work: provisioned first, then warm on-demand, then create new
      list.forEach((x) => (x.busy = false));
      let remaining = allowed;
      const ready = list.filter((x) => x.initLeft === 0).sort((a, b) => (a.kind === 'provisioned' ? -1 : 1) - (b.kind === 'provisioned' ? -1 : 1));
      for (const x of ready) {
        if (remaining <= 0) break;
        x.busy = true;
        x.idle = 0;
        remaining--;
      }
      const initing = list.filter((x) => x.initLeft > 0);
      remaining -= initing.length;
      initing.forEach((x) => (x.busy = true));
      let cold = 0;
      const initTicks = Math.max(1, Math.round(initMs / 700));
      while (remaining > 0) {
        list.push({ id: envId++, kind: 'ondemand', initLeft: initTicks, idle: 0, busy: true });
        cold++;
        remaining--;
      }
      // retire idle on-demand envs (Lambda reclaims idle environments after some time)
      list.forEach((x) => {
        if (!x.busy) x.idle += 1;
      });
      list = list.filter((x) => x.kind === 'provisioned' || x.idle < 8);
      setEnvs(list);
      setHist((h) => [...h, { t: tick.current, concurrency: Math.min(need, limit), cold, throttled }].slice(-60));
    },
    running ? 700 : null,
  );

  const last = hist[hist.length - 1];
  const monthlyReq = rps * 60 * 60 * 24 * 30;
  const gbSeconds = monthlyReq * (durationMs / 1000) * (memory / 1024);
  const cost = (monthlyReq / 1e6) * SAMPLE.lambdaPerMillion + gbSeconds * SAMPLE.lambdaGbSecond;
  const fire = (id: TriggerId) => {
    runN.current += 1;
    const warm = envs.some((x) => x.initLeft === 0 && !x.busy);
    setTrig({ id, def: triggerFlow(id, warm, runN.current) });
  };

  const counts = useMemo(
    () => ({
      prov: envs.filter((x) => x.kind === 'provisioned').length,
      init: envs.filter((x) => x.initLeft > 0).length,
      busy: envs.filter((x) => x.busy && x.initLeft === 0).length,
      idle: envs.filter((x) => !x.busy).length,
    }),
    [envs],
  );

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Slider label="Requests per second" value={rps} min={0} max={400} step={5} onChange={setRps} format={(v) => `${v}/s`} />
          <Slider label="Handler duration @1024 MB" value={baseMs} min={20} max={3000} step={20} onChange={setBaseMs} format={(v) => `${v} ms`} />
          <Slider label="Memory (CPU scales with it)" value={memory} min={128} max={4096} step={64} onChange={setMemory} format={(v) => `${v} MB → ${durationMs} ms`} />
          <Slider label="Init (cold start) duration" value={initMs} min={100} max={5000} step={100} onChange={setInitMs} format={(v) => `${v} ms`} />
          <Slider label="Account concurrency limit (Region)" value={accountLimit} min={10} max={1000} step={10} onChange={setAccountLimit} />
          <Slider label="Reserved concurrency (0 = none)" value={reserved} min={0} max={200} step={5} onChange={setReserved} />
          <Slider label="Provisioned concurrency" value={provisioned} min={0} max={60} onChange={setProvisioned} />
          <div className="flex gap-1.5">
            <button className="btn btn-sm btn-primary" onClick={() => setRunning((x) => !x)}>
              {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Pause' : 'Run'}
            </button>
            <button className="btn btn-sm" onClick={() => setRps((x) => Math.min(400, x * 5 || 50))}>
              Burst ×5
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setEnvs([]);
                setHist([]);
                tick.current = 0;
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Badge tone="sky">concurrency needed: {Math.ceil(rps * (durationMs / 1000))}</Badge>
            <Badge tone="violet">provisioned: {counts.prov}</Badge>
            <Badge tone="accent">busy: {counts.busy}</Badge>
            <Badge tone="warn">initialising (cold): {counts.init}</Badge>
            <Badge>idle warm: {counts.idle}</Badge>
            {last && last.throttled > 0 && <Badge tone="bad">throttled: {last.throttled}/s (429 TooManyRequests)</Badge>}
          </div>
          <div className="rounded-lg border border-line p-2">
            <div className="label mb-1">Execution environments (each handles one request at a time)</div>
            <div className="flex flex-wrap gap-1">
              {envs.slice(0, 240).map((x) => (
                <div
                  key={x.id}
                  title={`${x.kind} · ${x.initLeft ? 'INIT' : x.busy ? 'busy' : 'idle'}`}
                  className={`h-3.5 w-3.5 rounded-sm ${x.initLeft ? 'bg-sky animate-pulse' : x.busy ? (x.kind === 'provisioned' ? 'bg-violet' : 'bg-accent') : x.kind === 'provisioned' ? 'border border-violet' : 'bg-panel3'}`}
                />
              ))}
              {envs.length === 0 && <span className="text-[12px] text-faint">No environments yet – scale from zero.</span>}
              {envs.length > 240 && <span className="text-[11px] text-faint">+{envs.length - 240} more</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10.5px] text-muted">
              <span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky" /> cold start (INIT)
              </span>
              <span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> busy
              </span>
              <span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet" /> provisioned busy
              </span>
              <span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-violet" /> provisioned idle
              </span>
              <span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-panel3" /> warm idle
              </span>
            </div>
          </div>
          <div className="h-52 rounded-lg border border-line p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={axisTick} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="concurrency" name="concurrent executions" stroke="#ff9900" fill="#ff990033" isAnimationActive={false} />
                <Area dataKey="cold" name="new cold starts" stroke="#4aa8ff" fill="#4aa8ff33" isAnimationActive={false} />
                <Area dataKey="throttled" name="throttled req/s" stroke="#f0524d" fill="#f0524d33" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border border-line bg-panel2 p-3 text-[12px] text-muted">
            Sample monthly cost at a steady {rps} req/s: <b className="mono text-ink">{(monthlyReq / 1e6).toFixed(1)}M requests</b> × ${SAMPLE.lambdaPerMillion}/M + <b className="mono text-ink">{Math.round(gbSeconds).toLocaleString()} GB-s</b> × ${SAMPLE.lambdaGbSecond} ≈ <b className="mono text-accent">${cost.toFixed(2)}/month</b>. Free tier and provisioned-concurrency charges not included. {PRICING_DISCLAIMER}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-2">Trigger the function</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(TRIGGERS) as TriggerId[]).map((k) => (
            <button key={k} className={`btn btn-sm ${trig?.id === k ? 'btn-active' : ''}`} onClick={() => fire(k)}>
              {TRIGGERS[k].label}
            </button>
          ))}
        </div>
        {trig ? (
          <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
            <FlowPlayer key={trig.def.id} def={trig.def} autoStart />
            <CodeBlock code={TRIGGERS[trig.id].event} lang="json" title="event (sample payload)" />
          </div>
        ) : (
          <Callout kind="tip">Pause the traffic, set requests to 0 and wait for environments to be reclaimed, then fire a trigger – you will see a cold start. Fire it again while environments are warm to see reuse.</Callout>
        )}
      </div>
    </div>
  );
}
