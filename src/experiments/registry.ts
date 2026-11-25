import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Interactive experiments are code-split so each module page only loads its own simulator. */
export const EXPERIMENTS: Record<string, LazyExoticComponent<ComponentType>> = {
  'cloud-scaling': lazy(() => import('./CloudScaling')),
  'region-explorer': lazy(() => import('./RegionExplorer')),
  'iam-simulator': lazy(() => import('./IamSimulator')),
  'ec2-simulator': lazy(() => import('./Ec2Simulator')),
  'vpc-lab': lazy(() => import('./VpcLab')),
  's3-simulator': lazy(() => import('./S3Simulator')),
  'lb-simulator': lazy(() => import('./LbSimulator')),
  'dns-simulator': lazy(() => import('./DnsSimulator')),
  'db-simulator': lazy(() => import('./DbSimulator')),
  'lambda-simulator': lazy(() => import('./LambdaSimulator')),
  'cloudwatch-dashboard': lazy(() => import('./CloudWatchDashboard')),
  'messaging-simulator': lazy(() => import('./MessagingSimulator')),
  'security-lab': lazy(() => import('./SecurityLab')),
  'containers-lab': lazy(() => import('./ContainersLab')),
  'connectivity-lab': lazy(() => import('./ConnectivityLab')),
  'cicd-simulator': lazy(() => import('./CicdSimulator')),
};
