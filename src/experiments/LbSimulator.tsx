import { useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Zap, Skull, Bug } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useInterval, useLoop } from '../animation/useLoop';
import { axisTick, chartTooltip } from '../components/chartStyles';
import { Badge, Callout, Slider, Tabs, Toggle } from '../components/ui';

type IState = 'booting' | 'initial' | 'healthy' | 'unhealthy' | 'draining';

interface Inst {
  id: string;
  az: number;
  state: IState;
  bootLeft: number;
  okStreak: number;
  failStreak: number;
  broken: boolean;
  served: number;
  cpu: number;
  unhealthyFor: number;
}

const AZS = ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'];
const CAP = 100; // rps one instance handles at 100% CPU (illustrative)
const BOOT = 4; // ticks to boot

let ic = 0;
const mk = (az: number, booted = false): Inst => ({ id: `i-${(0xa10 + ic++).toString(16)}`, az, state: booted ? 'healthy' : 'booting', bootLeft: booted ? 0 : BOOT, okStreak: 0, failStreak: 0, broken: false, served: 0, cpu: 0, unhealthyFor: 0 });

interface Hist {
  t: number;
  rps: number;
  healthy: number;
  cpu: number;
  errors: number;
}

export default function LbSimulator() {
  const [running, setRunning] = useState(true);
  const [rps, setRps] = useState(120);
  const [algo, setAlgo] = useState<'rr' | 'lor'>('rr');
  const [asgOn, setAsgOn] = useState(true);
  const [min, setMin] = useState(2);
  const [max, setMax] = useState(9);
  const [hcThreshold, setHcThreshold] = useState(2);
  const [failedAz, setFailedAz] = useState<number | null>(null);
  const [insts, setInsts] = useState<Inst[]>(() => [mk(0, true), mk(1, true), mk(2, true)]);
  const [desired, setDesired] = useState(3);
  const [hist, setHist] = useState<Hist[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const tick = useRef(0);
  const rr = useRef(0);
  const cooldown = useRef(0);
  const { t } = useLoop(1200, running);

  const ev = (m: string) => setEvents((e) => [`t=${tick.current}s ${m}`, ...e].slice(0, 16));

  useInterval(
    () => {
      tick.current += 1;
      const now = tick.current;
      const msgs: string[] = [];
      let list = insts.map((i) => ({ ...i }));

      // 1. lifecycle: boot, health checks
      list.forEach((i) => {
        const azDown = failedAz === i.az;
        if (i.state === 'booting') {
          if (azDown) return;
          i.bootLeft -= 1;
          if (i.bootLeft <= 0) {
            i.state = 'initial';
            msgs.push(`${i.id} booted – registered with target group (initial health checks)`);
          }
          return;
        }
        const passes = !i.broken && !azDown && i.cpu < 140;
        if (passes) {
          i.okStreak += 1;
          i.failStreak = 0;
        } else {
          i.failStreak += 1;
          i.okStreak = 0;
        }
        if ((i.state === 'initial' || i.state === 'unhealthy') && i.okStreak >= hcThreshold) {
          i.state = 'healthy';
          i.unhealthyFor = 0;
          msgs.push(`${i.id} passed ${hcThreshold} health checks → healthy, receiving traffic`);
        }
        if (i.state === 'healthy' && i.failStreak >= hcThreshold) {
          i.state = 'unhealthy';
          msgs.push(`${i.id} failed ${hcThreshold} consecutive health checks (GET /health) → unhealthy, removed from rotation`);
        }
        if (i.state === 'unhealthy') i.unhealthyFor += 1;
      });

      // 2. route traffic
      const healthy = list.filter((i) => i.state === 'healthy');
      list.forEach((i) => (i.served = 0));
      let errors = 0;
      if (healthy.length === 0) errors = rps;
      else if (algo === 'rr') {
        const per = rps / healthy.length;
        healthy.forEach((i) => (i.served = per));
        rr.current = (rr.current + 1) % healthy.length;
      } else {
        // least outstanding requests: faster (less loaded / not-degraded) targets get more
        const weights = healthy.map((i) => (i.broken ? 0.3 : 1));
        const sum = weights.reduce((a, b) => a + b, 0);
        healthy.forEach((i, k) => (i.served = (rps * weights[k]) / sum));
      }
      list.forEach((i) => (i.cpu = i.state === 'healthy' ? Math.round((i.served / CAP) * 100) : i.state === 'booting' ? 20 : 5));
      const overload = healthy.reduce((a, i) => a + Math.max(0, i.served - CAP * 1.4), 0);
      errors += Math.round(overload);

      // 3. Auto Scaling
      let want = desired;
      if (asgOn) {
        const avgCpu = healthy.length ? healthy.reduce((a, i) => a + i.cpu, 0) / healthy.length : 100;
        if (cooldown.current > 0) cooldown.current -= 1;
        else {
          const inService = list.filter((i) => i.state !== 'unhealthy').length || 1;
          const target = Math.min(max, Math.max(min, Math.ceil((inService * avgCpu) / 50)));
          if (target !== desired && (target > desired || avgCpu < 35)) {
            msgs.push(`Target tracking: avg CPU ${Math.round(avgCpu)}% vs target 50% → desired ${desired} → ${target}`);
            want = target;
            cooldown.current = 3;
          }
        }
        // replace unhealthy instances (ELB health check type)
        list.forEach((i) => {
          if (i.state === 'unhealthy' && i.unhealthyFor >= 2) {
            msgs.push(`ASG terminated unhealthy ${i.id} and is launching a replacement`);
            i.state = 'draining';
          }
        });
        list = list.filter((i) => i.state !== 'draining');
        // reconcile count
        const usable = [0, 1, 2].filter((a) => a !== failedAz);
        while (list.length < want) {
          const counts = usable.map((a) => ({ a, c: list.filter((i) => i.az === a).length })).sort((x, y) => x.c - y.c);
          const n = mk(counts[0].a);
          list.push(n);
          msgs.push(`Launching ${n.id} in ${AZS[n.az]} (AZ balancing)`);
        }
        while (list.length > want) {
          // scale in: remove newest instance in the AZ with the most instances
          const counts = [0, 1, 2].map((a) => ({ a, c: list.filter((i) => i.az === a).length })).sort((x, y) => y.c - x.c);
          const idx = list.map((i) => i.az).lastIndexOf(counts[0].a);
          msgs.push(`Scale-in: deregistering (connection draining) and terminating ${list[idx].id}`);
          list.splice(idx, 1);
        }
      }

      setInsts(list);
      if (want !== desired) setDesired(want);
      const hc = list.filter((i) => i.state === 'healthy');
      setHist((h) => [...h, { t: now, rps, healthy: hc.length, cpu: hc.length ? Math.round(hc.reduce((a, i) => a + i.cpu, 0) / hc.length) : 0, errors }].slice(-60));
      if (msgs.length) setEvents((e) => [...msgs.reverse().map((m) => `t=${now}s ${m}`), ...e].slice(0, 16));
    },
    running ? 1000 : null,
  );

  const reset = () => {
    tick.current = 0;
    cooldown.current = 0;
    setInsts([mk(0, true), mk(1, true), mk(2, true)]);
    setDesired(3);
    setHist([]);
    setEvents([]);
    setFailedAz(null);
    setRps(120);
  };

  const breakOne = () => {
    const h = insts.find((i) => i.state === 'healthy' && !i.broken);
    if (!h) return;
    setInsts((l) => l.map((i) => (i.id === h.id ? { ...i, broken: true } : i)));
    ev(`💥 ${h.id}: application crashed (process still running, /health returns 500)`);
  };
  const killOne = () => {
    const h = insts.find((i) => i.state === 'healthy');
    if (!h) return;
    setInsts((l) => l.filter((i) => i.id !== h.id));
    ev(`☠ ${h.id} terminated unexpectedly`);
  };

  const errorsNow = hist[hist.length - 1]?.errors ?? 0;
  const healthyNow = insts.filter((i) => i.state === 'healthy');

  // layout of the live diagram
  const W = 760;
  const maxPerAz = Math.max(1, ...[0, 1, 2].map((a) => insts.filter((i) => i.az === a).length));
  const H = Math.max(300, 90 + maxPerAz * 46);
  const lb = { x: 220, y: H / 2 };
  const pos = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    [0, 1, 2].forEach((az) => {
      const inAz = insts.filter((i) => i.az === az);
      inAz.forEach((i, k) => (out[i.id] = { x: 400 + az * 125, y: 70 + k * 46 }));
    });
    return out;
  }, [insts]);

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Pause' : 'Resume'}
        </button>
        <button className="btn btn-sm" onClick={reset}>
          <RotateCcw size={12} /> Reset
        </button>
        <button className="btn btn-sm btn-danger" onClick={breakOne}>
          <Bug size={12} /> Break app on an instance
        </button>
        <button className="btn btn-sm btn-danger" onClick={killOne}>
          <Skull size={12} /> Terminate an instance
        </button>
        {AZS.map((a, i) => (
          <button key={a} className={`btn btn-sm ${failedAz === i ? 'btn-danger' : ''}`} onClick={() => { setFailedAz(failedAz === i ? null : i); ev(failedAz === i ? `${a} recovered` : `⚡ ${a} outage – instances there stop responding`); }}>
            <Zap size={12} /> {failedAz === i ? `Recover ${a.slice(-2)}` : `Fail AZ ${a.slice(-2)}`}
          </button>
        ))}
        <button className="btn btn-sm" onClick={() => setRps(520)}>
          Traffic spike ×4
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-line bg-bg/60">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {AZS.map((a, i) => (
              <g key={a}>
                <rect x={345 + i * 125} y={22} width={112} height={H - 34} rx={8} style={{ fill: failedAz === i ? 'rgba(240,82,77,0.08)' : 'rgba(74,168,255,0.05)', stroke: failedAz === i ? '#f0524d' : 'var(--color-line)', strokeDasharray: '4 3' }} />
                <text x={401 + i * 125} y={38} textAnchor="middle" style={{ fill: failedAz === i ? '#f0524d' : 'var(--color-muted)', fontSize: 10.5 }}>
                  {a}
                  {failedAz === i ? ' ✕' : ''}
                </text>
              </g>
            ))}
            {/* clients */}
            <rect x={20} y={lb.y - 24} width={100} height={48} rx={8} style={{ fill: 'var(--color-panel2)', stroke: 'var(--color-line)' }} />
            <text x={70} y={lb.y - 3} textAnchor="middle" style={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 600 }}>
              Clients
            </text>
            <text x={70} y={lb.y + 13} textAnchor="middle" className="mono" style={{ fill: 'var(--color-muted)', fontSize: 10.5 }}>
              {rps} req/s
            </text>
            <line x1={120} y1={lb.y} x2={lb.x - 48} y2={lb.y} style={{ stroke: 'var(--color-line)', strokeWidth: 2 }} />
            {running &&
              Array.from({ length: Math.min(8, Math.ceil(rps / 60)) }).map((_, k) => {
                const f = (t + k / Math.min(8, Math.ceil(rps / 60))) % 1;
                return <circle key={k} cx={120 + (lb.x - 48 - 120) * f} cy={lb.y} r={3} style={{ fill: '#4aa8ff' }} />;
              })}
            {/* LB */}
            <rect x={lb.x - 48} y={lb.y - 30} width={96} height={60} rx={10} style={{ fill: 'var(--color-panel2)', stroke: '#a78bfa', strokeWidth: 1.5 }} />
            <text x={lb.x} y={lb.y - 6} textAnchor="middle" style={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 600 }}>
              ALB
            </text>
            <text x={lb.x} y={lb.y + 10} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 9.5 }}>
              {algo === 'rr' ? 'round robin' : 'least outstanding'}
            </text>
            {errorsNow > 0 && (
              <text x={lb.x} y={lb.y + 48} textAnchor="middle" style={{ fill: '#f0524d', fontSize: 11, fontWeight: 600 }}>
                {healthyNow.length === 0 ? '503 – no healthy targets' : `${errorsNow} req/s failing (overload)`}
              </text>
            )}
            {insts.map((i) => {
              const p = pos[i.id];
              if (!p) return null;
              const color = i.state === 'healthy' ? (i.cpu > 100 ? '#f5a524' : '#2fbf71') : i.state === 'unhealthy' ? '#f0524d' : '#94a3b8';
              const share = i.served;
              const dots = i.state === 'healthy' && running ? Math.max(1, Math.min(5, Math.round(share / 30))) : 0;
              return (
                <g key={i.id}>
                  <line x1={lb.x + 48} y1={lb.y} x2={p.x - 44} y2={p.y} style={{ stroke: i.state === 'healthy' ? 'var(--color-line)' : 'transparent', strokeWidth: 1.2 }} />
                  {Array.from({ length: dots }).map((_, k) => {
                    const f = (t * 1.3 + k / dots) % 1;
                    return <circle key={k} cx={lb.x + 48 + (p.x - 44 - lb.x - 48) * f} cy={lb.y + (p.y - lb.y) * f} r={2.6} style={{ fill: i.broken ? '#f0524d' : '#4aa8ff' }} />;
                  })}
                  <rect x={p.x - 44} y={p.y - 17} width={88} height={34} rx={6} style={{ fill: 'var(--color-panel)', stroke: color, strokeWidth: 1.5, opacity: i.state === 'booting' ? 0.6 : 1 }} />
                  <text x={p.x} y={p.y - 3} textAnchor="middle" className="mono" style={{ fill: 'var(--color-ink)', fontSize: 9.5 }}>
                    {i.id}
                  </text>
                  <text x={p.x} y={p.y + 10} textAnchor="middle" style={{ fill: color, fontSize: 9 }}>
                    {i.state === 'booting' ? `booting ${i.bootLeft}s` : i.state === 'healthy' ? `CPU ${i.cpu}%` : i.state === 'initial' ? 'health checks…' : 'unhealthy'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-3">
          <Slider label="Incoming traffic" value={rps} min={0} max={800} step={10} onChange={setRps} format={(v) => `${v} req/s`} />
          <div>
            <div className="label mb-1">Routing algorithm</div>
            <Tabs tabs={[{ id: 'rr', label: 'Round robin' }, { id: 'lor', label: 'Least outstanding' }]} value={algo} onChange={setAlgo} />
          </div>
          <Slider label="Health check threshold (consecutive)" value={hcThreshold} min={1} max={5} onChange={setHcThreshold} />
          <Toggle checked={asgOn} onChange={setAsgOn} label="Auto Scaling group (target tracking: 50% CPU)" />
          {asgOn && (
            <div className="grid grid-cols-2 gap-3">
              <Slider label="Min" value={min} min={1} max={4} onChange={setMin} />
              <Slider label="Max" value={max} min={3} max={12} onChange={setMax} />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Badge tone="ok">healthy {healthyNow.length}</Badge>
            <Badge tone="sky">desired {asgOn ? desired : '–'}</Badge>
            <Badge tone="warn">booting {insts.filter((i) => i.state === 'booting' || i.state === 'initial').length}</Badge>
            <Badge tone="bad">unhealthy {insts.filter((i) => i.state === 'unhealthy').length}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="h-56 rounded-lg border border-line p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={axisTick} />
              <YAxis yAxisId="l" tick={axisTick} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick} />
              <Tooltip contentStyle={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="l" dataKey="rps" name="req/s" stroke="#4aa8ff" dot={false} isAnimationActive={false} />
              <Line yAxisId="l" dataKey="errors" name="errors/s" stroke="#f0524d" dot={false} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="cpu" name="avg CPU %" stroke="#ff9900" dot={false} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="healthy" name="healthy targets" stroke="#2fbf71" dot={false} isAnimationActive={false} type="stepAfter" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-line p-2">
          <div className="label mb-1">Event log</div>
          <div className="mono text-[10.5px] text-muted space-y-0.5 h-48 overflow-auto">
            {events.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        </div>
      </div>
      <Callout kind="tip">Try: break an app → watch it fail health checks and get replaced. Fail an AZ → traffic shifts to the other two AZs and new instances launch there. Spike traffic → CPU rises above 50% and the ASG scales out after the boot time (that delay is why you keep headroom).</Callout>
    </div>
  );
}
