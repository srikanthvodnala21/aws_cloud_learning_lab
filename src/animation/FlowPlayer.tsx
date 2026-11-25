import { useMemo } from 'react';
import type { FlowDef, FlowEdge, FlowNode, GroupTone, PacketColor, Status } from './flowTypes';
import { useTimeline } from './useTimeline';
import { PlaybackControls } from './PlaybackControls';
import { ICONS, KIND_COLOR, KIND_ICON } from '../components/icons';
import { Box } from 'lucide-react';

export const PACKET_COLORS: Record<PacketColor, string> = {
  blue: '#4aa8ff',
  green: '#2fbf71',
  red: '#f0524d',
  orange: '#ff9900',
  purple: '#a78bfa',
  teal: '#2dd4bf',
  pink: '#f472b6',
  gray: '#94a3b8',
};

const TONE: Record<GroupTone, { stroke: string; fill: string; dash?: string }> = {
  cloud: { stroke: '#64748b', fill: 'rgba(100,116,139,0.04)' },
  region: { stroke: '#4aa8ff', fill: 'rgba(74,168,255,0.04)', dash: '6 4' },
  az: { stroke: '#4aa8ff', fill: 'rgba(74,168,255,0.05)', dash: '3 3' },
  vpc: { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.05)' },
  public: { stroke: '#2fbf71', fill: 'rgba(47,191,113,0.07)' },
  private: { stroke: '#4aa8ff', fill: 'rgba(74,168,255,0.07)' },
  onprem: { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.06)', dash: '6 4' },
  edge: { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.05)', dash: '4 4' },
  generic: { stroke: '#64748b', fill: 'rgba(100,116,139,0.05)' },
  danger: { stroke: '#f0524d', fill: 'rgba(240,82,77,0.06)', dash: '4 3' },
};

interface Geom {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  curved: boolean;
}

function clipToRect(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = w / 2 / Math.abs(dx || 1e-9);
  const sy = h / 2 / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

export function nodeSize(n: FlowNode) {
  return { w: n.w ?? 116, h: n.h ?? 52 };
}

function edgeGeom(e: FlowEdge, map: Record<string, FlowNode>): Geom | null {
  const a = map[e.from];
  const b = map[e.to];
  if (!a || !b) return null;
  const sa = nodeSize(a);
  const sb = nodeSize(b);
  const curve = e.curve ?? 0;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;
  const p1 = clipToRect(a.x, a.y, sa.w + 6, sa.h + 6, curve ? cx : b.x, curve ? cy : b.y);
  const p2 = clipToRect(b.x, b.y, sb.w + 10, sb.h + 10, curve ? cx : a.x, curve ? cy : a.y);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cx, cy, curved: !!curve };
}

function pointAt(g: Geom, p: number) {
  if (!g.curved) return { x: g.x1 + (g.x2 - g.x1) * p, y: g.y1 + (g.y2 - g.y1) * p };
  const q = 1 - p;
  return {
    x: q * q * g.x1 + 2 * q * p * g.cx + p * p * g.x2,
    y: q * q * g.y1 + 2 * q * p * g.cy + p * p * g.y2,
  };
}

