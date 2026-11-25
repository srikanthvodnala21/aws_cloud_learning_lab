import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { INSTANCE_TYPES, EBS_PRICES, S3_CLASSES, SAMPLE, PURCHASE_OPTIONS, PRICING_DISCLAIMER, type S3ClassId } from '../data/pricing';
import { axisTick, chartTooltip } from '../components/chartStyles';
import { Callout, Field, PageHeader, Slider, Stat, Toggle } from '../components/ui';

const COLORS = ['#ff9900', '#4aa8ff', '#2fbf71', '#a78bfa', '#e879f9', '#2dd4bf', '#f5a524', '#f0524d'];
const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CostPage() {
  const [type, setType] = useState('t3.medium');
  const [count, setCount] = useState(2);
  const [hours, setHours] = useState(730);
  const [purchase, setPurchase] = useState<(typeof PURCHASE_OPTIONS)[number]['id']>('ondemand');
  const [ebsType, setEbsType] = useState('gp3');
  const [ebsGb, setEbsGb] = useState(30);
  const [s3Class, setS3Class] = useState<S3ClassId>('STANDARD');
  const [s3Gb, setS3Gb] = useState(500);
  const [egressGb, setEgressGb] = useState(300);
  const [natCount, setNatCount] = useState(1);
  const [natGb, setNatGb] = useState(100);
  const [alb, setAlb] = useState(true);
  const [albLcu, setAlbLcu] = useState(2);
  const [publicIps, setPublicIps] = useState(2);

  const it = INSTANCE_TYPES.find((x) => x.type === type)!;
  const po = PURCHASE_OPTIONS.find((x) => x.id === purchase)!;

  const lines = useMemo(() => {
    const ec2 = it.hourly * po.factor * hours * count;
    const ebs = EBS_PRICES[ebsType].perGb * ebsGb * count;
    const s3 = S3_CLASSES.find((c) => c.id === s3Class)!.perGb * s3Gb;
    const egress = Math.max(0, egressGb - SAMPLE.dataTransferFreeGb) * SAMPLE.dataTransferOutPerGb;
    const nat = natCount * SAMPLE.natHour * hours + natGb * SAMPLE.natPerGb;
    const lb = alb ? SAMPLE.albHour * hours + SAMPLE.albLcuHour * albLcu * hours : 0;
    const ips = publicIps * SAMPLE.publicIpv4Hour * hours;
    return [
      { name: 'EC2 compute', value: ec2, how: `${count} × ${type} × ${hours} h × $${it.hourly}/h${po.factor !== 1 ? ` × ${po.factor} (${po.label})` : ''}` },
      { name: 'EBS volumes', value: ebs, how: `${count} × ${ebsGb} GB × $${EBS_PRICES[ebsType].perGb}/GB-month (${ebsType})` },
      { name: 'S3 storage', value: s3, how: `${s3Gb} GB × $${S3_CLASSES.find((c) => c.id === s3Class)!.perGb}/GB-month (requests/retrieval not included)` },
      { name: 'Data transfer out', value: egress, how: `(${egressGb} GB − ${SAMPLE.dataTransferFreeGb} GB free) × $${SAMPLE.dataTransferOutPerGb}/GB to the internet` },
      { name: 'NAT Gateway', value: nat, how: `${natCount} × ${hours} h × $${SAMPLE.natHour}/h + ${natGb} GB processed × $${SAMPLE.natPerGb}/GB` },
      { name: 'Load balancer', value: lb, how: alb ? `${hours} h × $${SAMPLE.albHour}/h + ${albLcu} LCU × ${hours} h × $${SAMPLE.albLcuHour}` : 'none' },
      { name: 'Public IPv4', value: ips, how: `${publicIps} addresses × ${hours} h × $${SAMPLE.publicIpv4Hour}/h (charged since Feb 2024, in use or idle)` },
    ];
  }, [it, po, hours, count, ebsType, ebsGb, s3Class, s3Gb, egressGb, natCount, natGb, alb, albLcu, publicIps, type]);

  const total = lines.reduce((s, l) => s + l.value, 0);
  const compare = PURCHASE_OPTIONS.map((o) => ({ name: o.label.replace(' (', '\n('), short: o.id, value: Math.round(it.hourly * o.factor * hours * count * 100) / 100 }));
  const hidden = lines.filter((l) => ['NAT Gateway', 'Public IPv4', 'Data transfer out'].includes(l.name)).reduce((s, l) => s + l.value, 0);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Cost Explorer (sample pricing)" title="What would this architecture cost?" desc="Change resources and watch the estimated monthly bill. Learn which line items dominate and which hidden costs surprise people." />
      <Callout kind="warn" title="Sample prices – not a quote">
        {PRICING_DISCLAIMER} Prices vary by Region, OS, tier and over time. Taxes, support plans, free tier and request charges are not included.{' '}
        <a className="inline-flex items-center gap-1 text-accent underline" href="https://calculator.aws/" target="_blank" rel="noreferrer">
          Open the official AWS Pricing Calculator <ExternalLink size={12} />
        </a>
      </Callout>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="card p-4 space-y-4">
          <div className="text-[13px] font-semibold">Compute</div>
          <Field label="Instance type">
            <select className="select w-full" value={type} onChange={(e) => setType(e.target.value)}>
              {INSTANCE_TYPES.map((x) => (
                <option key={x.type} value={x.type}>
                  {x.type} – {x.vcpu} vCPU / {x.memGiB} GiB – ${x.hourly}/h
                </option>
              ))}
            </select>
          </Field>
          <Slider label="Instances" value={count} min={0} max={20} onChange={setCount} />
          <Slider label="Hours per month" value={hours} min={0} max={730} step={10} onChange={setHours} format={(v) => `${v} h${v === 730 ? ' (24/7)' : ''}`} />
          <Field label="Purchase option">
            <select className="select w-full" value={purchase} onChange={(e) => setPurchase(e.target.value as typeof purchase)}>
              {PURCHASE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="-mt-2 text-[11.5px] text-faint">{po.note}</p>
          <div className="text-[13px] font-semibold pt-1">Storage</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EBS type">
              <select className="select w-full" value={ebsType} onChange={(e) => setEbsType(e.target.value)}>
                {Object.entries(EBS_PRICES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Slider label="EBS per instance" value={ebsGb} min={8} max={1000} step={2} onChange={setEbsGb} format={(v) => `${v} GB`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="S3 class">
              <select className="select w-full" value={s3Class} onChange={(e) => setS3Class(e.target.value as S3ClassId)}>
                {S3_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Slider label="S3 data" value={s3Gb} min={0} max={20000} step={50} onChange={setS3Gb} format={(v) => `${v.toLocaleString()} GB`} />
          </div>
          <div className="text-[13px] font-semibold pt-1">Networking</div>
          <Slider label="Data transfer out to internet" value={egressGb} min={0} max={10000} step={50} onChange={setEgressGb} format={(v) => `${v.toLocaleString()} GB`} />
          <div className="grid grid-cols-2 gap-3">
            <Slider label="NAT Gateways" value={natCount} min={0} max={3} onChange={setNatCount} />
            <Slider label="NAT data processed" value={natGb} min={0} max={5000} step={50} onChange={setNatGb} format={(v) => `${v} GB`} />
          </div>
          <Toggle checked={alb} onChange={setAlb} label="Application Load Balancer" />
          {alb && <Slider label="Average LCUs" value={albLcu} min={1} max={20} onChange={setAlbLcu} />}
          <Slider label="Public IPv4 addresses" value={publicIps} min={0} max={20} onChange={setPublicIps} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Estimated monthly total" value={money(total)} hint="sample prices" tone="var(--color-accent)" />
            <Stat label="Per year" value={money(total * 12)} />
            <Stat label="“Hidden” networking costs" value={money(hidden)} hint={`${total ? Math.round((hidden / total) * 100) : 0}% of total`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-3">
              <div className="text-[13px] font-semibold mb-1">Breakdown</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lines.filter((l) => l.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} isAnimationActive={false}>
                      {lines.filter((l) => l.value > 0).map((l) => (
                        <Cell key={l.name} fill={COLORS[lines.indexOf(l) % COLORS.length]} stroke="var(--color-panel)" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={chartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {lines.map((l, i) => (
                  <span key={l.name} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="card p-3">
              <div className="text-[13px] font-semibold mb-1">EC2 compute by purchase option</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compare} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                    <XAxis type="number" tick={axisTick} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="short" tick={axisTick} width={70} />
                    <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => PURCHASE_OPTIONS.find((o) => o.id === l)?.label ?? String(l)} contentStyle={chartTooltip} />
                    <Bar dataKey="value" isAnimationActive={false}>
                      {compare.map((c) => (
                        <Cell key={c.short} fill={c.short === purchase ? '#ff9900' : '#4aa8ff'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Line item</th>
                  <th>How it’s calculated (sample rates)</th>
                  <th className="text-right">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.name}>
                    <td className="font-medium">{l.name}</td>
                    <td className="mono text-[11.5px] text-muted">{l.how}</td>
                    <td className="mono text-right">{money(l.value)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold">Total</td>
                  <td />
                  <td className="mono text-right font-semibold text-accent">{money(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Callout kind="tip" title="Cost levers">
              Right-size instances (CloudWatch and Compute Optimizer), use Savings Plans for steady load and Spot for interruptible work, and stop dev environments at night (try 200 h/month). Use S3 lifecycle rules, and use VPC gateway endpoints for S3/DynamoDB instead of sending that traffic through NAT.
            </Callout>
            <Callout kind="info" title="Pricing assumptions">
              Approximate us-east-1 Linux On-Demand rates. 730 hours = one month. Data transfer uses the first tier after a 100 GB monthly free allowance. Purchase-option factors are illustrative averages; real discounts depend on the term, payment option, family and Region. Inter-AZ traffic, requests, CloudWatch, backups and support plans are excluded.
            </Callout>
          </div>
        </div>
      </div>
    </div>
  );
}
