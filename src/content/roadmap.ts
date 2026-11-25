/**
 * Recommended beginner → intermediate learning path.
 * Each stage groups one or more modules (and optionally lab pages).
 */
export interface RoadmapStage {
  step: number;
  title: string;
  why: string;
  modules: string[];
  extras?: { label: string; to: string }[];
}

export const ROADMAP: RoadmapStage[] = [
  { step: 1, title: 'Cloud fundamentals', why: 'Vocabulary and mental model for everything else: elasticity, HA, pricing.', modules: ['cloud-fundamentals'] },
  { step: 2, title: 'Global infrastructure', why: 'Regions and AZs determine availability and latency of every design.', modules: ['global-infrastructure'] },
  { step: 3, title: 'IAM', why: 'Every API call is authorised by IAM – learn it before creating resources.', modules: ['iam'] },
  { step: 4, title: 'EC2', why: 'The core compute building block; many services are built on it.', modules: ['ec2'] },
  { step: 5, title: 'VPC', why: 'Networking is where most real-world problems hide.', modules: ['vpc'] },
  { step: 6, title: 'S3', why: 'Durable object storage used by nearly every architecture.', modules: ['s3'] },
  { step: 7, title: 'Load balancing & DNS', why: 'Make applications highly available and reachable by name.', modules: ['load-balancing', 'route53'] },
  { step: 8, title: 'Databases', why: 'Pick the right managed database and make it resilient.', modules: ['databases'] },
  { step: 9, title: 'Serverless & messaging', why: 'Event-driven designs that scale automatically and decouple components.', modules: ['serverless', 'messaging'] },
  { step: 10, title: 'Monitoring', why: 'See what your systems are doing and who changed what.', modules: ['monitoring'] },
  { step: 11, title: 'Security', why: 'Shared responsibility and defence in depth.', modules: ['security'] },
  { step: 12, title: 'Containers', why: 'Modern packaging and orchestration with ECS, EKS and Fargate.', modules: ['containers'] },
  { step: 13, title: 'DevOps', why: 'Automate builds, infrastructure and safe deployments.', modules: ['devops'] },
  {
    step: 14,
    title: 'Architecture',
    why: 'Combine everything: hybrid networking, real-world scenarios and your own designs.',
    modules: ['networking'],
    extras: [
      { label: 'Scenario Lab', to: '/scenarios' },
      { label: 'Architecture Playground', to: '/playground' },
      { label: 'Cost Explorer', to: '/cost' },
    ],
  },
];
