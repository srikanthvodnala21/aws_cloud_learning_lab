import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { FlowCanvas } from '../animation/FlowPlayer';
import type { FlowDef, FlowEdge, FlowNode, FlowStep, Status } from '../animation/flowTypes';
import { useLoop } from '../animation/useLoop';
import { Callout, Tabs } from '../components/ui';

/** Region codes and names are real; positions are approximate; AZ layout below is ILLUSTRATIVE. */
const REGIONS = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', lon: -77.5, lat: 39 },
  { code: 'us-east-2', name: 'US East (Ohio)', lon: -83, lat: 40 },
  { code: 'us-west-2', name: 'US West (Oregon)', lon: -120, lat: 45.8 },
  { code: 'us-west-1', name: 'US West (N. California)', lon: -122, lat: 37.5 },
  { code: 'ca-central-1', name: 'Canada (Central)', lon: -73.6, lat: 45.5 },
  { code: 'sa-east-1', name: 'South America (São Paulo)', lon: -46.6, lat: -23.5 },
  { code: 'eu-west-1', name: 'Europe (Ireland)', lon: -6.3, lat: 53.3 },
  { code: 'eu-west-2', name: 'Europe (London)', lon: -0.1, lat: 51.5 },
  { code: 'eu-central-1', name: 'Europe (Frankfurt)', lon: 8.7, lat: 50.1 },
  { code: 'eu-north-1', name: 'Europe (Stockholm)', lon: 18, lat: 59.3 },
  { code: 'me-south-1', name: 'Middle East (Bahrain)', lon: 50.6, lat: 26 },
  { code: 'af-south-1', name: 'Africa (Cape Town)', lon: 18.4, lat: -33.9 },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', lon: 72.9, lat: 19 },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', lon: 103.8, lat: 1.35 },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', lon: 139.7, lat: 35.7 },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', lon: 151.2, lat: -33.9 },
];

const USERS = [
  { id: 'nyc', name: 'New York', lon: -74, lat: 40.7 },
  { id: 'lon', name: 'London', lon: -0.1, lat: 51.5 },
  { id: 'blr', name: 'Bengaluru', lon: 77.6, lat: 12.97 },
  { id: 'tyo', name: 'Tokyo', lon: 139.7, lat: 35.7 },
  { id: 'sao', name: 'São Paulo', lon: -46.6, lat: -23.5 },
  { id: 'syd', name: 'Sydney', lon: 151.2, lat: -33.9 },
];

// very rough continent outlines (lon, lat) – stylised, not a real map
const LAND: [number, number][][] = [
  [[-168, 65], [-140, 70], [-100, 72], [-80, 65], [-60, 55], [-65, 45], [-80, 30], [-97, 25], [-105, 20], [-90, 15], [-83, 9], [-80, 8], [-95, 17], [-110, 23], [-118, 33], [-125, 40], [-125, 50], [-140, 60], [-160, 58]],
  [[-80, 10], [-60, 10], [-50, 0], [-35, -7], [-40, -22], [-55, -35], [-68, -55], [-75, -45], [-72, -20], [-81, -5]],
  [[-10, 36], [-9, 43], [-2, 48], [-5, 58], [5, 62], [15, 70], [30, 70], [40, 65], [40, 45], [28, 41], [20, 40], [12, 38], [5, 43], [-2, 36]],
  [[-17, 15], [-17, 28], [-6, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -28], [20, -35], [12, -17], [9, 4], [-8, 4]],
  [[40, 45], [40, 65], [60, 70], [100, 77], [140, 72], [180, 68], [160, 60], [140, 50], [130, 35], [122, 30], [120, 22], [108, 18], [105, 10], [100, 2], [98, 15], [90, 22], [80, 10], [73, 20], [60, 25], [50, 30], [48, 40]],
  [[114, -22], [122, -18], [135, -12], [145, -15], [153, -28], [147, -38], [138, -35], [130, -32], [115, -34]],
  [[-5, 50], [2, 51], [0, 58], [-6, 58]],
  [[130, 31], [141, 36], [142, 44], [136, 36]],
];

const W = 800;
const H = 380;
const proj = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * W, y: ((80 - lat) / 140) * H });

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Strategy = '1' | '2' | '3';

