import { lazy, Suspense, useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw, Play } from 'lucide-react';
import { FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef, FlowStep, Packet } from '../animation/flowTypes';
import { e, g, n } from '../animation/builders';
import { evalNacl, evalSg, lookup, validCidr, type NaclRule, type Route, type RouteLookup, type SgRule, type Target } from '../simulations/network';
import { Callout, Loading, Tabs, Toggle } from '../components/ui';

const VpcBuilder = lazy(() => import('../playground/VpcBuilder'));

interface Cfg {
  igw: boolean;
  nat: boolean;
  webPublicIp: boolean;
  pubRoutes: Route[];
  privRoutes: Route[];
  webSg: SgRule[];
  appSg: SgRule[];
  naclIn: NaclRule[];
  naclOut: NaclRule[];
}

const DEFAULT: Cfg = {
  igw: true,
  nat: true,
  webPublicIp: true,
  pubRoutes: [
    { dest: '10.0.0.0/16', target: 'local' },
    { dest: '0.0.0.0/0', target: 'igw' },
  ],
  privRoutes: [
    { dest: '10.0.0.0/16', target: 'local' },
    { dest: '0.0.0.0/0', target: 'nat' },
    { dest: '172.16.0.0/16', target: 'pcx' },
  ],
  webSg: [
    { ports: '443', source: '0.0.0.0/0' },
    { ports: '22', source: '203.0.113.0/24' },
  ],
  appSg: [{ ports: '8080', source: 'sg:web-sg' }],
  naclIn: [
    { num: 90, action: 'deny', ports: 'all', cidr: '198.51.100.0/24' },
    { num: 100, action: 'allow', ports: '443', cidr: '0.0.0.0/0' },
    { num: 110, action: 'allow', ports: '22', cidr: '203.0.113.0/24' },
    { num: 120, action: 'allow', ports: '1024-65535', cidr: '0.0.0.0/0' },
  ],
  naclOut: [
    { num: 100, action: 'allow', ports: '1024-65535', cidr: '0.0.0.0/0' },
    { num: 110, action: 'allow', ports: '443', cidr: '0.0.0.0/0' },
    { num: 120, action: 'allow', ports: '8080', cidr: '10.0.0.0/16' },
  ],
};

const TARGET_LABEL: Record<Target, string> = { local: 'local', igw: 'igw-0a1b (Internet GW)', nat: 'nat-0c2d (NAT GW)', pcx: 'pcx-0e3f (peering)', blackhole: 'blackhole' };

const TESTS = [
  { id: 'inet-web', label: 'Internet → public web :443', src: '203.0.113.9' },
  { id: 'admin-ssh', label: 'Admin → web SSH :22', src: '203.0.113.50' },
  { id: 'attacker-ssh', label: 'Unknown host → web :22', src: '198.51.100.7' },
  { id: 'inet-app', label: 'Internet → private app :8080', src: '203.0.113.9' },
  { id: 'app-out', label: 'Private app → internet (updates)', src: '10.0.2.20' },
  { id: 'web-app', label: 'Web → app :8080 (subnet to subnet)', src: '10.0.1.10' },
  { id: 'app-peer', label: 'App → peered VPC DB :5432', src: '10.0.2.20' },
] as const;

type TestId = (typeof TESTS)[number]['id'];

interface Lk {
  table: string;
  ip: string;
  res: RouteLookup;
}

interface Sim {
  steps: FlowStep[];
  ok: boolean;
  summary: string;
  lookups: Lk[];
}

