import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  NodeResizer,
  Position,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CircleCheck, CircleX, TriangleAlert, Trash2 } from 'lucide-react';
import { Icon, KIND_COLOR } from '../components/icons';

type GroupKind = 'vpc' | 'public' | 'private';
type ResKind = 'igw' | 'nat' | 'ec2' | 'alb' | 'rds' | 'lambda';

interface GroupData extends Record<string, unknown> {
  kind: GroupKind;
  label: string;
}
interface ResData extends Record<string, unknown> {
  kind: ResKind;
  label: string;
}

const GROUP_STYLE: Record<GroupKind, { border: string; bg: string; text: string; label: string; w: number; h: number }> = {
  vpc: { border: '#a78bfa', bg: 'rgba(167,139,250,0.05)', text: '#a78bfa', label: 'VPC 10.0.0.0/16', w: 620, h: 420 },
  public: { border: '#2fbf71', bg: 'rgba(47,191,113,0.07)', text: '#2fbf71', label: 'Public subnet', w: 250, h: 150 },
  private: { border: '#4aa8ff', bg: 'rgba(74,168,255,0.07)', text: '#4aa8ff', label: 'Private subnet', w: 250, h: 150 },
};

const RES: Record<ResKind, { label: string; icon: string; kind: string; desc: string }> = {
  igw: { label: 'Internet Gateway', icon: 'globe', kind: 'network', desc: 'Attach to the VPC; connect it to a subnet to add a 0.0.0.0/0 route.' },
  nat: { label: 'NAT Gateway', icon: 'network', kind: 'network', desc: 'Place inside a public subnet; connect private subnets to it.' },
  ec2: { label: 'EC2 instance', icon: 'server', kind: 'compute', desc: 'Place inside a subnet.' },
  alb: { label: 'Application LB', icon: 'scale', kind: 'network', desc: 'Internet-facing ALBs belong in public subnets.' },
  rds: { label: 'RDS database', icon: 'database', kind: 'database', desc: 'Belongs in private subnets.' },
  lambda: { label: 'Lambda (in VPC)', icon: 'zap', kind: 'compute', desc: 'Runs in private subnets when VPC-attached.' },
};

function GroupNode({ data, selected }: NodeProps<Node<GroupData>>) {
  const s = GROUP_STYLE[data.kind];
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={100} lineStyle={{ borderColor: s.border }} handleStyle={{ background: s.border }} />
      <div className="h-full w-full rounded-lg" style={{ border: `1.5px ${data.kind === 'vpc' ? 'solid' : 'dashed'} ${s.border}`, background: s.bg }}>
        <div className="px-2 py-1 text-[11px] font-semibold" style={{ color: s.text }}>
          {data.label}
        </div>
      </div>
      {data.kind !== 'vpc' && (
        <>
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </>
      )}
    </>
  );
}