export default function RegionExplorer() {
  const [region, setRegion] = useState(REGIONS[6]);
  const [user, setUser] = useState(USERS[1]);
  const [strategy, setStrategy] = useState<Strategy>('2');
  const [perAz, setPerAz] = useState(2);
  const [failed, setFailed] = useState<string[]>([]);
  const { t } = useLoop(1800);

  const azs = useMemo(() => ['a', 'b', 'c'].map((s) => `${region.code}${s}`), [region.code]);
  const usedAzs = useMemo(() => azs.slice(0, Number(strategy)), [azs, strategy]);
  const total = usedAzs.length * perAz;
  const healthy = usedAzs.filter((a) => !failed.includes(a)).length * perAz;
  const up = healthy > 0;
  const capacityPct = Math.round((healthy / total) * 100);

  const rtt = Math.round(distanceKm(user, region) / 100 + 4); // rough fibre RTT estimate

  const def: FlowDef = useMemo(() => {
    const groups = azs.map((az, i) => ({ id: az, label: `AZ ${az}${i >= usedAzs.length ? ' (unused)' : ''}`, x: 190 + i * 205, y: 30, w: 190, h: 250, tone: 'az' as const }));
    const nodes: FlowNode[] = [
      { id: 'users', label: `Users`, sub: user.name, x: 70, y: 155, kind: 'user', icon: 'users', w: 100 },
      { id: 'alb', label: 'Load balancer', sub: 'spans used AZs', x: 400, y: 310, kind: 'network', w: 150 },
    ];
    const edges: FlowEdge[] = [{ id: 'u-alb', from: 'users', to: 'alb', curve: 40 }];
    const status: Record<string, Status> = {};
    const packets: FlowStep['packets'] = [{ edge: 'u-alb', color: 'blue', span: 0.35 }];
    let k = 0;
    usedAzs.forEach((az, i) => {
      for (let j = 0; j < perAz; j++) {
        const id = `${az}-i${j}`;
        nodes.push({ id, label: `EC2 ${String.fromCharCode(97 + i)}-${j + 1}`, sub: failed.includes(az) ? 'unreachable' : 'healthy', x: 285 + i * 205, y: 80 + j * (perAz > 2 ? 62 : 80), kind: 'compute', w: 120 });
        edges.push({ id: `e-${id}`, from: 'alb', to: id, curve: 0 });
        if (failed.includes(az)) {
          status[id] = 'fail';
          status[`e-${id}`] = 'off';
        } else {
          packets.push({ edge: `e-${id}`, color: 'blue', at: 0.35 + (k % 4) * 0.04, span: 0.45 });
        }
        k++;
      }
    });
    azs.forEach((az, i) => {
      if (i >= usedAzs.length) status[az] = 'off';
      if (failed.includes(az)) status[az] = 'fail';
    });
    if (!up) packets.splice(0, packets.length, { edge: 'u-alb', color: 'red', label: '503', dropAt: 0.9 });
    return {
      id: 'region-live',
      title: 'live',
      width: 820,
      height: 350,
      groups,
      nodes,
      edges,
      initial: status,
      steps: [{ title: '', text: '', packets }],
    };
  }, [azs, usedAzs, perAz, failed, user.name, up]);

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold">Select a Region</div>
            <span className="text-[11px] text-faint">Stylised map · positions approximate</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line" style={{ background: 'var(--color-bg)' }}>
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v${i}`} x1={(i * W) / 12} y1={0} x2={(i * W) / 12} y2={H} style={{ stroke: 'var(--color-line)', strokeWidth: 0.5 }} />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(i * H) / 7} x2={W} y2={(i * H) / 7} style={{ stroke: 'var(--color-line)', strokeWidth: 0.5 }} />
            ))}
            {LAND.map((poly, i) => (
              <polygon key={i} points={poly.map(([lo, la]) => `${proj(lo, la).x},${proj(lo, la).y}`).join(' ')} style={{ fill: 'var(--color-panel3)', stroke: 'var(--color-line)' }} />
            ))}
            {(() => {
              const a = proj(user.lon, user.lat);
              const b = proj(region.lon, region.lat);
              return (
                <g>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="dash-flow" style={{ stroke: 'var(--color-accent)', strokeWidth: 1.5 }} />
                  <circle cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r={4} style={{ fill: 'var(--color-accent)' }} />
                </g>
              );
            })()}
            {USERS.map((u) => {
              const pt = proj(u.lon, u.lat);
              return (
                <g key={u.id} onClick={() => setUser(u)} style={{ cursor: 'pointer' }}>
                  <rect x={pt.x - 5} y={pt.y - 5} width={10} height={10} rx={2} style={{ fill: user.id === u.id ? '#4aa8ff' : 'transparent', stroke: '#4aa8ff', strokeWidth: 1.5 }} />
                </g>
              );
            })}
            {REGIONS.map((r) => {
              const pt = proj(r.lon, r.lat);
              const sel = r.code === region.code;
              return (
                <g key={r.code} onClick={() => { setRegion(r); setFailed([]); }} style={{ cursor: 'pointer' }}>
                  {sel && <circle cx={pt.x} cy={pt.y} r={12} className="pulse-ring" style={{ fill: 'none', stroke: 'var(--color-accent)', strokeWidth: 2 }} />}
                  <circle cx={pt.x} cy={pt.y} r={sel ? 6.5 : 5} style={{ fill: sel ? 'var(--color-accent)' : '#ff9900aa', stroke: '#0b111b', strokeWidth: 1.5 }} />
                  <title>{`${r.name} – ${r.code}`}</title>
                </g>
              );
            })}
            <text x={8} y={H - 8} style={{ fill: 'var(--color-faint)', fontSize: 10 }}>
              ● Region (click) ■ User location (click)
            </text>
          </svg>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-panel2 p-3">
            <div className="text-[11px] text-muted">Selected Region</div>
            <div className="text-[16px] font-semibold">{region.name}</div>
            <div className="mono text-[12px] text-accent">{region.code}</div>
            <div className="mt-2 text-[12px] text-muted">
              Users in <b className="text-ink">{user.name}</b> → estimated round trip ≈ <b className="text-ink mono">{rtt} ms</b> <span className="text-faint">(rough distance-based estimate)</span>
            </div>
          </div>
          <div>
            <div className="label mb-1">Deploy across</div>
            <Tabs tabs={[{ id: '1', label: '1 AZ' }, { id: '2', label: '2 AZs' }, { id: '3', label: '3 AZs' }]} value={strategy} onChange={(v) => { setStrategy(v); setFailed([]); }} />
          </div>
          <div>
            <div className="label mb-1">Instances per AZ</div>
            <Tabs tabs={[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }]} value={String(perAz) as '1' | '2' | '3'} onChange={(v) => setPerAz(Number(v))} />
          </div>
          <div>
            <div className="label mb-1">Simulate an AZ failure</div>
            <div className="flex flex-wrap gap-1.5">
              {usedAzs.map((az) => (
                <button key={az} className={`btn btn-sm ${failed.includes(az) ? 'btn-danger' : ''}`} onClick={() => setFailed((f) => (f.includes(az) ? f.filter((x) => x !== az) : [...f, az]))}>
                  {failed.includes(az) ? `Recover ${az}` : `Fail ${az}`}
                </button>
              ))}
              <button className="btn btn-sm" onClick={() => setFailed([])}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
          <div className={`rounded-lg border p-3 ${up ? (capacityPct < 100 ? 'border-warn/50 bg-warn/5' : 'border-ok/50 bg-ok/5') : 'border-bad/50 bg-bad/10'}`}>
            <div className="text-[14px] font-semibold">{up ? (capacityPct < 100 ? 'Application UP – reduced capacity' : 'Application UP') : 'Application DOWN'}</div>
            <div className="text-[12px] text-muted">
              Healthy instances: {healthy}/{total} ({capacityPct}% capacity).{' '}
              {!up && strategy === '1' && 'Everything was in one AZ – a single AZ failure took the whole application down.'}
              {up && capacityPct < 100 && 'The load balancer routes only to healthy AZs; Auto Scaling would launch replacements in the healthy AZs.'}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-bg/60 p-2">
        <FlowCanvas def={def} step={0} t={Math.min(1, t * 1.1)} />
      </div>
      <Callout kind="info" title="Illustrative data">
        Region codes and names are real AWS Regions, but this map, the three AZs shown per Region and the latency figures are simplified for learning. AWS states that every Region has at least three AZs; some have more. Check the AWS Global Infrastructure page for current Regions and AZ counts.
      </Callout>
    </div>
  );
}
