import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Pause, Play, Plus, Minus, Skull, Zap, RotateCcw, Upload } from 'lucide-react';
import { FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef } from '../animation/flowTypes';
import { e, g, n, p, r } from '../animation/builders';
import { useInterval } from '../animation/useLoop';
import { Badge, Callout, CodeBlock, Tabs } from '../components/ui';

/* ------------------------------------------------------ who manages what */

const LAYERS = ['Your application & container image', 'Task definition / Pod spec (CPU, memory, IAM role)', 'Orchestrator control plane (scheduling, API)', 'Container runtime & agent (containerd, ECS agent, kubelet)', 'Worker node OS, AMI & patching', 'Cluster capacity (how many hosts, which sizes)', 'Physical servers & virtualisation'];
const OPTIONS = {
  ec2: { label: 'Docker on plain EC2', who: ['you', 'you', 'you', 'you', 'you', 'you', 'aws'] },
  ecsec2: { label: 'ECS on EC2', who: ['you', 'you', 'aws', 'shared', 'you', 'you', 'aws'] },
  fargate: { label: 'ECS on Fargate', who: ['you', 'you', 'aws', 'aws', 'aws', 'aws', 'aws'] },
  eks: { label: 'EKS (managed node groups)', who: ['you', 'you', 'aws', 'shared', 'shared', 'you', 'aws'] },
  eksauto: { label: 'EKS Auto Mode / Fargate', who: ['you', 'you', 'aws', 'aws', 'aws', 'aws', 'aws'] },
} as const;
type OptId = keyof typeof OPTIONS;

const NOTES: Partial<Record<OptId, string>> = {
  ec2: 'You install Docker and write your own scripts for restarts, placement, rolling deploys and service discovery.',
  ecsec2: 'AWS runs the ECS control plane for free. You run the EC2 container instances (ECS-optimised AMI) and scale them, for example with capacity providers.',
  fargate: 'No servers to manage. You pay per task vCPU and GB-second, and each task gets its own isolated micro-VM and ENI.',
  eks: 'AWS runs a highly available Kubernetes control plane (billed per cluster-hour). Managed node groups automate node provisioning and updates, but you choose when to update.',
  eksauto: 'AWS also manages node provisioning, scaling and patching. You still own pods, images and Kubernetes manifests.',
};

function deployFlow(opt: OptId): FlowDef {
  const isK8s = opt === 'eks' || opt === 'eksauto';
  const ctrl = isK8s ? 'EKS control plane' : opt === 'ec2' ? 'Your deploy script' : 'ECS scheduler';
  const host = opt === 'fargate' || opt === 'eksauto' ? 'Fargate / AWS-managed capacity' : isK8s ? 'Worker nodes (EC2)' : 'EC2 container instances';
  return {
    id: `deploy-${opt}`,
    title: `Deploying v2 with ${OPTIONS[opt].label}`,
    width: 840,
    height: 300,
    groups: [g('cap', host, 470, 30, 230, 240, opt === 'fargate' || opt === 'eksauto' ? 'cloud' : 'az')],
    nodes: [
      n('dev', 'CI pipeline', 70, 80, 'devops', 'docker build', { w: 110 }),
      n('ecr', 'Amazon ECR', 70, 210, 'container', 'image repo', { w: 110 }),
      n('ctl', ctrl, 290, 145, opt === 'ec2' ? 'devops' : 'container', isK8s ? 'kubectl apply' : opt === 'ec2' ? 'ssh + docker run' : 'UpdateService', { w: 150 }),
      n('old1', isK8s ? 'Pod v1' : 'Task v1', 585, 80, 'container', 'running', { w: 110 }),
      n('new1', isK8s ? 'Pod v2' : 'Task v2', 585, 160, 'container', 'starting', { w: 110 }),
      n('old2', isK8s ? 'Pod v1' : 'Task v1', 585, 240, 'container', 'running', { w: 110 }),
      n('alb', 'ALB', 770, 160, 'network', 'target group', { w: 80 }),
    ],
    edges: [e('push', 'dev', 'ecr'), e('upd', 'dev', 'ctl'), e('pull', 'ecr', 'new1', { curve: 60, dashed: true }), e('sch', 'ctl', 'new1'), e('a1', 'alb', 'old1'), e('a2', 'alb', 'new1'), e('a3', 'alb', 'old2')],
    initial: { new1: 'hidden', a2: 'hidden', pull: 'hidden' },
    steps: [
      { title: 'Build & push the image', text: 'CI builds the container image and pushes it to ECR with an immutable tag (for example a git SHA). ECR can scan it for vulnerabilities.', packets: [p('push', 'teal', 'image:v2')] },
      { title: 'Tell the orchestrator', text: isK8s ? 'kubectl apply updates the Deployment’s pod template image. The Deployment controller starts a rolling update.' : opt === 'ec2' ? 'Without an orchestrator, your script must SSH to each host, pull the image, stop the old container and start the new one – and handle failures itself.' : 'UpdateService registers a new task definition revision. The ECS scheduler plans a rolling deployment (minimumHealthyPercent / maximumPercent).', packets: [p('upd', 'teal', 'deploy v2')] },
      { title: opt === 'fargate' || opt === 'eksauto' ? 'Capacity appears on demand' : 'Placed on a host with free capacity', text: opt === 'fargate' || opt === 'eksauto' ? 'AWS finds capacity for the new task or pod. You never see or patch the host.' : 'The scheduler bin-packs the new task or pod onto a host with enough free CPU and memory. If none has room, it stays Pending until you or Cluster Autoscaler/Karpenter add nodes.', packets: [p('sch', 'teal')], set: { new1: 'new', pull: 'ok' } },
      { title: 'Pull image & start', text: 'The host pulls the image from ECR (using an IAM role) and starts the container.', packets: [r('pull', 'teal', 'pull', { span: 0.5 })], set: { new1: 'warn' } },
      { title: 'Health check, then add to the load balancer', text: 'The ALB health check passes, so the new target is registered and receives traffic.', packets: [p('a2', 'blue', 'GET /health')], set: { new1: 'ok', a2: 'ok' } },
      { title: 'Drain & stop the old version', text: 'The old task or pod is deregistered (connection draining) and stopped. This repeats until every replica runs v2, and capacity never dropped below the minimum.', packets: [p('a1', 'gray')], set: { old1: 'off', a1: 'off' } },
    ],
  };
}

