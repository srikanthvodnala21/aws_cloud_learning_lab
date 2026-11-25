import type { LearningModule } from '../../types';
import { fundamentals } from './m01-fundamentals';
import { globalInfra } from './m02-global';
import { iam } from './m03-iam';
import { ec2 } from './m04-ec2';
import { vpc } from './m05-vpc';
import { s3 } from './m06-s3';
import { loadBalancing } from './m07-lb';
import { route53 } from './m08-route53';
import { databases } from './m09-databases';
import { serverless } from './m10-lambda';
import { monitoring } from './m11-monitoring';
import { messaging } from './m12-messaging';
import { security } from './m13-security';
import { containers } from './m14-containers';
import { networking } from './m15-networking';
import { devops } from './m16-devops';

export const MODULES: LearningModule[] = [
  fundamentals,
  globalInfra,
  iam,
  ec2,
  vpc,
  s3,
  loadBalancing,
  route53,
  databases,
  serverless,
  monitoring,
  messaging,
  security,
  containers,
  networking,
  devops,
];

export const MODULE_MAP: Record<string, LearningModule> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
