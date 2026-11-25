import type { FlowDef } from '../animation/flowTypes';
import { e, g, n, p, r } from '../animation/builders';

export interface Comparison {
  id: string;
  title: string;
  items: { name: string; icon: string; tagline: string; bestFor: string[] }[];
  rows: { aspect: string; values: string[] }[];
  verdict: string;
  diagram: FlowDef;
  module: string;
}

export const COMPARISONS: Comparison[] = [
  {
    id: 's3-ebs-efs',
    title: 'S3 vs EBS vs EFS',
    module: 's3',
    items: [
      { name: 'Amazon S3', icon: 'folder', tagline: 'Object storage over HTTPS', bestFor: ['Backups, media, data lakes', 'Static websites', 'Unlimited scale'] },
      { name: 'Amazon EBS', icon: 'disk', tagline: 'Block disk for one instance', bestFor: ['Boot volumes', 'Databases on EC2', 'Low-latency block I/O'] },
      { name: 'Amazon EFS', icon: 'layers', tagline: 'Shared NFS file system', bestFor: ['Shared content across instances', 'Lift-and-shift apps needing POSIX files', 'Containers needing shared storage'] },
    ],
    rows: [
      { aspect: 'Storage type', values: ['Object (key → bytes + metadata)', 'Block (raw disk)', 'File (NFS v4)'] },
      { aspect: 'Access', values: ['HTTPS API from anywhere', 'Attached to EC2 in same AZ', 'Mounted by many clients across AZs'] },
      { aspect: 'Scope', values: ['Regional', 'Zonal', 'Regional (or One Zone)'] },
      { aspect: 'Capacity', values: ['Virtually unlimited, no provisioning', 'Provisioned size (up to 64 TiB per volume)', 'Elastic, grows and shrinks automatically'] },
      { aspect: 'Pricing', values: ['Per GB-month + requests + transfer', 'Per provisioned GB-month (+ IOPS/throughput for gp3/io2)', 'Per GB-month used (higher than S3)'] },
      { aspect: 'Concurrency', values: ['Any number of clients', 'Usually one instance (Multi-Attach for io1/io2)', 'Thousands of concurrent clients'] },
    ],
    verdict: 'Use EBS as an instance’s disk, EFS when several servers need the same files, and S3 for everything accessed as whole objects over an API.',
    diagram: {
      id: 'cmp-storage',
      title: 'How each is accessed',
      width: 820,
      height: 300,
      groups: [g('az', 'AZ a', 20, 20, 250, 260, 'az')],
      nodes: [n('i1', 'EC2', 145, 80, 'compute'), n('ebs', 'EBS volume', 145, 210, 'storage', 'block device'), n('i2', 'EC2 (AZ a)', 360, 70, 'compute'), n('i3', 'EC2 (AZ b)', 360, 230, 'compute'), n('efs', 'EFS', 520, 150, 'storage', 'NFS mount'), n('s3', 'S3', 720, 150, 'storage', 'HTTPS API'), n('any', 'Any client', 720, 50, 'user', 'internet / VPC')],
      edges: [e('a', 'i1', 'ebs', { label: 'attached' }), e('b', 'i2', 'efs'), e('c', 'i3', 'efs'), e('d', 'i2', 's3', { dashed: true, curve: -40 }), e('f', 'any', 's3')],
      steps: [{ title: 'Access patterns', text: 'EBS attaches to one instance in its AZ; EFS is mounted by many instances across AZs; S3 is reached over HTTPS by anything with permission.', packets: [p('a', 'blue'), p('b', 'purple'), p('c', 'purple', undefined, { at: 0.1 }), p('f', 'green'), p('d', 'green', undefined, { at: 0.2 })] }],
    },
  },
  {
    id: 'ecs-eks',
    title: 'ECS vs EKS',
    module: 'containers',
    items: [
      { name: 'Amazon ECS', icon: 'container', tagline: 'AWS-native orchestration', bestFor: ['Teams new to containers', 'Deep AWS integration', 'Minimal operational overhead'] },
      { name: 'Amazon EKS', icon: 'boxes', tagline: 'Managed Kubernetes', bestFor: ['Kubernetes skills/tooling', 'Portability across clouds/on-prem', 'Helm, operators, CNCF ecosystem'] },
    ],
    rows: [
      { aspect: 'API / concepts', values: ['Task definitions, services, clusters', 'Kubernetes: pods, deployments, services'] },
      { aspect: 'Control plane cost', values: ['No charge for the control plane', 'Hourly charge per cluster'] },
      { aspect: 'Compute', values: ['Fargate, EC2, ECS Anywhere', 'Fargate, managed node groups, Auto Mode, self-managed, EKS Anywhere/Hybrid Nodes'] },
      { aspect: 'Learning curve', values: ['Lower', 'Higher'] },
      { aspect: 'Ecosystem', values: ['AWS tools (Copilot, CDK)', 'Huge open-source ecosystem'] },
    ],
    verdict: 'Default to ECS (often with Fargate) for simplicity; choose EKS when you need Kubernetes itself.',
    diagram: {
      id: 'cmp-ecs-eks',
      title: 'Who you talk to',
      width: 820,
      height: 260,
      nodes: [n('dev1', 'You', 80, 70, 'user', 'aws ecs …'), n('ecs', 'ECS scheduler', 300, 70, 'container', 'AWS API'), n('t', 'Tasks', 540, 70, 'container', 'Fargate / EC2'), n('dev2', 'You', 80, 190, 'user', 'kubectl'), n('k8s', 'EKS API server', 300, 190, 'container', 'Kubernetes API', { w: 130 }), n('pods', 'Pods', 540, 190, 'container', 'nodes / Fargate')],
      edges: [e('a', 'dev1', 'ecs'), e('b', 'ecs', 't'), e('c', 'dev2', 'k8s'), e('d', 'k8s', 'pods')],
      steps: [{ title: 'Two control planes', text: 'ECS uses AWS APIs and concepts; EKS exposes the standard Kubernetes API.', packets: [p('a', 'orange'), p('b', 'orange', undefined, { at: 0.4 }), p('c', 'blue'), p('d', 'blue', undefined, { at: 0.4 })] }],
    },
  },
  {
    id: 'ec2-lambda',
    title: 'EC2 vs Lambda',
    module: 'serverless',
    items: [
      { name: 'Amazon EC2', icon: 'server', tagline: 'Virtual servers you control', bestFor: ['Long-running processes', 'Custom OS / software', 'Steady high utilisation'] },
      { name: 'AWS Lambda', icon: 'zap', tagline: 'Functions on events', bestFor: ['Spiky or unpredictable traffic', 'Event processing / glue code', 'No server management'] },
    ],
    rows: [
      { aspect: 'Management', values: ['You patch OS, scale, monitor', 'AWS manages everything below your code'] },
      { aspect: 'Billing', values: ['Per second while running (even idle)', 'Per request + GB-second of execution'] },
      { aspect: 'Max run time', values: ['Unlimited', '15 minutes'] },
      { aspect: 'Scaling', values: ['Auto Scaling groups (minutes)', 'Automatic per request (cold starts)'] },
      { aspect: 'State', values: ['Can keep local state/disk', 'Stateless; /tmp is ephemeral'] },
    ],
    verdict: 'Lambda for event-driven and spiky workloads; EC2 (or containers) for long-running, steady or highly customised workloads.',
    diagram: {
      id: 'cmp-ec2-lambda',
      title: 'Idle time',
      width: 820,
      height: 240,
      nodes: [n('r1', 'Requests', 80, 70, 'user'), n('ec2', 'EC2 (always on)', 330, 70, 'compute', 'billed 24/7', { w: 130 }), n('r2', 'Requests', 80, 180, 'user'), n('lam', 'Lambda', 330, 180, 'compute', 'billed per ms', { icon: 'zap' })],
      edges: [e('a', 'r1', 'ec2'), e('b', 'r2', 'lam')],
      steps: [{ title: 'Pay for idle vs pay per use', text: 'EC2 costs money while waiting for requests; Lambda costs nothing between invocations.', packets: [p('a', 'blue'), p('b', 'blue', undefined, { at: 0.2 })], badges: { ec2: '$ idle', lam: '$0 idle' } }],
    },
  },
  {
    id: 'alb-nlb',
    title: 'ALB vs NLB',
    module: 'load-balancing',
    items: [
      { name: 'Application LB', icon: 'split', tagline: 'Layer 7 HTTP(S)', bestFor: ['Web apps & microservices', 'Path/host routing', 'Auth, redirects, WAF'] },
      { name: 'Network LB', icon: 'network', tagline: 'Layer 4 TCP/UDP/TLS', bestFor: ['Extreme performance', 'Static IPs / Elastic IPs', 'Non-HTTP protocols, PrivateLink'] },
    ],
    rows: [
      { aspect: 'OSI layer', values: ['7 (HTTP, HTTPS, gRPC, WebSocket)', '4 (TCP, UDP, TLS)'] },
      { aspect: 'Routing', values: ['Host, path, header, query, method', 'Port-based to target groups'] },
      { aspect: 'Static IP', values: ['No (DNS name only)', 'Yes, one per AZ; Elastic IPs supported'] },
      { aspect: 'Client IP', values: ['Via X-Forwarded-For header', 'Preserved (for instance/IP targets)'] },
      { aspect: 'WAF', values: ['Supported', 'Not supported directly'] },
      { aspect: 'Targets', values: ['Instances, IPs, Lambda', 'Instances, IPs, ALB'] },
    ],
    verdict: 'ALB for HTTP applications; NLB for raw TCP/UDP, static IPs, PrivateLink services or millions of requests per second.',
    diagram: {
      id: 'cmp-alb-nlb',
      title: 'What each looks at',
      width: 820,
      height: 240,
      nodes: [n('c1', 'Client', 80, 70, 'user', 'GET /api/users'), n('alb', 'ALB', 320, 70, 'network', 'reads HTTP'), n('t1', 'api-tg', 560, 70, 'compute', 'path /api/*'), n('c2', 'Client', 80, 180, 'user', 'TCP :5432'), n('nlb', 'NLB', 320, 180, 'network', 'reads TCP port'), n('t2', 'db-proxy-tg', 560, 180, 'compute', 'port 5432', { w: 120 })],
      edges: [e('a', 'c1', 'alb'), e('b', 'alb', 't1'), e('c', 'c2', 'nlb'), e('d', 'nlb', 't2')],
      steps: [{ title: 'L7 vs L4', text: 'ALB inspects HTTP content to choose a target; NLB forwards connections by protocol and port with minimal latency.', packets: [p('a', 'blue', 'HTTP'), p('b', 'blue', undefined, { at: 0.4 }), p('c', 'purple', 'TCP'), p('d', 'purple', undefined, { at: 0.4 })] }],
    },
  },
  {
    id: 'sqs-sns-eventbridge',
    title: 'SQS vs SNS vs EventBridge',
    module: 'messaging',
    items: [
      { name: 'Amazon SQS', icon: 'mail', tagline: 'Queue (pull)', bestFor: ['Work queues', 'Buffering spikes', 'Decoupling producer/consumer speed'] },
      { name: 'Amazon SNS', icon: 'tower', tagline: 'Pub/sub (push)', bestFor: ['Fan-out to many subscribers', 'Notifications (email/SMS)', 'SNS → SQS fan-out'] },
      { name: 'Amazon EventBridge', icon: 'workflow', tagline: 'Event bus with rules', bestFor: ['Content-based routing', 'AWS service and SaaS events', 'Schedules & cross-account buses'] },
    ],
    rows: [
      { aspect: 'Delivery model', values: ['Consumers poll', 'Push to subscribers', 'Push to rule targets'] },
      { aspect: 'Consumers per message', values: ['One (per message)', 'All subscribers', 'All matching rule targets'] },
      { aspect: 'Persistence', values: ['Up to 14 days', 'No storage (retries only)', 'No storage (archive & replay optional)'] },
      { aspect: 'Filtering', values: ['None (consumer decides)', 'Subscription filter policies', 'Rich event patterns'] },
      { aspect: 'Ordering', values: ['FIFO queues', 'FIFO topics', 'Not guaranteed'] },
    ],
    verdict: 'Queue work with SQS, broadcast with SNS, route events by content with EventBridge – they are often combined.',
    diagram: {
      id: 'cmp-msg',
      title: 'One message, different fates',
      width: 820,
      height: 300,
      nodes: [n('p1', 'Producer', 80, 50, 'compute'), n('q', 'SQS', 300, 50, 'integration'), n('c1', 'Worker', 520, 50, 'compute', 'pulls'), n('p2', 'Producer', 80, 150, 'compute'), n('t', 'SNS', 300, 150, 'integration'), n('s1', 'Sub A', 520, 120, 'compute', '', { h: 40 }), n('s2', 'Sub B', 660, 170, 'compute', '', { h: 40 }), n('p3', 'Producer', 80, 255, 'compute'), n('b', 'EventBridge', 300, 255, 'integration', 'rules'), n('x', 'Matching target', 560, 255, 'compute', '', { w: 140 })],
      edges: [e('a', 'p1', 'q'), e('bq', 'c1', 'q', { label: 'poll' }), e('c', 'p2', 't'), e('d', 't', 's1'), e('f', 't', 's2'), e('h', 'p3', 'b'), e('i', 'b', 'x', { label: 'pattern match' })],
      steps: [{ title: 'Queue, fan-out, route', text: 'SQS holds the message until one worker pulls it; SNS pushes copies to all subscribers; EventBridge sends it only to targets whose rule pattern matches.', packets: [p('a', 'blue'), r('bq', 'blue', undefined, { at: 0.4 }), p('c', 'purple'), p('d', 'purple', undefined, { at: 0.4 }), p('f', 'purple', undefined, { at: 0.4 }), p('h', 'orange'), p('i', 'orange', undefined, { at: 0.4 })] }],
    },
  },
  {
    id: 'rds-dynamodb',
    title: 'RDS vs DynamoDB',
    module: 'databases',
    items: [
      { name: 'Amazon RDS / Aurora', icon: 'database', tagline: 'Managed relational SQL', bestFor: ['Complex queries & joins', 'Transactions across tables', 'Existing SQL applications'] },
      { name: 'Amazon DynamoDB', icon: 'zap', tagline: 'Serverless key-value / document', bestFor: ['Massive scale, predictable latency', 'Known access patterns', 'Serverless apps'] },
    ],
    rows: [
      { aspect: 'Data model', values: ['Tables with schema, relations', 'Items with keys, flexible attributes'] },
      { aspect: 'Query', values: ['SQL, joins, aggregates', 'Key-based Get/Query, indexes (GSI/LSI)'] },
      { aspect: 'Scaling', values: ['Vertical + read replicas', 'Horizontal, virtually unlimited'] },
      { aspect: 'Servers', values: ['Choose instance class (or Aurora Serverless v2)', 'None – on-demand or provisioned capacity'] },
      { aspect: 'Availability', values: ['Multi-AZ option', 'Multi-AZ by default; global tables'] },
    ],
    verdict: 'RDS/Aurora for relational data and flexible queries; DynamoDB for high-scale, low-latency access by key.',
    diagram: {
      id: 'cmp-db',
      title: 'Query styles',
      width: 820,
      height: 220,
      nodes: [n('a', 'App', 80, 60, 'compute', 'SELECT … JOIN'), n('rds', 'RDS', 330, 60, 'database', 'SQL engine'), n('b', 'App', 80, 160, 'compute', 'GetItem(PK)'), n('ddb', 'DynamoDB', 330, 160, 'database', 'key lookup')],
      edges: [e('x', 'a', 'rds'), e('y', 'b', 'ddb')],
      steps: [{ title: 'SQL vs key lookup', text: 'RDS evaluates arbitrary SQL; DynamoDB looks items up by key in single-digit milliseconds.', packets: [p('x', 'blue', 'SQL'), r('x', 'green', 'rows', { at: 0.45 }), p('y', 'purple', 'PK'), r('y', 'green', 'item', { at: 0.4 })] }],
    },
  },
  {
    id: 'sg-nacl',
    title: 'Security Groups vs Network ACLs',
    module: 'vpc',
    items: [
      { name: 'Security Group', icon: 'shield', tagline: 'Instance-level, stateful', bestFor: ['Primary firewall for every resource', 'Tiered access via SG references'] },
      { name: 'Network ACL', icon: 'list', tagline: 'Subnet-level, stateless', bestFor: ['Explicitly blocking IP ranges', 'Coarse subnet guardrails'] },
    ],
    rows: [
      { aspect: 'Applies to', values: ['Network interfaces (instances, RDS, Lambda ENIs…)', 'All traffic entering/leaving a subnet'] },
      { aspect: 'State', values: ['Stateful – return traffic allowed automatically', 'Stateless – return traffic needs rules'] },
      { aspect: 'Rules', values: ['Allow only', 'Allow and deny'] },
      { aspect: 'Evaluation', values: ['All rules evaluated together', 'Lowest rule number first; first match wins'] },
      { aspect: 'Default', values: ['New SG: deny all inbound, allow all outbound', 'Default NACL: allow all; custom NACL: deny all'] },
      { aspect: 'References', values: ['Can reference other security groups', 'CIDR ranges only'] },
    ],
    verdict: 'Security groups do most of the work; use NACLs as an extra subnet-level layer, especially to deny specific ranges.',
    diagram: {
      id: 'cmp-sg-nacl',
      title: 'Where they sit',
      width: 820,
      height: 260,
      groups: [g('sub', 'Subnet', 300, 30, 500, 210, 'public'), g('sg', 'Security group', 520, 70, 250, 130, 'generic')],
      nodes: [n('in', 'Traffic', 90, 135, 'internet'), n('nacl', 'NACL', 330, 135, 'security', 'subnet edge', { w: 90 }), n('ec2', 'EC2', 645, 135, 'compute', 'ENI')],
      edges: [e('a', 'in', 'nacl'), e('b', 'nacl', 'ec2')],
      steps: [{ title: 'Two layers', text: 'A packet passes the subnet NACL first (stateless), then the instance’s security group (stateful).', packets: [p('a', 'blue'), p('b', 'blue', undefined, { at: 0.4 })], focus: ['nacl', 'sg'] }],
    },
  },
  {
    id: 'multiaz-readreplica',
    title: 'Multi-AZ vs Read Replicas',
    module: 'databases',
    items: [
      { name: 'Multi-AZ', icon: 'shieldcheck', tagline: 'High availability', bestFor: ['Surviving AZ/instance failure', 'Zero data loss failover', 'Maintenance with less downtime'] },
      { name: 'Read Replicas', icon: 'layers', tagline: 'Read scaling', bestFor: ['Offloading read-heavy traffic', 'Reporting/analytics', 'Cross-Region DR copies'] },
    ],
    rows: [
      { aspect: 'Purpose', values: ['Availability / durability', 'Performance (read scale)'] },
      { aspect: 'Replication', values: ['Synchronous', 'Asynchronous (can lag)'] },
      { aspect: 'Serves reads?', values: ['No (instance deployment); yes for Multi-AZ DB clusters', 'Yes'] },
      { aspect: 'Failover', values: ['Automatic, same endpoint', 'Manual promotion (new endpoint)'] },
      { aspect: 'Location', values: ['Different AZ, same Region', 'Same AZ, other AZ or other Region'] },
    ],
    verdict: 'Multi-AZ keeps you up; read replicas make you faster. Production databases often use both.',
    diagram: {
      id: 'cmp-maz',
      title: 'Sync standby vs async replica',
      width: 820,
      height: 240,
      nodes: [n('app', 'App', 80, 120, 'compute'), n('pri', 'Primary', 320, 120, 'database'), n('sb', 'Standby', 580, 50, 'database', 'sync · no reads'), n('rr', 'Read replica', 580, 190, 'database', 'async · reads', { w: 120 })],
      edges: [e('a', 'app', 'pri'), e('b', 'pri', 'sb', { label: 'sync' }), e('c', 'pri', 'rr', { label: 'async' }), e('d', 'app', 'rr', { curve: 60, dashed: true, label: 'SELECT' })],
      steps: [{ title: 'Two kinds of copies', text: 'Writes are synchronously copied to the standby and asynchronously to read replicas, which serve reads.', packets: [p('a', 'blue'), p('b', 'teal', undefined, { at: 0.3 }), p('c', 'purple', undefined, { at: 0.4 }), p('d', 'purple', undefined, { at: 0.1 })] }],
    },
  },
  {
    id: 'cloudwatch-cloudtrail',
    title: 'CloudWatch vs CloudTrail (vs Config)',
    module: 'monitoring',
    items: [
      { name: 'CloudWatch', icon: 'activity', tagline: 'Performance & health', bestFor: ['Metrics, logs, alarms', 'Dashboards', 'Auto Scaling triggers'] },
      { name: 'CloudTrail', icon: 'eye', tagline: 'API activity audit', bestFor: ['Who did what, when', 'Security investigations', 'Compliance evidence'] },
      { name: 'AWS Config', icon: 'list', tagline: 'Configuration history', bestFor: ['Resource change timeline', 'Compliance rules', 'Drift detection'] },
    ],
    rows: [
      { aspect: 'Question answered', values: ['How is it performing?', 'Who called which API?', 'What did it look like and is it compliant?'] },
      { aspect: 'Data', values: ['Metrics, logs, traces (X-Ray/App Signals)', 'API events (management, data)', 'Configuration items, relationships'] },
      { aspect: 'Typical action', values: ['Alarm → SNS / scale', 'Investigate, alert on sensitive calls', 'Flag/remediate non-compliant resources'] },
    ],
    verdict: 'They complement each other: CloudWatch for operations, CloudTrail for auditing activity, Config for configuration compliance.',
    diagram: {
      id: 'cmp-obs',
      title: 'Three lenses on the same resource',
      width: 820,
      height: 260,
      nodes: [n('res', 'EC2 instance', 120, 130, 'compute'), n('cw', 'CloudWatch', 450, 50, 'monitoring', 'CPU 92%'), n('ct', 'CloudTrail', 450, 130, 'monitoring', 'alice ModifyInstanceAttribute', { icon: 'eye', w: 200 }), n('cfg', 'AWS Config', 450, 210, 'monitoring', 'SG changed 14:02', { icon: 'list', w: 140 })],
      edges: [e('a', 'res', 'cw'), e('b', 'res', 'ct'), e('c', 'res', 'cfg')],
      steps: [{ title: 'Performance, activity, configuration', text: 'One instance produces metrics (CloudWatch), API activity records (CloudTrail) and configuration changes (Config).', packets: [p('a', 'teal'), p('b', 'orange', undefined, { at: 0.1 }), p('c', 'purple', undefined, { at: 0.2 })] }],
    },
  },
  {
    id: 'nat-igw',
    title: 'NAT Gateway vs Internet Gateway',
    module: 'vpc',
    items: [
      { name: 'Internet Gateway', icon: 'globe', tagline: 'Two-way internet for public subnets', bestFor: ['Public-facing load balancers', 'Bastion / public instances', 'Required for NAT GW to work'] },
      { name: 'NAT Gateway', icon: 'network', tagline: 'Outbound-only for private subnets', bestFor: ['Patching private instances', 'Calling external APIs from private apps'] },
    ],
    rows: [
      { aspect: 'Direction', values: ['Inbound and outbound', 'Outbound initiated only (+ replies)'] },
      { aspect: 'Used by', values: ['Public subnets (route 0.0.0.0/0 → igw)', 'Private subnets (route 0.0.0.0/0 → nat)'] },
      { aspect: 'Public IP needed', values: ['Yes, on each resource', 'Only on the NAT GW (Elastic IP)'] },
      { aspect: 'Availability', values: ['Redundant, Regional, no AZ concern', 'Zonal – deploy one per AZ'] },
      { aspect: 'Cost', values: ['No charge for the gateway (data transfer applies)', 'Hourly + per-GB processed'] },
    ],
    verdict: 'IGW makes subnets public; NAT Gateway gives private subnets outbound access without exposing them.',
    diagram: {
      id: 'cmp-nat',
      title: 'Directions of traffic',
      width: 820,
      height: 260,
      groups: [g('pub', 'Public subnet', 260, 30, 280, 90, 'public'), g('priv', 'Private subnet', 260, 150, 280, 90, 'private')],
      nodes: [n('inet', 'Internet', 80, 130, 'internet'), n('igw', 'IGW', 200, 130, 'network', '', { w: 70 }), n('web', 'Public EC2', 340, 75, 'compute', '', { w: 110 }), n('nat', 'NAT GW', 470, 75, 'network', '', { w: 100 }), n('app', 'Private EC2', 400, 195, 'compute', '', { w: 110 })],
      edges: [e('a', 'inet', 'igw', { both: true }), e('b', 'igw', 'web', { both: true }), e('c', 'app', 'nat'), e('d', 'nat', 'igw', { curve: -40 }), e('x', 'igw', 'app', { dashed: true })],
      steps: [{ title: 'Two-way vs outbound-only', text: 'Public instances talk both ways through the IGW; private instances go out via NAT, but inbound connections to them are impossible.', packets: [p('a', 'blue'), p('b', 'blue', undefined, { at: 0.35 }), p('c', 'green'), p('d', 'green', undefined, { at: 0.4 }), p('x', 'red', 'blocked', { dropAt: 0.3, at: 0.1 })] }],
    },
  },
];

export const COMPARISON_MAP = Object.fromEntries(COMPARISONS.map((c) => [c.id, c]));