function simulate(id: TestId, c: Cfg): Sim {
  const steps: FlowStep[] = [];
  const lookups: Lk[] = [];
  const P = (edge: string, extra: Partial<Packet> = {}): Packet => ({ edge, color: 'blue', ...extra });
  const end = (ok: boolean, summary: string): Sim => ({ steps, ok, summary, lookups });
  const fail = (title: string, text: string, packets: Packet[], focus: string[] = []) => {
    steps.push({ title: `✕ ${title}`, text, packets, focus, log: `DROPPED: ${title}` });
    return end(false, text);
  };
  const doLookup = (table: string, routes: Route[], ip: string) => {
    const res = lookup(routes, ip);
    lookups.push({ table, ip, res });
    return res;
  };

  const inbound = (srcIp: string, srcNode: string, srcEdge: string, port: number) => {
    const eph = 50123;
    steps.push({ title: 'Client sends packet', text: `${srcIp}:${eph} → web public IP 54.10.20.30:${port}.`, packets: [P(srcEdge, { label: `:${port}` })] });
    if (!c.webPublicIp) return fail('No public IP', 'The web instance has no public IPv4 or Elastic IP. There is no address the internet can send to, and nothing for the IGW to translate.', [P(srcEdge, { color: 'red', dropAt: 0.9 })], ['web']);
    if (!c.igw) return fail('No Internet Gateway', 'No Internet Gateway is attached to the VPC, so internet traffic cannot enter it at all.', [P(srcEdge, { color: 'red', dropAt: 0.9 })], ['igw']);
    steps.push({ title: 'IGW translates the destination', text: 'The Internet Gateway maps public IP 54.10.20.30 → private IP 10.0.1.10 (1:1 NAT) and forwards into the VPC.', focus: ['igw'], badges: { igw: '54.10.20.30 → 10.0.1.10' } });
    const nIn = evalNacl(c.naclIn, port, srcIp);
    if (!nIn.allowed) return fail('Blocked by network ACL (inbound)', `Public subnet NACL inbound evaluated in order: ${nIn.rule} matched first → DENY. NACLs can explicitly deny specific ranges.`, [P('igw-web', { color: 'red', dropAt: 0.3 })], ['pub']);
    steps.push({ title: 'Network ACL inbound: allowed', text: `Public subnet NACL: ${nIn.rule} → ALLOW (rules are checked from the lowest number; first match wins).`, packets: [P('igw-web', { span: 0.35 })], focus: ['pub'] });
    const sg = evalSg(c.webSg, port, srcIp);
    if (!sg.allowed) return fail('Blocked by security group', `No inbound rule in web-sg allows TCP ${port} from ${srcIp}. Security groups have no deny rules – unmatched traffic is silently dropped.`, [P('igw-web', { color: 'red', at: 0, span: 0.7, dropAt: 0.9 })], ['web']);
    steps.push({ title: 'Security group: allowed', text: `web-sg rule "${sg.rule}" allows the connection. The packet reaches the web server.`, packets: [P('igw-web', { at: 0, span: 0.7 })], focus: ['web'] });
    const lk = doLookup('Public route table', c.pubRoutes, srcIp);
    if (!lk.chosen) return fail('No return route', `The web server replies to ${srcIp}, but the public route table has no route covering it. (Security groups would allow the reply – stateful – but there is no path.)`, [P('igw-web', { color: 'red', reverse: true, dropAt: 0.3 })], ['rtp']);
    if (lk.chosen.target !== 'igw') return fail('Reply routed to the wrong target', `Route lookup for ${srcIp} selects ${lk.chosen.dest} → ${TARGET_LABEL[lk.chosen.target]}. Replies must leave through the IGW that translated the inbound packet; otherwise the client never sees them.`, [P('igw-web', { color: 'red', reverse: true, dropAt: 0.3 })], ['rtp']);
    const nOut = evalNacl(c.naclOut, eph, srcIp);
    if (!nOut.allowed) return fail('Reply blocked by NACL (outbound)', `NACLs are stateless: the reply to ephemeral port ${eph} needs an outbound allow. ${nOut.rule} applied → DENY. The client times out.`, [P('igw-web', { color: 'green', reverse: true, dropAt: 0.25 })], ['pub']);
    steps.push({ title: 'Reply leaves via the IGW', text: `Route lookup: ${srcIp} → ${lk.chosen.dest} → ${TARGET_LABEL.igw}. NACL outbound ${nOut.rule} allows port ${eph}. The IGW rewrites the source back to 54.10.20.30.`, packets: [P('igw-web', { color: 'green', reverse: true, span: 0.4 }), P(srcEdge, { color: 'green', reverse: true, at: 0.42, span: 0.4, label: 'reply' })], focus: ['rtp'], log: `route ${srcIp} → ${lk.chosen.dest} (${lk.chosen.target})` });
    void srcNode;
    return end(true, `Connection succeeded: internet → IGW → NACL → security group → web, and the reply returned via the IGW.`);
  };

  switch (id) {
    case 'inet-web':
      return inbound('203.0.113.9', 'client', 'client-igw', 443);
    case 'admin-ssh':
      return inbound('203.0.113.50', 'admin', 'admin-igw', 22);
    case 'attacker-ssh':
      return inbound('198.51.100.7', 'attacker', 'attacker-igw', 22);
    case 'inet-app': {
      steps.push({ title: 'Client tries to reach the app', text: 'The client wants 10.0.2.20:8080. That is a private (RFC 1918) address – it is not routable on the public internet.', packets: [P('client-igw', { label: '→ 10.0.2.20' })] });
      return fail('No path into the private subnet', 'Even at the VPC edge, the IGW only translates addresses that are associated with a public IP. The app has none, and the private route table has no IGW route. Expose private apps through a load balancer in the public subnets instead.', [P('igw-app', { color: 'red', dropAt: 0.35 })], ['priv', 'igw']);
    }
    case 'app-out': {
      const dst = '93.184.216.34';
      steps.push({ title: 'App starts an outbound connection', text: `10.0.2.20:40001 → ${dst}:443 (e.g. downloading OS updates). Outbound is allowed by the app security group (default: allow all outbound).`, focus: ['app'] });
      const lk = doLookup('Private route table', c.privRoutes, dst);
      if (!lk.chosen) return fail('No route', `No route in the private route table matches ${dst}. Packets to unknown destinations are dropped.`, [P('app-nat', { color: 'red', dropAt: 0.2 })], ['rtv']);
      if (lk.chosen.target === 'igw') return fail('Route to IGW but no public IP', `The private route table sends ${dst} to the IGW (${lk.chosen.dest}). That would make this subnet public – but the app has no public IP, so the IGW cannot translate it and the traffic is dropped.`, [P('igw-app', { color: 'red', reverse: true, dropAt: 0.4 })], ['rtv']);
      if (lk.chosen.target === 'pcx') return fail('Peering does not reach the internet', `Route ${lk.chosen.dest} → peering. VPC peering does not support edge-to-edge routing: you cannot use a peer VPC’s IGW or NAT.`, [P('app-peer', { color: 'red', dropAt: 0.5 })], ['rtv']);
      if (lk.chosen.target === 'blackhole' || (lk.chosen.target === 'nat' && !c.nat)) return fail('Blackhole route', 'The route target (NAT Gateway) no longer exists, so the route is a blackhole.', [P('app-nat', { color: 'red', dropAt: 0.4 })], ['rtv']);
      if (lk.chosen.target === 'local') return fail('Local route', 'The local route only covers the VPC CIDR.', [P('app-nat', { color: 'red', dropAt: 0.4 })]);
      steps.push({ title: `Route selected: ${lk.chosen.dest} → NAT`, text: `Longest prefix match for ${dst}: ${lk.candidates.filter((x) => x.matches).map((x) => x.route.dest).join(', ')} match; the most specific is ${lk.chosen.dest} → ${TARGET_LABEL.nat}.`, packets: [P('app-nat', { label: ':443' })], focus: ['rtv'], log: `route ${dst} → ${lk.chosen.dest} (nat)` });
      steps.push({ title: 'NAT Gateway rewrites the source', text: 'Source 10.0.2.20:40001 becomes the NAT Gateway’s Elastic IP (e.g. 3.120.5.9:1100). The NAT tracks the connection so it can return replies.', focus: ['nat'], badges: { nat: 'SNAT → EIP' } });
      const nOut = evalNacl(c.naclOut, 443, dst);
      if (!nOut.allowed) return fail('Blocked by public subnet NACL (outbound)', `The NAT Gateway lives in the public subnet, so that subnet’s NACL applies: ${nOut.rule} → DENY for port 443.`, [P('nat-igw', { color: 'red', dropAt: 0.3 })], ['pub']);
      const lk2 = doLookup('Public route table', c.pubRoutes, dst);
      if (!lk2.chosen || lk2.chosen.target !== 'igw') return fail('NAT has no path to the internet', `The NAT Gateway’s subnet route table must send ${dst} to an Internet Gateway. Selected: ${lk2.chosen ? `${lk2.chosen.dest} → ${lk2.chosen.target}` : 'no route'}.`, [P('nat-igw', { color: 'red', dropAt: 0.4 })], ['rtp']);
      if (!c.igw) return fail('No Internet Gateway', 'The public route table points to an IGW that is not attached.', [P('nat-igw', { color: 'red', dropAt: 0.8 })], ['igw']);
      steps.push({ title: 'Out through the IGW', text: `Public route table: ${dst} → ${lk2.chosen.dest} → IGW. NACL outbound ${nOut.rule} allows 443.`, packets: [P('nat-igw', { span: 0.4 }), P('ext-igw', { reverse: true, at: 0.4, span: 0.4 })], focus: ['rtp'] });
      const nIn = evalNacl(c.naclIn, 1100, dst);
      if (!nIn.allowed) return fail('Reply blocked by NACL (inbound)', `The reply arrives at the NAT’s ephemeral port 1100. NACLs are stateless – inbound needs an allow for 1024-65535. ${nIn.rule} → DENY.`, [P('ext-igw', { color: 'green', dropAt: 0.9 }), P('nat-igw', { color: 'red', reverse: true, at: 0.4, dropAt: 0.2 })], ['pub']);
      steps.push({ title: 'Reply returns to the app', text: `NACL inbound ${nIn.rule} allows the reply; the NAT Gateway translates it back to 10.0.2.20:40001. The security group allows it automatically (stateful).`, packets: [P('ext-igw', { color: 'green', span: 0.3 }), P('nat-igw', { color: 'green', reverse: true, at: 0.3, span: 0.25 }), P('app-nat', { color: 'green', reverse: true, at: 0.55, span: 0.3 })] });
      return end(true, 'Outbound connection succeeded via NAT Gateway → IGW. Note that the internet still cannot start a connection to the app.');
    }
    case 'web-app': {
      const lk = doLookup('Public route table', c.pubRoutes, '10.0.2.20');
      steps.push({ title: 'Route lookup', text: `10.0.2.20 matches ${lk.chosen?.dest} → ${lk.chosen?.target}. The local route keeps VPC traffic inside the VPC – no gateway needed.`, focus: ['rtp'], log: `route 10.0.2.20 → ${lk.chosen?.dest} (${lk.chosen?.target})` });
      if (lk.chosen?.target !== 'local') return fail('Unexpected route', 'Traffic inside the VPC should use the local route.', []);
      const nOut = evalNacl(c.naclOut, 8080, '10.0.2.20');
      if (!nOut.allowed) return fail('Blocked by public NACL (outbound)', `Leaving the public subnet, ${nOut.rule} → DENY for port 8080.`, [P('web-app', { color: 'red', dropAt: 0.15 })], ['pub']);
      steps.push({ title: 'Leaves the public subnet', text: `Public NACL outbound ${nOut.rule} allows 8080. The private subnet uses the default NACL (allow all).`, packets: [P('web-app', { span: 0.4, label: ':8080' })] });
      const sg = evalSg(c.appSg, 8080, '10.0.1.10', 'web-sg');
      if (!sg.allowed) return fail('Blocked by app security group', 'app-sg has no rule allowing 8080 from the web tier (by security group reference or CIDR).', [P('web-app', { color: 'red', dropAt: 0.9 })], ['app']);
      steps.push({ title: 'App security group: allowed', text: `app-sg rule "${sg.rule}" – referencing the web security group means any instance with web-sg can connect, regardless of its IP.`, packets: [P('web-app', { at: 0, span: 0.7 })], focus: ['app'] });
      const nIn = evalNacl(c.naclIn, 50200, '10.0.2.20');
      if (!nIn.allowed) return fail('Reply blocked by public NACL (inbound)', `Reply to ephemeral port 50200 entering the public subnet: ${nIn.rule} → DENY (stateless!).`, [P('web-app', { color: 'green', reverse: true, dropAt: 0.85 })], ['pub']);
      steps.push({ title: 'Reply returns', text: `Public NACL inbound ${nIn.rule} allows the reply.`, packets: [P('web-app', { color: 'green', reverse: true })] });
      return end(true, 'Subnet-to-subnet traffic succeeded using the local route.');
    }
    case 'app-peer': {
      const dst = '172.16.0.5';
      const lk = doLookup('Private route table', c.privRoutes, dst);
      if (!lk.chosen) return fail('No route to the peer VPC', `No route matches ${dst}. Both VPCs need routes pointing to the peering connection.`, [P('app-peer', { color: 'red', dropAt: 0.15 })], ['rtv']);
      if (lk.chosen.target !== 'pcx') return fail(`Route goes to ${lk.chosen.target}`, `${dst} matches ${lk.chosen.dest} → ${TARGET_LABEL[lk.chosen.target]}. Without a more specific route to the peering connection, the packet goes the wrong way${lk.chosen.target === 'nat' ? ' – the internet cannot route private 172.16.x.x addresses' : ''}.`, [P(lk.chosen.target === 'nat' ? 'app-nat' : 'app-peer', { color: 'red', dropAt: 0.5 })], ['rtv']);
      steps.push({ title: `Route selected: ${lk.chosen.dest} → peering`, text: `Longest prefix match: ${lk.chosen.dest} is more specific than 0.0.0.0/0, so the peering connection wins.`, packets: [P('app-peer', { label: ':5432' })], focus: ['rtv'], log: `route ${dst} → ${lk.chosen.dest} (pcx)` });
      steps.push({ title: 'Peer side', text: 'The peer VPC must have a route back to 10.0.0.0/16 via the same peering connection, and its security group must allow 5432 from 10.0.2.0/24 (assumed configured).', packets: [P('app-peer', { color: 'green', reverse: true })] });
      return end(true, 'Traffic reached the peered VPC privately – no internet, no gateways.');
    }
  }
}