function WhoManages() {
  const [opt, setOpt] = useState<OptId>('fargate');
  return (
    <div className="space-y-4">
      <Tabs tabs={Object.entries(OPTIONS).map(([k, v]) => ({ id: k as OptId, label: v.label }))} value={opt} onChange={setOpt} />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-1">
          {LAYERS.map((l, i) => {
            const w = OPTIONS[opt].who[i];
            return (
              <motion.div layout key={l} className={`flex items-center justify-between rounded-md border px-3 py-2 text-[12.5px] transition-colors duration-500 ${w === 'you' ? 'border-accent/60 bg-accent/15' : w === 'aws' ? 'border-sky/50 bg-sky/10' : 'border-violet/50 bg-violet/10'}`}>
                <span>{l}</span>
                <span className="text-[10.5px] font-bold uppercase">{w === 'you' ? 'You' : w === 'aws' ? 'AWS' : 'Shared'}</span>
              </motion.div>
            );
          })}
        </div>
        <Callout kind="info" title={OPTIONS[opt].label}>
          {NOTES[opt]}
        </Callout>
      </div>
      <FlowPlayer key={opt} def={deployFlow(opt)} />
    </div>
  );
}

/* ------------------------------------------------------ mini Kubernetes */

type PodState = 'Pending' | 'ContainerCreating' | 'Running' | 'Terminating';
interface Pod {
  id: string;
  node: string | null;
  ver: number;
  state: PodState;
  age: number;
}
interface KNode {
  id: string;
  az: string;
  ready: boolean;
  notReadyFor: number;
}
const CAP = 4;
const rid = () => Math.random().toString(36).slice(2, 7);

