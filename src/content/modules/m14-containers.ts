import type { LearningModule } from '../../types';
import { e, g, n, p } from '../../animation/builders';

export const containers: LearningModule = {
  id: 'containers',
  num: 14,
  title: 'Containers and Kubernetes',
  short: 'Containers',
  icon: 'container',
  level: 'Intermediate',
  minutes: 55,
  intro:
    'Containers package an application with its dependencies into a portable image that runs the same everywhere. On AWS you store images in Amazon ECR and run them with an orchestrator: Amazon ECS (AWS-native, simpler) or Amazon EKS (managed Kubernetes). The compute underneath can be EC2 instances you manage or AWS Fargate, which runs each task or pod without any servers for you to manage.',
  analogy: 'A container image is a shipping container: whatever is inside, cranes and ships handle it the same way. ECS and EKS are port authorities deciding where containers go; EC2 is owning the ships; Fargate is paying a shipping line per container.',
  concepts: [
    { term: 'Docker fundamentals', body: 'A Dockerfile describes how to build an image layer by layer (base image, copy code, install deps, set the start command). docker build creates the image; docker run starts a container. Containers share the host kernel, so they start in seconds and are lighter than VMs.' },
    { term: 'Container images', body: 'Immutable, layered, versioned artefacts identified by repository:tag (and an immutable digest). Build once, promote the same image through dev → staging → prod.' },
    { term: 'Containers', body: 'A running instance of an image with isolated process, filesystem and network namespaces, and CPU/memory limits. Containers should be stateless and disposable.' },
    { term: 'Amazon ECR', body: 'A managed, private (and public) container registry integrated with IAM. Features: image scanning for vulnerabilities, lifecycle policies to expire old images, immutable tags and cross-Region replication.' },
    { term: 'Amazon ECS', body: 'AWS’s container orchestrator. A task definition describes containers (image, CPU, memory, ports, IAM task role, logging). A service keeps N tasks running, replaces failed ones, integrates with ALB target groups and scales. Runs on Fargate, EC2 capacity providers or on-premises (ECS Anywhere).' },
    { term: 'Amazon EKS', body: 'A managed Kubernetes control plane (API server, etcd) run by AWS across multiple AZs. You run workloads on managed node groups, self-managed nodes, Fargate or EKS Auto Mode. Choose EKS for Kubernetes portability, ecosystem tooling (Helm, operators) or existing K8s skills.' },
    { term: 'AWS Fargate', body: 'Serverless compute for containers. You specify CPU and memory per task/pod; AWS provisions isolated compute, patches it and bills per second for the resources requested. No instances, AMIs or cluster capacity to manage.' },
    { term: 'Kubernetes basics', body: 'A declarative system: you describe desired state in YAML (manifests) and controllers continuously reconcile actual state to match it.' },
    { term: 'Pods', body: 'The smallest deployable unit in Kubernetes – one or more tightly coupled containers sharing network and storage. Pods are ephemeral and get replaced, not repaired.' },
    { term: 'Deployments', body: 'A controller that manages ReplicaSets to keep a desired number of identical pods running and performs rolling updates and rollbacks.' },
    { term: 'Services', body: 'A stable virtual IP/DNS name that load-balances to a changing set of pods selected by labels. Types: ClusterIP, NodePort, LoadBalancer (provisions an NLB/ALB via the AWS Load Balancer Controller). Ingress exposes HTTP routes.' },
    { term: 'Nodes', body: 'Worker machines (EC2 instances or Fargate micro-VMs) that run pods. The kube-scheduler places pods on nodes with enough CPU/memory.' },
  ],
  animations: [
    {
      id: 'm14-deploy',
      title: 'Container deployment: build → ECR → ECS on Fargate → ALB',
      width: 840,
      height: 380,
      groups: [g('cluster', 'ECS cluster – service "web" (desired 2) on Fargate', 420, 60, 400, 290, 'generic')],
      nodes: [
        n('dev', 'Developer', 70, 100, 'user', 'git push'),
        n('ci', 'CI build', 70, 260, 'devops', 'docker build', { icon: 'boxes' }),
        n('ecr', 'Amazon ECR', 250, 260, 'container', 'web:1.4.0'),
        n('td', 'Task definition', 250, 100, 'container', 'image, 0.5 vCPU, 1 GB', { icon: 'file', w: 150 }),
        n('t1', 'Task 1', 520, 140, 'container', 'AZ a · 10.0.2.11'),
        n('t2', 'Task 2', 520, 280, 'container', 'AZ b · 10.0.3.12'),
        n('alb', 'ALB', 730, 210, 'network', 'target type ip'),
      ],
      edges: [e('d-c', 'dev', 'ci'), e('c-e', 'ci', 'ecr', { label: 'docker push' }), e('e-1', 'ecr', 't1', { label: 'pull' }), e('e-2', 'ecr', 't2'), e('td-1', 'td', 't1', { dashed: true }), e('a-1', 'alb', 't1'), e('a-2', 'alb', 't2')],
      initial: { t1: 'hidden', t2: 'hidden' },
      steps: [
        { title: 'Build the image', text: 'A push triggers CI, which runs docker build using the Dockerfile and tags the image with the version/commit SHA.', packets: [p('d-c', 'blue', 'push')] },
        { title: 'Push to ECR', text: 'The CI job authenticates to ECR with IAM and pushes the image. ECR scans it for vulnerabilities.', packets: [p('c-e', 'purple', 'web:1.4.0')] },
        { title: 'Register a task definition', text: 'A new task definition revision references the image, CPU/memory, port 8080, the task IAM role and awslogs logging.', focus: ['td'] },
        { title: 'Service launches tasks on Fargate', text: 'The ECS service scheduler starts 2 tasks spread across AZs. Fargate provisions isolated compute; each task gets its own ENI (awsvpc networking) and pulls the image.', set: { t1: 'new', t2: 'new' }, packets: [p('e-1', 'purple', 'pull'), p('e-2', 'purple', 'pull', { at: 0.1 })] },
        { title: 'Register with the load balancer', text: 'Tasks register their IPs in the ALB target group and pass health checks.', set: { t1: 'ok', t2: 'ok' }, packets: [p('a-1', 'teal', '/health'), p('a-2', 'teal', '/health', { at: 0.1 })] },
        { title: 'Self-healing', text: 'If a task crashes, the service scheduler notices the running count < desired and starts a replacement automatically.', set: { t2: 'fail' }, log: 'service web: task 2 stopped (Essential container exited) – starting new task' },
      ],
    },
    {
      id: 'm14-k8s',
      title: 'Kubernetes: Deployment, Pods, Service and Nodes',
      width: 840,
      height: 380,
      groups: [g('n1', 'Node 1 (EC2)', 330, 40, 240, 150, 'az'), g('n2', 'Node 2 (EC2)', 330, 210, 240, 150, 'az'), g('cp', 'EKS control plane (AWS-managed)', 20, 220, 270, 140, 'generic')],
      nodes: [
        n('client', 'Client', 80, 100, 'user'),
        n('svc', 'Service: web', 200, 100, 'network', 'ClusterIP / LB', { w: 110 }),
        n('p1', 'pod web-a', 400, 110, 'container', '', { w: 100 }),
        n('p2', 'pod web-b', 510, 110, 'container', '', { w: 100, x: 510 }),
        n('p3', 'pod web-c', 400, 290, 'container', '', { w: 100 }),
        n('p4', 'pod web-d', 510, 290, 'container', 'rescheduled', { w: 100 }),
        n('api', 'API server', 90, 300, 'container', 'desired: 3', { icon: 'cloudcog', w: 110 }),
        n('sched', 'Scheduler', 220, 300, 'container', '', { icon: 'cpu', w: 100 }),
        n('dep', 'Deployment', 720, 200, 'container', 'replicas: 3', { icon: 'file' }),
      ],
      edges: [e('c-s', 'client', 'svc'), e('s-1', 'svc', 'p1'), e('s-2', 'svc', 'p2', { curve: -20 }), e('s-3', 'svc', 'p3'), e('s-4', 'svc', 'p4', { curve: 20 }), e('d-a', 'dep', 'api', { dashed: true, curve: 120 }), e('sc-4', 'sched', 'p4', { dashed: true })],
      initial: { p4: 'hidden' },
      steps: [
        { title: 'Desired state', text: 'kubectl apply sends a Deployment with replicas: 3 to the API server. Controllers create 3 pods; the scheduler places them on nodes.', packets: [p('d-a', 'blue', 'apply')], focus: ['dep'] },
        { title: 'Service load-balances pods', text: 'The Service selects pods with label app=web and spreads requests across them.', packets: [p('c-s', 'blue', undefined, { span: 0.3 }), p('s-1', 'blue', undefined, { at: 0.3, span: 0.4 }), p('s-2', 'blue', undefined, { at: 0.35, span: 0.4 }), p('s-3', 'blue', undefined, { at: 0.4, span: 0.4 })] },
        { title: 'A pod dies', text: 'web-b crashes (or its node is drained).', set: { p2: 'fail', 's-2': 'off' } },
        { title: 'Reconciliation', text: 'The ReplicaSet controller sees 2 of 3 replicas and creates a new pod; the scheduler places it on Node 2 where there is capacity.', set: { p2: 'hidden', p4: 'new' }, packets: [p('sc-4', 'orange', 'bind')], log: 'ReplicaSet web-7d9f: Created pod web-d' },
        { title: 'Traffic resumes to new pod', text: 'Once its readiness probe passes, the Service starts sending it traffic. You never repair pods – controllers replace them.', set: { p4: 'ok' }, packets: [p('s-1', 'blue'), p('s-3', 'blue', undefined, { at: 0.1 }), p('s-4', 'blue', undefined, { at: 0.2 })] },
      ],
    },
  ],
  experiment: 'containers-lab',
  experimentTitle: 'EC2 vs ECS vs EKS vs Fargate',
  experimentBlurb: 'Compare who manages each layer, then run a mini Kubernetes cluster: scale replicas, kill pods and fail nodes.',
  code: [
    {
      title: 'Dockerfile (Node.js)',
      lang: 'bash',
      code: `FROM public.ecr.aws/docker/library/node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
USER node
CMD ["node", "server.js"]`,
    },
    {
      title: 'Kubernetes Deployment + Service',
      lang: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: 111122223333.dkr.ecr.eu-west-1.amazonaws.com/web:1.4.0
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: 250m, memory: 256Mi }
          readinessProbe:
            httpGet: { path: /health, port: 8080 }
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080 }]`,
    },
  ],
  realWorld: {
    title: 'Microservices for a media company',
    story: 'A media company runs 40 microservices. Small teams without Kubernetes experience deploy on ECS with Fargate – no nodes to patch. The data-platform team, which relies on Kubernetes operators for Spark and Kafka, runs EKS with managed node groups and Karpenter for autoscaling. Both pull images from ECR with scanning and lifecycle policies.',
    points: ['ECS + Fargate for simplicity', 'EKS for Kubernetes ecosystem needs', 'One registry (ECR) for both'],
  },
  limits: ['Fargate does not support privileged containers or GPUs (use EC2 capacity for those).', 'EKS clusters have an hourly control-plane charge.', 'Container images should be small and scanned; use immutable tags in production.'],
  summary: ['Images in ECR; orchestrate with ECS or EKS; compute on EC2 or Fargate.', 'ECS: AWS-native, simpler. EKS: managed Kubernetes.', 'Fargate removes server management, billed per vCPU/GB-second.', 'Kubernetes is declarative: Deployments keep pods at desired state; Services give stable endpoints.'],
  related: ['ecr', 'ecs', 'eks', 'fargate', 'alb', 'ec2'],
  quiz: [
    { q: 'You want to run containers without managing any EC2 instances. Which compute option?', options: ['EC2 launch type', 'AWS Fargate', 'Dedicated Hosts', 'Lightsail'], answer: 1, explain: 'Fargate provisions compute per task/pod; no instances to manage.' },
    { q: 'Your team already uses Helm charts and Kubernetes operators. Which orchestrator?', options: ['Amazon ECS', 'Amazon EKS', 'AWS Batch', 'Elastic Beanstalk'], answer: 1, explain: 'EKS runs upstream Kubernetes, so Helm and operators work.' },
    { q: 'Where should container images for ECS/EKS be stored?', options: ['Amazon ECR', 'Amazon EBS', 'CloudTrail', 'Parameter Store'], answer: 0, explain: 'ECR is AWS’s managed container registry integrated with IAM.' },
    { q: 'In ECS, what describes the containers, CPU, memory and IAM role of a task?', options: ['Service', 'Cluster', 'Task definition', 'Capacity provider'], answer: 2, explain: 'The task definition is the blueprint; the service keeps tasks running from it.' },
    { q: 'In Kubernetes, what keeps 3 replicas of a pod running and performs rolling updates?', options: ['Service', 'Deployment', 'Node', 'ConfigMap'], answer: 1, explain: 'A Deployment manages ReplicaSets to maintain replicas and roll out changes.' },
    { q: 'What gives a changing set of pods a stable network endpoint?', options: ['A Kubernetes Service', 'A Pod', 'An AMI', 'A Namespace'], answer: 0, explain: 'Services select pods by label and provide a stable virtual IP and DNS name.' },
  ],
  docs: [
    { label: 'Amazon ECS Developer Guide', url: 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html' },
    { label: 'Amazon EKS User Guide', url: 'https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html' },
    { label: 'AWS Fargate', url: 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html' },
    { label: 'Kubernetes concepts', url: 'https://kubernetes.io/docs/concepts/' },
  ],
};
