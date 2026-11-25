import { useMemo, useState } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import { useLoop } from '../animation/useLoop';
import { Badge, Callout, Tabs, Toggle } from '../components/ui';

const VPCS = [
  { id: 'A', name: 'prod', cidr: '10.0.0.0/16', x: 160, y: 70 },
  { id: 'B', name: 'shared-services', cidr: '10.1.0.0/16', x: 460, y: 70 },
  { id: 'C', name: 'dev', cidr: '10.2.0.0/16', x: 460, y: 270 },
  { id: 'D', name: 'acquired-co', cidr: '10.0.0.0/16', x: 160, y: 270 },
];
const ONPREM = { id: 'P', name: 'on-premises DC', cidr: '192.168.0.0/16', x: 310, y: 360 };
const PAIRS = [
  ['A', 'B'],
  ['A', 'C'],
  ['A', 'D'],
  ['B', 'C'],
  ['B', 'D'],
  ['C', 'D'],
] as const;
const key = (a: string, b: string) => [a, b].sort().join('-');
const cidrOf = (id: string) => (id === 'P' ? ONPREM.cidr : VPCS.find((v) => v.id === id)!.cidr);

function Mesh() {
  const [mode, setMode] = useState<'peering' | 'tgw'>('peering');
  const [peers, setPeers] = useState<Record<string, boolean>>({ 'A-B': true, 'B-C': true });
  const [attached, setAttached] = useState<Record<string, boolean>>({ A: true, B: true, C: true, D: false, P: true });
  const [isolateDev, setIsolateDev] = useState(false);
  const [vpnOn, setVpnOn] = useState(true); // peering mode: VPN to VPC A
  const [probe, setProbe] = useState<[string, string]>(['A', 'C']);
  const { t } = useLoop(1600);

  const ids = ['A', 'B', 'C', 'D', 'P'];

  const reach = useMemo(() => {
    const res: Record<string, { ok: boolean; why: string }> = {};
    ids.forEach((a) =>
      ids.forEach((b) => {
        if (a === b) return;
        const k = `${a}>${b}`;
        if (cidrOf(a) === cidrOf(b)) {
          res[k] = { ok: false, why: `Overlapping CIDRs (${cidrOf(a)}): routing between identical ranges is impossible. Re-IP one VPC, or use PrivateLink / private NAT.` };
          return;
        }
        if (mode === 'peering') {
          if (a === 'P' || b === 'P') {
            const other = a === 'P' ? b : a;
            if (!vpnOn) res[k] = { ok: false, why: 'No VPN connection.' };
            else if (other === 'A') res[k] = { ok: true, why: 'Site-to-Site VPN terminates on VPC A’s virtual private gateway.' };
            else res[k] = { ok: false, why: `The VPN goes to VPC A only. Peering does not support edge-to-edge routing, so on-prem cannot reach VPC ${other} through VPC A.` };
            return;
          }
          if (peers[key(a, b)]) res[k] = { ok: true, why: `Direct peering connection pcx-${key(a, b)} with routes on both sides.` };
          else {
            const via = ids.find((m) => m !== a && m !== b && m !== 'P' && peers[key(a, m)] && peers[key(m, b)]);
            res[k] = { ok: false, why: via ? `${a}↔${via} and ${via}↔${b} are peered, but peering is NOT transitive. ${a} cannot reach ${b} through ${via}.` : `No peering connection between ${a} and ${b}.` };
          }
        } else {
          if (!attached[a] || !attached[b]) {
            res[k] = { ok: false, why: `${!attached[a] ? a : b} is not attached to the Transit Gateway.` };
            return;
          }
          if ((a === 'A' || a === 'D' || b === 'A' || b === 'D') && attached.A && attached.D) {
            res[k] = { ok: false, why: 'A and D are both attached with 10.0.0.0/16. The TGW route table can propagate only one route for that CIDR, so traffic to 10.0.0.0/16 is ambiguous.' };
            return;
          }
          if (isolateDev && ((a === 'C' && b === 'A') || (a === 'A' && b === 'C'))) {
            res[k] = { ok: false, why: 'Segmentation: dev (C) is associated with a separate TGW route table that only propagates shared-services and on-prem. prod is not reachable.' };
            return;
          }
          res[k] = { ok: true, why: `Hub and spoke: ${a} → TGW route table → ${b}. Transitive routing works through the hub.` };
        }
      }),
    );
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, peers, attached, isolateDev, vpnOn]);

  const pos = (id: string) => (id === 'P' ? ONPREM : VPCS.find((v) => v.id === id)!);
  const hub = { x: 310, y: 170 };
  const links: [string, string][] = mode === 'peering' ? [...PAIRS.filter(([a, b]) => peers[key(a, b)]).map(([a, b]) => [a, b] as [string, string]), ...(vpnOn ? ([['P', 'A']] as [string, string][]) : [])] : [];
  const probeRes = reach[`${probe[0]}>${probe[1]}`];
  const peeringCount = PAIRS.filter(([a, b]) => peers[key(a, b)]).length;

  const pathPts = (): { x: number; y: number }[] => {
    if (!probeRes?.ok) return [];
    const a = pos(probe[0]);
    const b = pos(probe[1]);
    return mode === 'tgw' ? [a, hub, b] : [a, b];
  };
  const pts = pathPts();
  const dot = (() => {
    if (pts.length < 2) return null;
    const segs = pts.length - 1;
    const f = t * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    const lf = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * lf, y: pts[i].y + (pts[i + 1].y - pts[i].y) * lf };
  })();

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { id: 'peering', label: 'VPC peering (mesh)' },
          { id: 'tgw', label: 'Transit Gateway (hub & spoke)' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="rounded-lg border border-line bg-bg/60">
          <svg viewBox="0 0 620 410" className="w-full">
            {mode === 'tgw' &&
              ids
                .filter((id) => attached[id])
                .map((id) => {
                  const p = pos(id);
                  return <line key={id} x1={p.x} y1={p.y} x2={hub.x} y2={hub.y} style={{ stroke: id === 'P' ? '#94a3b8' : '#a78bfa', strokeWidth: 2, strokeDasharray: id === 'P' ? '6 4' : undefined }} />;
                })}
            {links.map(([a, b]) => {
              const pa = pos(a);
              const pb = pos(b);
              return <line key={a + b} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} style={{ stroke: a === 'P' ? '#94a3b8' : '#2dd4bf', strokeWidth: 2, strokeDasharray: a === 'P' ? '6 4' : undefined }} />;
            })}
            {mode === 'tgw' && (
              <g>
                <rect x={hub.x - 55} y={hub.y - 24} width={110} height={48} rx={10} style={{ fill: 'var(--color-panel2)', stroke: '#a78bfa', strokeWidth: 2 }} />
                <text x={hub.x} y={hub.y - 3} textAnchor="middle" style={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 600 }}>
                  Transit Gateway
                </text>
                <text x={hub.x} y={hub.y + 13} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 9.5 }}>
                  {isolateDev ? '2 route tables' : '1 route table'}
                </text>
              </g>
            )}
            {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} style={{ fill: 'none', stroke: '#ff9900', strokeWidth: 3, opacity: 0.35 }} />}
            {dot && <circle cx={dot.x} cy={dot.y} r={6} style={{ fill: '#ff9900' }} />}
            {[...VPCS, ONPREM].map((v) => {
              const sel = probe.includes(v.id);
              const overlap = v.id === 'A' || v.id === 'D';
              return (
                <g key={v.id}>
                  <rect x={v.x - 70} y={v.y - 28} width={140} height={56} rx={10} style={{ fill: 'var(--color-panel)', stroke: sel ? '#ff9900' : v.id === 'P' ? '#94a3b8' : '#4aa8ff', strokeWidth: sel ? 2.5 : 1.5 }} />
                  <text x={v.x} y={v.y - 8} textAnchor="middle" style={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 600 }}>
                    {v.id === 'P' ? v.name : `VPC ${v.id} · ${v.name}`}
                  </text>
                  <text x={v.x} y={v.y + 10} textAnchor="middle" className="mono" style={{ fill: overlap ? '#f5a524' : 'var(--color-muted)', fontSize: 10.5 }}>
                    {v.cidr}
                    {overlap ? ' ⚠' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-3">
          {mode === 'peering' ? (
            <>
              <div className="label">Peering connections</div>
              <div className="grid grid-cols-2 gap-1">
                {PAIRS.map(([a, b]) => {
                  const overlap = cidrOf(a) === cidrOf(b);
                  return (
                    <Toggle
                      key={a + b}
                      checked={!!peers[key(a, b)]}
                      onChange={(v) => !overlap && setPeers({ ...peers, [key(a, b)]: v })}
                      label={
                        <span className={overlap ? 'text-faint line-through' : ''} title={overlap ? 'Peering is not possible between VPCs with overlapping CIDRs' : ''}>
                          {a} ↔ {b}
                        </span>
                      }
                    />
                  );
                })}
              </div>
              <Toggle checked={vpnOn} onChange={setVpnOn} label="Site-to-Site VPN: on-prem → VPC A" />
              <div className="text-[11.5px] text-muted">
                {peeringCount} peering connection(s). Full mesh of n VPCs needs n(n−1)/2: 10 VPCs → 45, 50 VPCs → 1,225.
              </div>
            </>
          ) : (
            <>
              <div className="label">TGW attachments</div>
              <div className="grid grid-cols-2 gap-1">
                {ids.map((id) => (
                  <Toggle key={id} checked={!!attached[id]} onChange={(v) => setAttached({ ...attached, [id]: v })} label={id === 'P' ? 'On-prem (VPN)' : `VPC ${id}`} />
                ))}
              </div>
              <Toggle checked={isolateDev} onChange={setIsolateDev} label="Segment: isolate dev from prod" />
              <div className="text-[11.5px] text-muted">Each VPC needs one attachment, and routing is transitive through the hub. TGW is a Regional resource; use TGW peering between Regions. It is charged per attachment-hour plus per GB processed (sample assumption).</div>
            </>
          )}
          <div className="rounded-lg border border-line p-2">
            <div className="label mb-1">Test a path</div>
            <div className="flex items-center gap-1.5">
              <select className="select text-[12px]" value={probe[0]} onChange={(e) => setProbe([e.target.value, probe[1] === e.target.value ? probe[0] : probe[1]])}>
                {ids.map((i) => (
                  <option key={i} value={i}>
                    {i === 'P' ? 'on-prem' : `VPC ${i}`}
                  </option>
                ))}
              </select>
              →
              <select className="select text-[12px]" value={probe[1]} onChange={(e) => setProbe([probe[0] === e.target.value ? probe[1] : probe[0], e.target.value])}>
                {ids.map((i) => (
                  <option key={i} value={i}>
                    {i === 'P' ? 'on-prem' : `VPC ${i}`}
                  </option>
                ))}
              </select>
            </div>
            {probeRes && (
              <div className={`mt-2 flex gap-1.5 text-[12px] ${probeRes.ok ? 'text-ok' : 'text-bad'}`}>
                {probeRes.ok ? <CircleCheck size={14} className="shrink-0 mt-0.5" /> : <CircleX size={14} className="shrink-0 mt-0.5" />}
                <span>{probeRes.why}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="lab-table w-auto">
          <thead>
            <tr>
              <th>from \ to</th>
              {ids.map((i) => (
                <th key={i}>{i === 'P' ? 'on-prem' : i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((a) => (
              <tr key={a}>
                <td className="font-medium">{a === 'P' ? 'on-prem' : `VPC ${a}`}</td>
                {ids.map((b) => {
                  if (a === b) return <td key={b} className="text-faint text-center">–</td>;
                  const rr = reach[`${a}>${b}`];
                  return (
                    <td key={b} className="text-center cursor-pointer" title={rr.why} onClick={() => setProbe([a, b])}>
                      {rr.ok ? <CircleCheck size={15} className="inline text-ok" /> : <CircleX size={15} className="inline text-bad" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-faint">Click a cell for the explanation.</p>
      </div>
    </div>
  );
}

/* --------------------------------------------- hybrid connectivity chooser */

function Chooser() {
  const [bw, setBw] = useState<'low' | 'mid' | 'high'>('mid');
  const [urgent, setUrgent] = useState(true);
  const [steady, setSteady] = useState(false);
  const [users, setUsers] = useState(false);
  const [critical, setCritical] = useState(false);

  const rec = useMemo(() => {
    if (users) return { name: 'AWS Client VPN', tone: 'sky' as const, why: 'Individual laptops connecting to the VPC need a managed OpenVPN-based endpoint, not a site-to-site link. Consider Verified Access for zero-trust app access.' };
    if (critical && (bw === 'high' || steady)) return { name: 'Direct Connect ×2 locations (+ VPN backup)', tone: 'ok' as const, why: 'Production-critical with consistent performance: two Direct Connect connections at different locations for maximum resilience. Site-to-Site VPN over the internet is a cheaper backup path. Add MACsec or IPsec over DX if you need encryption.' };
    if (bw === 'high' || steady) return { name: urgent ? 'Site-to-Site VPN now → Direct Connect later' : 'AWS Direct Connect', tone: 'ok' as const, why: `Direct Connect gives a private, dedicated connection (1/10/100 Gbps dedicated, or hosted from 50 Mbps) with consistent latency and lower data-transfer-out rates. Provisioning takes weeks${urgent ? ', so start with a VPN today' : ''}. DX is not encrypted by default.` };
    return { name: 'AWS Site-to-Site VPN', tone: 'accent' as const, why: `IPsec tunnels over the internet, ready in minutes. Each connection has two tunnels (in different AZs) at up to ~1.25 Gbps per tunnel. Performance varies with the internet. ${critical ? 'For resilience, use two customer gateways.' : ''}` };
  }, [bw, urgent, steady, users, critical]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <div>
          <div className="label mb-1">Bandwidth needed</div>
          <Tabs tabs={[{ id: 'low', label: '< 500 Mbps' }, { id: 'mid', label: '~1 Gbps' }, { id: 'high', label: '10+ Gbps' }]} value={bw} onChange={setBw} />
        </div>
        <Toggle checked={urgent} onChange={setUrgent} label="Need it working this week" />
        <Toggle checked={steady} onChange={setSteady} label="Need consistent, predictable latency" />
        <Toggle checked={critical} onChange={setCritical} label="Business-critical (needs redundancy)" />
        <Toggle checked={users} onChange={setUsers} label="It’s individual remote users, not a whole site" />
      </div>
      <div className="rounded-lg border border-line p-4 space-y-2">
        <div className="label">Recommendation</div>
        <div className="text-[17px] font-semibold">
          <Badge tone={rec.tone}>{rec.name}</Badge>
        </div>
        <p className="text-[13px] text-muted leading-relaxed">{rec.why}</p>
        <table className="lab-table mt-2">
          <thead>
            <tr>
              <th />
              <th>Site-to-Site VPN</th>
              <th>Direct Connect</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Path', 'Public internet (IPsec)', 'Private dedicated circuit'],
              ['Setup time', 'Minutes', 'Weeks (cross-connect)'],
              ['Bandwidth', '~1.25 Gbps per tunnel', '50 Mbps – 100 Gbps'],
              ['Latency', 'Variable', 'Consistent'],
              ['Encryption', 'Yes (IPsec)', 'No by default (MACsec / VPN over DX)'],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((c, i) => (
                  <td key={i} className={i === 0 ? 'font-medium' : 'text-muted text-[12px]'}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ConnectivityLab() {
  const [tab, setTab] = useState<'mesh' | 'hybrid'>('mesh');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'mesh', label: 'VPC-to-VPC connectivity' },
          { id: 'hybrid', label: 'Hybrid connectivity chooser' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'mesh' ? <Mesh /> : <Chooser />}
      <Callout kind="info">The CIDRs, limits and throughput figures here are simplified teaching values. Check the VPC, Transit Gateway and Direct Connect quotas in the AWS documentation before you design for production.</Callout>
    </div>
  );
}
