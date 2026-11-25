import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Square, Save, FolderOpen, Download, Upload, Trash2, Zap, TriangleAlert, CircleCheck, Info } from 'lucide-react';
import { CATALOG, CATALOG_MAP, singleAz } from '../playground/catalog';
import { Icon, KIND_COLOR } from '../components/icons';
import { Badge, Callout, PageHeader, Toggle } from '../components/ui';

interface NData extends Record<string, unknown> {
  comp: string;
  label: string;
  cfg: Record<string, string>;
  failed?: boolean;
  // derived (not persisted)
  onPath?: boolean;
  dim?: boolean;
  spof?: boolean;
  warn?: boolean;
}
interface EData extends Record<string, unknown> {
  active?: boolean;
  blocked?: boolean;
  path?: boolean;
}
type PNode = Node<NData, 'aws'>;
type PEdge = Edge<EData, 'traffic'>;

const STORAGE_KEY = 'aws-lab-playground-v1';

/* ---------------------------------------------------------------- nodes */

function AwsNode({ data, selected }: NodeProps<PNode>) {
  const c = CATALOG_MAP[data.comp];
  const color = KIND_COLOR[c?.kind ?? 'generic'];
  const border = data.failed ? '#f0524d' : data.onPath ? '#ff9900' : selected ? '#ff9900' : color;
  return (
    <div className="relative" style={{ opacity: data.dim ? 0.35 : 1 }}>
      <Handle type="target" position={Position.Left} />
      <div className={`flex w-[150px] items-center gap-2 rounded-lg border-2 bg-panel px-2 py-1.5 shadow-md ${data.failed ? 'bg-bad/10' : ''}`} style={{ borderColor: border, boxShadow: data.onPath ? '0 0 0 3px rgba(255,153,0,0.25)' : undefined }}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: `${color}22`, color }}>
          <Icon name={c?.icon} size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11.5px] font-semibold text-ink">{data.label}</div>
          <div className="text-[9.5px] uppercase tracking-wide text-faint">{data.failed ? <span className="text-bad">failed</span> : c?.scope}</div>
        </div>
      </div>
      {data.spof && !data.failed && (
        <div className="absolute -right-2 -top-2 rounded-full bg-bad px-1.5 text-[9px] font-bold text-white" title="Single point of failure">
          SPOF
        </div>
      )}
      {!data.spof && data.warn && !data.failed && (
        <div className="absolute -right-2 -top-2 rounded-full bg-warn px-1.5 text-[9px] font-bold text-black" title="Single-AZ configuration">
          1 AZ
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function TrafficEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected }: EdgeProps<PEdge>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const stroke = data?.blocked ? '#f0524d' : data?.path ? '#ff9900' : data?.active ? '#4aa8ff' : selected ? '#ff9900' : 'var(--color-faint)';
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: data?.path ? 3 : 1.8, strokeDasharray: data?.blocked ? '6 4' : undefined }} />
      {data?.active &&
        [0, 0.5].map((off) => (
          <circle key={off} r={data.path ? 5 : 3.5} style={{ fill: data.path ? '#ff9900' : '#4aa8ff' }}>
            <animateMotion dur="1.6s" begin={`${off * 1.6}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
      {data?.blocked && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan pointer-events-none absolute rounded bg-bad px-1 text-[10px] font-bold text-white" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}>
            ✕ blocked
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { aws: AwsNode };
const edgeTypes = { traffic: TrafficEdge };
const edgeDefaults = { type: 'traffic' as const, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };

/* ------------------------------------------------------------ templates */

let idc = 1;
const mkNode = (comp: string, x: number, y: number, label?: string, cfg: Record<string, string> = {}): PNode => {
  const c = CATALOG_MAP[comp];
  const defaults = Object.fromEntries(c.config.map((f) => [f.key, f.default]));
  return { id: `${comp}-${idc++}`, type: 'aws', position: { x, y }, data: { comp, label: label ?? c.label, cfg: { ...defaults, ...cfg } } };
};
const link = (a: PNode, b: PNode): PEdge => ({ id: `e-${a.id}-${b.id}`, source: a.id, target: b.id, ...edgeDefaults });

const TEMPLATES: Record<string, { label: string; desc: string; build: () => { nodes: PNode[]; edges: PEdge[] } }> = {
  web: {
    label: '3-tier web app',
    desc: 'Route 53 → CloudFront → ALB → EC2 → RDS',
    build: () => {
      const u = mkNode('users', 0, 0);
      const r53 = mkNode('route53', 200, 0);
      const cf = mkNode('cloudfront', 400, 0);
      const s3 = mkNode('s3', 600, -90, 'S3 static assets');
      const alb = mkNode('alb', 200, 160);
      const ec2 = mkNode('ec2', 400, 160, 'EC2 web server');
      const rds = mkNode('rds', 600, 160, 'RDS PostgreSQL');
      return { nodes: [u, r53, cf, s3, alb, ec2, rds], edges: [link(u, r53), link(r53, cf), link(cf, s3), link(cf, alb), link(alb, ec2), link(ec2, rds)] };
    },
  },
  serverless: {
    label: 'Serverless API',
    desc: 'API Gateway → Lambda → DynamoDB',
    build: () => {
      const u = mkNode('users', 0, 140);
      const cog = mkNode('cognito', 190, 20, 'Cognito user pool');
      const api = mkNode('apigw', 190, 140);
      const fn = mkNode('lambda', 380, 140, 'Lambda orders-api');
      const ddb = mkNode('dynamodb', 570, 140, 'DynamoDB Orders');
      const cf = mkNode('cloudfront', 190, 270);
      const s3 = mkNode('s3', 380, 270, 'S3 web app');
      return { nodes: [u, cog, api, fn, ddb, cf, s3], edges: [link(u, cog), link(u, api), link(api, fn), link(fn, ddb), link(u, cf), link(cf, s3)] };
    },
  },
  network: {
    label: 'Public/private network',
    desc: 'Internet → IGW → public subnet → NAT → private subnet',
    build: () => {
      const u = mkNode('users', 0, 60, 'Internet');
      const igw = mkNode('igw', 200, 60);
      const alb = mkNode('alb', 400, 0, 'ALB (public subnet)');
      const nat = mkNode('nat', 400, 140, 'NAT GW (public subnet)');
      const app = mkNode('asg', 600, 0, 'App ASG (private)');
      const db = mkNode('rds', 800, 0, 'RDS (private)', { multiaz: 'Multi-AZ' });
      const ext = mkNode('onprem', 200, 220, 'Package repo (internet)');
      const appOut = mkNode('ec2', 600, 160, 'Batch EC2 (private)');
      return { nodes: [u, igw, alb, nat, app, db, ext, appOut], edges: [link(u, igw), link(igw, alb), link(alb, app), link(app, db), link(appOut, nat), link(nat, igw), link(igw, ext)] };
    },
  },
  events: {
    label: 'Event-driven',
    desc: 'API → Lambda → EventBridge → SQS / SNS',
    build: () => {
      const u = mkNode('users', 0, 0);
      const api = mkNode('apigw', 200, 0);
      const fn = mkNode('lambda', 400, 0, 'Lambda place-order');
      const eb = mkNode('eventbridge', 600, 0);
      const q = mkNode('sqs', 200, 150, 'SQS fulfilment');
      const w = mkNode('lambda', 400, 150, 'Lambda worker');
      const ddb = mkNode('dynamodb', 600, 150);
      const sns = mkNode('sns', 600, -100, 'SNS notifications');
      return { nodes: [u, api, fn, eb, q, w, ddb, sns], edges: [link(u, api), link(api, fn), link(fn, eb), link(eb, q), link(q, w), link(w, ddb), link(eb, sns)] };
    },
  },
};

/* --------------------------------------------------------------- graph */

function reachable(nodes: PNode[], edges: PEdge[], removed?: string): Set<string> {
  const failed = new Set(nodes.filter((n) => n.data.failed).map((n) => n.id));
  if (removed) failed.add(removed);
  const sources = nodes.filter((n) => (n.data.comp === 'users' || n.data.comp === 'onprem') && !failed.has(n.id)).map((n) => n.id);
  const seen = new Set<string>(sources);
  const q = [...sources];
  while (q.length) {
    const cur = q.shift()!;
    edges.forEach((e) => {
      if (e.source === cur && !failed.has(e.target) && !seen.has(e.target)) {
        seen.add(e.target);
        q.push(e.target);
      }
    });
  }
  return seen;
}

function shortestPath(nodes: PNode[], edges: PEdge[], target: string): string[] | null {
  const failed = new Set(nodes.filter((n) => n.data.failed).map((n) => n.id));
  const sources = nodes.filter((n) => (n.data.comp === 'users' || n.data.comp === 'onprem') && !failed.has(n.id)).map((n) => n.id);
  const prev = new Map<string, string | null>(sources.map((s) => [s, null]));
  const q = [...sources];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === target) break;
    edges.forEach((e) => {
      if (e.source === cur && !failed.has(e.target) && !prev.has(e.target)) {
        prev.set(e.target, cur);
        q.push(e.target);
      }
    });
  }
  if (!prev.has(target)) return null;
  const path: string[] = [];
  let c: string | null = target;
  while (c) {
    path.unshift(c);
    c = prev.get(c) ?? null;
  }
  return path;
}

/* ---------------------------------------------------------------- page */

function Playground() {
  const initial = useMemo(() => TEMPLATES.web.build(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PEdge>(initial.edges);
  const [sim, setSim] = useState(false);
  const [selected, setSelected] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  const [showSpof, setShowSpof] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const rf = useReactFlow<PNode, PEdge>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, ...edgeDefaults }, es)), [setEdges]);

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    const comp = ev.dataTransfer.getData('application/aws-comp');
    if (!comp) return;
    const pos = rf.screenToFlowPosition({ x: ev.clientX - 75, y: ev.clientY - 22 });
    const nd = mkNode(comp, pos.x, pos.y);
    setNodes((ns) => [...ns, nd]);
    setSelected({ kind: 'node', id: nd.id });
  };

  const loadTemplate = (k: string) => {
    const t = TEMPLATES[k].build();
    setNodes(t.nodes);
    setEdges(t.edges);
    setSelected(null);
    setTimeout(() => rf.fitView({ padding: 0.2 }), 50);
  };

  // --- analysis
  const analysis = useMemo(() => {
    const base = reachable(nodes, edges);
    const spofs: { id: string; lost: string[] }[] = [];
    const managedCuts: { id: string; lost: string[] }[] = [];
    nodes.forEach((n) => {
      const c = CATALOG_MAP[n.data.comp];
      if (!c || c.scope === 'external' || n.data.failed || !base.has(n.id)) return;
      const without = reachable(nodes, edges, n.id);
      const lost = [...base].filter((x) => x !== n.id && !without.has(x));
      if (!lost.length) return;
      if (c.managedHA) managedCuts.push({ id: n.id, lost });
      else if (singleAz(n.data.comp, n.data.cfg)) spofs.push({ id: n.id, lost });
    });
    const warns = nodes.filter((n) => singleAz(n.data.comp, n.data.cfg)).map((n) => n.id);
    const unreachable = nodes.filter((n) => !base.has(n.id) && CATALOG_MAP[n.data.comp]?.scope !== 'external').map((n) => n.id);
    return { base, spofs, managedCuts, warns, unreachable };
  }, [nodes, edges]);

  const pathIds = useMemo(() => {
    if (!sim || selected?.kind !== 'node') return null;
    return shortestPath(nodes, edges, selected.id);
  }, [sim, selected, nodes, edges]);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onPath: !!pathIds?.includes(n.id),
          dim: sim && !analysis.base.has(n.id),
          spof: showSpof && analysis.spofs.some((s) => s.id === n.id),
          warn: showSpof && analysis.warns.includes(n.id),
        },
      })),
    [nodes, pathIds, sim, analysis, showSpof],
  );
  const failedIds = useMemo(() => new Set(nodes.filter((n) => n.data.failed).map((n) => n.id)), [nodes]);
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const srcOk = analysis.base.has(e.source);
        const onPath = !!pathIds && pathIds.indexOf(e.target) > 0 && pathIds[pathIds.indexOf(e.target) - 1] === e.source;
        return { ...e, data: { active: sim && srcOk && !failedIds.has(e.target), blocked: sim && srcOk && failedIds.has(e.target), path: onPath } };
      }),
    [edges, sim, analysis, failedIds, pathIds],
  );

  const selNode = selected?.kind === 'node' ? nodes.find((n) => n.id === selected.id) : undefined;
  const selComp = selNode ? CATALOG_MAP[selNode.data.comp] : undefined;
  const updateSel = (patch: Partial<NData>) => selNode && setNodes((ns) => ns.map((n) => (n.id === selNode.id ? { ...n, data: { ...n.data, ...patch } } : n)));

  const persistable = () => ({ nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: { comp: n.data.comp, label: n.data.label, cfg: n.data.cfg, failed: n.data.failed } })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) });
  const restore = (obj: { nodes: { id: string; position: { x: number; y: number }; data: NData }[]; edges: { id: string; source: string; target: string }[] }) => {
    if (!obj?.nodes || !obj?.edges) throw new Error('bad file');
    setNodes(obj.nodes.filter((n) => CATALOG_MAP[n.data?.comp]).map((n) => ({ id: n.id, type: 'aws', position: n.position, data: n.data })));
    setEdges(obj.edges.map((e) => ({ ...e, ...edgeDefaults })));
    idc = Math.max(idc, ...obj.nodes.map((n) => Number(n.id.split('-').pop()) || 0)) + 1;
    setTimeout(() => rf.fitView({ padding: 0.2 }), 50);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable()));
    setToast('Saved to this browser (localStorage).');
  };
  const load = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return setToast('Nothing saved yet.');
    try {
      restore(JSON.parse(raw));
      setToast('Loaded saved architecture.');
    } catch {
      setToast('Saved data was invalid.');
    }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(persistable(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aws-architecture.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = (f: File) => {
    f.text()
      .then((t) => {
        restore(JSON.parse(t));
        setToast('Imported.');
      })
      .catch(() => setToast('Could not read that file.'));
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === 'node') {
      setNodes((ns) => ns.filter((n) => n.id !== selected.id));
      setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
    } else setEdges((es) => es.filter((e) => e.id !== selected.id));
    setSelected(null);
  };

  const label = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const categories = [...new Set(CATALOG.map((c) => c.category))];

  return (
    <div className="grid gap-4 xl:grid-cols-[200px_1fr_300px]">
      {/* palette */}
      <div className="card p-3 space-y-3 xl:max-h-[calc(100vh-180px)] xl:overflow-auto">
        <div className="text-[12px] text-muted">Drag components onto the canvas. Drag from a node’s right handle to another node to connect them.</div>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="label mb-1">{cat}</div>
            <div className="space-y-1">
              {CATALOG.filter((c) => c.category === cat).map((c) => (
                <div key={c.id} draggable onDragStart={(ev) => ev.dataTransfer.setData('application/aws-comp', c.id)} onDoubleClick={() => setNodes((ns) => [...ns, mkNode(c.id, 100 + Math.random() * 300, 100 + Math.random() * 200)])} className="flex cursor-grab items-center gap-2 rounded-md border border-line bg-panel2 px-2 py-1 text-[12px] hover:border-accent active:cursor-grabbing" title={c.desc}>
                  <span style={{ color: KIND_COLOR[c.kind] }}>
                    <Icon name={c.icon} size={14} />
                  </span>
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* canvas */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={`btn btn-sm ${sim ? 'btn-danger' : 'btn-primary'}`} onClick={() => setSim((s) => !s)}>
            {sim ? <Square size={12} /> : <Play size={12} />} {sim ? 'Stop traffic' : 'Simulate traffic'}
          </button>
          <select className="select text-[12px]" value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)}>
            <option value="">Load template…</option>
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label} – {t.desc}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={save}>
            <Save size={12} /> Save
          </button>
          <button className="btn btn-sm" onClick={load}>
            <FolderOpen size={12} /> Load
          </button>
          <button className="btn btn-sm" onClick={exportJson}>
            <Download size={12} /> Export JSON
          </button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Import
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <button
            className="btn btn-sm"
            onClick={() => {
              setNodes([]);
              setEdges([]);
              setSelected(null);
            }}
          >
            <Trash2 size={12} /> Clear
          </button>
          <Toggle checked={showSpof} onChange={setShowSpof} label="Show SPOFs" />
          {toast && <span className="text-[12px] text-ok">{toast}</span>}
        </div>
        <div className="h-[620px] rounded-xl border border-line overflow-hidden bg-bg" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelected({ kind: 'node', id: n.id })}
            onEdgeClick={(_, e) => setSelected({ kind: 'edge', id: e.id })}
            onPaneClick={() => setSelected(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable style={{ width: 140, height: 90, background: 'var(--color-panel)' }} nodeColor={(n) => KIND_COLOR[CATALOG_MAP[(n.data as NData).comp]?.kind ?? 'generic']} maskColor="rgba(0,0,0,0.5)" />
          </ReactFlow>
        </div>
        <p className="text-[11.5px] text-faint">Simulation only – nothing is deployed to AWS. With traffic running, click a node to highlight the request path from Users to it. Fail components in the side panel.</p>
      </div>

      {/* side panel */}
      <div className="space-y-3">
        {selNode && selComp ? (
          <div className="card p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${KIND_COLOR[selComp.kind]}22`, color: KIND_COLOR[selComp.kind] }}>
                <Icon name={selComp.icon} size={18} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{selComp.label}</div>
                <div className="flex gap-1">
                  <Badge tone={selComp.scope === 'global' ? 'violet' : selComp.scope === 'regional' ? 'sky' : selComp.scope === 'zonal' ? 'warn' : 'default'}>{selComp.scope}</Badge>
                  {selComp.managedHA && <Badge tone="ok">multi-AZ managed</Badge>}
                </div>
              </div>
            </div>
            <p className="text-[12.5px] text-muted leading-relaxed">{selComp.desc}</p>
            <label className="block">
              <span className="label">Name</span>
              <input className="input mt-1 w-full text-[12px]" value={selNode.data.label} onChange={(e) => updateSel({ label: e.target.value })} />
            </label>
            {selComp.config.map((f) => (
              <label key={f.key} className="block">
                <span className="label">{f.label}</span>
                <select className="select mt-1 w-full text-[12px]" value={selNode.data.cfg[f.key] ?? f.default} onChange={(e) => updateSel({ cfg: { ...selNode.data.cfg, [f.key]: e.target.value } })}>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
            {singleAz(selNode.data.comp, selNode.data.cfg) && <div className="text-[12px] text-warn">⚠ {singleAz(selNode.data.comp, selNode.data.cfg)}</div>}
            {selComp.scope !== 'external' && (
              <button className={`btn btn-sm w-full ${selNode.data.failed ? 'btn-primary' : 'btn-danger'}`} onClick={() => updateSel({ failed: !selNode.data.failed })}>
                <Zap size={12} /> {selNode.data.failed ? 'Recover component' : 'Simulate failure'}
              </button>
            )}
            {sim && pathIds && (
              <div className="text-[11.5px] text-muted">
                <span className="label">Request path</span>
                <div className="mt-0.5 text-ink">{pathIds.map(label).join(' → ')}</div>
              </div>
            )}
            {sim && !pathIds && <div className="text-[12px] text-bad">No healthy path from Users to this component.</div>}
            <button className="btn btn-sm w-full" onClick={deleteSelected}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        ) : selected?.kind === 'edge' ? (
          <div className="card p-3 space-y-2">
            <div className="text-[13px] font-semibold">Connection</div>
            <div className="text-[12px] text-muted">{label(edges.find((e) => e.id === selected.id)?.source ?? '')} → {label(edges.find((e) => e.id === selected.id)?.target ?? '')}</div>
            <button className="btn btn-sm w-full" onClick={deleteSelected}>
              <Trash2 size={12} /> Delete connection
            </button>
          </div>
        ) : (
          <Callout kind="tip">Click a component to see what it does, configure it, or make it fail. Try failing the EC2 instance or the single-AZ RDS in the template, and watch the downstream traffic stop.</Callout>
        )}

        <div className="card p-3 space-y-2">
          <div className="text-[13px] font-semibold">Resilience review</div>
          {analysis.spofs.length === 0 && analysis.warns.length === 0 && (
            <div className="flex gap-1.5 text-[12px] text-ok">
              <CircleCheck size={14} className="mt-0.5 shrink-0" /> No single-AZ single points of failure found.
            </div>
          )}
          {analysis.spofs.map((s) => (
            <div key={s.id} className="flex gap-1.5 text-[12px]">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-bad" />
              <span>
                <b>{label(s.id)}</b> is a single point of failure. If it fails, {s.lost.length} component(s) become unreachable: {s.lost.map(label).join(', ')}.
              </span>
            </div>
          ))}
          {analysis.warns
            .filter((w) => !analysis.spofs.some((s) => s.id === w))
            .map((w) => (
              <div key={w} className="flex gap-1.5 text-[12px] text-muted">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" />
                <span>
                  <b className="text-ink">{label(w)}</b>: {singleAz(nodes.find((n) => n.id === w)!.data.comp, nodes.find((n) => n.id === w)!.data.cfg)}
                </span>
              </div>
            ))}
          {analysis.managedCuts.length > 0 && (
            <div className="flex gap-1.5 text-[11.5px] text-faint">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>Every request goes through {analysis.managedCuts.map((m) => label(m.id)).join(', ')}. These are managed services built redundantly across AZs (or globally), so they are not treated as SPOFs, but a Regional outage would still affect Regional services.</span>
            </div>
          )}
          {analysis.unreachable.length > 0 && <div className="text-[12px] text-warn">Not reachable from Users: {analysis.unreachable.map(label).join(', ')}</div>}
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <div>
      <PageHeader eyebrow="Architecture Playground" title="Design, connect and break an architecture" desc="Drag AWS components onto the canvas, connect them, simulate traffic and failures, and find single points of failure. Everything runs in your browser." />
      <ReactFlowProvider>
        <Playground />
      </ReactFlowProvider>
    </div>
  );
}
