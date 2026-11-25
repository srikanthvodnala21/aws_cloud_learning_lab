import type { LearningModule } from '../../types';
import { e, g, n, p } from '../../animation/builders';

export const GITLAB_CI = `# .gitlab-ci.yml – build a container, push to ECR, deploy to ECS
# Uses GitLab OIDC → AWS IAM role (no long-lived AWS keys stored in GitLab)
stages: [test, build, deploy]

variables:
  AWS_REGION: eu-west-1
  AWS_ACCOUNT_ID: "111122223333"
  ECR_REPO: web
  ROLE_ARN: arn:aws:iam::111122223333:role/gitlab-deploy

.aws_auth: &aws_auth
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  before_script:
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn "$ROLE_ARN"
      --role-session-name "gitlab-$CI_PIPELINE_ID"
      --web-identity-token "$GITLAB_OIDC_TOKEN"
      --duration-seconds 3600
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))

unit-tests:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm test

build-image:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  <<: *aws_auth
  script:
    - apk add --no-cache aws-cli
    - aws ecr get-login-password --region $AWS_REGION |
        docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    - docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$CI_COMMIT_SHORT_SHA .
    - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$CI_COMMIT_SHORT_SHA

deploy-infra:
  stage: deploy
  image: hashicorp/terraform:1.9
  <<: *aws_auth
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - terraform init
    - terraform apply -auto-approve -var "image_tag=$CI_COMMIT_SHORT_SHA"
  environment:
    name: production`;

