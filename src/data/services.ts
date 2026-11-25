import type { AwsService } from '../types';

/**
 * Service catalog. `scope` describes where the resource lives, which is a
 * common source of exam/design confusion:
 *   Global   – not tied to a single Region (IAM, Route 53, CloudFront…)
 *   Regional – resources live in one Region and AWS spreads them across AZs
 *   Zonal    – a resource lives in a single Availability Zone (EC2 instance, EBS volume, subnet)
 */
export const SERVICES: AwsService[] = [
  // Fundamentals / infrastructure
  { id: 'regions', name: 'Regions & Availability Zones', short: 'Regions/AZs', category: 'Global Infrastructure', scope: 'Global', desc: 'Physical locations around the world. Each Region contains multiple isolated Availability Zones.', module: 'global-infrastructure' },
  { id: 'edge-locations', name: 'Edge Locations', short: 'Edge', category: 'Global Infrastructure', scope: 'Edge', desc: 'Points of presence used by CloudFront, Route 53 and Global Accelerator to get closer to users.', module: 'global-infrastructure' },
  { id: 'local-zones', name: 'Local Zones', short: 'Local Zones', category: 'Global Infrastructure', scope: 'Zonal', desc: 'Extensions of a Region placed in metro areas for single-digit millisecond latency.', module: 'global-infrastructure' },
  { id: 'wavelength', name: 'Wavelength Zones', short: 'Wavelength', category: 'Global Infrastructure', scope: 'Zonal', desc: 'AWS compute and storage embedded in telecom 5G networks.', module: 'global-infrastructure' },

  // Security & identity
  { id: 'iam', name: 'AWS Identity and Access Management', short: 'IAM', category: 'Security, Identity', scope: 'Global', desc: 'Controls who is authenticated and what they are authorized to do.', module: 'iam' },
  { id: 'sts', name: 'AWS Security Token Service', short: 'STS', category: 'Security, Identity', scope: 'Global', desc: 'Issues temporary credentials, e.g. via AssumeRole. Regional endpoints are recommended.', module: 'iam' },
  { id: 'iam-identity-center', name: 'IAM Identity Center', short: 'Identity Center', category: 'Security, Identity', scope: 'Account / Org', desc: 'Workforce single sign-on across AWS accounts (successor to AWS SSO).', module: 'iam' },
  { id: 'kms', name: 'AWS Key Management Service', short: 'KMS', category: 'Security, Identity', scope: 'Regional', desc: 'Create and control encryption keys; integrated with most AWS services.', module: 'security' },
  { id: 'secrets-manager', name: 'AWS Secrets Manager', short: 'Secrets Manager', category: 'Security, Identity', scope: 'Regional', desc: 'Store, retrieve and automatically rotate secrets such as database passwords.', module: 'security' },
  { id: 'parameter-store', name: 'Systems Manager Parameter Store', short: 'Parameter Store', category: 'Security, Identity', scope: 'Regional', desc: 'Hierarchical storage for configuration data and secrets (SecureString via KMS).', module: 'security' },
  { id: 'waf', name: 'AWS WAF', short: 'WAF', category: 'Security, Identity', scope: 'Regional', desc: 'Web application firewall for CloudFront, ALB, API Gateway and more (CloudFront web ACLs are global).', module: 'security' },
  { id: 'shield', name: 'AWS Shield', short: 'Shield', category: 'Security, Identity', scope: 'Global', desc: 'DDoS protection. Shield Standard is automatic at no extra cost; Shield Advanced is a paid tier.', module: 'security' },
  { id: 'guardduty', name: 'Amazon GuardDuty', short: 'GuardDuty', category: 'Security, Identity', scope: 'Regional', desc: 'Threat detection that analyses CloudTrail, VPC Flow Logs, DNS logs and more.', module: 'security' },
  { id: 'security-hub', name: 'AWS Security Hub', short: 'Security Hub', category: 'Security, Identity', scope: 'Regional', desc: 'Aggregates security findings and runs posture checks against best-practice standards.', module: 'security' },
  { id: 'organizations', name: 'AWS Organizations', short: 'Organizations', category: 'Management', scope: 'Account / Org', desc: 'Centrally manage multiple AWS accounts, consolidated billing and Service Control Policies.', module: 'security' },

  // Compute
  { id: 'ec2', name: 'Amazon EC2', short: 'EC2', category: 'Compute', scope: 'Zonal', desc: 'Resizable virtual servers (instances) running in a subnet in one Availability Zone.', module: 'ec2' },
  { id: 'ebs', name: 'Amazon EBS', short: 'EBS', category: 'Storage', scope: 'Zonal', desc: 'Block storage volumes attached to EC2 instances in the same Availability Zone.', module: 'ec2' },
  { id: 'ami', name: 'Amazon Machine Image', short: 'AMI', category: 'Compute', scope: 'Regional', desc: 'Template (OS + software + config) used to launch instances. AMIs are Regional; copy them to use elsewhere.', module: 'ec2' },
  { id: 'auto-scaling', name: 'Amazon EC2 Auto Scaling', short: 'Auto Scaling', category: 'Compute', scope: 'Regional', desc: 'Keeps the right number of instances running, across AZs, and replaces unhealthy ones.', module: 'load-balancing' },
  { id: 'lambda', name: 'AWS Lambda', short: 'Lambda', category: 'Compute', scope: 'Regional', desc: 'Run code in response to events without managing servers; pay per request and duration.', module: 'serverless' },

  // Networking
  { id: 'vpc', name: 'Amazon VPC', short: 'VPC', category: 'Networking', scope: 'Regional', desc: 'Logically isolated virtual network. A VPC spans all AZs in a Region; subnets are zonal.', module: 'vpc' },
  { id: 'subnet', name: 'Subnets', short: 'Subnet', category: 'Networking', scope: 'Zonal', desc: 'A range of IP addresses in a VPC that lives in exactly one Availability Zone.', module: 'vpc' },
  { id: 'igw', name: 'Internet Gateway', short: 'IGW', category: 'Networking', scope: 'Regional', desc: 'Horizontally scaled, highly available gateway that connects a VPC to the internet.', module: 'vpc' },
  { id: 'nat-gateway', name: 'NAT Gateway', short: 'NAT GW', category: 'Networking', scope: 'Zonal', desc: 'Lets resources in private subnets initiate outbound IPv4 connections. Created in a specific AZ.', module: 'vpc' },
  { id: 'security-groups', name: 'Security Groups', short: 'Security Group', category: 'Networking', scope: 'Regional', desc: 'Stateful virtual firewall attached to network interfaces. Allow rules only.', module: 'vpc' },
  { id: 'nacl', name: 'Network ACLs', short: 'NACL', category: 'Networking', scope: 'Regional', desc: 'Stateless subnet-level firewall with numbered allow and deny rules.', module: 'vpc' },
  { id: 'vpc-endpoints', name: 'VPC Endpoints', short: 'VPC Endpoint', category: 'Networking', scope: 'Regional', desc: 'Private connectivity to AWS services: gateway endpoints (S3, DynamoDB) and interface endpoints (PrivateLink).', module: 'vpc' },
  { id: 'vpc-peering', name: 'VPC Peering', short: 'Peering', category: 'Networking', scope: 'Regional', desc: 'Private routing between two VPCs. Not transitive; CIDRs must not overlap.', module: 'networking' },
  { id: 'transit-gateway', name: 'AWS Transit Gateway', short: 'Transit GW', category: 'Networking', scope: 'Regional', desc: 'Regional hub that connects many VPCs and on-premises networks.', module: 'networking' },
  { id: 'direct-connect', name: 'AWS Direct Connect', short: 'Direct Connect', category: 'Networking', scope: 'Hybrid', desc: 'Dedicated private network connection from your premises to AWS.', module: 'networking' },
  { id: 'site-to-site-vpn', name: 'AWS Site-to-Site VPN', short: 'S2S VPN', category: 'Networking', scope: 'Hybrid', desc: 'Encrypted IPsec tunnels over the internet between your network and AWS.', module: 'networking' },
  { id: 'privatelink', name: 'AWS PrivateLink', short: 'PrivateLink', category: 'Networking', scope: 'Regional', desc: 'Expose or consume services privately through interface endpoints.', module: 'networking' },
  { id: 'cloudfront', name: 'Amazon CloudFront', short: 'CloudFront', category: 'Networking', scope: 'Global', desc: 'Content delivery network that caches content at edge locations.', module: 'networking' },
  { id: 'global-accelerator', name: 'AWS Global Accelerator', short: 'Global Accelerator', category: 'Networking', scope: 'Global', desc: 'Static anycast IPs that route users over the AWS global network to healthy endpoints.', module: 'networking' },
  { id: 'route53', name: 'Amazon Route 53', short: 'Route 53', category: 'Networking', scope: 'Global', desc: 'Highly available DNS service, domain registration and health checking.', module: 'route53' },
  { id: 'alb', name: 'Application Load Balancer', short: 'ALB', category: 'Networking', scope: 'Regional', desc: 'Layer 7 (HTTP/HTTPS) load balancer with path and host-based routing.', module: 'load-balancing' },
  { id: 'nlb', name: 'Network Load Balancer', short: 'NLB', category: 'Networking', scope: 'Regional', desc: 'Layer 4 (TCP/UDP/TLS) load balancer for very high throughput and static IPs.', module: 'load-balancing' },
  { id: 'gwlb', name: 'Gateway Load Balancer', short: 'GWLB', category: 'Networking', scope: 'Regional', desc: 'Layer 3 load balancer for third-party virtual appliances (firewalls, IDS) using GENEVE.', module: 'load-balancing' },
  { id: 'api-gateway', name: 'Amazon API Gateway', short: 'API Gateway', category: 'Networking', scope: 'Regional', desc: 'Create, publish and secure REST, HTTP and WebSocket APIs.', module: 'serverless' },

  // Storage
  { id: 's3', name: 'Amazon S3', short: 'S3', category: 'Storage', scope: 'Regional', desc: 'Object storage. Bucket names are globally unique but each bucket lives in one Region.', module: 's3' },
  { id: 's3-glacier', name: 'S3 Glacier storage classes', short: 'Glacier', category: 'Storage', scope: 'Regional', desc: 'Low-cost archive storage classes inside S3 (Instant, Flexible, Deep Archive).', module: 's3' },
  { id: 'efs', name: 'Amazon EFS', short: 'EFS', category: 'Storage', scope: 'Regional', desc: 'Managed NFS file system that many instances across AZs can mount at once.', module: 's3' },

  // Databases
  { id: 'rds', name: 'Amazon RDS', short: 'RDS', category: 'Database', scope: 'Regional', desc: 'Managed relational databases: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Db2.', module: 'databases' },
  { id: 'aurora', name: 'Amazon Aurora', short: 'Aurora', category: 'Database', scope: 'Regional', desc: 'Cloud-native MySQL/PostgreSQL-compatible database with storage replicated across 3 AZs.', module: 'databases' },
  { id: 'dynamodb', name: 'Amazon DynamoDB', short: 'DynamoDB', category: 'Database', scope: 'Regional', desc: 'Serverless key-value and document database with single-digit millisecond performance.', module: 'databases' },
  { id: 'elasticache', name: 'Amazon ElastiCache', short: 'ElastiCache', category: 'Database', scope: 'Regional', desc: 'Managed in-memory caching with Valkey, Redis OSS or Memcached.', module: 'databases' },

  // Integration
  { id: 'sqs', name: 'Amazon SQS', short: 'SQS', category: 'Application Integration', scope: 'Regional', desc: 'Fully managed message queues (Standard and FIFO).', module: 'messaging' },
  { id: 'sns', name: 'Amazon SNS', short: 'SNS', category: 'Application Integration', scope: 'Regional', desc: 'Pub/sub messaging: one message fans out to many subscribers.', module: 'messaging' },
  { id: 'eventbridge', name: 'Amazon EventBridge', short: 'EventBridge', category: 'Application Integration', scope: 'Regional', desc: 'Serverless event bus that routes events to targets with pattern-matching rules.', module: 'messaging' },
  { id: 'kinesis', name: 'Amazon Kinesis Data Streams', short: 'Kinesis', category: 'Analytics', scope: 'Regional', desc: 'Real-time data streaming with ordered shards and replay.', module: 'messaging' },

  // Monitoring
  { id: 'cloudwatch', name: 'Amazon CloudWatch', short: 'CloudWatch', category: 'Management', scope: 'Regional', desc: 'Metrics, logs, alarms and dashboards for your resources and applications.', module: 'monitoring' },
  { id: 'cloudtrail', name: 'AWS CloudTrail', short: 'CloudTrail', category: 'Management', scope: 'Regional', desc: 'Records API calls (who did what, when, from where) for auditing.', module: 'monitoring' },
  { id: 'config', name: 'AWS Config', short: 'Config', category: 'Management', scope: 'Regional', desc: 'Records resource configuration over time and evaluates compliance rules.', module: 'monitoring' },

  // Containers
  { id: 'ecr', name: 'Amazon ECR', short: 'ECR', category: 'Containers', scope: 'Regional', desc: 'Managed container image registry.', module: 'containers' },
  { id: 'ecs', name: 'Amazon ECS', short: 'ECS', category: 'Containers', scope: 'Regional', desc: 'AWS-native container orchestration using tasks and services.', module: 'containers' },
  { id: 'eks', name: 'Amazon EKS', short: 'EKS', category: 'Containers', scope: 'Regional', desc: 'Managed Kubernetes control plane.', module: 'containers' },
  { id: 'fargate', name: 'AWS Fargate', short: 'Fargate', category: 'Containers', scope: 'Regional', desc: 'Serverless compute engine for containers on ECS and EKS – no nodes to manage.', module: 'containers' },

  // DevOps
  { id: 'codecommit', name: 'AWS CodeCommit', short: 'CodeCommit', category: 'Developer Tools', scope: 'Regional', desc: 'Managed Git hosting. AWS paused new-customer onboarding in 2024; check current docs for its status.', module: 'devops' },
  { id: 'codebuild', name: 'AWS CodeBuild', short: 'CodeBuild', category: 'Developer Tools', scope: 'Regional', desc: 'Managed build service that compiles, tests and packages code.', module: 'devops' },
  { id: 'codedeploy', name: 'AWS CodeDeploy', short: 'CodeDeploy', category: 'Developer Tools', scope: 'Regional', desc: 'Automates deployments to EC2, on-premises servers, Lambda and ECS.', module: 'devops' },
  { id: 'codepipeline', name: 'AWS CodePipeline', short: 'CodePipeline', category: 'Developer Tools', scope: 'Regional', desc: 'Continuous delivery service that orchestrates source, build, test and deploy stages.', module: 'devops' },
  { id: 'cloudformation', name: 'AWS CloudFormation', short: 'CloudFormation', category: 'Management', scope: 'Regional', desc: 'Infrastructure as code using JSON/YAML templates and stacks.', module: 'devops' },
  { id: 'cdk', name: 'AWS CDK', short: 'CDK', category: 'Developer Tools', scope: 'Regional', desc: 'Define infrastructure in TypeScript, Python, Java… that synthesises to CloudFormation.', module: 'devops' },
];

export const SERVICE_MAP: Record<string, AwsService> = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
