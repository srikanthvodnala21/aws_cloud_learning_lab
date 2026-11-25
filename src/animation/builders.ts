import type { FlowEdge, FlowGroup, FlowNode, GroupTone, NodeKind, Packet, PacketColor } from './flowTypes';

export const n = (id: string, label: string, x: number, y: number, kind: NodeKind, sub?: string, extra: Partial<FlowNode> = {}): FlowNode => ({
  id,
  label,
  x,
  y,
  kind,
  sub,
  ...extra,
});

export const e = (id: string, from: string, to: string, extra: Partial<FlowEdge> = {}): FlowEdge => ({ id, from, to, ...extra });

export const g = (id: string, label: string, x: number, y: number, w: number, h: number, tone: GroupTone): FlowGroup => ({ id, label, x, y, w, h, tone });

/** packet helper: p('e1', 'blue', 'GET /') */
export const p = (edge: string, color: PacketColor = 'blue', label?: string, extra: Partial<Packet> = {}): Packet => ({ edge, color, label, ...extra });

/** reverse packet (response) */
export const r = (edge: string, color: PacketColor = 'green', label?: string, extra: Partial<Packet> = {}): Packet => ({ edge, color, label, reverse: true, ...extra });

/** a chain of packets that run one after the other along several edges within a single step */
export function chain(edges: { edge: string; reverse?: boolean }[], color: PacketColor, label?: string, start = 0, end = 0.85): Packet[] {
  const span = (end - start) / edges.length;
  return edges.map((x, i) => ({ edge: x.edge, reverse: x.reverse, color, label, at: start + i * span, span: span * 0.95 }));
}
