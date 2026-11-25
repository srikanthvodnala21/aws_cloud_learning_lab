/** Component catalog for the Architecture Playground (explanations are simplified for learning). */

export type Scope = 'global' | 'regional' | 'zonal' | 'external';

export interface ConfigField {
  key: string;
  label: string;
  options: string[];
  default: string;
}

export interface Component {
  id: string;
  label: string;
  icon: string;
  kind: string; // colour group (KIND_COLOR)
  category: 'Edge & entry' | 'Networking' | 'Compute' | 'Data' | 'Integration' | 'Security & ops' | 'Clients';
  scope: Scope;
  /** managed services that AWS runs redundantly across AZs */
  managedHA?: boolean;
  desc: string;
  config: ConfigField[];
}

const azs: ConfigField = { key: 'azs', label: 'Availability Zones', options: ['1', '2', '3'], default: '2' };

export const CATALOG: Component[] = [
  { id: 'users', label: 'Users', icon: 'users', kind: 'user', category: 'Clients', scope: 'external', desc: 'Browsers and mobile apps on the internet. This is where simulated traffic starts.', config: [{ key: 'rps', label: 'Traffic', options: ['low', 'medium', 'high'], default: 'medium' }] },
  { id: 'onprem', label: 'On-prem DC', icon: 'building', kind: 'onprem', category: 'Clients', scope: 'external', desc: 'Your own data centre, connected with VPN or Direct Connect.', config: [] },
  { id: 'route53', label: 'Route 53', icon: 'globe', kind: 'dns', category: 'Edge & entry', scope: 'global', managedHA: true, desc: 'Highly available DNS. Routing policies (latency, weighted, failover) with health checks. 100% availability SLA.', config: [{ key: 'policy', label: 'Routing policy', options: ['simple', 'latency', 'weighted', 'failover'], default: 'simple' }] },
  { id: 'cloudfront', label: 'CloudFront', icon: 'zap', kind: 'edge', category: 'Edge & entry', scope: 'global', managedHA: true, desc: 'CDN with hundreds of edge locations. Caches content close to users, terminates TLS and protects origins.', config: [{ key: 'ttl', label: 'Default cache TTL', options: ['0s', '60s', '1h', '1d'], default: '1h' }] },
  { id: 'waf', label: 'AWS WAF', icon: 'filter', kind: 'security', category: 'Edge & entry', scope: 'global', managedHA: true, desc: 'Web application firewall on CloudFront, ALB or API Gateway. Blocks SQL injection, XSS, bad bots and floods (rate rules).', config: [{ key: 'rules', label: 'Rule set', options: ['Core rule set', 'Core + SQLi', 'Core + SQLi + rate limit'], default: 'Core + SQLi' }] },
  { id: 'apigw', label: 'API Gateway', icon: 'workflow', kind: 'integration', category: 'Edge & entry', scope: 'regional', managedHA: true, desc: 'Managed API front door: auth, throttling, request validation, usage plans. Commonly invokes Lambda.', config: [{ key: 'type', label: 'API type', options: ['HTTP API', 'REST API', 'WebSocket'], default: 'HTTP API' }] },
  { id: 'igw', label: 'Internet Gateway', icon: 'globe', kind: 'network', category: 'Networking', scope: 'regional', managedHA: true, desc: 'Connects a VPC to the internet. Horizontally scaled and redundant, so it is not a bottleneck.', config: [] },
  { id: 'alb', label: 'Application LB', icon: 'scale', kind: 'network', category: 'Networking', scope: 'regional', managedHA: true, desc: 'Layer-7 load balancer spanning multiple AZs. Path/host routing, health checks and TLS termination.', config: [azs, { key: 'scheme', label: 'Scheme', options: ['internet-facing', 'internal'], default: 'internet-facing' }] },
  { id: 'nlb', label: 'Network LB', icon: 'scale', kind: 'network', category: 'Networking', scope: 'regional', managedHA: true, desc: 'Layer-4 TCP/UDP load balancer. Ultra-low latency, static IP per AZ, millions of requests per second.', config: [azs] },
  { id: 'nat', label: 'NAT Gateway', icon: 'network', kind: 'network', category: 'Networking', scope: 'zonal', desc: 'Lets private subnets reach the internet outbound. It is a ZONAL resource, so use one per AZ for resilience.', config: [{ key: 'count', label: 'NAT gateways', options: ['1 (single AZ)', '1 per AZ'], default: '1 (single AZ)' }] },
  { id: 'vpce', label: 'VPC Endpoint', icon: 'split', kind: 'network', category: 'Networking', scope: 'regional', managedHA: true, desc: 'Private access to AWS services (S3, DynamoDB via gateway endpoints; others via PrivateLink) without NAT or the internet.', config: [{ key: 'type', label: 'Type', options: ['Gateway', 'Interface'], default: 'Gateway' }] },
  { id: 'ec2', label: 'EC2 instance', icon: 'server', kind: 'compute', category: 'Compute', scope: 'zonal', desc: 'A single virtual server in ONE AZ. On its own, it is a single point of failure.', config: [{ key: 'type', label: 'Instance type', options: ['t3.micro', 't3.medium', 'm7g.large', 'c7g.xlarge'], default: 't3.medium' }] },
  { id: 'asg', label: 'Auto Scaling group', icon: 'layers', kind: 'compute', category: 'Compute', scope: 'regional', desc: 'A fleet of EC2 instances across AZs. Replaces unhealthy instances and scales with demand.', config: [azs, { key: 'size', label: 'min / desired / max', options: ['1/1/1', '2/2/4', '2/4/10'], default: '2/2/4' }] },
  { id: 'lambda', label: 'Lambda', icon: 'zap', kind: 'compute', category: 'Compute', scope: 'regional', managedHA: true, desc: 'Serverless functions. Runs across multiple AZs automatically and scales per request.', config: [{ key: 'memory', label: 'Memory', options: ['128 MB', '512 MB', '1024 MB', '3008 MB'], default: '512 MB' }] },
  { id: 'fargate', label: 'ECS on Fargate', icon: 'container', kind: 'container', category: 'Compute', scope: 'regional', desc: 'Serverless containers. Run the service tasks spread over several AZs.', config: [azs, { key: 'tasks', label: 'Tasks', options: ['1', '2', '4', '8'], default: '2' }] },
  { id: 'eks', label: 'EKS cluster', icon: 'boxes', kind: 'container', category: 'Compute', scope: 'regional', desc: 'Managed Kubernetes. AWS runs the HA control plane; worker nodes and pods spread across your AZs.', config: [azs] },
  { id: 'rds', label: 'RDS database', icon: 'database', kind: 'database', category: 'Data', scope: 'zonal', desc: 'Managed relational DB. Single-AZ is a SPOF; Multi-AZ adds a synchronous standby with automatic failover.', config: [{ key: 'multiaz', label: 'Deployment', options: ['Single-AZ', 'Multi-AZ'], default: 'Single-AZ' }, { key: 'engine', label: 'Engine', options: ['PostgreSQL', 'MySQL', 'Aurora PostgreSQL'], default: 'PostgreSQL' }] },
  { id: 'dynamodb', label: 'DynamoDB', icon: 'database', kind: 'database', category: 'Data', scope: 'regional', managedHA: true, desc: 'Serverless key-value/NoSQL. Data replicated across 3 AZs automatically; Global Tables for multi-Region.', config: [{ key: 'mode', label: 'Capacity mode', options: ['On-demand', 'Provisioned'], default: 'On-demand' }] },
  { id: 'cache', label: 'ElastiCache', icon: 'cpu', kind: 'database', category: 'Data', scope: 'zonal', desc: 'In-memory cache (Valkey/Redis OSS/Memcached). Use replicas across AZs; a single node is a SPOF.', config: [{ key: 'replicas', label: 'Replicas', options: ['0 (single node)', '1+ in another AZ'], default: '0 (single node)' }] },
  { id: 's3', label: 'S3 bucket', icon: 'box', kind: 'storage', category: 'Data', scope: 'regional', managedHA: true, desc: 'Object storage. 11 nines durability, data stored across ≥3 AZs. Great as a static-site origin behind CloudFront.', config: [{ key: 'class', label: 'Storage class', options: ['Standard', 'Intelligent-Tiering', 'Standard-IA'], default: 'Standard' }] },
  { id: 'sqs', label: 'SQS queue', icon: 'list', kind: 'integration', category: 'Integration', scope: 'regional', managedHA: true, desc: 'Durable message queue that decouples producers and consumers and absorbs spikes.', config: [{ key: 'type', label: 'Type', options: ['Standard', 'FIFO'], default: 'Standard' }] },
  { id: 'sns', label: 'SNS topic', icon: 'bell', kind: 'integration', category: 'Integration', scope: 'regional', managedHA: true, desc: 'Pub/sub fan-out to many subscribers (SQS, Lambda, HTTPS, e-mail).', config: [] },
  { id: 'eventbridge', label: 'EventBridge', icon: 'workflow', kind: 'integration', category: 'Integration', scope: 'regional', managedHA: true, desc: 'Event bus with pattern-matching rules to route events to targets.', config: [] },
  { id: 'cognito', label: 'Cognito', icon: 'user', kind: 'security', category: 'Security & ops', scope: 'regional', managedHA: true, desc: 'User sign-up/sign-in and tokens for your app’s end users (user pools), federated identities.', config: [] },
  { id: 'kms', label: 'KMS', icon: 'key', kind: 'security', category: 'Security & ops', scope: 'regional', managedHA: true, desc: 'Managed encryption keys used by S3, EBS, RDS, DynamoDB, etc.', config: [] },
  { id: 'secrets', label: 'Secrets Manager', icon: 'lock', kind: 'security', category: 'Security & ops', scope: 'regional', managedHA: true, desc: 'Stores and rotates DB passwords and API keys.', config: [] },
  { id: 'cloudwatch', label: 'CloudWatch', icon: 'activity', kind: 'monitoring', category: 'Security & ops', scope: 'regional', managedHA: true, desc: 'Metrics, logs and alarms for everything in the diagram.', config: [] },
];

export const CATALOG_MAP: Record<string, Component> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

/** Is this node (with its config) a single-AZ resource? */
export function singleAz(compId: string, cfg: Record<string, string>): string | null {
  if (compId === 'ec2') return 'A single EC2 instance lives in one AZ. Put it in an Auto Scaling group across ≥2 AZs.';
  if (compId === 'rds' && cfg.multiaz !== 'Multi-AZ') return 'Single-AZ RDS: an AZ or instance failure means downtime. Enable Multi-AZ.';
  if (compId === 'nat' && cfg.count !== '1 per AZ') return 'One NAT Gateway serves all AZs – if its AZ fails, private subnets elsewhere lose internet access.';
  if (compId === 'cache' && cfg.replicas?.startsWith('0')) return 'Single cache node: losing it causes a cache-miss storm against the database.';
  if (['asg', 'alb', 'nlb', 'fargate', 'eks'].includes(compId) && cfg.azs === '1') return 'Configured for only one AZ.';
  if (compId === 'fargate' && cfg.tasks === '1') return 'Only one task running.';
  if (compId === 'asg' && cfg.size === '1/1/1') return 'Fleet of exactly one instance.';
  return null;
}
