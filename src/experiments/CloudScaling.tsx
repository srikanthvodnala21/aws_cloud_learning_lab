import { useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, LineChart } from 'recharts';
import { Pause, Play } from 'lucide-react';
import { Callout, Slider, Tabs } from '../components/ui';
import { axisTick, chartTooltip } from '../components/chartStyles';

type Pattern = 'daily' | 'campaign' | 'steady' | 'growth';

const PATTERNS: Record<Pattern, { label: string; fn: (h: number) => number }> = {
  daily: { label: 'Business-hours peaks', fn: (h) => 120 + 380 * Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)) },
  campaign: { label: 'Marketing spike', fn: (h) => 150 + (h >= 18 && h <= 21 ? 1100 * Math.sin(((h - 17.5) / 4) * Math.PI) : 40 * Math.sin(h)) },
  steady: { label: 'Steady load', fn: (h) => 300 + 25 * Math.sin(h / 2) },
  growth: { label: 'Fast-growing startup', fn: (h) => 80 + h * 22 + 60 * Math.sin(h / 1.5) },
};

const RPS_PER_SERVER = 100; // requests/s one server handles
// ILLUSTRATIVE sample economics – not AWS prices
const ONPREM_SERVER_CAPEX = 6000; // $ per server, 3-year life
const ONPREM_SERVER_OPEX = 120; // $ / server / month power, space, staff share
const CLOUD_SERVER_HOUR = 0.1; // $ / server-hour (sample on-demand rate)


const ServerRow = ({ n, max, color, label, overflow }: { n: number; max: number; color: string; label: string; overflow?: number }) => (
  <div>
    <div className="flex justify-between text-[11px] text-muted mb-1">
      <span>{label}</span>
      <span className="mono">{n} servers</span>
    </div>
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: Math.max(n, max) }).map((_, i) => (
        <div key={i} className="h-4 w-3 rounded-sm transition-all duration-300" style={{ background: i < n ? color : 'transparent', border: `1px solid ${i < n ? color : 'var(--color-line)'}`, opacity: i < n ? 1 : 0.4 }} />
      ))}
      {!!overflow && overflow > 0 && <span className="text-[11px] text-bad ml-1">+{overflow} req/s dropped</span>}
    </div>
  </div>
);

export default function CloudScaling() {
  const [pattern, setPattern] = useState<Pattern>('daily');
  const [onPrem, setOnPrem] = useState(5);
  const [buffer, setBuffer] = useState(20);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h + 1) % 24), 450);
    return () => clearInterval(t);
  }, [playing]);

  const data = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        const demand = Math.round(PATTERNS[pattern].fn(h));
        const cloudServers = Math.max(1, Math.ceil((demand * (1 + buffer / 100)) / RPS_PER_SERVER));
        return { h: `${String(h).padStart(2, '0')}:00`, demand, onprem: onPrem * RPS_PER_SERVER, cloud: cloudServers * RPS_PER_SERVER, cloudServers };
      }),
    [pattern, onPrem, buffer],
  );

  const totalDemand = data.reduce((a, d) => a + d.demand, 0);
  const unmet = data.reduce((a, d) => a + Math.max(0, d.demand - d.onprem), 0);
  const onpremIdle = 1 - data.reduce((a, d) => a + Math.min(d.demand, d.onprem), 0) / (onPrem * RPS_PER_SERVER * 24);
  const cloudIdle = 1 - totalDemand / data.reduce((a, d) => a + d.cloud, 0);
  const avgCloudServers = data.reduce((a, d) => a + d.cloudServers, 0) / 24;

  const cost = useMemo(() => {
    const rows = [];
    let onp = onPrem * ONPREM_SERVER_CAPEX;
    let cl = 0;
    for (let m = 0; m <= 36; m++) {
      const growth = pattern === 'growth' ? 1 + m * 0.04 : 1;
      if (m > 0) {
        onp += onPrem * ONPREM_SERVER_OPEX;
        cl += avgCloudServers * growth * 730 * CLOUD_SERVER_HOUR;
      }
      rows.push({ m, onprem: Math.round(onp), cloud: Math.round(cl) });
    }
    return rows;
  }, [onPrem, avgCloudServers, pattern]);

  const cur = data[hour];
  const maxServers = Math.max(onPrem, ...data.map((d) => d.cloudServers));

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="label mb-1">Demand pattern (24 h)</div>
          <Tabs tabs={(Object.keys(PATTERNS) as Pattern[]).map((k) => ({ id: k, label: PATTERNS[k].label }))} value={pattern} onChange={setPattern} />
        </div>
        <div className="w-56">
          <Slider label="On-prem servers bought" value={onPrem} min={1} max={14} onChange={setOnPrem} />
        </div>
        <div className="w-56">
          <Slider label="Cloud headroom" value={buffer} min={0} max={60} step={5} onChange={setBuffer} format={(v) => `${v}%`} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="text-[13px] font-semibold mb-2">Capacity vs demand (requests / second)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ left: -10, right: 10, top: 5 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="h" tick={axisTick} interval={3} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="demand" name="Demand" fill="#4aa8ff" fillOpacity={0.25} stroke="#4aa8ff" isAnimationActive={false} />
                <Line type="stepAfter" dataKey="onprem" name="On-prem capacity (fixed)" stroke="#f0524d" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="cloud" name="Cloud capacity (elastic)" stroke="#2fbf71" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine x={cur.h} stroke="var(--color-accent)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">
              Live view at <span className="mono text-accent">{cur.h}</span>
            </div>
            <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Play'}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            className="w-full"
          />
          <div className="text-[12px] text-muted">
            Demand: <span className="mono text-ink">{cur.demand} req/s</span> · each server handles {RPS_PER_SERVER} req/s
          </div>
          <ServerRow n={onPrem} max={maxServers} color="#f0524d" label="On-premises (bought for a guess)" overflow={cur.demand - cur.onprem} />
          <ServerRow n={cur.cloudServers} max={maxServers} color="#2fbf71" label="Cloud (Auto Scaling follows demand)" />
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg border border-line p-2.5">
              <div className="text-muted">On-prem (24 h)</div>
              <div className={unmet > 0 ? 'text-bad' : 'text-ok'}>{((unmet / totalDemand) * 100).toFixed(1)}% requests dropped</div>
              <div className="text-warn">{(onpremIdle * 100).toFixed(0)}% capacity idle</div>
            </div>
            <div className="rounded-lg border border-line p-2.5">
              <div className="text-muted">Cloud (24 h)</div>
              <div className="text-ok">0% requests dropped</div>
              <div className="text-ok">{(cloudIdle * 100).toFixed(0)}% idle (headroom)</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-2">Cumulative cost over 36 months (illustrative sample economics)</div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={cost} margin={{ left: 10, right: 10 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="m" tick={axisTick} />
              <YAxis tick={axisTick} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} labelFormatter={(l) => `Month ${l}`} contentStyle={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="onprem" name="On-prem (CapEx up-front + monthly ops)" stroke="#f0524d" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="cloud" name="Cloud (pay per server-hour)" stroke="#2fbf71" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2">
          <Callout kind="warn" title="Sample numbers, not AWS prices">
            On-prem: ${ONPREM_SERVER_CAPEX.toLocaleString()} per server up-front + ${ONPREM_SERVER_OPEX}/server/month. Cloud: ${CLOUD_SERVER_HOUR}/server-hour. Real comparisons must include staff, licensing, networking, data transfer and commitment discounts. Try <b>Steady load</b> – a well-sized on-prem fleet can be competitive; try <b>Marketing spike</b> – it cannot keep up.
          </Callout>
        </div>
      </div>
    </div>
  );
}
