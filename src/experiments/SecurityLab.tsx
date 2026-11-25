import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, Eye } from 'lucide-react';
import { FlowCanvas, FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef, FlowStep } from '../animation/flowTypes';
import { e, g, n, p } from '../animation/builders';
import { useLoop } from '../animation/useLoop';
import { Callout, Tabs, Toggle } from '../components/ui';

/* ------------------------------------------------ shared responsibility */

type Who = 'customer' | 'aws' | 'shared';
const LAYERS = ['Customer data & classification', 'Identity & access (IAM, policies)', 'Application code', 'Encryption choices (at rest / in transit)', 'Network rules (security groups, NACLs)', 'Operating system patching', 'Runtime / database engine', 'Virtualisation & host', 'Physical data centre, hardware, global network'];
const RESP: Record<string, { label: string; who: Who[]; notes: string[] }> = {
  ec2: {
    label: 'Amazon EC2 (IaaS)',
    who: ['customer', 'customer', 'customer', 'customer', 'customer', 'customer', 'customer', 'aws', 'aws'],
    notes: ['', '', '', 'You enable EBS encryption and TLS.', 'You write every SG rule.', 'You patch the guest OS (Systems Manager Patch Manager helps).', 'You install and patch web servers, runtimes and databases.', 'Nitro hypervisor and host are AWS’s job.', ''],
  },
  rds: {
    label: 'Amazon RDS (managed DB)',
    who: ['customer', 'customer', 'customer', 'customer', 'customer', 'aws', 'shared', 'aws', 'aws'],
    notes: ['', 'DB users and IAM auth are yours.', 'Your SQL, schema and queries.', 'You choose KMS encryption and enforce SSL.', 'You place it in private subnets and set its SG.', 'AWS patches the OS.', 'AWS supplies engine patches; you choose the version and maintenance window.', '', ''],
  },
  lambda: {
    label: 'AWS Lambda (serverless)',
    who: ['customer', 'customer', 'customer', 'shared', 'shared', 'aws', 'shared', 'aws', 'aws'],
    notes: ['', 'The execution role should be least privilege.', 'Your code and its dependencies (keep them patched).', 'Env vars are encrypted by default; you can use your own KMS key.', 'Only applies if the function is attached to a VPC.', 'No OS for you to manage.', 'AWS patches managed runtimes; you must move off deprecated runtime versions.', '', ''],
  },
  s3: {
    label: 'Amazon S3 (abstracted storage)',
    who: ['customer', 'customer', 'aws', 'shared', 'aws', 'aws', 'aws', 'aws', 'aws'],
    notes: ['What you store and who should see it.', 'Bucket policies, Block Public Access, IAM and ACLs (disabled by default).', 'No code runs in S3.', 'SSE-S3 is on by default; you choose SSE-KMS or client-side encryption and enforce TLS.', '', '', '', '', ''],
  },
};
const WHO_STYLE: Record<Who, string> = { customer: 'bg-accent/20 border-accent/60 text-ink', aws: 'bg-sky/15 border-sky/50 text-ink', shared: 'bg-violet/15 border-violet/50 text-ink' };