function ResNode({ data, selected }: NodeProps<Node<ResData>>) {
  const r = RES[data.kind];
  const color = KIND_COLOR[r.kind];
  return (
    <div className={`flex items-center gap-2 rounded-md border bg-panel px-2 py-1.5 text-[11px] shadow ${selected ? 'ring-2 ring-accent' : ''}`} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Left} />
      <span style={{ color }}>
        <Icon name={r.icon} size={14} />
      </span>
      <span className="font-medium text-ink">{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { group: GroupNode, res: ResNode };

type AnyNode = Node<GroupData> | Node<ResData>;

const edgeDefaults = { animated: true, style: { stroke: '#ff9900', strokeWidth: 1.5 } };

function template(): { nodes: AnyNode[]; edges: Edge[] } {
  const nodes: AnyNode[] = [
    { id: 'vpc', type: 'group', position: { x: 160, y: 20 }, width: 640, height: 430, data: { kind: 'vpc', label: GROUP_STYLE.vpc.label } },
    { id: 'pubA', type: 'group', parentId: 'vpc', position: { x: 20, y: 40 }, width: 280, height: 160, data: { kind: 'public', label: 'Public subnet A 10.0.1.0/24' } },
    { id: 'pubB', type: 'group', parentId: 'vpc', position: { x: 340, y: 40 }, width: 280, height: 160, data: { kind: 'public', label: 'Public subnet B 10.0.3.0/24' } },
    { id: 'privA', type: 'group', parentId: 'vpc', position: { x: 20, y: 240 }, width: 280, height: 170, data: { kind: 'private', label: 'Private subnet A 10.0.2.0/24' } },
    { id: 'privB', type: 'group', parentId: 'vpc', position: { x: 340, y: 240 }, width: 280, height: 170, data: { kind: 'private', label: 'Private subnet B 10.0.4.0/24' } },
    { id: 'igw', type: 'res', position: { x: 10, y: 120 }, data: { kind: 'igw', label: 'Internet Gateway' } },
    { id: 'alb', type: 'res', parentId: 'pubA', position: { x: 30, y: 50 }, data: { kind: 'alb', label: 'ALB' } },
    { id: 'nat', type: 'res', parentId: 'pubB', position: { x: 60, y: 90 }, data: { kind: 'nat', label: 'NAT Gateway' } },
    { id: 'ec2a', type: 'res', parentId: 'privA', position: { x: 30, y: 50 }, data: { kind: 'ec2', label: 'App EC2 a' } },
    { id: 'ec2b', type: 'res', parentId: 'privB', position: { x: 30, y: 50 }, data: { kind: 'ec2', label: 'App EC2 b' } },
    { id: 'rds', type: 'res', parentId: 'privA', position: { x: 120, y: 115 }, data: { kind: 'rds', label: 'RDS primary' } },
  ];
  const edges: Edge[] = [
    { id: 'r1', source: 'igw', target: 'pubA', label: '0.0.0.0/0 → igw', ...edgeDefaults },
    { id: 'r2', source: 'igw', target: 'pubB', label: '0.0.0.0/0 → igw', ...edgeDefaults },
    { id: 'r3', source: 'privA', target: 'nat', label: '0.0.0.0/0 → nat', ...edgeDefaults },
    { id: 'r4', source: 'privB', target: 'nat', label: '0.0.0.0/0 → nat', ...edgeDefaults },
  ];
  return { nodes, edges };
}

interface Check {
  level: 'ok' | 'warn' | 'bad';
  text: string;
}

function validate(nodes: AnyNode[], edges: Edge[]): Check[] {
  const out: Check[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kindOf = (n?: AnyNode) => (n ? (n.data as GroupData | ResData).kind : undefined);
  const neighbors = (id: string) => edges.flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : []));
  const vpcs = nodes.filter((n) => kindOf(n) === 'vpc');
  const subnets = nodes.filter((n) => kindOf(n) === 'public' || kindOf(n) === 'private');
  const igws = nodes.filter((n) => kindOf(n) === 'igw');

  if (vpcs.length === 0) out.push({ level: 'bad', text: 'Add a VPC – every subnet and resource lives inside one.' });
  else out.push({ level: 'ok', text: `${vpcs.length} VPC defined.` });

  subnets.forEach((s) => {
    const parent = byId.get(s.parentId ?? '');
    if (kindOf(parent) !== 'vpc') out.push({ level: 'bad', text: `${(s.data as GroupData).label}: must be placed inside a VPC.` });
    const igwLinked = neighbors(s.id).some((id) => kindOf(byId.get(id)) === 'igw');
    const natLinked = neighbors(s.id).some((id) => kindOf(byId.get(id)) === 'nat');
    if (kindOf(s) === 'public') {
      if (igwLinked) out.push({ level: 'ok', text: `${(s.data as GroupData).label}: route 0.0.0.0/0 → IGW, so it is public.` });
      else out.push({ level: 'bad', text: `${(s.data as GroupData).label}: no route to an Internet Gateway – it is not actually public. Connect it to an IGW.` });
    } else {
      if (igwLinked) out.push({ level: 'warn', text: `${(s.data as GroupData).label}: a route to the IGW makes this subnet public by definition.` });
      else if (natLinked) out.push({ level: 'ok', text: `${(s.data as GroupData).label}: outbound internet via NAT Gateway; not reachable from the internet.` });
      else out.push({ level: 'warn', text: `${(s.data as GroupData).label}: isolated (no NAT). Instances can’t download updates unless you use VPC endpoints.` });
    }
  });

  if (igws.length > 1) out.push({ level: 'bad', text: 'A VPC can have only one Internet Gateway attached.' });
  if (igws.length && !vpcs.length) out.push({ level: 'bad', text: 'Internet Gateway has no VPC to attach to.' });

  const resources = nodes.filter((n) => n.type === 'res' && kindOf(n) !== 'igw');
  resources.forEach((r) => {
    const d = r.data as ResData;
    const parent = byId.get(r.parentId ?? '');
    const pk = kindOf(parent);
    if (pk !== 'public' && pk !== 'private') {
      out.push({ level: 'bad', text: `${d.label}: drop it inside a subnet (resources launch into subnets, not directly into a VPC).` });
      return;
    }
    if (d.kind === 'nat') {
      if (pk !== 'public') out.push({ level: 'bad', text: `${d.label}: a public NAT Gateway must be in a public subnet (it needs the IGW route).` });
      else out.push({ level: 'ok', text: `${d.label}: in a public subnet ✓` });
    }
    if (d.kind === 'rds' && pk === 'public') out.push({ level: 'warn', text: `${d.label}: databases should be in private subnets.` });
    if (d.kind === 'alb' && pk !== 'public') out.push({ level: 'warn', text: `${d.label}: an internet-facing ALB needs public subnets (an internal ALB can be private).` });
    if (d.kind === 'ec2' && pk === 'public') out.push({ level: 'warn', text: `${d.label}: app servers are usually kept private behind a load balancer.` });
  });

  const natSubnetsLinked = subnets.filter((s) => kindOf(s) === 'private' && neighbors(s.id).some((id) => kindOf(byId.get(id)) === 'nat'));
  natSubnetsLinked.forEach((s) => {
    const nat = neighbors(s.id).map((id) => byId.get(id)).find((n) => kindOf(n) === 'nat');
    const natParent = byId.get(nat?.parentId ?? '');
    if (natParent && kindOf(natParent) === 'public' && !neighbors(natParent.id).some((id) => kindOf(byId.get(id)) === 'igw')) out.push({ level: 'bad', text: `NAT Gateway’s subnet has no IGW route – private subnets behind it still can’t reach the internet.` });
  });

  const publicCount = subnets.filter((s) => kindOf(s) === 'public').length;
  const privCount = subnets.filter((s) => kindOf(s) === 'private').length;
  if (nodes.some((n) => kindOf(n) === 'alb') && publicCount < 2) out.push({ level: 'warn', text: 'An ALB requires subnets in at least two Availability Zones – add a second public subnet.' });
  if (nodes.some((n) => kindOf(n) === 'rds') && privCount < 2) out.push({ level: 'warn', text: 'An RDS DB subnet group needs subnets in at least two AZs.' });
  if (nodes.filter((n) => kindOf(n) === 'nat').length === 1 && privCount > 1) out.push({ level: 'warn', text: 'One NAT Gateway serves all private subnets – it is a zonal resource, so an AZ outage cuts outbound access for the others. Use one NAT per AZ for resilience.' });
  return out;
}

let idc = 1;

function Builder() {
  const t = template();
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNode>(t.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(t.edges);
  const [selected, setSelected] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const rf = useReactFlow<AnyNode, Edge>();

  const onConnect = useCallback(
    (c: Connection) => {
      const kind = (id: string | null) => (nodes.find((n) => n.id === id)?.data as GroupData | ResData | undefined)?.kind;
      const ks = [kind(c.source), kind(c.target)];
      const label = ks.includes('igw') ? '0.0.0.0/0 → igw' : ks.includes('nat') ? '0.0.0.0/0 → nat' : 'traffic';
      setEdges((es) => addEdge({ ...c, label, ...edgeDefaults }, es));
    },
    [nodes, setEdges],
  );

  /** find the smallest group containing an absolute point that may host `kind` */
  const findParent = useCallback(
    (pt: { x: number; y: number }, kind: GroupKind | ResKind, excludeId?: string) => {
      const candidates = rf
        .getNodes()
        .filter((n) => n.type === 'group' && n.id !== excludeId)
        .filter((n) => {
          const gk = (n.data as GroupData).kind;
          if (kind === 'vpc') return false;
          if (kind === 'public' || kind === 'private') return gk === 'vpc';
          if (kind === 'igw') return false;
          return true;
        })
        .map((n) => {
          const internal = rf.getInternalNode(n.id);
          const pos = internal?.internals.positionAbsolute ?? n.position;
          const w = internal?.measured.width ?? n.width ?? 0;
          const h = internal?.measured.height ?? n.height ?? 0;
          return { n, pos, w, h };
        })
        .filter(({ pos, w, h }) => pt.x >= pos.x && pt.x <= pos.x + w && pt.y >= pos.y && pt.y <= pos.y + h)
        .sort((a, b) => a.w * a.h - b.w * b.h);
      return candidates[0];
    },
    [rf],
  );

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    const kind = ev.dataTransfer.getData('application/vpc-kind') as GroupKind | ResKind;
    if (!kind) return;
    const pt = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
    const parent = findParent(pt, kind);
    const id = `${kind}-${idc++}`;
    const isGroup = kind === 'vpc' || kind === 'public' || kind === 'private';
    const pos = parent ? { x: pt.x - parent.pos.x, y: pt.y - parent.pos.y } : pt;
    const node: AnyNode = isGroup
      ? { id, type: 'group', position: pos, parentId: parent?.n.id, width: GROUP_STYLE[kind as GroupKind].w, height: GROUP_STYLE[kind as GroupKind].h, data: { kind: kind as GroupKind, label: GROUP_STYLE[kind as GroupKind].label } }
      : { id, type: 'res', position: pos, parentId: parent?.n.id, data: { kind: kind as ResKind, label: RES[kind as ResKind].label } };
    // parents must come before children in the array
    setNodes((ns) => (isGroup && kind === 'vpc' ? [node, ...ns] : [...ns, node]));
    setSelected(id);
  };

  const onNodeDragStop = (_: unknown, node: AnyNode) => {
    const kind = (node.data as GroupData | ResData).kind;
    if (kind === 'vpc') return;
    const internal = rf.getInternalNode(node.id);
    const abs = internal?.internals.positionAbsolute ?? node.position;
    const w = internal?.measured.width ?? 0;
    const h = internal?.measured.height ?? 0;
    const center = { x: abs.x + w / 2, y: abs.y + h / 2 };
    const parent = findParent(center, kind, node.id);
    const newParent = parent?.n.id;
    if (newParent === node.parentId) return;
    setNodes((ns) => {
      const updated = ns.map((n) => (n.id === node.id ? { ...n, parentId: newParent, position: parent ? { x: abs.x - parent.pos.x, y: abs.y - parent.pos.y } : abs } : n));
      // keep parents before children: sort by depth
      const depth = (n: AnyNode): number => (n.parentId ? 1 + depth(updated.find((x) => x.id === n.parentId)!) : 0);
      return [...updated].sort((a, b) => depth(a) - depth(b));
    });
  };

  const removeSelected = () => {
    if (!selected) return;
    const toRemove = new Set<string>([selected]);
    let grew = true;
    while (grew) {
      grew = false;
      nodes.forEach((n) => {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          grew = true;
        }
      });
    }
    setNodes((ns) => ns.filter((n) => !toRemove.has(n.id)));
    setEdges((es) => es.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
    setSelected(null);
  };

  const checks = useMemo(() => validate(nodes, edges), [nodes, edges]);
  const score = checks.filter((c) => c.level === 'bad').length === 0;

  const paletteItem = (kind: GroupKind | ResKind, label: string, color: string, icon?: string) => (
    <div key={kind} draggable onDragStart={(ev) => ev.dataTransfer.setData('application/vpc-kind', kind)} className="flex cursor-grab items-center gap-2 rounded-md border border-line bg-panel2 px-2 py-1.5 text-[12px] hover:border-accent active:cursor-grabbing">
      <span style={{ color }}>{icon ? <Icon name={icon} size={14} /> : <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: color }} />}</span>
      {label}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[180px_1fr_280px]">
      <div className="space-y-1.5">
        <div className="label">Drag onto the canvas</div>
        {paletteItem('vpc', 'VPC', GROUP_STYLE.vpc.border)}
        {paletteItem('public', 'Public subnet', GROUP_STYLE.public.border)}
        {paletteItem('private', 'Private subnet', GROUP_STYLE.private.border)}
        {(Object.keys(RES) as ResKind[]).map((k) => paletteItem(k, RES[k].label, KIND_COLOR[RES[k].kind], RES[k].icon))}
        <div className="pt-2 space-y-1.5">
          <button
            className="btn btn-sm w-full"
            onClick={() => {
              const tt = template();
              setNodes(tt.nodes);
              setEdges(tt.edges);
            }}
          >
            Load 2-tier template
          </button>
          <button
            className="btn btn-sm w-full"
            onClick={() => {
              setNodes([]);
              setEdges([]);
            }}
          >
            Clear canvas
          </button>
          <button className="btn btn-sm btn-danger w-full" disabled={!selected} onClick={removeSelected}>
            <Trash2 size={12} /> Delete selected
          </button>
        </div>
        <p className="text-[11px] text-faint pt-1">Connect an IGW to a subnet = route 0.0.0.0/0 → IGW. Connect a private subnet to a NAT = route 0.0.0.0/0 → NAT. Drag resources between subnets to move them.</p>
      </div>
      <div ref={wrapper} className="h-[520px] rounded-lg border border-line overflow-hidden" onDragOver={(ev) => ev.preventDefault()} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="space-y-2">
        <div className={`rounded-lg border p-2.5 text-[13px] font-semibold ${score ? 'border-ok/50 bg-ok/5 text-ok' : 'border-bad/50 bg-bad/5 text-bad'}`}>{score ? 'Valid network design' : 'Design has errors'}</div>
        <div className="max-h-[470px] overflow-auto space-y-1.5">
          {checks.map((c, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-snug">
              {c.level === 'ok' ? <CircleCheck size={14} className="mt-0.5 shrink-0 text-ok" /> : c.level === 'warn' ? <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" /> : <CircleX size={14} className="mt-0.5 shrink-0 text-bad" />}
              <span className="text-muted">{c.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VpcBuilder() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