function buildDef(id: TestId, sim: Sim, c: Cfg, run: number): FlowDef {
  return {
    id: `vpc-test-${run}`,
    title: TESTS.find((t) => t.id === id)!.label,
    description: sim.ok ? 'Result: connection succeeds' : 'Result: packet dropped',
    width: 880,
    height: 420,
    groups: [g('vpc', 'VPC 10.0.0.0/16', 180, 15, 520, 390, 'vpc'), g('pub', 'Public subnet 10.0.1.0/24', 230, 45, 450, 160, 'public'), g('priv', 'Private subnet 10.0.2.0/24', 230, 225, 450, 165, 'private'), g('peer', 'Peer VPC 172.16.0.0/16', 720, 245, 150, 130, 'vpc')],
    nodes: [
      n('client', 'Internet client', 75, 60, 'user', '203.0.113.9', { w: 120 }),
      n('admin', 'Admin', 75, 150, 'user', '203.0.113.50', { w: 120 }),
      n('attacker', 'Unknown host', 75, 240, 'user', '198.51.100.7', { w: 120 }),
      n('ext', 'Update server', 75, 340, 'internet', '93.184.216.34', { w: 120 }),
      n('igw', 'IGW', 200, 200, 'network', c.igw ? 'attached' : 'detached', { w: 76 }),
      n('web', 'Web EC2', 320, 115, 'compute', c.webPublicIp ? '10.0.1.10 · 54.10.20.30' : '10.0.1.10 · no public IP', { w: 150 }),
      n('nat', 'NAT Gateway', 470, 115, 'network', '10.0.1.50 · EIP', { w: 120 }),
      n('rtp', 'Public RT', 615, 115, 'network', `${c.pubRoutes.length} routes`, { icon: 'route', w: 100 }),
      n('app', 'App EC2', 320, 300, 'compute', '10.0.2.20 (private)', { w: 140 }),
      n('rtv', 'Private RT', 615, 300, 'network', `${c.privRoutes.length} routes`, { icon: 'route', w: 100 }),
      n('peerdb', 'DB host', 795, 320, 'database', '172.16.0.5', { w: 110 }),
    ],
    edges: [
      e('client-igw', 'client', 'igw'),
      e('admin-igw', 'admin', 'igw'),
      e('attacker-igw', 'attacker', 'igw'),
      e('ext-igw', 'ext', 'igw'),
      e('igw-web', 'igw', 'web'),
      e('igw-app', 'igw', 'app', { dashed: true }),
      e('web-app', 'web', 'app'),
      e('app-nat', 'app', 'nat'),
      e('nat-igw', 'nat', 'igw', { curve: 40 }),
      e('app-peer', 'app', 'peerdb', { curve: 60, label: 'pcx' }),
    ],
    initial: { nat: c.nat ? 'ok' : 'off', igw: c.igw ? 'ok' : 'off', 'igw-web': c.igw ? 'ok' : 'off' },
    steps: [...sim.steps, { title: sim.ok ? '✓ Result: success' : '✕ Result: dropped', text: sim.summary, set: sim.ok ? {} : {} }],
  };
}