function Responsibility() {
  const [svc, setSvc] = useState<keyof typeof RESP>('ec2');
  const r = RESP[svc];
  return (
    <div className="space-y-3">
      <Tabs tabs={Object.entries(RESP).map(([k, v]) => ({ id: k as keyof typeof RESP, label: v.label }))} value={svc} onChange={setSvc} />
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-1">
          {LAYERS.map((l, i) => (
            <div key={l} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors duration-500 ${WHO_STYLE[r.who[i]]}`}>
              <span className="text-[12.5px] font-medium">{l}</span>
              <span className="text-[11px] text-muted">{r.notes[i]}</span>
              <span className="text-[10.5px] font-bold uppercase tracking-wide">{r.who[i] === 'customer' ? 'You' : r.who[i] === 'aws' ? 'AWS' : 'Shared'}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-accent bg-accent/20" /> Customer: security <b>in</b> the cloud
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-sky bg-sky/15" /> AWS: security <b>of</b> the cloud
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-violet bg-violet/15" /> Shared / depends on configuration
          </div>
          <Callout kind="tip">Switch between EC2 → RDS → Lambda → S3 and watch the AWS-managed layers move up the stack. The more managed the service, the less you operate – but data and access are <b>always</b> yours.</Callout>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ security architecture map */

const INFO: Record<string, { title: string; text: string; scope: string }> = {
  user: { title: 'Users', text: 'Legitimate users and attackers both arrive from the internet.', scope: '' },
  shield: { title: 'AWS Shield', text: 'DDoS protection. Shield Standard is automatic and free for all customers at layers 3/4. Shield Advanced adds L7 protection, a 24/7 response team and cost protection.', scope: 'Global (edge)' },
  waf: { title: 'AWS WAF', text: 'A web application firewall attached to CloudFront, ALB, API Gateway or AppSync. Rules block SQL injection, XSS, bad bots and IPs, and apply rate limits. Managed rule groups are available.', scope: 'Regional, or global with CloudFront' },
  cf: { title: 'Amazon CloudFront', text: 'A CDN that terminates TLS at the edge with ACM certificates. It hides your origin, and origin access control keeps S3 private.', scope: 'Global' },
  alb: { title: 'Application Load Balancer', text: 'In public subnets. Terminates HTTPS with an ACM certificate and forwards only to app targets. Its security group allows 443 from CloudFront only (managed prefix list).', scope: 'Regional (multi-AZ)' },
  app: { title: 'EC2 app tier', text: 'In private subnets. The security group allows traffic only from the ALB’s security group. Access goes through SSM Session Manager (no SSH keys and no port 22). An IAM role provides temporary credentials.', scope: 'Zonal instances' },
  db: { title: 'RDS (encrypted)', text: 'In private subnets. The SG allows 5432 only from the app SG. Storage is encrypted with KMS and TLS is enforced. No public access.', scope: 'Regional service, zonal instances' },
  kms: { title: 'AWS KMS', text: 'Creates and controls encryption keys. Envelope encryption protects EBS, RDS, S3 and more. Key policies plus IAM decide who can use each key, and every use is logged in CloudTrail.', scope: 'Regional' },
  sm: { title: 'Secrets Manager', text: 'Stores the DB password, and the app fetches it at runtime. Automatic rotation is available. Never put secrets in code or AMIs.', scope: 'Regional' },
  iam: { title: 'IAM / IAM Identity Center', text: 'Gives people SSO with MFA and workloads roles (temporary credentials). Least privilege applies. SCPs and permissions boundaries add guardrails.', scope: 'Global' },
  gd: { title: 'Amazon GuardDuty', text: 'Threat detection that analyses CloudTrail, VPC Flow Logs, DNS logs and more using ML and threat intelligence. It flags crypto-mining, credential exfiltration, port scans and similar threats.', scope: 'Regional (enable in every Region)' },
  insp: { title: 'Amazon Inspector', text: 'Continuously scans EC2, container images and Lambda for software vulnerabilities (CVEs) and unintended network exposure.', scope: 'Regional' },
  hub: { title: 'AWS Security Hub', text: 'Aggregates findings from GuardDuty, Inspector, Macie, Config and others. Runs security standard checks (CIS, AWS Foundational Best Practices).', scope: 'Regional, with cross-Region aggregation' },
  trail: { title: 'CloudTrail + Config', text: 'CloudTrail is the audit log of every API call. Config records resource configurations and rule compliance. Together they answer who changed what, and whether it is compliant.', scope: 'Regional (multi-Region trails available)' },
};

function SecMap() {
  const [sel, setSel] = useState('waf');
  const { t } = useLoop(2200);
  const def: FlowDef = useMemo(
    () => ({
      id: 'secmap',
      title: 'Defence in depth',
      width: 860,
      height: 400,
      groups: [g('vpc', 'VPC', 395, 20, 300, 230, 'vpc'), g('pub', 'Public subnets', 410, 50, 120, 180, 'public'), g('priv', 'Private subnets', 550, 50, 130, 180, 'private'), g('gov', 'Detect, govern & protect data', 30, 280, 800, 110, 'generic')],
      nodes: [
        n('user', 'Users', 60, 140, 'user', 'internet', { w: 80 }),
        n('shield', 'Shield', 160, 90, 'security', 'DDoS', { w: 90, icon: 'shield' }),
        n('waf', 'WAF', 160, 190, 'security', 'L7 rules', { w: 90, icon: 'filter' }),
        n('cf', 'CloudFront', 290, 140, 'edge', 'TLS @ edge', { w: 110 }),
        n('alb', 'ALB', 470, 140, 'network', 'HTTPS', { w: 90 }),
        n('app', 'App EC2', 615, 100, 'compute', 'private', { w: 100 }),
        n('db', 'RDS', 615, 190, 'database', 'encrypted', { w: 100 }),
        n('sm', 'Secrets Mgr', 770, 80, 'security', 'DB password', { w: 110, icon: 'key' }),
        n('kms', 'KMS', 770, 190, 'security', 'keys', { w: 100, icon: 'key' }),
        n('iam', 'IAM / SSO', 115, 335, 'security', 'least privilege', { w: 120, icon: 'user' }),
        n('gd', 'GuardDuty', 280, 335, 'security', 'threats', { w: 120, icon: 'eye' }),
        n('insp', 'Inspector', 435, 335, 'security', 'CVEs', { w: 110, icon: 'target' }),
        n('hub', 'Security Hub', 590, 335, 'security', 'findings', { w: 120, icon: 'shieldcheck' }),
        n('trail', 'CloudTrail/Config', 745, 335, 'monitoring', 'audit', { w: 140 }),
      ],
      edges: [e('a', 'user', 'shield'), e('b', 'user', 'waf'), e('c', 'shield', 'cf'), e('d', 'waf', 'cf'), e('f', 'cf', 'alb'), e('h', 'alb', 'app'), e('i', 'app', 'db'), e('j', 'app', 'sm', { dashed: true }), e('k', 'db', 'kms', { dashed: true }), e('l', 'gd', 'hub', { dashed: true }), e('m', 'insp', 'hub', { dashed: true })],
      steps: [{ title: '', text: '', packets: [p('b', 'blue', undefined, { span: 0.2 }), p('d', 'blue', undefined, { at: 0.2, span: 0.2 }), p('f', 'blue', undefined, { at: 0.4, span: 0.2 }), p('h', 'blue', undefined, { at: 0.6, span: 0.2 }), p('i', 'blue', undefined, { at: 0.8, span: 0.18 })] }],
    }),
    [],
  );
  const info = INFO[sel];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="rounded-lg border border-line bg-bg/60 p-1">
        <FlowCanvas def={def} step={0} t={t} onNodeClick={setSel} selected={sel} />
        <div className="px-2 pb-1 text-[11px] text-faint">Click any component.</div>
      </div>
      <div className="rounded-lg border border-line p-3 space-y-2">
        <div className="text-[15px] font-semibold">{info.title}</div>
        {info.scope && <div className="text-[11px] text-accent">{info.scope}</div>}
        <p className="text-[13px] text-muted leading-relaxed">{info.text}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------ threat simulator */

type Defense = 'waf' | 'shieldAdv' | 'bpa' | 'noKeys' | 'gd' | 'ssm' | 'secrets' | 'kms';
const DEFENSES: Record<Defense, string> = {
  waf: 'AWS WAF with managed rules + rate limit',
  shieldAdv: 'Shield Advanced',
  bpa: 'S3 Block Public Access (account level)',
  noKeys: 'No long-term access keys (SSO + roles, MFA)',
  gd: 'GuardDuty enabled + EventBridge auto-response',
  ssm: 'No SSH: SG without port 22, SSM Session Manager',
  secrets: 'Secrets Manager (no secrets in code)',
  kms: 'Encryption with KMS key policy',
};

interface Threat {
  label: string;
  path: { id: string; label: string; defense?: Defense; mode?: 'block' | 'detect'; why: string }[];
  impact: string;
}

const THREATS: Record<string, Threat> = {
  sqli: {
    label: 'SQL injection on /search',
    path: [
      { id: 'edge', label: 'CloudFront + WAF', defense: 'waf', mode: 'block', why: 'The AWSManagedRulesSQLiRuleSet matched `\' OR 1=1 --` → 403 Forbidden.' },
      { id: 'app', label: 'App server', why: 'The request reached the application unfiltered.' },
      { id: 'db', label: 'Database', why: 'Vulnerable query concatenation executed the payload.' },
    ],
    impact: 'Customer table dumped. (Also fix the root cause: parameterised queries.)',
  },
  ddos: {
    label: 'Layer-7 HTTP flood (500k req/s)',
    path: [
      { id: 'edge', label: 'Edge network', defense: 'waf', mode: 'block', why: 'A WAF rate-based rule blocks IPs above 2,000 requests per 5 minutes. CloudFront absorbs the volume at the edge.' },
      { id: 'shield', label: 'Shield', defense: 'shieldAdv', mode: 'block', why: 'Shield Advanced detects the L7 anomaly and the Shield Response Team helps mitigate it. Cost protection covers the scaling charges.' },
      { id: 'app', label: 'ALB / app', why: 'The flood reaches the origin; Auto Scaling races to add capacity.' },
    ],
    impact: 'Site slow or unavailable, and a large scaling bill. (Shield Standard still stops L3/L4 floods automatically.)',
  },
  key: {
    label: 'Access key leaked in a public Git repo',
    path: [
      { id: 'iam', label: 'IAM', defense: 'noKeys', mode: 'block', why: 'No long-term access keys exist. People use SSO and workloads use roles with short-lived credentials, so nothing was there to leak.' },
      { id: 'gd', label: 'GuardDuty', defense: 'gd', mode: 'detect', why: 'GuardDuty flags API calls from an unusual location or a known malicious IP. EventBridge triggers a Lambda that deactivates the key within minutes.' },
      { id: 'acct', label: 'AWS account', why: 'The attacker calls RunInstances in every Region.' },
    ],
    impact: 'Crypto-mining fleet launched; a five-figure bill overnight.',
  },
  bucket: {
    label: 'Bucket policy accidentally made public',
    path: [
      { id: 'bpa', label: 'Block Public Access', defense: 'bpa', mode: 'block', why: 'Account-level Block Public Access overrides the public bucket policy, so the PutBucketPolicy call is rejected.' },
      { id: 'kms', label: 'SSE-KMS', defense: 'kms', mode: 'block', why: 'Objects are encrypted with a customer-managed KMS key. Anonymous users have no kms:Decrypt permission, so their GETs fail.' },
      { id: 's3', label: 'S3 objects', why: 'Anyone with the URL can download the objects.' },
    ],
    impact: 'Data breach and a regulatory notification.',
  },
  ssh: {
    label: 'SSH brute force on port 22',
    path: [
      { id: 'sg', label: 'Security group', defense: 'ssm', mode: 'block', why: 'Port 22 is not open at all and admins use Session Manager. The packets are dropped silently.' },
      { id: 'gd', label: 'GuardDuty', defense: 'gd', mode: 'detect', why: 'GuardDuty raises a UnauthorizedAccess:EC2/SSHBruteForce finding. Auto-response isolates the instance by swapping its security group.' },
      { id: 'ec2', label: 'EC2 instance', why: 'A weak password is guessed and the attacker gets a shell.' },
    ],
    impact: 'Compromised instance used to pivot inside the VPC.',
  },
  secret: {
    label: 'DB password found in source code',
    path: [
      { id: 'sm', label: 'Secrets Manager', defense: 'secrets', mode: 'block', why: 'Code holds only the secret ARN. The password is fetched at runtime with an IAM role and rotated automatically.' },
      { id: 'db', label: 'Database', why: 'Anyone with repository access can log in to production.' },
    ],
    impact: 'Insider or ex-contractor access to production data.',
  },
};

function threatFlow(id: string, enabled: Record<Defense, boolean>, run: number): { def: FlowDef; outcome: 'blocked' | 'detected' | 'breach'; msg: string } {
  const th = THREATS[id];
  const nodes = [n('att', 'Attacker', 70, 120, 'user', '', { w: 100 }), ...th.path.map((s, i) => n(s.id, s.label, 230 + i * 190, 120, s.defense ? 'security' : 'generic', s.defense ? (enabled[s.defense] ? 'enabled' : 'not enabled') : 'target', { w: 150 }))];
  const edges = th.path.map((s, i) => e(`e${i}`, i === 0 ? 'att' : th.path[i - 1].id, s.id));
  const steps: FlowStep[] = [];
  let outcome: 'blocked' | 'detected' | 'breach' = 'breach';
  let msg = th.impact;
  const set: Record<string, 'off'> = {};
  th.path.forEach((s) => {
    if (s.defense && !enabled[s.defense]) set[s.id] = 'off';
  });
  for (let i = 0; i < th.path.length; i++) {
    const s = th.path[i];
    if (s.defense && enabled[s.defense] && s.mode === 'block') {
      steps.push({ title: `Blocked at ${s.label}`, text: s.why, packets: [p(`e${i}`, 'red', 'attack', { dropAt: 0.85 })], focus: [s.id], set: { [s.id]: 'active' } });
      outcome = 'blocked';
      msg = s.why;
      break;
    }
    if (s.defense && enabled[s.defense] && s.mode === 'detect') {
      steps.push({ title: `Detected by ${s.label}`, text: s.why, packets: [p(`e${i}`, 'orange', 'attack')], focus: [s.id], set: { [s.id]: 'warn' } });
      outcome = 'detected';
      msg = s.why;
      break;
    }
    steps.push({ title: s.defense ? `${s.label}: not enabled` : `Reaches ${s.label}`, text: s.defense ? `This layer could have stopped it, but it is not enabled. ${i === th.path.length - 1 ? '' : 'The attack continues.'}` : s.why, packets: [p(`e${i}`, 'red', 'attack')], focus: [s.id], set: s.defense ? {} : { [s.id]: 'fail' } });
  }
  if (outcome === 'breach') steps.push({ title: 'Breach', text: th.impact, focus: [th.path[th.path.length - 1].id] });
  return { def: { id: `threat-${id}-${run}`, title: th.label, width: 820, height: 230, nodes, edges, initial: set, steps }, outcome, msg };
}

function ThreatSim() {
  const [enabled, setEnabled] = useState<Record<Defense, boolean>>({ waf: false, shieldAdv: false, bpa: false, noKeys: false, gd: false, ssm: false, secrets: false, kms: false });
  const [threat, setThreat] = useState('sqli');
  const [run, setRun] = useState(1);
  const sim = useMemo(() => threatFlow(threat, enabled, run), [threat, enabled, run]);
  return (
    <div className="grid gap-4 xl:grid-cols-[290px_1fr]">
      <div className="space-y-2">
        <div className="label">Defences</div>
        {(Object.keys(DEFENSES) as Defense[]).map((d) => (
          <Toggle key={d} checked={enabled[d]} onChange={(v) => setEnabled({ ...enabled, [d]: v })} label={<span className="text-[12px]">{DEFENSES[d]}</span>} />
        ))}
        <button className="btn btn-sm w-full" onClick={() => setEnabled(Object.fromEntries(Object.keys(DEFENSES).map((k) => [k, true])) as Record<Defense, boolean>)}>
          Enable all
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(THREATS).map(([k, v]) => (
            <button key={k} className={`btn btn-sm ${threat === k ? 'btn-active' : ''}`} onClick={() => { setThreat(k); setRun((r) => r + 1); }}>
              {v.label}
            </button>
          ))}
        </div>
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-[13px] ${sim.outcome === 'blocked' ? 'border-ok/50 bg-ok/5' : sim.outcome === 'detected' ? 'border-warn/50 bg-warn/5' : 'border-bad/50 bg-bad/5'}`}>
          {sim.outcome === 'blocked' ? <ShieldCheck className="text-ok shrink-0" size={18} /> : sim.outcome === 'detected' ? <Eye className="text-warn shrink-0" size={18} /> : <ShieldAlert className="text-bad shrink-0" size={18} />}
          <div>
            <b>{sim.outcome === 'blocked' ? 'Prevented' : sim.outcome === 'detected' ? 'Detected & contained' : 'Attack succeeded'}</b> – <span className="text-muted">{sim.msg}</span>
          </div>
        </div>
        <FlowPlayer key={sim.def.id + JSON.stringify(enabled)} def={sim.def} autoStart />
      </div>
    </div>
  );
}

export default function SecurityLab() {
  const [tab, setTab] = useState<'resp' | 'map' | 'threat'>('resp');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'resp', label: 'Shared responsibility' },
          { id: 'map', label: 'Security architecture map' },
          { id: 'threat', label: 'Threat simulator' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'resp' ? <Responsibility /> : tab === 'map' ? <SecMap /> : <ThreatSim />}
      <Callout kind="sim">Attacks here are illustrative stories that show which control helps where. They are not real attack tooling, and no traffic is generated.</Callout>
    </div>
  );
}
