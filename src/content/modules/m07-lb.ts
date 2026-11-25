import type { LearningModule } from '../../types';
import type { FlowDef } from '../../animation/flowTypes';
import { e, g, n, p, r } from '../../animation/builders';

function lbBase(id: string, title: string, steps: FlowDef['steps'], initial?: FlowDef['initial'], description?: string): FlowDef {
  return {
    id,
    title,
    description,
    width: 840,
    height: 400,
    groups: [g('tg', 'Target group web-tg (Auto Scaling group: min 2 · max 4)', 380, 20, 330, 370, 'generic'), g('aza', 'AZ a', 395, 48, 145, 330, 'az'), g('azb', 'AZ b', 552, 48, 145, 330, 'az')],
    nodes: [
      n('users', 'Internet', 70, 200, 'internet', 'clients'),
      n('alb', 'Application LB', 240, 200, 'network', 'HTTP :443', { w: 120 }),
      n('i1', 'web-1', 467, 115, 'compute', 'healthy', { w: 120 }),
      n('i2', 'web-2', 625, 115, 'compute', 'healthy', { w: 120 }),
      n('i3', 'web-3', 467, 290, 'compute', 'new', { w: 120 }),
      n('i4', 'web-4', 625, 290, 'compute', 'new', { w: 120 }),
      n('cw', 'CloudWatch', 780, 120, 'monitoring', 'CPU alarm', { w: 100 }),
      n('asg', 'Auto Scaling', 780, 290, 'monitoring', 'policy', { icon: 'scale', w: 100 }),
    ],
    edges: [
      e('u', 'users', 'alb'),
      e('a1', 'alb', 'i1'),
      e('a2', 'alb', 'i2', { curve: -25 }),
      e('a3', 'alb', 'i3'),
      e('a4', 'alb', 'i4', { curve: 25 }),
      e('cw-asg', 'cw', 'asg'),
      e('asg-3', 'asg', 'i3', { dashed: true, curve: -30 }),
      e('asg-4', 'asg', 'i4', { dashed: true }),
    ],
    initial: { i3: 'hidden', i4: 'hidden', ...initial },
    steps,
  };
}

