/**
 * SAMPLE PRICING – for learning only.
 * Values approximate public On-Demand Linux prices in us-east-1 at some point in time and
 * WILL drift. They are NOT current AWS prices. Always check https://calculator.aws/ .
 */
export const PRICING_DISCLAIMER =
  'Sample prices for illustration only (approximate us-east-1 list prices at a point in time). They are not guaranteed to be current AWS prices – use the official AWS Pricing Calculator for real estimates.';

export interface InstanceType {
  type: string;
  family: string;
  vcpu: number;
  memGiB: number;
  note: string;
  hourly: number; // sample On-Demand $/hour, Linux
}

export const INSTANCE_TYPES: InstanceType[] = [
  { type: 't3.micro', family: 'General purpose (burstable)', vcpu: 2, memGiB: 1, note: 'Free Tier eligible in many accounts; dev/test', hourly: 0.0104 },
  { type: 't3.small', family: 'General purpose (burstable)', vcpu: 2, memGiB: 2, note: 'Small web apps', hourly: 0.0208 },
  { type: 't3.medium', family: 'General purpose (burstable)', vcpu: 2, memGiB: 4, note: 'Low-traffic apps, CI runners', hourly: 0.0416 },
  { type: 't3.large', family: 'General purpose (burstable)', vcpu: 2, memGiB: 8, note: 'Spiky workloads', hourly: 0.0832 },
  { type: 'm7i.large', family: 'General purpose', vcpu: 2, memGiB: 8, note: 'Balanced web/app servers (Intel)', hourly: 0.1008 },
  { type: 'm7i.xlarge', family: 'General purpose', vcpu: 4, memGiB: 16, note: 'Application servers', hourly: 0.2016 },
  { type: 'm7g.large', family: 'General purpose (Graviton)', vcpu: 2, memGiB: 8, note: 'Arm-based, better price-performance', hourly: 0.0816 },
  { type: 'c7i.large', family: 'Compute optimized', vcpu: 2, memGiB: 4, note: 'Batch, gaming, encoding', hourly: 0.0893 },
  { type: 'c7i.xlarge', family: 'Compute optimized', vcpu: 4, memGiB: 8, note: 'High-performance web, HPC', hourly: 0.1785 },
  { type: 'r7i.large', family: 'Memory optimized', vcpu: 2, memGiB: 16, note: 'In-memory caches, databases', hourly: 0.1323 },
  { type: 'r7i.xlarge', family: 'Memory optimized', vcpu: 4, memGiB: 32, note: 'Real-time analytics', hourly: 0.2646 },
  { type: 'i4i.large', family: 'Storage optimized', vcpu: 2, memGiB: 16, note: '468 GB local NVMe SSD (instance store)', hourly: 0.172 },
  { type: 'g5.xlarge', family: 'Accelerated computing', vcpu: 4, memGiB: 16, note: '1 × NVIDIA A10G GPU – ML inference, graphics', hourly: 1.006 },
];

export const EBS_PRICES: Record<string, { label: string; perGb: number; note: string }> = {
  gp3: { label: 'gp3 – General Purpose SSD', perGb: 0.08, note: '3,000 IOPS / 125 MB/s baseline included' },
  io2: { label: 'io2 – Provisioned IOPS SSD', perGb: 0.125, note: 'plus per provisioned IOPS (not modelled)' },
  st1: { label: 'st1 – Throughput Optimized HDD', perGb: 0.045, note: 'big sequential workloads' },
  sc1: { label: 'sc1 – Cold HDD', perGb: 0.015, note: 'infrequently accessed data' },
};

export const S3_CLASSES = [
  { id: 'STANDARD', label: 'S3 Standard', perGb: 0.023, retrieval: 'None', latency: 'milliseconds', minDays: 0, azs: '≥ 3', use: 'Frequently accessed data' },
  { id: 'INTELLIGENT_TIERING', label: 'S3 Intelligent-Tiering', perGb: 0.023, retrieval: 'None (small monitoring fee per object)', latency: 'milliseconds (archive tiers optional)', minDays: 0, azs: '≥ 3', use: 'Unknown or changing access patterns' },
  { id: 'STANDARD_IA', label: 'S3 Standard-IA', perGb: 0.0125, retrieval: 'Per GB retrieved', latency: 'milliseconds', minDays: 30, azs: '≥ 3', use: 'Infrequent access, needs fast retrieval' },
  { id: 'ONEZONE_IA', label: 'S3 One Zone-IA', perGb: 0.01, retrieval: 'Per GB retrieved', latency: 'milliseconds', minDays: 30, azs: '1', use: 'Re-creatable infrequent data' },
  { id: 'GLACIER_IR', label: 'S3 Glacier Instant Retrieval', perGb: 0.004, retrieval: 'Per GB (higher)', latency: 'milliseconds', minDays: 90, azs: '≥ 3', use: 'Archive accessed ~once a quarter' },
  { id: 'GLACIER', label: 'S3 Glacier Flexible Retrieval', perGb: 0.0036, retrieval: 'Restore required: expedited 1–5 min, standard 3–5 h, bulk 5–12 h', latency: 'minutes to hours', minDays: 90, azs: '≥ 3', use: 'Backups, archives read 1–2×/year' },
  { id: 'DEEP_ARCHIVE', label: 'S3 Glacier Deep Archive', perGb: 0.00099, retrieval: 'Restore required: standard within 12 h, bulk within 48 h', latency: 'hours', minDays: 180, azs: '≥ 3', use: 'Long-term retention, compliance' },
] as const;

export type S3ClassId = (typeof S3_CLASSES)[number]['id'];

export const SAMPLE = {
  dataTransferOutPerGb: 0.09, // first 10 TB/month tier, internet egress
  dataTransferFreeGb: 100, // monthly free egress aggregated across services
  natHour: 0.045,
  natPerGb: 0.045,
  albHour: 0.0225,
  albLcuHour: 0.008,
  publicIpv4Hour: 0.005,
  lambdaPerMillion: 0.2,
  lambdaGbSecond: 0.0000166667,
};

export const PURCHASE_OPTIONS = [
  { id: 'ondemand', label: 'On-Demand', factor: 1, note: 'No commitment, pay per second. Most flexible.' },
  { id: 'sp1', label: 'Compute Savings Plan (1 yr, no upfront)', factor: 0.72, note: 'Commit to $/hour of compute for 1 year; applies across instance families, Regions, Fargate and Lambda. Sample ~28% discount.' },
  { id: 'sp3', label: 'Compute Savings Plan (3 yr, no upfront)', factor: 0.5, note: 'Longer commitment, larger discount. Sample ~50%.' },
  { id: 'ri3', label: 'Standard Reserved Instance (3 yr, all upfront)', factor: 0.4, note: 'Commit to a specific instance family/Region. Up to ~72% off per AWS; sample ~60%.' },
  { id: 'spot', label: 'Spot Instance', factor: 0.3, note: 'Spare capacity, up to 90% off, can be interrupted with a 2-minute notice. Price varies. Sample ~70% off.' },
] as const;
