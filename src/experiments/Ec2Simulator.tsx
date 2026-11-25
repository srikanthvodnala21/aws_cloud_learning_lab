import { useMemo, useState } from 'react';
import { Plus, Trash2, Power, RotateCcw, Zap, Rocket } from 'lucide-react';
import { FlowCanvas } from '../animation/FlowPlayer';
import type { FlowDef, Status } from '../animation/flowTypes';
import { useInterval, useLoop } from '../animation/useLoop';
import { INSTANCE_TYPES, EBS_PRICES, PRICING_DISCLAIMER } from '../data/pricing';
import { Badge, Callout, Field, Slider, Toggle } from '../components/ui';

type State = 'pending' | 'running' | 'stopping' | 'stopped' | 'shutting-down' | 'terminated' | 'rebooting';

interface Rule {
  port: string;
  source: string;
  desc: string;
}

interface Instance {
  id: string;
  name: string;
  type: string;
  os: string;
  state: State;
  timer: number; // ticks until next transition
  publicIp?: string;
  privateIp: string;
  ebsGb: number;
  ebsType: string;
  sysCheck: 'ok' | 'impaired' | 'initializing';
  instCheck: 'ok' | 'impaired' | 'initializing';
  elasticIp: boolean;
  pub: boolean;
  autoIp: boolean;
  log: string[];
}

const OS = [
  { id: 'al2023', label: 'Amazon Linux 2023', user: 'ec2-user' },
  { id: 'ubuntu', label: 'Ubuntu Server 24.04 LTS', user: 'ubuntu' },
  { id: 'rhel', label: 'Red Hat Enterprise Linux 9', user: 'ec2-user' },
  { id: 'windows', label: 'Windows Server 2025', user: 'Administrator (RDP)' },
];

const FAMILY_TABLE = [
  ['General purpose', 'M, T', 'Balanced CPU/memory', 'Web/app servers, small DBs, dev/test'],
  ['Compute optimized', 'C', 'High CPU per GiB', 'Batch, encoding, gaming servers, HPC'],
  ['Memory optimized', 'R, X, z', 'High memory per vCPU', 'In-memory caches, large DBs, analytics'],
  ['Storage optimized', 'I, D, H', 'Fast local NVMe / dense HDD', 'NoSQL DBs, data warehousing, log processing'],
  ['Accelerated computing', 'P, G, Inf, Trn', 'GPUs / ML accelerators', 'ML training & inference, graphics'],
];