export const GITLAB_TRUST = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::111122223333:oidc-provider/gitlab.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "gitlab.com:aud": "https://gitlab.com" },
        "StringLike": {
          "gitlab.com:sub": "project_path:my-group/my-app:ref_type:branch:ref:main"
        }
      }
    }
  ]
}`;

export const devops: LearningModule = {
  id: 'devops',
  num: 16,
  title: 'AWS DevOps and Deployment',
  short: 'DevOps',
  icon: 'git',
  level: 'Intermediate',
  minutes: 55,
  intro:
    'DevOps on AWS means automating how code and infrastructure move from a developer’s commit to production. CI (continuous integration) builds and tests every change; CD (continuous delivery/deployment) releases it safely. Infrastructure as code (CloudFormation, CDK, Terraform) makes environments reproducible. Deployment strategies – rolling, blue/green, canary – control risk, and automatic rollback limits the damage of a bad release.',
  analogy: 'A CI/CD pipeline is a factory assembly line with quality checkpoints: every product (commit) is assembled (build), inspected (tests), and shipped (deploy). A defective batch triggers an automatic recall (rollback).',
  concepts: [
    { term: 'CodeCommit (legacy note)', body: 'AWS CodeCommit is a managed Git service. In July 2024 AWS stopped onboarding new customers to it, and AWS has since revised its plans for the service – check the current CodeCommit documentation before adopting it. Most teams use GitHub, GitLab or Bitbucket, which integrate with AWS through AWS CodeConnections (formerly CodeStar Connections) or via OIDC from their own CI systems.' },
    { term: 'CodeBuild', body: 'A fully managed build service. A buildspec.yml defines install, pre_build, build and post_build phases; it runs in ephemeral containers, billed per minute, and can build Docker images and run tests.' },
    { term: 'CodeDeploy', body: 'Automates deployments to EC2/on-premises (in-place or blue/green), Lambda (traffic shifting: canary, linear, all-at-once) and ECS (blue/green with ALB). Integrates CloudWatch alarms for automatic rollback. An appspec file defines lifecycle hooks.' },
    { term: 'CodePipeline', body: 'Orchestrates stages (Source → Build → Test → Approval → Deploy) and actions, triggered by source changes. Integrates with CodeBuild, CodeDeploy, CloudFormation, ECS, S3, Lambda and third-party tools.' },
    { term: 'CloudFormation', body: 'AWS’s native infrastructure-as-code. JSON/YAML templates declare resources; CloudFormation creates them as a stack, computes changes with change sets, rolls back on failure, and detects drift.' },
    { term: 'AWS CDK', body: 'Define infrastructure in TypeScript, Python, Java, C# or Go using constructs (high-level, opinionated building blocks). cdk synth produces CloudFormation templates; cdk deploy deploys them.' },
    { term: 'Terraform', body: 'HashiCorp’s IaC tool using HCL and the AWS provider. It keeps state (commonly in an S3 backend with locking), shows a plan, then applies. Multi-cloud and widely used with GitLab CI and GitHub Actions.' },
    { term: 'CI/CD', body: 'Continuous Integration merges and tests changes frequently. Continuous Delivery keeps code always deployable (with a manual approval to production). Continuous Deployment releases every passing change automatically.' },
    { term: 'Rolling deployments', body: 'Replace instances/tasks in batches (e.g. 25% at a time). No extra capacity needed, but old and new versions run together and rollback means rolling back again.' },
    { term: 'Blue/green deployments', body: 'Run the new version (green) alongside the old (blue), test it, then switch traffic (ALB listener, Route 53 weights or CodeDeploy). Rollback is instant – switch back to blue. Costs double capacity temporarily.' },
    { term: 'Canary deployments', body: 'Shift a small percentage of traffic (e.g. 10%) to the new version, watch alarms for a bake period, then shift the rest. Limits the blast radius of a bad release. Lambda aliases, CodeDeploy and ALB weighted target groups support it.' },
    { term: 'Rollback', body: 'Automatic rollback is triggered by failed health checks, failed lifecycle hooks or CloudWatch alarms breaching during the deployment. Keep previous artefacts (immutable image tags, Lambda versions) so you can redeploy them quickly.' },
  ],
  animations: [
    {
      id: 'm16-pipeline',
      title: 'CI/CD pipeline with automatic rollback',
      description: 'Git Repository → Build → Test → Deploy → Production',
      width: 860,
      height: 340,
      groups: [g('prod', 'Production', 610, 40, 230, 270, 'region')],
      nodes: [
        n('git', 'Git repository', 80, 170, 'devops', 'push to main', { w: 120 }),
        n('build', 'Build', 230, 170, 'devops', 'CodeBuild', { icon: 'boxes', w: 100 }),
        n('test', 'Test', 360, 170, 'devops', 'unit + integration', { icon: 'list', w: 110 }),
        n('deploy', 'Deploy', 500, 170, 'devops', 'CodeDeploy', { icon: 'rocket', w: 100 }),
        n('v1', 'v1.3 (current)', 725, 100, 'compute', 'stable', { w: 130 }),
        n('v2', 'v1.4 (new)', 725, 240, 'compute', 'canary 10%', { w: 130 }),
        n('alarm', '5xx alarm', 500, 290, 'monitoring', 'CloudWatch', { icon: 'bell', w: 100 }),
      ],
      edges: [e('g-b', 'git', 'build'), e('b-t', 'build', 'test'), e('t-d', 'test', 'deploy'), e('d-1', 'deploy', 'v1'), e('d-2', 'deploy', 'v2'), e('v2-a', 'v2', 'alarm'), e('a-d', 'alarm', 'deploy', { label: 'rollback' })],
      initial: { v2: 'hidden' },
      steps: [
        { title: 'Commit triggers the pipeline', text: 'A merge to main triggers the pipeline (webhook / CodeConnections).', packets: [p('g-b', 'blue', 'commit a1b2c3')], focus: ['build'] },
        { title: 'Build', text: 'CodeBuild compiles, runs linters and builds an immutable artefact (container image tagged a1b2c3).', packets: [p('b-t', 'blue', 'artefact')], badges: { build: '✓ 2m 10s' } },
        { title: 'Test', text: 'Automated unit and integration tests pass. Optionally a manual approval gate for production.', packets: [p('t-d', 'blue', 'approved')], badges: { test: '✓ 312 tests' } },
        { title: 'Canary deploy', text: 'CodeDeploy shifts 10% of traffic to v1.4 while v1.3 serves 90%.', set: { v2: 'new' }, packets: [p('d-2', 'orange', '10%'), p('d-1', 'blue', '90%', { at: 0.05 })] },
        { title: 'Errors detected', text: 'v1.4 has a bug – the HTTP 5xx alarm breaches during the bake period.', set: { v2: 'fail', alarm: 'fail' }, packets: [p('v2-a', 'red', '5xx ↑')], log: 'Alarm web-5xx → ALARM during deployment d-XYZ' },
        { title: 'Automatic rollback', text: 'CodeDeploy stops the deployment and shifts all traffic back to v1.3. Only 10% of users saw errors, for a few minutes.', packets: [p('a-d', 'red', 'rollback'), p('d-1', 'green', '100%', { at: 0.4 })], set: { v2: 'hidden', v1: 'ok', alarm: 'ok' }, log: 'Deployment d-XYZ: rolled back – traffic restored to v1.3' },
        { title: 'Fix forward', text: 'The team fixes the bug and pushes again; the pipeline repeats, the canary passes, and 100% of traffic moves to the new version.', packets: [p('g-b', 'blue', 'fix', { span: 0.2 }), p('b-t', 'blue', undefined, { at: 0.2, span: 0.2 }), p('t-d', 'blue', undefined, { at: 0.4, span: 0.2 }), p('d-2', 'green', '100%', { at: 0.6, span: 0.25 })], set: { v2: 'ok' } },
      ],
    },
    {
      id: 'm16-bluegreen',
      title: 'Blue/green deployment',
      width: 820,
      height: 340,
      groups: [g('blue', 'Blue environment – v1', 380, 30, 220, 130, 'private'), g('green', 'Green environment – v2', 380, 190, 220, 130, 'public')],
      nodes: [
        n('users', 'Users', 80, 170, 'user'),
        n('alb', 'ALB listener', 240, 170, 'network', 'forward rule', { w: 110 }),
        n('b', 'Blue fleet', 490, 95, 'compute', 'v1'),
        n('gr', 'Green fleet', 490, 255, 'compute', 'v2'),
        n('qa', 'Test traffic', 700, 255, 'user', 'port 8443', { w: 100 }),
      ],
      edges: [e('u-a', 'users', 'alb'), e('a-b', 'alb', 'b'), e('a-g', 'alb', 'gr'), e('q-g', 'qa', 'gr', { dashed: true })],
      initial: { gr: 'hidden' },
      steps: [
        { title: 'Blue serves production', text: 'All traffic goes to blue (v1).', packets: [p('u-a', 'blue', undefined, { span: 0.3 }), p('a-b', 'blue', undefined, { at: 0.3, span: 0.4 })] },
        { title: 'Deploy green', text: 'A complete copy running v2 is created alongside – production is untouched.', set: { gr: 'new' } },
        { title: 'Test green', text: 'Smoke tests hit green via a test listener.', packets: [p('q-g', 'teal', 'smoke test')], set: { gr: 'ok' } },
        { title: 'Switch traffic', text: 'The listener now forwards to green. The switch is near-instant.', set: { 'a-b': 'off' }, packets: [p('u-a', 'blue', undefined, { span: 0.3 }), p('a-g', 'green', undefined, { at: 0.3, span: 0.4 })] },
        { title: 'Instant rollback available', text: 'Keep blue running for a while. If something goes wrong, switch the listener back. Then terminate blue.', focus: ['blue'] },
      ],
    },
  ],
  experiment: 'cicd-simulator',
  experimentTitle: 'Pipeline & deployment strategy simulator',
  experimentBlurb: 'Run a pipeline, inject failures at any stage, and compare rolling, blue/green and canary deployments with live traffic split.',
  code: [
    { title: 'GitLab CI/CD → AWS (OIDC, ECR, Terraform)', lang: 'yaml', code: GITLAB_CI },
    { title: 'IAM role trust policy for GitLab OIDC', lang: 'json', code: GITLAB_TRUST, notes: [{ key: 'Federated', text: 'The IAM OIDC identity provider you create for https://gitlab.com (or your self-managed GitLab URL).' }, { key: 'gitlab.com:sub', text: 'Restricts which project and branch can assume the role. Without it, any GitLab project could request credentials!' }] },
    {
      title: 'CloudFormation (YAML)',
      lang: 'yaml',
      code: `AWSTemplateFormatVersion: '2010-09-09'