export const loadBalancing: LearningModule = {
  id: 'load-balancing',
  num: 7,
  title: 'Load Balancing and Auto Scaling',
  short: 'Load Balancing',
  icon: 'split',
  level: 'Intermediate',
  minutes: 45,
  intro:
    'Elastic Load Balancing spreads incoming traffic across multiple targets (EC2 instances, containers, IPs, Lambda functions) in multiple AZs and only sends traffic to targets that pass health checks. EC2 Auto Scaling keeps the right number of instances running: it replaces unhealthy ones and adds or removes capacity as load changes. Together they deliver both high availability and elasticity.',
  analogy: 'The load balancer is a restaurant host seating guests at free tables; Auto Scaling is the manager who calls in more waiters when the queue grows and sends them home when it is quiet.',
  concepts: [
    { term: 'Application Load Balancer (ALB)', body: 'Layer 7 (HTTP/HTTPS/gRPC). Routes on host, path, headers, query strings and methods; supports TLS termination, redirects, fixed responses, authentication (Cognito/OIDC), WebSockets and Lambda targets.' },
    { term: 'Network Load Balancer (NLB)', body: 'Layer 4 (TCP/UDP/TLS). Handles millions of requests per second with very low latency, provides a static IP per AZ (or Elastic IPs) and preserves the client source IP. Use for non-HTTP protocols or extreme performance.' },
    { term: 'Gateway Load Balancer (GWLB)', body: 'Layer 3 load balancer for fleets of virtual network appliances (firewalls, IDS/IPS). It uses GENEVE encapsulation on port 6081 and gateway load balancer endpoints to insert inspection transparently into traffic paths.' },
    { term: 'Target groups', body: 'A group of targets plus a protocol, port and health check. Listeners (e.g. HTTPS:443) have rules that forward requests to target groups – e.g. /api/* → api-tg, everything else → web-tg.' },
    { term: 'Health checks', body: 'The load balancer periodically sends a request (e.g. GET /health) to each target. After a number of consecutive failures (unhealthy threshold) the target is taken out of rotation; after consecutive successes (healthy threshold) it is put back.', facts: ['ALB defaults: interval 30 s, timeout 5 s, healthy threshold 5, unhealthy threshold 2'] },
    { term: 'Auto Scaling groups (ASG)', body: 'A logical group of EC2 instances launched from a launch template across chosen subnets/AZs, with minimum, maximum and desired capacity. The ASG maintains desired capacity and rebalances across AZs.' },
    { term: 'Scaling policies', body: 'Target tracking (keep average CPU at 50% – the simplest, recommended), step scaling (add N instances when an alarm breaches by X), scheduled scaling (known patterns) and predictive scaling (forecasts from history).' },
    { term: 'ASG health checks', body: 'By default the ASG uses EC2 status checks. Enable ELB health checks on the ASG so that instances failing the load balancer’s application health check are also replaced.' },
    { term: 'Horizontal vs vertical scaling', body: 'Vertical: bigger instance (needs a restart, has a ceiling, single point of failure). Horizontal: more instances behind a load balancer (no ceiling in practice, fault tolerant, requires stateless app design).' },
    { term: 'Cross-zone load balancing', body: 'With cross-zone enabled (always on for ALB), each load balancer node distributes traffic across targets in all AZs, so uneven instance counts per AZ do not cause uneven load.' },
    { term: 'Connection draining (deregistration delay)', body: 'When a target is removed, the load balancer stops sending new requests but lets in-flight requests finish for the deregistration delay (default 300 s).' },
  ],
  animations: [
    lbBase('m7-one', '1 · One incoming request', [
      { title: 'Client resolves the ALB DNS name', text: 'Clients connect to the ALB’s DNS name (e.g. my-alb-123.eu-west-1.elb.amazonaws.com). ALB nodes exist in each enabled AZ.', packets: [p('u', 'blue', 'GET /')] },
      { title: 'Listener rule picks the target group', text: 'The HTTPS:443 listener terminates TLS and its default rule forwards to web-tg.', focus: ['alb', 'tg'] },
      { title: 'A healthy target is chosen', text: 'ALB uses round robin by default (or least outstanding requests). web-1 receives the request.', packets: [p('a1', 'blue', 'GET /')] },
      { title: 'Response', text: 'web-1 responds through the ALB to the client. The ALB adds X-Forwarded-For so the app can see the client IP.', packets: [r('a1', 'green', '200', { span: 0.4 }), r('u', 'green', '200', { at: 0.4, span: 0.4 })] },
    ]),
    lbBase('m7-many', '2 · Many requests are distributed', [
      { title: 'Burst of requests', text: 'Several clients send requests at the same time.', packets: [p('u', 'blue', 'req 1', { span: 0.3 }), p('u', 'blue', 'req 2', { at: 0.12, span: 0.3 }), p('u', 'blue', 'req 3', { at: 0.24, span: 0.3 }), p('u', 'blue', 'req 4', { at: 0.36, span: 0.3 })] },
      { title: 'Round-robin across AZs', text: 'Requests alternate between web-1 (AZ a) and web-2 (AZ b). Cross-zone load balancing keeps both busy evenly.', packets: [p('a1', 'blue', '1', { span: 0.3 }), p('a2', 'teal', '2', { at: 0.15, span: 0.3 }), p('a1', 'blue', '3', { at: 0.3, span: 0.3 }), p('a2', 'teal', '4', { at: 0.45, span: 0.3 })], badges: { i1: '2 req', i2: '2 req' } },
      { title: 'Stateless servers', text: 'Because consecutive requests from one user may hit different servers, session state belongs in ElastiCache/DynamoDB (or use ALB sticky sessions when unavoidable).', focus: ['i1', 'i2'] },
    ]),
    lbBase('m7-unhealthy', '3 · Unhealthy instance and automatic replacement', [
      { title: 'Health checks pass', text: 'Every 30 seconds the ALB sends GET /health to each target; both return 200.', packets: [p('a1', 'teal', '/health'), p('a2', 'teal', '/health', { at: 0.1 })] },
      { title: 'web-2 starts failing', text: 'The application on web-2 crashes and returns 500 errors.', set: { i2: 'fail' }, packets: [p('a2', 'red', '/health', { dropAt: 0.9 })] },
      { title: 'Marked unhealthy', text: 'After 2 consecutive failures (unhealthy threshold), web-2 is removed from rotation. New requests go only to web-1.', packets: [p('u', 'blue', undefined, { span: 0.3 }), p('a1', 'blue', undefined, { at: 0.3, span: 0.4 })], set: { a2: 'off' }, log: 'Target web-2 is unhealthy: Health checks failed with these codes: [500]' },
      { title: 'ASG terminates and replaces it', text: 'With ELB health checks enabled on the ASG, the unhealthy instance is terminated and a new one is launched in the same AZ to keep desired capacity.', set: { i2: 'hidden', i4: 'new', a4: 'off' }, packets: [p('asg-4', 'green', 'launch')], log: 'ASG: Terminating web-2 (ELB health check failure); launching web-4' },
      { title: 'New instance registers', text: 'web-4 boots, passes the healthy threshold of health checks and joins the target group.', set: { i4: 'ok', a4: 'ok' }, packets: [p('a4', 'teal', '/health'), p('a1', 'blue', undefined, { at: 0.3 }), p('a4', 'blue', undefined, { at: 0.45 })] },
    ]),
    lbBase('m7-scale', '4 · Traffic increase triggers Auto Scaling', [
      { title: 'Steady state', text: 'Two instances at ~40% CPU. Target tracking policy: keep average CPU at 50%.', badges: { i1: '40%', i2: '42%' }, packets: [p('a1', 'blue'), p('a2', 'blue', undefined, { at: 0.1 })] },
      { title: 'Traffic doubles', text: 'Average CPU rises to 80%.', badges: { i1: '81%', i2: '79%' }, set: { i1: 'warn', i2: 'warn' }, packets: [p('u', 'red', undefined, { span: 0.25 }), p('u', 'red', undefined, { at: 0.1, span: 0.25 }), p('u', 'red', undefined, { at: 0.2, span: 0.25 }), p('a1', 'red', undefined, { at: 0.3, span: 0.35 }), p('a2', 'red', undefined, { at: 0.35, span: 0.35 })] },
      { title: 'CloudWatch alarm fires', text: 'The target-tracking alarm (managed by Auto Scaling) breaches and notifies the ASG.', packets: [p('cw-asg', 'orange', 'ALARM')], log: 'Alarm TargetTracking-web-asg-AlarmHigh → ALARM' },
      { title: 'Scale out to 4', text: 'Auto Scaling calculates the capacity needed to bring CPU back to 50% and launches two instances, one per AZ.', set: { i3: 'new', i4: 'new' }, packets: [p('asg-3', 'green', 'launch'), p('asg-4', 'green', 'launch')] },
      { title: 'Load evens out', text: 'After the warm-up period the new instances receive traffic and average CPU settles near 45%.', set: { i1: 'ok', i2: 'ok', i3: 'ok', i4: 'ok' }, badges: { i1: '45%', i2: '44%', i3: '46%', i4: '43%' }, packets: [p('a1', 'blue', undefined, { span: 0.5 }), p('a2', 'blue', undefined, { at: 0.1, span: 0.5 }), p('a3', 'blue', undefined, { at: 0.2, span: 0.5 }), p('a4', 'blue', undefined, { at: 0.3, span: 0.5 })] },
    ]),
    {
      id: 'm7-path',
      title: 'ALB path-based routing',
      width: 820,
      height: 340,
      nodes: [n('c', 'Client', 80, 170, 'user'), n('alb', 'ALB listener :443', 280, 170, 'network', 'rules', { w: 140 }), n('web', 'web-tg', 560, 70, 'compute', 'EC2 web servers'), n('api', 'api-tg', 560, 170, 'container', 'ECS tasks'), n('img', 'img-tg', 560, 270, 'compute', 'Lambda target', { icon: 'zap' })],
      edges: [e('c-a', 'c', 'alb'), e('a-w', 'alb', 'web', { label: 'default' }), e('a-api', 'alb', 'api', { label: '/api/*' }), e('a-img', 'alb', 'img', { label: '/img/*' })],
      steps: [
        { title: 'GET /', text: 'No specific rule matches – the default action forwards to web-tg.', packets: [p('c-a', 'blue', '/', { span: 0.35 }), p('a-w', 'blue', '/', { at: 0.4, span: 0.4 })] },
        { title: 'GET /api/orders', text: 'Rule priority 10: path /api/* → api-tg (ECS tasks).', packets: [p('c-a', 'purple', '/api/orders', { span: 0.35 }), p('a-api', 'purple', undefined, { at: 0.4, span: 0.4 })] },
        { title: 'GET /img/thumb.png', text: 'Rule priority 20: path /img/* → a Lambda function target.', packets: [p('c-a', 'orange', '/img/…', { span: 0.35 }), p('a-img', 'orange', undefined, { at: 0.4, span: 0.4 })] },
      ],
    },
  ],
  experiment: 'lb-simulator',
  experimentTitle: 'Live load balancer & Auto Scaling simulator',
  experimentBlurb: 'Drive traffic, break instances and watch health checks, replacement and target-tracking scaling with live CPU and instance-count charts.',
  realWorld: {
    title: 'Black Friday for an online shop',
    story: 'An online shop uses scheduled scaling to raise the minimum to 10 instances on Black Friday morning, target tracking at 50% CPU on top, and an ALB with path rules sending /api to containers and / to web servers. A bad deployment that made /health return 500 was caught by health checks; instances were replaced automatically while the team rolled back.',
    points: ['Scheduled + target tracking scaling', 'Health checks stop traffic to broken targets', 'Deregistration delay prevents dropped in-flight requests'],
  },
  limits: ['ALB does not provide static IPs – put an NLB or Global Accelerator in front when static IPs are required.', 'Scaling is not instant: instance boot plus warm-up can take minutes – pre-warm with scheduled scaling for known events.', 'Health check endpoints should check dependencies carefully to avoid replacing all instances when a shared database is down.'],
  summary: ['ALB = layer 7 smart routing; NLB = layer 4 performance + static IPs; GWLB = appliance insertion.', 'Health checks decide which targets receive traffic.', 'ASGs maintain desired capacity and replace unhealthy instances.', 'Target tracking is the simplest scaling policy.', 'Scale horizontally and keep instances stateless.'],
  related: ['alb', 'nlb', 'gwlb', 'auto-scaling', 'ec2', 'cloudwatch'],
  quiz: [
    { q: 'You need to route /api/* and /images/* to different services over HTTPS. Which load balancer?', options: ['Network Load Balancer', 'Application Load Balancer', 'Gateway Load Balancer', 'Classic DNS round robin'], answer: 1, explain: 'Path-based routing is a layer 7 feature of the ALB.' },
    { q: 'A partner requires a fixed IP address to allow-list your service. What helps?', options: ['ALB', 'NLB with Elastic IPs (or Global Accelerator)', 'Security group', 'CloudWatch'], answer: 1, explain: 'NLB provides one static IP per AZ and supports Elastic IPs. ALB IPs change.' },
    { q: 'Instances fail the ALB health check but are not replaced by the ASG. Why?', options: ['The ASG only uses EC2 status checks by default; enable ELB health checks', 'ALB cannot do health checks', 'ASGs never replace instances', 'The VPC is wrong'], answer: 0, explain: 'Without ELB health checks enabled on the ASG, it only considers EC2 status checks, which pass even if the app is broken.' },
    { q: 'Which scaling policy keeps a metric such as average CPU at a chosen value?', options: ['Scheduled scaling', 'Target tracking scaling', 'Manual scaling', 'Lifecycle hooks'], answer: 1, explain: 'Target tracking works like a thermostat around a target value.' },
    { q: 'Horizontal scaling means…', options: ['Upgrading to a larger instance type', 'Adding more instances', 'Adding more EBS volumes', 'Moving to another Region'], answer: 1, explain: 'Horizontal = scale out/in by changing the number of instances.' },
    { q: 'Which load balancer type would you place in front of a fleet of third-party firewall appliances?', options: ['ALB', 'NLB', 'Gateway Load Balancer', 'API Gateway'], answer: 2, explain: 'GWLB is designed to deploy, scale and manage virtual appliances transparently using GENEVE.' },
  ],
  docs: [
    { label: 'Elastic Load Balancing', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html' },
    { label: 'ALB health checks', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html' },
    { label: 'Target tracking scaling policies', url: 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html' },
  ],
};