const rndIp = () => `${[3, 18, 34, 44, 52, 54][Math.floor(Math.random() * 6)]}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
function portOk(rule: string, port: number) {
  if (rule.trim() === 'all') return true;
  const [a, b] = rule.split('-').map(Number);
  return b !== undefined && !Number.isNaN(b) ? port >= a && port <= b : a === port;
}

function cidrMatch(cidr: string, ip: string) {
  if (cidr === '0.0.0.0/0') return true;
  const [base, bits] = cidr.split('/');
  const toInt = (s: string) => s.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (toInt(base) & mask) === (toInt(ip) & mask);
}

const STATE_TONE: Record<State, 'ok' | 'warn' | 'bad' | 'default' | 'sky'> = {
  pending: 'warn',
  running: 'ok',
  stopping: 'warn',
  stopped: 'default',
  'shutting-down': 'warn',
  terminated: 'bad',
  rebooting: 'sky',
};

export default function Ec2Simulator() {
  const [minCpu, setMinCpu] = useState(2);
  const [minMem, setMinMem] = useState(1);
  const [type, setType] = useState('t3.micro');
  const [os, setOs] = useState('al2023');
  const [ebsGb, setEbsGb] = useState(8);
  const [ebsType, setEbsType] = useState('gp3');
  const [publicSubnet, setPublicSubnet] = useState(true);
  const [autoIp, setAutoIp] = useState(true);
  const [rules, setRules] = useState<Rule[]>([
    { port: '443', source: '0.0.0.0/0', desc: 'HTTPS from anywhere' },
    { port: '22', source: '203.0.113.10/32', desc: 'SSH from my IP' },
  ]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [test, setTest] = useState<string | null>(null);
  const { t } = useLoop(1600);

  const it = INSTANCE_TYPES.find((x) => x.type === type)!;
  const matching = INSTANCE_TYPES.filter((x) => x.vcpu >= minCpu && x.memGiB >= minMem);

  // simulation clock: 1 tick = 700 ms
  useInterval(() => {
    setInstances((list) =>
      list.map((i) => {
        if (i.timer > 0) return { ...i, timer: i.timer - 1 };
        const log = (m: string) => [`${new Date().toLocaleTimeString()} ${m}`, ...i.log].slice(0, 12);
        switch (i.state) {
          case 'pending':
            return { ...i, state: 'running', sysCheck: 'initializing', instCheck: 'initializing', timer: 3, publicIp: i.elasticIp ? i.publicIp : i.pub && i.autoIp ? i.publicIp ?? rndIp() : undefined, log: log('State → running (billing starts). Running user data…') };
          case 'running':
            if (i.sysCheck === 'initializing') return { ...i, sysCheck: 'ok', instCheck: 'ok', log: log('Status checks: 2/2 passed') };
            return i;
          case 'stopping':
            return { ...i, state: 'stopped', log: log('State → stopped. EBS volume retained (still billed).') };
          case 'shutting-down':
            return { ...i, state: 'terminated', log: log('State → terminated. Root EBS volume deleted (DeleteOnTermination=true).') };
          case 'rebooting':
            return { ...i, state: 'running', log: log('Reboot complete – same host, same IPs.') };
          default:
            return i;
        }
      }),
    );
  }, 700);

  const sel = instances.find((i) => i.id === selected) ?? instances[instances.length - 1];

  const launch = () => {
    const id = `i-0${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 9)}`;
    const inst: Instance = {
      id,
      name: `web-${instances.length + 1}`,
      type,
      os,
      state: 'pending',
      timer: 3,
      privateIp: `10.0.${publicSubnet ? 1 : 2}.${10 + instances.length}`,
      ebsGb,
      ebsType,
      sysCheck: 'initializing',
      instCheck: 'initializing',
      elasticIp: false,
      pub: publicSubnet,
      autoIp,
      log: [`${new Date().toLocaleTimeString()} RunInstances accepted – state → pending. Creating ${ebsGb} GiB ${ebsType} root volume from AMI snapshot.`],
    };
    setInstances((l) => [...l, inst]);
    setSelected(id);
    setTest(null);
  };

  const update = (id: string, f: (i: Instance) => Instance) => setInstances((l) => l.map((i) => (i.id === id ? f(i) : i)));
  const log = (i: Instance, m: string) => [`${new Date().toLocaleTimeString()} ${m}`, ...i.log].slice(0, 12);

  const act = (a: 'stop' | 'start' | 'reboot' | 'terminate' | 'fail' | 'recover' | 'eip') => {
    if (!sel) return;
    update(sel.id, (i) => {
      switch (a) {
        case 'stop':
          return { ...i, state: 'stopping', timer: 2, publicIp: i.elasticIp ? i.publicIp : undefined, log: log(i, 'StopInstances – OS shutting down. Auto-assigned public IP released.') };
        case 'start':
          return { ...i, state: 'pending', timer: 3, sysCheck: 'initializing', instCheck: 'initializing', log: log(i, 'StartInstances – placed on (possibly new) host; private IP kept.') };
        case 'reboot':
          return { ...i, state: 'rebooting', timer: 2, log: log(i, 'RebootInstances') };
        case 'terminate':
          return { ...i, state: 'shutting-down', timer: 2, publicIp: undefined, log: log(i, 'TerminateInstances – this cannot be undone.') };
        case 'fail':
          return { ...i, sysCheck: 'impaired', log: log(i, 'ALERT: System status check failed (underlying host hardware issue).') };
        case 'recover':
          return { ...i, state: 'pending', timer: 3, sysCheck: 'initializing', instCheck: 'initializing', log: log(i, 'Recovery: instance migrated to healthy hardware. Instance ID, private IP, Elastic IP and EBS data preserved.') };
        case 'eip': {
          const ip = rndIp();
          return { ...i, elasticIp: true, publicIp: ip, log: log(i, `Elastic IP ${ip} allocated and associated (static, survives stop/start).`) };
        }
      }
    });
  };

  const tests = [
    { id: 'https', label: 'HTTPS from the internet', src: '198.51.100.23', port: 443 },
    { id: 'ssh-me', label: 'SSH from my IP', src: '203.0.113.10', port: 22 },
    { id: 'ssh-other', label: 'SSH from another IP', src: '192.0.2.77', port: 22 },
    { id: 'http', label: 'HTTP :80 from the internet', src: '198.51.100.23', port: 80 },
  ];

  const testResult = useMemo(() => {
    if (!test || !sel) return null;
    const tt = tests.find((x) => x.id === test)!;
    if (sel.state !== 'running') return { ok: false, hop: 'ec2', why: `Instance is ${sel.state} – nothing is listening.` };
    if (!sel.pub) return { ok: false, hop: 'igw', why: 'Instance is in a private subnet: no route from an Internet Gateway, so it cannot be reached from the internet.' };
    if (!sel.publicIp) return { ok: false, hop: 'igw', why: 'Instance has no public IPv4 address (auto-assign disabled and no Elastic IP) – the IGW has nothing to translate.' };
    if (sel.sysCheck === 'impaired') return { ok: false, hop: 'ec2', why: 'System status check failed – the instance is unreachable until recovered.' };
    const rule = rules.find((r) => portOk(r.port, tt.port) && cidrMatch(r.source, tt.src));
    if (!rule) return { ok: false, hop: 'sg', why: `No security group rule allows TCP ${tt.port} from ${tt.src}. Packet silently dropped.` };
    return { ok: true, hop: 'ec2', why: `Allowed by rule "${rule.port} from ${rule.source}". Response allowed automatically (stateful).` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, sel, rules]);

  const diagram: FlowDef = useMemo(() => {
    const st: Record<string, Status> = {};
    if (!sel) st.ec2 = 'hidden';
    else if (sel.state === 'terminated') st.ec2 = 'off';
    else if (sel.sysCheck === 'impaired') st.ec2 = 'fail';
    else if (sel.state === 'stopped' || sel.state === 'stopping') st.ec2 = 'off';
    else if (sel.state === 'pending' || sel.state === 'rebooting') st.ec2 = 'warn';
    if (!sel) st.ebs = 'hidden';
    else if (sel.state === 'terminated') st.ebs = 'hidden';
    if (!sel?.publicIp) st['igw-ec2'] = 'off';
    const packets = testResult
      ? [
          { edge: 'net-igw', color: (testResult.ok ? 'blue' : 'red') as 'blue' | 'red', span: 0.3, dropAt: testResult.hop === 'igw' ? 0.95 : undefined },
          ...(testResult.hop !== 'igw' ? [{ edge: 'igw-ec2', color: (testResult.ok ? 'blue' : 'red') as 'blue' | 'red', at: 0.3, span: 0.45, dropAt: testResult.hop === 'sg' ? 0.55 : testResult.ok ? undefined : 0.95 }] : []),
        ]
      : [];
    return {
      id: 'ec2-live',
      title: 'live',
      width: 820,
      height: 300,
      groups: [
        { id: 'vpc', label: 'VPC 10.0.0.0/16', x: 180, y: 15, w: 620, h: 270, tone: 'vpc' },
        { id: 'sub', label: (sel ? sel.pub : publicSubnet) ? 'Public subnet 10.0.1.0/24 · AZ a' : 'Private subnet 10.0.2.0/24 · AZ a', x: 300, y: 45, w: 480, h: 225, tone: (sel ? sel.pub : publicSubnet) ? 'public' : 'private' },
        { id: 'sg', label: `Security group (${rules.length} inbound rules)`, x: 330, y: 75, w: 260, h: 110, tone: 'generic' },
      ],
      nodes: [
        { id: 'net', label: 'Internet', sub: 'clients', x: 80, y: 130, kind: 'internet' },
        { id: 'igw', label: 'IGW', x: 210, y: 130, kind: 'network', w: 70 },
        { id: 'ec2', label: sel ? sel.name : 'EC2', sub: sel ? `${sel.type} · ${sel.state}` : '', x: 460, y: 135, kind: 'compute', w: 150 },
        { id: 'ebs', label: `EBS ${sel?.ebsType ?? ebsType}`, sub: `${sel?.ebsGb ?? ebsGb} GiB root`, x: 460, y: 230, kind: 'storage', w: 130 },
        { id: 'ip', label: sel?.publicIp ?? 'no public IP', sub: sel ? `private ${sel.privateIp}${sel.elasticIp ? ' · Elastic IP' : ''}` : '', x: 690, y: 135, kind: 'network', w: 150, icon: 'globe' },
      ],
      edges: [
        { id: 'net-igw', from: 'net', to: 'igw' },
        { id: 'igw-ec2', from: 'igw', to: 'ec2' },
        { id: 'ec2-ebs', from: 'ec2', to: 'ebs', label: 'attached' },
        { id: 'ec2-ip', from: 'ec2', to: 'ip', plain: true, dashed: true },
      ],
      initial: st,
      steps: [{ title: '', text: '', packets }],
    };
  }, [sel, publicSubnet, rules.length, ebsGb, ebsType, testResult]);

  const hourly = it.hourly;
  const ebsMonthly = ebsGb * EBS_PRICES[ebsType].perGb;

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        {/* Launch wizard */}
        <div className="space-y-4">
          <div className="text-[13px] font-semibold flex items-center gap-2">
            <Rocket size={15} className="text-accent" /> Launch an instance
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Slider label="Need at least vCPU" value={minCpu} min={1} max={4} onChange={setMinCpu} />
            <Slider label="Need at least memory" value={minMem} min={1} max={32} onChange={setMinMem} format={(v) => `${v} GiB`} />
          </div>
          <p className="text-[11.5px] text-faint -mt-2">You can’t pick arbitrary CPU/memory on EC2 – you choose an instance type. Types meeting your needs are highlighted.</p>
          <div className="max-h-56 overflow-auto rounded-lg border border-line">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>vCPU</th>
                  <th>Memory</th>
                  <th>Sample $/h</th>
                </tr>
              </thead>
              <tbody>
                {INSTANCE_TYPES.map((x) => {
                  const ok = matching.includes(x);
                  return (
                    <tr key={x.type} onClick={() => setType(x.type)} className={`cursor-pointer ${type === x.type ? 'bg-accent-soft' : ''} ${ok ? '' : 'opacity-40'}`} title={x.note}>
                      <td className="mono text-[12px]">
                        {x.type}
                        <div className="text-[10px] text-faint font-sans">{x.family}</div>
                      </td>
                      <td>{x.vcpu}</td>
                      <td>{x.memGiB} GiB</td>
                      <td className="mono">{x.hourly.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="AMI / operating system">
              <select className="select w-full" value={os} onChange={(e) => setOs(e.target.value)}>
                {OS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Root volume type">
              <select className="select w-full" value={ebsType} onChange={(e) => setEbsType(e.target.value)}>
                {Object.entries(EBS_PRICES).map(([k, v]) => (
                  <option key={k} value={k} disabled={k === 'st1' || k === 'sc1'}>
                    {v.label}
                    {k === 'st1' || k === 'sc1' ? ' (not bootable)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Slider label="Root EBS size" value={ebsGb} min={8} max={500} step={4} onChange={setEbsGb} format={(v) => `${v} GiB`} />
          <div className="flex flex-wrap gap-4">
            <Toggle checked={publicSubnet} onChange={setPublicSubnet} label="Launch in public subnet" />
            <Toggle checked={autoIp} onChange={setAutoIp} label="Auto-assign public IP" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="label">Security group inbound rules</div>
              <button className="btn btn-sm" onClick={() => setRules((r) => [...r, { port: '80', source: '0.0.0.0/0', desc: 'HTTP' }])}>
                <Plus size={12} /> Rule
              </button>
            </div>
            <div className="space-y-1.5">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input className="input w-24 mono" value={r.port} onChange={(e) => setRules((rs) => rs.map((x, j) => (j === i ? { ...x, port: e.target.value } : x)))} title="port, range (1024-65535) or all" />
                  <input className="input flex-1 mono" value={r.source} onChange={(e) => setRules((rs) => rs.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} />
                  <button className="btn btn-sm" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove rule">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            {rules.some((r) => r.port === '22' && r.source === '0.0.0.0/0') && <div className="mt-1 text-[11.5px] text-warn">⚠ SSH open to the whole internet – a common security finding. Prefer Session Manager or your IP only.</div>}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line bg-panel2 p-3">
            <div className="text-[12px] text-muted">
              Sample cost: <b className="text-ink mono">${hourly.toFixed(4)}/h</b> (~${(hourly * 730).toFixed(2)}/mo) + EBS <b className="text-ink mono">${ebsMonthly.toFixed(2)}/mo</b>
            </div>
            <button className="btn btn-primary" onClick={launch}>
              <Rocket size={14} /> Launch
            </button>
          </div>
        </div>

        {/* Instances & diagram */}
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-bg/60 p-1">
            <FlowCanvas def={diagram} step={0} t={t} />
          </div>
          {instances.length === 0 ? (
            <Callout kind="tip">Configure the instance on the left and press <b>Launch</b> to watch it go through pending → running and status checks.</Callout>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {instances.map((i) => (
                  <button key={i.id} className={`btn btn-sm ${sel?.id === i.id ? 'btn-active' : ''}`} onClick={() => setSelected(i.id)}>
                    {i.name} <Badge tone={STATE_TONE[i.state]}>{i.state}</Badge>
                  </button>
                ))}
              </div>
              {sel && (
                <div className="rounded-lg border border-line p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="mono text-[12px]">{sel.id}</div>
                      <div className="text-[12px] text-muted">
                        {sel.type} · {OS.find((o) => o.id === sel.os)?.label} · login user: {OS.find((o) => o.id === sel.os)?.user}
                      </div>
                    </div>
                    <div className="flex gap-1.5 text-[11px]">
                      <Badge tone={sel.sysCheck === 'ok' ? 'ok' : sel.sysCheck === 'impaired' ? 'bad' : 'warn'}>System: {sel.sysCheck}</Badge>
                      <Badge tone={sel.instCheck === 'ok' ? 'ok' : sel.instCheck === 'impaired' ? 'bad' : 'warn'}>Instance: {sel.instCheck}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn btn-sm" disabled={sel.state !== 'running'} onClick={() => act('stop')}>
                      <Power size={12} /> Stop
                    </button>
                    <button className="btn btn-sm" disabled={sel.state !== 'stopped'} onClick={() => act('start')}>
                      <Power size={12} /> Start
                    </button>
                    <button className="btn btn-sm" disabled={sel.state !== 'running' || sel.sysCheck === 'impaired'} onClick={() => act('reboot')}>
                      <RotateCcw size={12} /> Reboot
                    </button>
                    <button className="btn btn-sm" disabled={sel.state === 'terminated' || sel.elasticIp} onClick={() => act('eip')}>
                      Associate Elastic IP
                    </button>
                    <button className="btn btn-sm btn-danger" disabled={sel.state !== 'running' || sel.sysCheck === 'impaired'} onClick={() => act('fail')}>
                      <Zap size={12} /> Simulate hardware failure
                    </button>
                    {sel.sysCheck === 'impaired' && (
                      <button className="btn btn-sm btn-primary" onClick={() => act('recover')}>
                        Auto-recover
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" disabled={sel.state === 'terminated' || sel.state === 'shutting-down'} onClick={() => act('terminate')}>
                      <Trash2 size={12} /> Terminate
                    </button>
                  </div>
                  <div>
                    <div className="label mb-1">Connectivity test</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tests.map((x) => (
                        <button key={x.id} className={`btn btn-sm ${test === x.id ? 'btn-active' : ''}`} onClick={() => setTest(x.id)}>
                          {x.label}
                        </button>
                      ))}
                    </div>
                    {testResult && <div className={`mt-2 text-[12.5px] ${testResult.ok ? 'text-ok' : 'text-bad'}`}>{testResult.ok ? '✓ Connected. ' : '✕ Blocked. '}{testResult.why}</div>}
                  </div>
                  <div className="mono text-[11px] text-muted max-h-36 overflow-auto space-y-0.5 border-t border-line pt-2">
                    {sel.log.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-2">Instance families at a glance</div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>Letters</th>
                <th>Optimised for</th>
                <th>Typical use cases</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY_TABLE.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className={i === 0 ? 'font-medium' : 'text-muted'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-faint">{PRICING_DISCLAIMER}</p>
      </div>
    </div>
  );
}