function edgePath(g: Geom) {
  return g.curved ? `M${g.x1},${g.y1} Q${g.cx},${g.cy} ${g.x2},${g.y2}` : `M${g.x1},${g.y1} L${g.x2},${g.y2}`;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function computeStatus(def: FlowDef, step: number): Record<string, Status> {
  const st: Record<string, Status> = { ...(def.initial ?? {}) };
  for (let i = 0; i <= step && i < def.steps.length; i++) Object.assign(st, def.steps[i].set ?? {});
  return st;
}

/** Pure SVG renderer of a FlowDef frame – reused by FlowPlayer and live simulators */
export function FlowCanvas({
  def,
  step,
  t,
  onNodeClick,
  selected,
  className,
}: {
  def: FlowDef;
  step: number;
  t: number;
  onNodeClick?: (id: string) => void;
  selected?: string;
  className?: string;
}) {
  const W = def.width ?? 820;
  const H = def.height ?? 400;
  const map = useMemo(() => Object.fromEntries(def.nodes.map((n) => [n.id, n])), [def.nodes]);
  const status = useMemo(() => computeStatus(def, step), [def, step]);
  const cur = def.steps[step];
  const focus = new Set(cur?.focus ?? []);
  const uid = def.id.replace(/[^a-z0-9]/gi, '');

  const hidden = (id: string) => status[id] === 'hidden';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? 'w-full h-auto'} role="img" aria-label={def.title}>
      <defs>
        <marker id={`arr-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--color-faint)' }} />
        </marker>
        <marker id={`arrh-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--color-accent)' }} />
        </marker>
        <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* groups */}
      {(def.groups ?? []).map((g) => {
        if (hidden(g.id)) return null;
        const tone = TONE[status[g.id] === 'fail' ? 'danger' : g.tone];
        const isFocus = focus.has(g.id);
        return (
          <g key={g.id} opacity={status[g.id] === 'off' ? 0.35 : 1}>
            <rect
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              rx={10}
              style={{ fill: tone.fill, stroke: isFocus ? 'var(--color-accent)' : tone.stroke, strokeWidth: isFocus ? 2 : 1.2 }}
              strokeDasharray={tone.dash}
            />
            <text x={g.x + 10} y={g.y + 16} style={{ fill: status[g.id] === 'fail' ? '#f0524d' : tone.stroke, fontSize: 11, fontWeight: 600 }}>
              {g.label}
              {status[g.id] === 'fail' ? '  ✕ FAILED' : ''}
            </text>
          </g>
        );
      })}

      {/* edges */}
      {def.edges.map((e) => {
        if (hidden(e.id) || hidden(e.from) || hidden(e.to)) return null;
        const g = edgeGeom(e, map);
        if (!g) return null;
        const isFocus = focus.has(e.id);
        const st = status[e.id];
        const off = st === 'off' || status[e.from] === 'fail' || status[e.to] === 'fail';
        const color = st === 'fail' ? '#f0524d' : isFocus ? 'var(--color-accent)' : 'var(--color-faint)';
        const lx = g.curved ? 0.25 * g.x1 + 0.5 * g.cx + 0.25 * g.x2 : (g.x1 + g.x2) / 2;
        const ly = g.curved ? 0.25 * g.y1 + 0.5 * g.cy + 0.25 * g.y2 : (g.y1 + g.y2) / 2;
        return (
          <g key={e.id} opacity={off ? 0.3 : 1}>
            <path
              d={edgePath(g)}
              style={{ fill: 'none', stroke: color, strokeWidth: isFocus ? 2.2 : 1.4 }}
              strokeDasharray={e.dashed ? '5 4' : undefined}
              className={isFocus && !e.dashed ? 'dash-flow' : undefined}
              markerEnd={e.plain ? undefined : `url(#${isFocus ? 'arrh' : 'arr'}-${uid})`}
              markerStart={e.both ? `url(#${isFocus ? 'arrh' : 'arr'}-${uid})` : undefined}
            />
            {e.label && (
              <g>
                <rect x={lx - e.label.length * 3.1 - 4} y={ly - 8} width={e.label.length * 6.2 + 8} height={15} rx={4} style={{ fill: 'var(--color-bg)', opacity: 0.85 }} />
                <text x={lx} y={ly + 3} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 9.5 }}>
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {def.nodes.map((n) => {
        if (hidden(n.id)) return null;
        const { w, h } = nodeSize(n);
        const st = status[n.id];
        const color = KIND_COLOR[n.kind] ?? '#94a3b8';
        const isFocus = focus.has(n.id);
        const isSel = selected === n.id;
        const C = ICONS[n.icon ?? KIND_ICON[n.kind]] ?? Box;
        const stroke = st === 'fail' ? '#f0524d' : st === 'warn' ? '#f5b83d' : isFocus || isSel ? 'var(--color-accent)' : color;
        const badge = cur?.badges?.[n.id];
        const x = n.x - w / 2;
        const y = n.y - h / 2;
        return (
          <g
            key={n.id}
            opacity={st === 'off' ? 0.35 : 1}
            onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
            style={{ cursor: onNodeClick ? 'pointer' : undefined }}
          >
            {(st === 'new' || isFocus) && (
              <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={12} className="pulse-ring" style={{ fill: 'none', stroke: st === 'new' ? '#2fbf71' : 'var(--color-accent)', strokeWidth: 2 }} />
            )}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={9}
              filter={isFocus ? `url(#glow-${uid})` : undefined}
              style={{
                fill: st === 'fail' ? 'rgba(240,82,77,0.14)' : 'var(--color-panel)',
                stroke,
                strokeWidth: isFocus || isSel || st === 'fail' ? 2.2 : 1.3,
              }}
            />
            <rect x={x} y={y} width={4} height={h} rx={2} style={{ fill: color }} />
            <C x={x + 10} y={n.y - 9} width={18} height={18} color={color} strokeWidth={2} />
            <text x={x + 34} y={n.sub ? n.y - 2 : n.y + 4} style={{ fill: 'var(--color-ink)', fontSize: 11.5, fontWeight: 600 }}>
              {n.label}
            </text>
            {n.sub && (
              <text x={x + 34} y={n.y + 12} style={{ fill: 'var(--color-muted)', fontSize: 9.5 }}>
                {n.sub}
              </text>
            )}
            {st === 'fail' && (
              <g>
                <circle cx={x + w - 4} cy={y + 4} r={9} style={{ fill: '#f0524d' }} />
                <text x={x + w - 4} y={y + 8} textAnchor="middle" style={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}>
                  ✕
                </text>
              </g>
            )}
            {st === 'new' && (
              <g>
                <circle cx={x + w - 4} cy={y + 4} r={9} style={{ fill: '#2fbf71' }} />
                <text x={x + w - 4} y={y + 8} textAnchor="middle" style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}>
                  +
                </text>
              </g>
            )}
            {badge && (
              <g>
                <rect x={n.x - badge.length * 3.3 - 6} y={y - 22} width={badge.length * 6.6 + 12} height={17} rx={8} style={{ fill: 'var(--color-accent)' }} />
                <text x={n.x} y={y - 10} textAnchor="middle" style={{ fill: '#111', fontSize: 10, fontWeight: 700 }}>
                  {badge}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* packets */}
      {(cur?.packets ?? []).map((p, i) => {
        const e = def.edges.find((x) => x.id === p.edge);
        if (!e) return null;
        const g = edgeGeom(e, map);
        if (!g) return null;
        const at = p.at ?? 0;
        const span = p.span ?? Math.max(0.1, 0.78 - at);
        const raw = (t - at) / span;
        if (raw < 0) return null;
        let prog = ease(Math.min(1, raw));
        const dropped = p.dropAt !== undefined && prog >= p.dropAt;
        if (p.dropAt !== undefined) prog = Math.min(prog, p.dropAt);
        if (!dropped && raw > 1.25) return null; // arrived – fade out
        const pt = pointAt(g, p.reverse ? 1 - prog : prog);
        const c = PACKET_COLORS[p.color ?? 'blue'];
        return (
          <g key={i} opacity={raw > 1 && !dropped ? Math.max(0, 1 - (raw - 1) * 4) : 1}>
            <circle cx={pt.x} cy={pt.y} r={11} style={{ fill: c, opacity: 0.22 }} />
            <circle cx={pt.x} cy={pt.y} r={6.5} style={{ fill: c, stroke: '#fff', strokeWidth: 1.5 }} />
            {dropped && (
              <text x={pt.x} y={pt.y + 5} textAnchor="middle" style={{ fill: '#fff', fontSize: 11, fontWeight: 800 }}>
                ✕
              </text>
            )}
            {p.label && (
              <g>
                <rect x={pt.x - p.label.length * 3.1 - 5} y={pt.y - 27} width={p.label.length * 6.2 + 10} height={15} rx={4} style={{ fill: c }} />
                <text x={pt.x} y={pt.y - 16} textAnchor="middle" style={{ fill: '#0b111b', fontSize: 9.5, fontWeight: 700 }}>
                  {p.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function FlowPlayer({ def, compact, autoStart }: { def: FlowDef; compact?: boolean; autoStart?: boolean }) {
  const durations = useMemo(() => def.steps.map((s) => s.duration ?? 2600), [def]);
  const tl = useTimeline(durations, { autoStart });
  const cur = def.steps[tl.step];
  const logs = def.steps.slice(0, tl.step + 1).filter((s) => s.log);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{def.title}</h3>
          {def.description && <p className="text-xs text-muted mt-0.5">{def.description}</p>}
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">Simulated animation</span>
      </div>
      <div className={compact ? '' : 'grid lg:grid-cols-[1fr_290px]'}>
        <div className="bg-bg/60 p-2 sm:p-3">
          <FlowCanvas def={def} step={tl.step} t={tl.t} />
        </div>
        <div className={`border-line ${compact ? 'border-t' : 'border-t lg:border-t-0 lg:border-l'} flex flex-col`}>
          <div className="p-4 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Step {tl.step + 1} / {def.steps.length}
            </div>
            <div className="mt-1 font-semibold text-sm">{cur?.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{cur?.text}</p>
          </div>
          {!compact && (
            <ol className="max-h-48 overflow-auto border-t border-line px-2 py-2 text-xs">
              {def.steps.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => tl.goto(i)}
                    className={`w-full text-left rounded-md px-2 py-1 flex gap-2 ${i === tl.step ? 'bg-accent-soft text-accent' : i < tl.step ? 'text-ink/80 hover:bg-panel2' : 'text-faint hover:bg-panel2'}`}
                  >
                    <span className="w-4 shrink-0 text-right">{i + 1}.</span>
                    <span>{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {logs.length > 0 && (
            <div className="border-t border-line px-3 py-2 max-h-28 overflow-auto mono text-[11px] text-muted space-y-0.5">
              {logs.map((s, i) => (
                <div key={i}>
                  <span className="text-ok">›</span> {s.log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlaybackControls tl={tl} total={def.steps.length} />
    </div>
  );
}