function RouteEditor({ title, routes, onChange }: { title: string; routes: Route[]; onChange: (r: Route[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="label">{title}</div>
        <button className="btn btn-sm" onClick={() => onChange([...routes, { dest: '0.0.0.0/0', target: 'igw' }])}>
          <Plus size={12} />
        </button>
      </div>
      <div className="space-y-1">
        {routes.map((r, i) => (
          <div key={i} className="flex gap-1">
            <input className={`input flex-1 mono text-[12px] ${validCidr(r.dest) ? '' : 'border-bad'}`} value={r.dest} disabled={r.target === 'local'} onChange={(ev) => onChange(routes.map((x, j) => (j === i ? { ...x, dest: ev.target.value } : x)))} />
            <select className="select text-[12px]" value={r.target} disabled={r.target === 'local'} onChange={(ev) => onChange(routes.map((x, j) => (j === i ? { ...x, target: ev.target.value as Target } : x)))}>
              {(['local', 'igw', 'nat', 'pcx', 'blackhole'] as Target[]).map((t) => (
                <option key={t} value={t} disabled={t === 'local'}>
                  {t}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" disabled={r.target === 'local'} onClick={() => onChange(routes.filter((_, j) => j !== i))} aria-label="Remove route">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NaclEditor({ title, rules, onChange }: { title: string; rules: NaclRule[]; onChange: (r: NaclRule[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="label">{title}</div>
        <button className="btn btn-sm" onClick={() => onChange([...rules, { num: Math.max(0, ...rules.map((r) => r.num)) + 10, action: 'allow', ports: 'all', cidr: '0.0.0.0/0' }])}>
          <Plus size={12} />
        </button>
      </div>
      <div className="space-y-1">
        {[...rules]
          .map((r, i) => ({ r, i }))
          .sort((a, b) => a.r.num - b.r.num)
          .map(({ r, i }) => (
            <div key={i} className="flex gap-1">
              <input className="input w-14 mono text-[12px]" type="number" value={r.num} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, num: Number(ev.target.value) } : x)))} />
              <select className={`select text-[12px] ${r.action === 'deny' ? 'text-bad' : 'text-ok'}`} value={r.action} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, action: ev.target.value as 'allow' | 'deny' } : x)))}>
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
              <input className="input w-24 mono text-[12px]" value={r.ports} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, ports: ev.target.value } : x)))} />
              <input className="input flex-1 mono text-[12px]" value={r.cidr} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, cidr: ev.target.value } : x)))} />
              <button className="btn btn-sm" onClick={() => onChange(rules.filter((_, j) => j !== i))} aria-label="Remove rule">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        <div className="text-[11px] text-faint mono">*  deny  all  0.0.0.0/0  (implicit, cannot be removed)</div>
      </div>
    </div>
  );
}