Description: Versioned, encrypted S3 bucket
Resources:
  ArtifactsBucket:
    Type: AWS::S3::Bucket
    Properties:
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: aws:kms
Outputs:
  BucketName:
    Value: !Ref ArtifactsBucket`,
    },
    {
      title: 'AWS CDK (TypeScript)',
      lang: 'text',
      code: `import { Stack, StackProps } from 'aws-cdk-lib';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // VPC, cluster, ALB, Fargate service, target group & security groups in one construct
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Web', {
      desiredCount: 2,
      taskImageOptions: { image: ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:latest') },
    });
  }
}`,
    },
    {
      title: 'Terraform (HCL)',
      lang: 'text',
      code: `terraform {
  backend "s3" {
    bucket       = "my-tf-state"
    key          = "web/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true   # S3 native state locking
  }
}

provider "aws" { region = "eu-west-1" }

resource "aws_s3_bucket" "site" {
  bucket = "my-static-site-example-123"
}`,
    },
  ],
  realWorld: {
    title: 'GitLab pipelines deploying to AWS',
    story: 'A company already standardised on GitLab CI. Instead of migrating to CodePipeline they configured an IAM OIDC provider for GitLab and one IAM role per environment whose trust policy only allows their project’s protected branches. Pipelines assume the role, push images to ECR and run terraform apply. ECS deployments use the circuit breaker with automatic rollback.',
    points: ['Keep existing CI; integrate via OIDC', 'Separate roles per environment', 'Infrastructure and app changes go through the same review process'],
  },
  limits: ['CloudFormation stacks have resource and output quotas; split large systems into multiple stacks.', 'Terraform state contains sensitive values – encrypt and restrict the state bucket.', 'Blue/green doubles capacity temporarily; canary requires good metrics and alarms to be useful.'],
  summary: ['CI builds/tests every change; CD releases safely.', 'CodePipeline orchestrates; CodeBuild builds; CodeDeploy deploys with rollback.', 'IaC: CloudFormation (native), CDK (code → CloudFormation), Terraform (HCL, multi-cloud).', 'Rolling = batches; blue/green = switch environments; canary = small % first.', 'Use OIDC roles instead of stored AWS keys in external CI like GitLab.'],
  related: ['codecommit', 'codebuild', 'codedeploy', 'codepipeline', 'cloudformation', 'cdk', 'ecr', 'ecs'],
  quiz: [
    { q: 'Which strategy provides near-instant rollback by keeping the previous environment running?', options: ['Rolling', 'Blue/green', 'In-place all-at-once', 'Recreate'], answer: 1, explain: 'Blue/green keeps the old environment; rollback is a traffic switch.' },
    { q: 'Shift 10% of traffic to a new Lambda version, wait 10 minutes, then shift the rest. This is…', options: ['Linear', 'Canary', 'Blue/green', 'All-at-once'], answer: 1, explain: 'Canary deployments send a small slice first, then the remainder after a bake period.' },
    { q: 'What is the most secure way for GitLab CI to deploy to AWS?', options: ['Store an IAM user’s access keys as CI variables', 'Assume an IAM role using GitLab’s OIDC token', 'Use the root user', 'Make the S3 bucket public'], answer: 1, explain: 'OIDC federation issues short-lived credentials and the trust policy can restrict project and branch.' },
    { q: 'AWS CDK applications are deployed by…', options: ['Synthesising CloudFormation templates', 'Calling Terraform', 'Running on EC2 only', 'Using CodeCommit'], answer: 0, explain: 'CDK synthesises CloudFormation templates, which CloudFormation deploys.' },
    { q: 'Which service runs build commands defined in buildspec.yml?', options: ['CodeDeploy', 'CodeBuild', 'CloudTrail', 'CodeArtifact'], answer: 1, explain: 'CodeBuild executes buildspec phases in managed build containers.' },
    { q: 'What can automatically trigger a CodeDeploy rollback?', options: ['A CloudWatch alarm breaching during deployment', 'A new Git tag', 'An IAM policy change', 'An S3 lifecycle rule'], answer: 0, explain: 'CodeDeploy can monitor CloudWatch alarms and roll back when they enter ALARM.' },
  ],
  docs: [
    { label: 'AWS CodePipeline', url: 'https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html' },
    { label: 'AWS CodeDeploy deployment configurations', url: 'https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html' },
    { label: 'GitLab: Configure OpenID Connect in AWS', url: 'https://docs.gitlab.com/ci/cloud_services/aws/' },
    { label: 'AWS CDK Developer Guide', url: 'https://docs.aws.amazon.com/cdk/v2/guide/home.html' },
  ],
};
