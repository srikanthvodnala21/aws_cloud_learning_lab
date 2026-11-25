import type { LearningModule } from '../../types';
import { e, g, n, p, r } from '../../animation/builders';

export const ec2: LearningModule = {
  id: 'ec2',
  num: 4,
  title: 'EC2 – Elastic Compute Cloud',
  short: 'EC2',
  icon: 'server',
  level: 'Beginner',
  minutes: 50,
  intro:
    'Amazon EC2 provides virtual servers called instances. You choose an AMI (the operating system image), an instance type (how many vCPUs and how much memory), storage (EBS volumes), networking (VPC, subnet, security groups) and you are running in minutes. You pay per second (Linux, with a 60-second minimum) or per hour while the instance is running.',
  analogy: 'An AMI is a cookie cutter, an instance is a cookie, the instance type is the size of the cookie and EBS is the plate it sits on – you can move the plate to another cookie in the same kitchen (AZ).',
  concepts: [
    { term: 'EC2 instance', body: 'A virtual machine running on AWS hardware (the AWS Nitro System). It lives in one subnet, therefore in one Availability Zone.' },
    { term: 'Instance families', body: 'Groups of instance types optimised for a workload: General purpose (M, T), Compute optimised (C), Memory optimised (R, X), Storage optimised (I, D), Accelerated computing (P, G, Inf, Trn). The generation number and suffix letters add detail, e.g. m7g = general purpose, 7th gen, Graviton (g).' },
    { term: 'Instance types', body: 'A specific size inside a family, e.g. t3.micro (2 vCPU, 1 GiB) or m6i.large (2 vCPU, 8 GiB). Sizes double as you go up (large → xlarge → 2xlarge…). You cannot set CPU and memory arbitrarily – you pick the type whose ratio fits.' },
    { term: 'Burstable (T) instances', body: 'T instances earn CPU credits while idle and spend them to burst above a baseline. In unlimited mode (default for T3/T4g) sustained bursting above baseline can incur extra charges.' },
    { term: 'AMI (Amazon Machine Image)', body: 'A template containing the root volume snapshot, launch permissions and block device mapping. Use AWS-provided AMIs (Amazon Linux 2023, Ubuntu, Windows Server), Marketplace AMIs or your own "golden" AMIs. AMIs are Regional.' },
    { term: 'EBS volumes', body: 'Network-attached block storage that persists independently of the instance. Lives in one AZ; snapshots go to S3 (Regional) and can be copied. Types: gp3 (general SSD, default choice), io2 (provisioned IOPS), st1/sc1 (throughput/cold HDD).', facts: ['Instance store = physically attached, very fast, but data is lost on stop/terminate'] },
    { term: 'Security groups', body: 'A stateful virtual firewall on the instance’s network interface. Only allow rules; return traffic is automatically allowed. Default: all inbound denied, all outbound allowed.' },
    { term: 'Key pairs', body: 'Public/private key pair for SSH (Linux) or decrypting the Windows admin password. AWS keeps the public key; you download the private key once. EC2 Instance Connect and Systems Manager Session Manager are alternatives that avoid managing keys or opening port 22.' },
    { term: 'Elastic IP', body: 'A static public IPv4 address you allocate to your account and associate with an instance. A normal auto-assigned public IP changes when the instance is stopped and started. Note: AWS charges for all public IPv4 addresses, including Elastic IPs.' },
    { term: 'User data', body: 'A script passed at launch that runs (by default once, on first boot, as root via cloud-init) – used to install packages and configure the instance automatically.' },
    { term: 'Instance lifecycle', body: 'pending → running → stopping → stopped → (start) pending… or shutting-down → terminated. Reboot keeps the same host and data. Stop/start may move to new hardware: instance-store data is lost, EBS data persists. You are not billed for instance usage while stopped (EBS storage is still billed).' },
    { term: 'Auto Scaling', body: 'EC2 Auto Scaling groups launch instances from a launch template, keep a desired count between min and max across AZs, replace unhealthy instances and scale with policies. See Module 7.' },
    { term: 'Purchase options', body: 'On-Demand (no commitment), Savings Plans and Reserved Instances (1 or 3-year commitment for a discount), Spot (spare capacity at a large discount, can be interrupted with a 2-minute notice), Dedicated Hosts/Instances (isolation, licensing).' },
  ],
  animations: [
    {
      id: 'm4-launch',
      title: 'What happens when an EC2 instance launches',
      description: 'Relationship between VPC, subnet, security group, instance and EBS.',
      width: 820,
      height: 400,
      groups: [g('reg', 'Region', 170, 20, 630, 360, 'region'), g('vpc', 'VPC 10.0.0.0/16', 190, 50, 590, 310, 'vpc'), g('sub', 'Public subnet 10.0.1.0/24 – AZ a', 300, 90, 330, 250, 'public'), g('sg', 'Security group web-sg', 330, 125, 270, 120, 'generic')],
      nodes: [
        n('you', 'You', 80, 200, 'user', 'console / CLI'),
        n('ami', 'AMI', 240, 300, 'compute', 'Amazon Linux 2023', { icon: 'layers', w: 90 }),
        n('ec2', 'EC2 instance', 465, 185, 'compute', 't3.micro · 10.0.1.25'),
        n('ebs', 'EBS gp3 root', 465, 295, 'storage', '8 GiB'),
        n('eni', 'ENI', 700, 185, 'network', 'eth0 + public IP', { w: 110 }),
      ],
      edges: [e('y-ami', 'you', 'ami', { dashed: true }), e('ami-ec2', 'ami', 'ec2', { label: 'launch from' }), e('ec2-ebs', 'ec2', 'ebs', { label: 'attached' }), e('ec2-eni', 'ec2', 'eni', { plain: true })],
      initial: { ec2: 'hidden', ebs: 'hidden', eni: 'hidden', sg: 'off' },
      steps: [
        { title: 'Choose an AMI', text: 'The AMI defines the OS and pre-installed software. Its snapshot becomes your root volume.', packets: [p('y-ami', 'blue', 'select')], focus: ['ami'] },
        { title: 'Pick the network location', text: 'The instance must go in a subnet in a VPC. The subnet determines the AZ (here AZ a) and the private IP range.', focus: ['vpc', 'sub'] },
        { title: 'Create the root EBS volume', text: 'EC2 creates a gp3 volume from the AMI snapshot in the same AZ.', set: { ebs: 'new' } },
        { title: 'Start the instance – pending', text: 'Capacity is reserved on a host; the instance enters the pending state and gets a private IP from the subnet.', set: { ec2: 'new' }, packets: [p('ami-ec2', 'orange', 'image')], badges: { ec2: 'pending' } },
        { title: 'Attach network interface', text: 'An Elastic Network Interface (ENI) with the private IP (and a public IP, because this subnet auto-assigns them) is attached.', set: { eni: 'new' } },
        { title: 'Apply security group', text: 'The security group (allowing inbound 443 from anywhere, 22 from your IP) is applied to the ENI.', set: { sg: 'ok' }, focus: ['sg'] },
        { title: 'Boot and run user data – running', text: 'The OS boots from EBS. cloud-init runs your user data script (e.g. install nginx). Status checks pass and billing starts.', set: { ec2: 'ok', ebs: 'ok', eni: 'ok' }, packets: [p('ec2-ebs', 'green', 'boot')], badges: { ec2: 'running' }, log: 'i-0a12… running · system status ok · instance status ok' },
      ],
    },
    {
      id: 'm4-lifecycle',
      title: 'Instance lifecycle states',
      width: 820,
      height: 330,
      nodes: [
        n('pending', 'pending', 100, 160, 'compute', 'booting', { w: 100 }),
        n('running', 'running', 290, 160, 'compute', 'billed', { w: 100 }),
        n('stopping', 'stopping', 470, 70, 'compute', '', { w: 100 }),
        n('stopped', 'stopped', 660, 70, 'compute', 'EBS still billed', { w: 120 }),
        n('reboot', 'rebooting', 290, 290, 'compute', 'same host', { w: 100 }),
        n('shut', 'shutting-down', 470, 250, 'compute', '', { w: 120 }),
        n('term', 'terminated', 660, 250, 'compute', 'gone', { w: 110 }),
      ],
      edges: [e('p-r', 'pending', 'running'), e('r-s', 'running', 'stopping'), e('s-st', 'stopping', 'stopped'), e('st-p', 'stopped', 'pending', { curve: -90, label: 'start' }), e('r-rb', 'running', 'reboot', { both: true }), e('r-sh', 'running', 'shut'), e('sh-t', 'shut', 'term'), e('st-t', 'stopped', 'term', { dashed: true })],
      steps: [
        { title: 'Launch → pending', text: 'The instance is being prepared. Not yet billed.', focus: ['pending'] },
        { title: 'running', text: 'Ready for use. Instance usage billing is active.', packets: [p('p-r', 'green')], focus: ['running'] },
        { title: 'Reboot', text: 'Like restarting a PC: same host, keeps public IP, instance-store data and EBS data.', packets: [p('r-rb', 'blue', 'reboot'), r('r-rb', 'blue', undefined, { at: 0.45, span: 0.35 })] },
        { title: 'Stop', text: 'The OS shuts down. EBS volumes persist (and are still billed). The auto-assigned public IP is released; instance-store data is lost.', packets: [p('r-s', 'orange'), p('s-st', 'orange', undefined, { at: 0.4 })], focus: ['stopped'] },
        { title: 'Start again', text: 'Starting usually places the instance on new hardware. It keeps its private IP and EBS data but gets a new public IP (unless you use an Elastic IP).', packets: [p('st-p', 'blue', 'start')], focus: ['pending'] },
        { title: 'Terminate', text: 'Permanent deletion. Root EBS volumes are deleted by default (DeleteOnTermination = true); additional volumes are kept unless configured otherwise.', packets: [p('r-sh', 'red'), p('sh-t', 'red', undefined, { at: 0.4 })], set: { term: 'fail' } },
      ],
    },
    {
      id: 'm4-failure',
      title: 'Instance failure and recovery',
      width: 820,
      height: 340,
      groups: [g('aza', 'AZ a', 220, 40, 220, 260, 'az'), g('azb', 'AZ b', 470, 40, 220, 260, 'az')],
      nodes: [
        n('cw', 'CloudWatch', 90, 80, 'monitoring', 'status checks'),
        n('asg', 'Auto Scaling', 90, 240, 'monitoring', 'desired = 2', { icon: 'scale' }),
        n('i1', 'Instance 1', 330, 120, 'compute', 'web'),
        n('i2', 'Instance 2', 580, 120, 'compute', 'web'),
        n('i3', 'Instance 3', 330, 240, 'compute', 'replacement'),
        n('host', 'Underlying host', 760, 240, 'generic', 'AWS hardware', { icon: 'cpu', w: 110 }),
      ],
      edges: [e('c-1', 'cw', 'i1', { dashed: true }), e('c-2', 'cw', 'i2', { dashed: true, curve: -40 }), e('a-3', 'asg', 'i3'), e('a-1', 'asg', 'i1', { dashed: true })],
      initial: { i3: 'hidden' },
      steps: [
        { title: 'Status checks', text: 'EC2 runs system status checks (AWS hardware/network) and instance status checks (your OS) every minute.', packets: [p('c-1', 'teal', 'check'), p('c-2', 'teal', 'check', { at: 0.1 })] },
        { title: 'Instance becomes impaired', text: 'Instance 1 fails its instance status check (e.g. kernel panic, out of memory).', set: { i1: 'fail' }, log: 'StatusCheckFailed_Instance = 1 for i-1' },
        { title: 'Auto Scaling marks it unhealthy', text: 'Because the instance is part of an Auto Scaling group, it is marked unhealthy and terminated.', packets: [p('a-1', 'red', 'terminate')], set: { i1: 'off' } },
        { title: 'Replacement launched', text: 'The group launches a fresh instance from the launch template to return to the desired capacity of 2.', set: { i3: 'new', i1: 'hidden' }, packets: [p('a-3', 'green', 'launch')], log: 'Launching a new EC2 instance: i-3' },
        { title: 'Lesson: design for failure', text: 'Treat instances as cattle, not pets: keep state outside (RDS, S3, EFS), launch from templates, and let automation replace failed instances. For single instances, EC2 automatic recovery can move the instance to healthy hardware on system status check failures.', set: { i3: 'ok' } },
      ],
    },
  ],
  experiment: 'ec2-simulator',
  experimentTitle: 'EC2 launch simulator',
  experimentBlurb: 'Configure and launch an instance, change its security group, stop/start it and simulate a hardware failure.',
  code: [
    {
      title: 'User data: install and start a web server (Amazon Linux 2023)',
      lang: 'bash',
      code: `#!/bin/bash
# Runs once as root on first boot (cloud-init)
dnf update -y
dnf install -y nginx
echo "<h1>Hello from $(hostname -f)</h1>" > /usr/share/nginx/html/index.html
systemctl enable --now nginx`,
    },
    {
      title: 'AWS CLI: launch an instance',
      lang: 'bash',
      code: `aws ec2 run-instances \\
  --image-id ami-0123456789abcdef0 \\
  --instance-type t3.micro \\
  --subnet-id subnet-0abc1234 \\
  --security-group-ids sg-0def5678 \\
  --iam-instance-profile Name=web-app-profile \\
  --user-data file://user-data.sh \\
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-1}]'`,
    },
  ],
  realWorld: {
    title: 'A WordPress site that outgrew one server',
    story: 'A marketing team ran WordPress on a single t3.medium. Image uploads filled the root disk and a kernel update broke the site. They moved uploads to S3, the database to RDS, baked a golden AMI, and ran two smaller instances in an Auto Scaling group across two AZs. Now a broken instance is simply replaced.',
    points: ['Stateless instances are replaceable', 'Right-size with CloudWatch metrics', 'Use Session Manager instead of opening SSH to the world'],
  },
  limits: ['An EBS volume can only attach to instances in the same AZ (Multi-Attach io1/io2 is a special case).', 'vCPU-based On-Demand instance quotas apply per Region; request increases in Service Quotas.', 'Changing instance type requires a stop/start (for EBS-backed instances).'],
  summary: ['An instance = AMI + instance type + storage + network + security group.', 'Instances and EBS volumes are zonal.', 'Security groups are stateful allow-lists.', 'Stopped instances are not billed for compute, but EBS is.', 'Design for failure: make instances replaceable and use Auto Scaling.'],
  related: ['ec2', 'ebs', 'ami', 'security-groups', 'auto-scaling', 'vpc'],
  quiz: [
    { q: 'Which instance family would you choose first for an in-memory analytics workload needing a high memory-to-vCPU ratio?', options: ['C (compute optimised)', 'R (memory optimised)', 'T (burstable)', 'I (storage optimised)'], answer: 1, explain: 'R (and X) families provide the most memory per vCPU.', why: ['C has a low memory-to-CPU ratio.', '', 'T is for spiky, low average CPU.', 'I is for high local disk IOPS.'] },
    { q: 'You stop and start an EBS-backed instance without an Elastic IP. What changes?', options: ['Its private IP', 'Its public IPv4 address', 'The data on its EBS root volume', 'Its instance ID'], answer: 1, explain: 'Auto-assigned public IPv4 addresses are released on stop. The private IP, EBS data and instance ID remain.' },
    { q: 'What happens to data on an instance store volume when the instance is stopped?', options: ['It persists', 'It is lost', 'It moves to S3', 'It is snapshotted'], answer: 1, explain: 'Instance store is ephemeral – data is lost when the instance stops, hibernates or terminates.' },
    { q: 'A security group allows inbound TCP 443. Do you need an outbound rule for the HTTPS responses?', options: ['Yes, for ports 1024–65535', 'No, security groups are stateful', 'Yes, for port 443 outbound', 'Only for IPv6'], answer: 1, explain: 'Security groups track connections; response traffic for allowed inbound requests is automatically allowed.' },
    { q: 'Where does a user data script run?', options: ['On your laptop', 'On the instance at first boot (by default)', 'In AWS Lambda', 'In CloudFormation only'], answer: 1, explain: 'cloud-init executes user data on the instance, by default only on the first boot.' },
    { q: 'An EBS volume is in us-east-1a. Can you attach it to an instance in us-east-1b?', options: ['Yes, any AZ in the Region', 'No – create a snapshot and restore it in us-east-1b', 'Yes, with an Elastic IP', 'Only for gp3'], answer: 1, explain: 'EBS volumes are zonal. Use a snapshot (stored regionally) to create a new volume in another AZ.' },
  ],
  docs: [
    { label: 'Amazon EC2 User Guide', url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html' },
    { label: 'Instance types', url: 'https://aws.amazon.com/ec2/instance-types/' },
    { label: 'Instance lifecycle', url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html' },
  ],
};