function SgEditor({ title, rules, onChange }: { title: string; rules: SgRule[]; onChange: (r: SgRule[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="label">{title}</div>
        <button className="btn btn-sm" onClick={() => onChange([...rules, { ports: '80', source: '0.0.0.0/0' }])}>
          <Plus size={12} />
        </button>
      </div>
      <div className="space-y-1">
        {rules.map((r, i) => (
          <div key={i} className="flex gap-1">
            <input className="input w-24 mono text-[12px]" value={r.ports} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, ports: ev.target.value } : x)))} />
            <input className="input flex-1 mono text-[12px]" value={r.source} onChange={(ev) => onChange(rules.map((x, j) => (j === i ? { ...x, source: ev.target.value } : x)))} title="CIDR or sg:web-sg" />
            <button className="btn btn-sm" onClick={() => onChange(rules.filter((_, j) => j !== i))} aria-label="Remove rule">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {rules.length === 0 && <div className="text-[11px] text-faint">No inbound rules – all inbound traffic dropped.</div>}
      </div>
    </div>
  );
}

const BREAKERS: { label: string; f: (c: Cfg) => Cfg }[] = [
  { label: 'Remove IGW route from public RT', f: (c) => ({ ...c, pubRoutes: c.pubRoutes.filter((r) => r.target !== 'igw') }) },
  { label: 'Delete NAT Gateway', f: (c) => ({ ...c, nat: false }) },
  { label: 'Remove NACL ephemeral rules', f: (c) => ({ ...c, naclIn: c.naclIn.filter((r) => r.ports !== '1024-65535'), naclOut: c.naclOut.filter((r) => r.ports !== '1024-65535') }) },
  { label: 'Detach Internet Gateway', f: (c) => ({ ...c, igw: false }) },
  { label: 'Remove web public IP', f: (c) => ({ ...c, webPublicIp: false }) },
  { label: 'Point private 0.0.0.0/0 to IGW', f: (c) => ({ ...c, privRoutes: c.privRoutes.map((r) => (r.dest === '0.0.0.0/0' ? { ...r, target: 'igw' as Target } : r)) }) },
  { label: 'Remove peering route', f: (c) => ({ ...c, privRoutes: c.privRoutes.filter((r) => r.target !== 'pcx') }) },
];