function MiniK8s() {
  const [running, setRunning] = useState(true);
  const [replicas, setReplicas] = useState(4);
  const [ver, setVer] = useState(1);
  const [nodes, setNodes] = useState<KNode[]>([
    { id: 'ip-10-0-1-21', az: 'a', ready: true, notReadyFor: 0 },
    { id: 'ip-10-0-2-37', az: 'b', ready: true, notReadyFor: 0 },
    { id: 'ip-10-0-3-54', az: 'c', ready: true, notReadyFor: 0 },
  ]);
  const [pods, setPods] = useState<Pod[]>(() => ['ip-10-0-1-21', 'ip-10-0-2-37', 'ip-10-0-3-54', 'ip-10-0-1-21'].map((nd) => ({ id: `web-7d9f-${rid()}`, node: nd, ver: 1, state: 'Running' as PodState, age: 10 })));
  const [events, setEvents] = useState<string[]>([]);
  const tick = useRef(0);

  useInterval(
    () => {
      tick.current++;
      const msgs: string[] = [];
      let ps = pods.map((x) => ({ ...x, age: x.age + 1 }));
      const ns = nodes.map((x) => ({ ...x, notReadyFor: x.ready ? 0 : x.notReadyFor + 1 }));
      // remove terminated
      ps = ps.filter((x) => !(x.state === 'Terminating' && x.age > 1));
      // evict pods from nodes NotReady for a while
      ns.forEach((nd) => {
        if (!nd.ready && nd.notReadyFor === 3)
          ps.forEach((x) => {
            if (x.node === nd.id && x.state !== 'Terminating') {
              x.state = 'Terminating';
              x.age = 0;
              msgs.push(`node ${nd.id} NotReady → evicting ${x.id}`);
            }
          });
      });
      // progress
      ps.forEach((x) => {
        if (x.state === 'ContainerCreating' && x.age >= 2) {
          x.state = 'Running';
          msgs.push(`${x.id} Running (readiness probe passed)`);
        }
      });
      // schedule pending
      ps.forEach((x) => {
        if (x.state !== 'Pending') return;
        const cands = ns.filter((nd) => nd.ready).map((nd) => ({ nd, c: ps.filter((y) => y.node === nd.id && y.state !== 'Terminating').length })).filter((c) => c.c < CAP).sort((a, b) => a.c - b.c);
        if (cands[0]) {
          x.node = cands[0].nd.id;
          x.state = 'ContainerCreating';
          x.age = 0;
          msgs.push(`scheduler: ${x.id} → ${x.node} (AZ ${cands[0].nd.az})`);
        }
      });
      // ReplicaSet / Deployment controller (rolling update maxSurge=1, maxUnavailable=0)
      const live = ps.filter((x) => x.state !== 'Terminating');
      const cur = live.filter((x) => x.ver === ver);
      const old = live.filter((x) => x.ver !== ver);
      const curReady = cur.filter((x) => x.state === 'Running');
      if (old.length > 0) {
        if (live.length < replicas + 1 && cur.length < replicas) {
          ps.push({ id: `web-${ver}a${ver}c-${rid()}`, node: null, ver, state: 'Pending', age: 0 });
          msgs.push(`rolling update: created new pod (surge) for v${ver}`);
        }
        const oldReady = old.filter((x) => x.state === 'Running');
        if (curReady.length + oldReady.length > replicas && oldReady.length > 0) {
          const victim = oldReady[0];
          victim.state = 'Terminating';
          victim.age = 0;
          msgs.push(`rolling update: terminated old pod ${victim.id}`);
        } else if (old.some((x) => x.state !== 'Running')) {
          const victim = old.find((x) => x.state !== 'Running')!;
          victim.state = 'Terminating';
          victim.age = 0;
        }
      } else {
        if (cur.length < replicas) {
          for (let i = cur.length; i < replicas; i++) ps.push({ id: `web-${ver}a${ver}c-${rid()}`, node: null, ver, state: 'Pending', age: 0 });
          msgs.push(`ReplicaSet: ${cur.length}/${replicas} pods → creating ${replicas - cur.length}`);
        } else if (cur.length > replicas) {
          cur.slice(replicas).forEach((x) => {
            x.state = 'Terminating';
            x.age = 0;
          });
          msgs.push(`ReplicaSet: scaling down to ${replicas}`);
        }
      }
      setPods(ps);
      setNodes(ns);
      if (msgs.length) setEvents((ev) => [...msgs.reverse().map((m) => `${tick.current}s ${m}`), ...ev].slice(0, 18));
    },
    running ? 800 : null,
  );

  const killPod = () => {
    const x = pods.find((y) => y.state === 'Running');
    if (!x) return;
    setPods((ps) => ps.map((y) => (y.id === x.id ? { ...y, state: 'Terminating', age: 0 } : y)));
    setEvents((ev) => [`${tick.current}s ☠ ${x.id} crashed / deleted`, ...ev]);
  };
  const failNode = () => {
    const nd = nodes.find((x) => x.ready);
    if (!nd) return;
    setNodes((ns) => ns.map((x) => (x.id === nd.id ? { ...x, ready: false } : x)));
    setEvents((ev) => [`${tick.current}s ⚡ node ${nd.id} (AZ ${nd.az}) stopped responding → NotReady`, ...ev]);
  };
  const addNode = () => {
    const az = ['a', 'b', 'c'][nodes.length % 3];
    const id = `ip-10-0-${(nodes.length % 3) + 1}-${10 + Math.floor(Math.random() * 89)}`;
    setNodes((ns) => [...ns.filter((x) => x.ready), { id, az, ready: true, notReadyFor: 0 }]);
    setEvents((ev) => [`${tick.current}s node ${id} joined (AZ ${az}); NotReady nodes removed`, ...ev]);
  };

  const stats = useMemo(() => ({ running: pods.filter((x) => x.state === 'Running').length, pending: pods.filter((x) => x.state === 'Pending').length, cur: pods.filter((x) => x.ver === ver && x.state === 'Running').length }), [pods, ver]);

  const podColor = (x: Pod) => (x.state === 'Terminating' ? '#64748b' : x.state === 'Pending' ? '#f5a524' : x.state === 'ContainerCreating' ? '#4aa8ff' : x.ver % 2 ? '#2fbf71' : '#a78bfa');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-sm btn-primary" onClick={() => setRunning((x) => !x)}>
          {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Pause' : 'Run'}
        </button>
        <button className="btn btn-sm" onClick={() => setReplicas((x) => Math.max(1, x - 1))}>
          <Minus size={12} />
        </button>
        <span className="mono text-[12px]">replicas: {replicas}</span>
        <button className="btn btn-sm" onClick={() => setReplicas((x) => Math.min(14, x + 1))}>
          <Plus size={12} />
        </button>
        <button className="btn btn-sm" onClick={() => { setVer((v) => v + 1); setEvents((ev) => [`${tick.current}s kubectl set image deployment/web web=…/web:v${ver + 1}`, ...ev]); }}>
          <Upload size={12} /> Rolling update → v{ver + 1}
        </button>
        <button className="btn btn-sm btn-danger" onClick={killPod}>
          <Skull size={12} /> Kill a pod
        </button>
        <button className="btn btn-sm btn-danger" onClick={failNode}>
          <Zap size={12} /> Fail a node
        </button>
        <button className="btn btn-sm" onClick={addNode}>
          <RotateCcw size={12} /> Add node / replace failed
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Badge tone="ok">running {stats.running}/{replicas}</Badge>
        <Badge tone="violet">on v{ver}: {stats.cur}</Badge>
        {stats.pending > 0 && <Badge tone="warn">pending {stats.pending} – no node capacity</Badge>}
        <Badge>node capacity: {CAP} pods each</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <LayoutGroup>
          <div className="grid gap-2 md:grid-cols-3">
            {nodes.map((nd) => (
              <div key={nd.id} className={`rounded-lg border p-2 ${nd.ready ? 'border-line' : 'border-bad/60 bg-bad/5'}`}>
                <div className="mb-1.5 flex justify-between text-[11px]">
                  <span className="mono">{nd.id}</span>
                  <span className={nd.ready ? 'text-ok' : 'text-bad'}>
                    AZ {nd.az} · {nd.ready ? 'Ready' : 'NotReady'}
                  </span>
                </div>
                <div className="grid min-h-28 grid-cols-2 content-start gap-1.5">
                  <AnimatePresence>
                    {pods
                      .filter((x) => x.node === nd.id)
                      .map((x) => (
                        <motion.div layout layoutId={x.id} key={x.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: x.state === 'Terminating' ? 0.4 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="rounded border px-1.5 py-1 text-[10px]" style={{ borderColor: podColor(x), background: `${podColor(x)}22` }}>
                          <div className="mono truncate">{x.id}</div>
                          <div style={{ color: podColor(x) }}>
                            v{x.ver} · {x.state}
                          </div>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
            {pods.some((x) => x.state === 'Pending') && (
              <div className="rounded-lg border border-dashed border-warn/60 p-2 md:col-span-3">
                <div className="label mb-1">Pending (unschedulable)</div>
                <div className="flex flex-wrap gap-1.5">
                  {pods
                    .filter((x) => x.state === 'Pending')
                    .map((x) => (
                      <motion.div layout layoutId={x.id} key={x.id} className="rounded border border-warn/60 bg-warn/10 px-1.5 py-1 mono text-[10px]">
                        {x.id}
                      </motion.div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </LayoutGroup>
        <div className="space-y-2">
          <CodeBlock
            lang="yaml"
            title="deployment.yaml"
            code={`apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: ${replicas}
  strategy:
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    spec:
      containers:
        - name: web
          image: 111122223333.dkr.ecr.us-east-1.amazonaws.com/web:v${ver}`}
          />
          <div className="mono text-[10.5px] text-muted h-40 overflow-auto rounded-lg border border-line p-2 space-y-0.5">
            {events.map((x, i) => (
              <div key={i}>{x}</div>
            ))}
          </div>
        </div>
      </div>
      <Callout kind="tip">Kubernetes is declarative: you state the desired state (replicas: {replicas}, image v{ver}), and controllers keep reconciling reality towards it. Kill pods, fail nodes or increase replicas past capacity (3 nodes × {CAP}) to see Pending pods – then add a node.</Callout>
    </div>
  );
}

export default function ContainersLab() {
  const [tab, setTab] = useState<'who' | 'k8s'>('who');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'who', label: 'ECS vs EKS vs Fargate: who manages what' },
          { id: 'k8s', label: 'Mini Kubernetes cluster' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'who' ? <WhoManages /> : <MiniK8s />}
    </div>
  );
}
