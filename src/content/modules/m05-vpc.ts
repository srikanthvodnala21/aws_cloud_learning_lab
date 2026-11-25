import type { LearningModule } from '../../types';
import type { FlowDef } from '../../animation/flowTypes';
import { e, g, n, p, r } from '../../animation/builders';

/** Shared base VPC diagram used by several animations */
function baseVpc(id: string, title: string, description: string, steps: FlowDef['steps'], initial?: FlowDef['initial']): FlowDef {
  return {
    id,
    title,
    description,
    width: 840,
    height: 420,
    groups: [
      g('vpc', 'VPC 10.0.0.0/16', 150, 18, 670, 390, 'vpc'),
      g('pub', 'Public subnet 10.0.1.0/24 (AZ a)', 230, 48, 340, 160, 'public'),
      g('priv', 'Private subnet 10.0.2.0/24 (AZ a)', 230, 228, 340, 165, 'private'),
    ],
    nodes: [
      n('inet', 'Internet', 70, 210, 'internet', '0.0.0.0/0'),
      n('igw', 'Internet GW', 175, 128, 'network', 'igw-01', { w: 100 }),
      n('web', 'Web EC2', 320, 130, 'compute', '10.0.1.10 + 54.x.x.x'),
      n('nat', 'NAT Gateway', 480, 130, 'network', '10.0.1.50 + EIP'),
      n('app', 'App EC2', 320, 315, 'compute', '10.0.2.20 (private)'),
      n('db', 'RDS', 480, 315, 'database', '10.0.2.30'),
      n('rtpub', 'Public route table', 700, 110, 'network', '10.0.0.0/16 → local', { w: 160, icon: 'route' }),
      n('rtpub2', '0.0.0.0/0 → igw-01', 700, 165, 'network', 'default route', { w: 160, icon: 'route' }),
      n('rtpriv', 'Private route table', 700, 290, 'network', '10.0.0.0/16 → local', { w: 160, icon: 'route' }),
      n('rtpriv2', '0.0.0.0/0 → nat-01', 700, 345, 'network', 'default route', { w: 160, icon: 'route' }),
    ],
    edges: [
      e('inet-igw', 'inet', 'igw'),
      e('igw-web', 'igw', 'web'),
      e('nat-igw', 'nat', 'igw', { curve: -45 }),
      e('app-nat', 'app', 'nat'),
      e('web-app', 'web', 'app'),
      e('app-db', 'app', 'db'),
      e('igw-app', 'igw', 'app', { dashed: true }),
      e('rt1', 'rtpub', 'rtpub2', { plain: true, dashed: true }),
      e('rt2', 'rtpriv', 'rtpriv2', { plain: true, dashed: true }),
    ],
    initial,
    steps,
  };
}