function PathTester() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [test, setTest] = useState<TestId>('inet-web');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ sim: Sim; def: FlowDef } | null>(null);

  const go = (id: TestId = test) => {
    const sim = simulate(id, cfg);
    const nr = run + 1;
    setRun(nr);
    setResult({ sim, def: buildDef(id, sim, cfg, nr) });
  };

  const changed = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(DEFAULT), [cfg]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TESTS.map((t) => (
          <button
            key={t.id}
            className={`btn btn-sm ${test === t.id ? 'btn-active' : ''}`}
            onClick={() => {
              setTest(t.id);
              go(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => go()}>
          <Play size={12} /> Re-run
        </button>
      </div>
      {result ? <FlowPlayer key={result.def.id} def={result.def} autoStart /> : <Callout kind="tip">Pick a test above to send a packet through the VPC. Then change routes, NACLs or security groups in the configuration panel below (or use “Break something”) and run it again.</Callout>}
      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`rounded-lg border p-3 text-[13px] ${result.sim.ok ? 'border-ok/50 bg-ok/5' : 'border-bad/50 bg-bad/5'}`}>
            <div className="font-semibold">{result.sim.ok ? '✓ Packet delivered' : '✕ Packet dropped'}</div>
            <div className="text-muted mt-1">{result.sim.summary}</div>
          </div>
          <div className="space-y-2">
            {result.sim.lookups.map((l, i) => (
              <div key={i} className="rounded-lg border border-line overflow-hidden">
                <div className="bg-panel2 px-3 py-1.5 text-[12px] font-semibold">
                  {l.table}: lookup for <span className="mono text-accent">{l.ip}</span>
                </div>
                <table className="lab-table">
                  <tbody>
                    {l.res.candidates.map((cnd, j) => {
                      const chosen = l.res.chosen === cnd.route;
                      return (
                        <tr key={j} className={chosen ? 'bg-ok/10' : ''}>
                          <td className="mono text-[12px]">{cnd.route.dest}</td>
                          <td className="mono text-[12px]">{cnd.route.target}</td>
                          <td className="text-[12px]">{cnd.matches ? `matches (/${cnd.bits})` : <span className="text-faint">no match</span>}</td>
                          <td className="text-[12px] font-semibold text-ok">{chosen ? '← selected (longest prefix)' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-[13px] font-semibold">Network configuration</div>
          <div className="flex flex-wrap gap-1.5">
            <select
              className="select text-[12px]"
              value=""
              onChange={(ev) => {
                const b = BREAKERS[Number(ev.target.value)];
                if (b) setCfg((c) => b.f(c));
              }}
            >
              <option value="">Break something…</option>
              {BREAKERS.map((b, i) => (
                <option key={b.label} value={i}>
                  {b.label}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" disabled={!changed} onClick={() => setCfg(DEFAULT)}>
              <RotateCcw size={12} /> Reset config
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mb-4">
          <Toggle checked={cfg.igw} onChange={(v) => setCfg({ ...cfg, igw: v })} label="Internet Gateway attached" />
          <Toggle checked={cfg.nat} onChange={(v) => setCfg({ ...cfg, nat: v })} label="NAT Gateway exists" />
          <Toggle checked={cfg.webPublicIp} onChange={(v) => setCfg({ ...cfg, webPublicIp: v })} label="Web has public IP" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4">
            <RouteEditor title="Public route table" routes={cfg.pubRoutes} onChange={(r) => setCfg({ ...cfg, pubRoutes: r })} />
            <RouteEditor title="Private route table" routes={cfg.privRoutes} onChange={(r) => setCfg({ ...cfg, privRoutes: r })} />
          </div>
          <div className="space-y-4">
            <NaclEditor title="Public subnet NACL – inbound" rules={cfg.naclIn} onChange={(r) => setCfg({ ...cfg, naclIn: r })} />
            <NaclEditor title="Public subnet NACL – outbound" rules={cfg.naclOut} onChange={(r) => setCfg({ ...cfg, naclOut: r })} />
            <p className="text-[11px] text-faint">The private subnet uses the default NACL (allows all traffic).</p>
          </div>
          <div className="space-y-4">
            <SgEditor title="web-sg inbound (stateful)" rules={cfg.webSg} onChange={(r) => setCfg({ ...cfg, webSg: r })} />
            <SgEditor title="app-sg inbound (stateful)" rules={cfg.appSg} onChange={(r) => setCfg({ ...cfg, appSg: r })} />
            <p className="text-[11px] text-faint">Sources can be CIDRs or a security group reference like <code className="mono">sg:web-sg</code>. Outbound is allow-all (the default).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VpcLab() {
  const [tab, setTab] = useState<'path' | 'builder'>('path');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'path', label: 'Packet path tester' },
          { id: 'builder', label: 'Drag-and-drop VPC builder' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'path' ? (
        <PathTester />
      ) : (
        <Suspense fallback={<Loading />}>
          <VpcBuilder />
        </Suspense>
      )}
    </div>
  );
}