export const vpc: LearningModule = {
  id: 'vpc',
  num: 5,
  title: 'VPC – Virtual Private Cloud',
  short: 'VPC',
  icon: 'network',
  level: 'Intermediate',
  minutes: 75,
  intro:
    'A VPC is your own logically isolated network inside an AWS Region. You choose its IP address range (CIDR block), divide it into subnets in different Availability Zones, and control exactly how traffic flows with route tables, gateways, security groups and network ACLs. Almost every AWS architecture – EC2, RDS, Lambda in a VPC, EKS, load balancers – sits inside a VPC, so understanding packet flow here is fundamental.',
  analogy: 'The VPC is a private office building. Subnets are floors; route tables are the signs in the corridors saying which exit leads where; the Internet Gateway is the main entrance; the NAT Gateway is a mail room that sends letters out for people on secure floors but never lets strangers walk in; security groups are the locks on each office door; NACLs are the guards at each floor’s stairwell.',
  concepts: [
    { term: 'What is a VPC?', body: 'A Regional virtual network that spans all AZs in the Region. Resources in a VPC communicate privately. Every account has a default VPC in each Region (172.31.0.0/16 with a public subnet per AZ) for quick starts; production usually uses custom VPCs.' },
    { term: 'CIDR blocks', body: 'The IPv4 range of the VPC in CIDR notation, between /16 (65,536 addresses) and /28 (16 addresses). Use private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and avoid overlapping with networks you may connect to later. You can add secondary CIDRs and an IPv6 block.', facts: ['AWS reserves 5 IPs in every subnet: network, VPC router, DNS, future use, broadcast', 'A /24 subnet therefore has 251 usable addresses'] },
    { term: 'Subnets', body: 'A subnet is a slice of the VPC CIDR located in exactly one AZ. Whether a subnet is "public" or "private" is not a setting – it depends entirely on its route table.' },
    { term: 'Public subnet', body: 'A subnet whose route table has a route to an Internet Gateway (0.0.0.0/0 → igw-…). Instances also need a public IPv4 or Elastic IP to be reachable from the internet.' },
    { term: 'Private subnet', body: 'A subnet with no route to an Internet Gateway. Instances cannot be reached from the internet. For outbound internet access (updates, external APIs) route 0.0.0.0/0 to a NAT Gateway in a public subnet.' },
    { term: 'Route tables', body: 'A set of routes (destination CIDR → target). Every subnet is associated with exactly one route table (the main route table if not explicitly associated). The most specific matching route wins (longest prefix match). Every route table has an un-deletable local route for the VPC CIDR.' },
    { term: 'Internet Gateway (IGW)', body: 'A horizontally scaled, redundant VPC component that allows communication between the VPC and the internet. It performs 1:1 NAT between an instance’s private IP and its public IP. One IGW per VPC; no bandwidth limits to manage.' },
    { term: 'NAT Gateway', body: 'A managed network address translation service that lets instances in private subnets start outbound IPv4 connections while blocking unsolicited inbound connections. It is created in a public subnet in a specific AZ with an Elastic IP. For AZ resilience, create one NAT Gateway per AZ. Billed per hour plus per GB processed.' },
    { term: 'Security groups', body: 'Stateful firewalls at the network interface (instance) level. Allow rules only; evaluated as a whole (all rules considered). Rules can reference other security groups – e.g. "allow 5432 from app-sg" – instead of IP ranges.' },
    { term: 'Network ACLs', body: 'Stateless firewalls at the subnet boundary. Ordered numbered rules (lowest first, first match wins), support allow and deny, and require explicit rules for return traffic (ephemeral ports 1024–65535). The default NACL allows everything; a new custom NACL denies everything until you add rules.' },
    { term: 'Elastic Network Interfaces (ENI)', body: 'A virtual network card with a private IP, optional public IP, MAC address and security groups. Instances have a primary ENI; you can attach secondary ENIs (in the same AZ) to move an IP between instances or to multi-home.' },
    { term: 'VPC Peering', body: 'A private connection between two VPCs (same or different accounts/Regions) so they can route to each other with private IPs. Not transitive and CIDRs must not overlap. Both sides need route table entries.' },
    { term: 'VPC Endpoints', body: 'Private access to AWS services without an IGW or NAT. Gateway endpoints (S3 and DynamoDB, free, added as route-table targets) and interface endpoints (ENIs in your subnets powered by PrivateLink, billed hourly and per GB).' },
    { term: 'Transit Gateway', body: 'A regional network hub. Attach many VPCs, VPNs and Direct Connect gateways to one Transit Gateway instead of building a mesh of peering connections. Supports transitive routing controlled by TGW route tables.' },
  ],
  animations: [
    baseVpc('m5-public', '1 · A request reaches a public EC2 instance', 'Internet → IGW → public subnet → web server', [
      { title: 'Client sends a request', text: 'A browser sends HTTPS to the instance’s public IP 54.x.x.x.', packets: [p('inet-igw', 'blue', 'dst 54.x.x.x:443')] },
      { title: 'IGW translates the address', text: 'The Internet Gateway maps the public IP 54.x.x.x to the instance’s private IP 10.0.1.10 (1:1 NAT).', focus: ['igw'], badges: { igw: '54.x → 10.0.1.10' } },
      { title: 'NACL & security group check', text: 'The subnet NACL allows inbound 443, and the web security group allows 443 from 0.0.0.0/0. The packet is delivered.', packets: [p('igw-web', 'blue', 'dst 10.0.1.10:443')], focus: ['pub', 'web'] },
      { title: 'Response leaves via the route table', text: 'The reply goes to the browser’s public IP. The public route table matches 0.0.0.0/0 → igw-01 (the only route covering that destination).', focus: ['rtpub2'], packets: [r('igw-web', 'green', 'reply')] },
      { title: 'Back to the internet', text: 'The IGW translates the source back to 54.x.x.x and sends the response out. Security groups are stateful, so the response is allowed automatically.', packets: [r('inet-igw', 'green', 'src 54.x.x.x')], log: 'Route lookup: dst 203.0.113.9 → match 0.0.0.0/0 → igw-01' },
    ]),
    baseVpc('m5-nat', '2 · A private instance reaches the internet through NAT', 'Private subnet → NAT Gateway → IGW → internet', [
      { title: 'App needs a software update', text: 'The private instance (no public IP) calls https://packages.example.com.', packets: [p('app-nat', 'blue', 'dst 93.184.x.x')], focus: ['app'] },
      { title: 'Private route table decides', text: 'Destination 93.184.x.x is not inside 10.0.0.0/16, so the local route does not match. The 0.0.0.0/0 route sends it to nat-01.', focus: ['rtpriv2'], log: 'Route lookup (private RT): 93.184.x.x → 0.0.0.0/0 → nat-01' },
      { title: 'NAT rewrites the source', text: 'The NAT Gateway replaces source 10.0.2.20 with its own private IP and tracks the connection. Its Elastic IP is what the internet sees.', focus: ['nat'], badges: { nat: 'src → EIP' } },
      { title: 'Out through the IGW', text: 'The NAT Gateway lives in the public subnet, whose route table sends 0.0.0.0/0 to the IGW.', packets: [p('nat-igw', 'blue'), p('inet-igw', 'blue', undefined, { reverse: true, at: 0.45, span: 0.35 })] },
      { title: 'Response returns to the app', text: 'The reply comes back to the NAT’s Elastic IP; the NAT Gateway looks up the tracked connection and forwards it to 10.0.2.20.', packets: [p('inet-igw', 'green', 'reply', { span: 0.25 }), r('nat-igw', 'green', undefined, { at: 0.25, span: 0.3 }), r('app-nat', 'green', undefined, { at: 0.55, span: 0.3 })] },
    ]),
    baseVpc('m5-unsolicited', '3 · Why the internet cannot reach a private subnet', 'Unsolicited inbound traffic has no path', [
      { title: 'An attacker scans for servers', text: 'Someone on the internet tries to connect to 10.0.2.20. But private IPs are not routable on the internet, and the instance has no public IP.', packets: [p('inet-igw', 'red', 'SYN → ?')] },
      { title: 'IGW has nothing to translate', text: 'The IGW only translates traffic for addresses with an associated public IP. The private instance has none, so there is no mapping.', packets: [p('igw-app', 'red', 'no mapping', { dropAt: 0.35 })], focus: ['igw'] },
      { title: 'NAT only allows return traffic', text: 'A NAT Gateway never accepts new inbound connections – it only forwards replies for connections started from inside.', focus: ['nat'], badges: { nat: 'outbound only' } },
      { title: 'Defence in depth', text: 'Even if a route existed, the app security group only allows traffic from the web tier’s security group. To expose private apps, put a load balancer in the public subnets and keep instances private.', focus: ['app', 'priv'] },
    ]),
    {
      id: 'm5-sg',
      title: '4 · How security groups filter traffic',
      description: 'Stateful, allow-only rules on the instance network interface',
      width: 820,
      height: 380,
      groups: [g('sg', 'Security group web-sg  ·  in: 443 from 0.0.0.0/0, 22 from 203.0.113.10/32', 330, 70, 470, 240, 'generic')],
      nodes: [
        n('user', 'Any user', 90, 80, 'user', 'internet'),
        n('admin', 'You (admin)', 90, 190, 'user', '203.0.113.10'),
        n('bad', 'Unknown host', 90, 300, 'user', '198.51.100.7'),
        n('ec2', 'Web EC2', 560, 190, 'compute', 'eni-0a1'),
      ],
      edges: [e('u', 'user', 'ec2', { label: 'TCP 443' }), e('a', 'admin', 'ec2', { label: 'TCP 22' }), e('b', 'bad', 'ec2', { label: 'TCP 22' })],
      steps: [
        { title: 'HTTPS from anyone – allowed', text: 'Rule "443 from 0.0.0.0/0" matches. Packet allowed.', packets: [p('u', 'blue', ':443')] },
        { title: 'Response is automatic (stateful)', text: 'The security group remembers the connection, so the response is allowed out regardless of outbound rules.', packets: [r('u', 'green', 'response')] },
        { title: 'SSH from your IP – allowed', text: 'Rule "22 from 203.0.113.10/32" matches the source.', packets: [p('a', 'blue', ':22')] },
        { title: 'SSH from an unknown host – dropped', text: 'No rule allows port 22 from 198.51.100.7. Security groups have no deny rules – anything not allowed is silently dropped.', packets: [p('b', 'red', ':22', { dropAt: 0.8 })] },
        { title: 'Best practice', text: 'Prefer Session Manager over open SSH, and reference other security groups (e.g. allow 443 only from alb-sg) to build tiers.', focus: ['sg'] },
      ],
    },
    {
      id: 'm5-nacl',
      title: '5 · How Network ACLs work (stateless)',
      description: 'Ordered rules at the subnet boundary – return traffic needs its own rule',
      width: 820,
      height: 380,
      groups: [g('sub', 'Public subnet 10.0.1.0/24', 470, 60, 330, 280, 'public')],
      nodes: [
        n('client', 'Client', 90, 120, 'user', '203.0.113.9:50123'),
        n('blocked', 'Blocked range', 90, 290, 'user', '198.51.100.0/24'),
        n('nacl', 'Network ACL', 360, 200, 'security', 'stateless', { icon: 'list', w: 120 }),
        n('web', 'Web EC2', 650, 200, 'compute', '10.0.1.10:443'),
        n('rules', 'Inbound: 100 deny 198.51.100.0/24 · 110 allow 443 · * deny', 360, 50, 'security', 'Outbound: 100 allow 1024-65535 · * deny', { w: 330, icon: 'file' }),
      ],
      edges: [e('c-n', 'client', 'nacl'), e('b-n', 'blocked', 'nacl'), e('n-w', 'nacl', 'web')],
      steps: [
        { title: 'Inbound request', text: 'Client sends to port 443. NACL rules are checked in order: rule 100 (deny 198.51.100.0/24) doesn’t match; rule 110 allows 443.', packets: [p('c-n', 'blue', ':443', { span: 0.4 }), p('n-w', 'blue', ':443', { at: 0.4, span: 0.4 })], focus: ['rules'] },
        { title: 'Outbound response checked separately', text: 'NACLs are stateless – the response to port 50123 must be allowed by an outbound rule. Rule 100 allows ephemeral ports 1024–65535.', packets: [r('n-w', 'green', '→ :50123', { span: 0.4 }), r('c-n', 'green', undefined, { at: 0.4, span: 0.4 })] },
        { title: 'Deny rule wins by order', text: 'A request from 198.51.100.7 matches rule 100 (deny) first and is dropped before rule 110 is evaluated. NACLs can block specific IPs – security groups cannot.', packets: [p('b-n', 'red', ':443', { dropAt: 0.85 })], focus: ['nacl'] },
        { title: 'Common mistake', text: 'If you forget the outbound ephemeral-port rule, requests get in but responses are dropped and clients time out. The default NACL allows all traffic in both directions, so this only bites with custom NACLs.', set: { nacl: 'warn' } },
      ],
    },
    baseVpc('m5-subnets', '6 · Traffic between two subnets', 'Web tier → app tier → database inside the VPC', [
      { title: 'Web server calls the app tier', text: 'The web server (10.0.1.10) sends a request to 10.0.2.20.', packets: [p('web-app', 'blue', 'dst 10.0.2.20:8080')] },
      { title: 'Local route matches', text: '10.0.2.20 falls inside 10.0.0.0/16, so the local route is selected (longest prefix that matches). Traffic stays inside the VPC – no gateway involved.', focus: ['rtpub'], log: 'Route lookup: 10.0.2.20 → 10.0.0.0/16 → local' },
      { title: 'Security group references', text: 'The app security group allows 8080 only from web-sg. Because the source ENI has web-sg, the packet is allowed.', focus: ['app'], badges: { app: 'allow from web-sg' } },
      { title: 'App queries the database', text: 'Same local route. The DB security group allows 5432 only from app-sg.', packets: [p('app-db', 'purple', ':5432')] },
      { title: 'Responses return', text: 'Responses flow back along the same path; stateful security groups allow them automatically.', packets: [r('app-db', 'green', undefined, { span: 0.4 }), r('web-app', 'green', undefined, { at: 0.4, span: 0.4 })] },
    ]),
  ],
  experiment: 'vpc-lab',
  experimentTitle: 'VPC network simulator',
  experimentBlurb: 'Two tools: a packet-path tester that evaluates real route-table longest-prefix matching, NACLs and security groups; and a drag-and-drop VPC builder that checks your design.',
  code: [
    {
      title: 'Route tables for a public/private design',
      lang: 'text',
      code: `Public route table (associated with public subnets)
Destination      Target
10.0.0.0/16      local
0.0.0.0/0        igw-0a1b2c3d

Private route table – AZ a (associated with private subnet in AZ a)
Destination      Target
10.0.0.0/16      local
0.0.0.0/0        nat-0aaa1111   # NAT Gateway in public subnet AZ a
pl-63a5400a      vpce-0s3...    # S3 gateway endpoint (prefix list)`,
    },
  ],
  realWorld: {
    title: 'Three-tier web application network',
    story: 'An e-commerce company uses a /16 VPC across three AZs. Each AZ has a public subnet (ALB nodes and a NAT Gateway), a private application subnet (EC2/ECS) and a private database subnet (RDS). Only the ALB is internet-facing. The app tier reaches S3 through a free gateway endpoint, and outbound API calls through the NAT Gateway in its own AZ.',
    points: ['Subnets per tier, per AZ', 'One NAT Gateway per AZ avoids cross-AZ dependency', 'Security groups chained: alb-sg → app-sg → db-sg'],
  },
  limits: ['Subnet CIDRs cannot be resized after creation.', 'VPC peering is not transitive and does not support overlapping CIDRs.', 'Security groups: default quota of 60 inbound and 60 outbound rules per group.', 'Data processed by NAT Gateways is charged per GB – use gateway endpoints for S3/DynamoDB traffic.'],
  summary: ['A VPC is Regional; subnets are zonal.', 'Public vs private is decided by the route table (route to IGW or not).', 'Longest prefix match selects the route; the local route keeps VPC traffic internal.', 'NAT Gateway = outbound-only internet for private subnets.', 'Security groups: stateful, allow-only, per ENI. NACLs: stateless, ordered allow/deny, per subnet.'],
  related: ['vpc', 'subnet', 'igw', 'nat-gateway', 'security-groups', 'nacl', 'vpc-endpoints', 'vpc-peering', 'transit-gateway'],
  quiz: [
    { q: 'What makes a subnet "public"?', options: ['It has the word public in its name', 'Its route table has a route to an Internet Gateway', 'It has a NAT Gateway route', 'Its NACL allows all traffic'], answer: 1, explain: 'A public subnet is one whose associated route table sends internet-bound traffic to an IGW.', why: ['Names are just tags.', '', 'A NAT route makes it a private subnet with outbound access.', 'NACLs filter; they do not provide a path.'] },
    { q: 'A route table has 10.0.0.0/16 → local, 172.16.0.0/16 → pcx-123 (peering), 172.16.5.0/24 → tgw-456 and 0.0.0.0/0 → igw. Where does traffic to 172.16.5.9 go?', options: ['local', 'pcx-123 (peering)', 'tgw-456 (Transit Gateway)', 'igw'], answer: 2, explain: 'Longest prefix match: 172.16.5.0/24 is more specific than 172.16.0.0/16 and 0.0.0.0/0, so the Transit Gateway route wins.', why: ['172.16.5.9 is outside the VPC CIDR 10.0.0.0/16.', 'It matches, but /16 is less specific than /24.', '', '0.0.0.0/0 matches everything but is the least specific route.'] },
    { q: 'Instances in a private subnet need to download OS patches from the internet. What do you add?', options: ['An Internet Gateway route in the private route table', 'A NAT Gateway in a public subnet and a 0.0.0.0/0 route to it', 'An Elastic IP on each instance', 'A VPC peering connection'], answer: 1, explain: 'A NAT Gateway provides outbound-only internet access for private subnets.' },
    { q: 'You allow inbound 443 in a custom NACL but clients time out. Inbound traffic reaches the instance. What is the likely cause?', options: ['Security groups are stateless', 'The NACL is missing an outbound rule for ephemeral ports', 'The IGW is full', 'The instance needs an ENI'], answer: 1, explain: 'NACLs are stateless; responses go to the client’s ephemeral port and need an outbound allow rule.' },
    { q: 'Which statement about security groups is true?', options: ['They support deny rules', 'They are evaluated in rule-number order', 'They are stateful and allow-only', 'They are applied at the subnet level'], answer: 2, explain: 'Security groups are stateful, allow-only and attached to network interfaces. NACLs are ordered, stateless and subnet-level.' },
    { q: 'How many IP addresses are usable in a /24 subnet in a VPC?', options: ['256', '254', '251', '250'], answer: 2, explain: 'AWS reserves 5 addresses in each subnet (first four and the last), leaving 251.' },
    { q: 'VPC A peers with B and B peers with C. Can A reach C through B?', options: ['Yes, peering is transitive', 'No, peering is not transitive – use a direct peering or Transit Gateway', 'Only for IPv6', 'Only if the CIDRs overlap'], answer: 1, explain: 'VPC peering is not transitive. Transit Gateway provides hub-and-spoke transitive routing.' },
  ],
  docs: [
    { label: 'Amazon VPC User Guide', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html' },
    { label: 'Route tables', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html' },
    { label: 'Compare security groups and network ACLs', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html' },
    { label: 'NAT gateways', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html' },
  ],
};
