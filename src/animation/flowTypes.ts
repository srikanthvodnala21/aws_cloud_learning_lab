/**
 * Declarative animation format used by every architecture animation in the lab.
 * A FlowDef is a diagram (groups, nodes, edges) plus an ordered list of steps.
 * Each step can move packets along edges, highlight things and change the
 * status of nodes/edges (e.g. fail an instance, reveal a new one).
 */

export type NodeKind =
  | 'user'
  | 'internet'
  | 'compute'
  | 'network'
  | 'storage'
  | 'database'
  | 'security'
  | 'integration'
  | 'monitoring'
  | 'devops'
  | 'container'
  | 'onprem'
  | 'edge'
  | 'dns'
  | 'generic';

export type Status = 'ok' | 'fail' | 'warn' | 'off' | 'hidden' | 'new' | 'active';

export type PacketColor = 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'teal' | 'pink' | 'gray';

export interface FlowNode {
  id: string;
  label: string;
  sub?: string;
  x: number; // center
  y: number; // center
  w?: number;
  h?: number;
  kind: NodeKind;
  icon?: string;
}

export type GroupTone = 'cloud' | 'region' | 'az' | 'vpc' | 'public' | 'private' | 'onprem' | 'edge' | 'generic' | 'danger';

export interface FlowGroup {
  id: string;
  label: string;
  x: number; // top-left
  y: number;
  w: number;
  h: number;
  tone: GroupTone;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  /** draw without arrowhead */
  plain?: boolean;
  /** draw arrowheads at both ends */
  both?: boolean;
  /** curve amount (perpendicular offset, px) */
  curve?: number;
}

export interface Packet {
  edge: string;
  reverse?: boolean;
  color?: PacketColor;
  label?: string;
  /** 0..1 – start fraction of the step */
  at?: number;
  /** 0..1 – fraction of the step the travel takes */
  span?: number;
  /** packet is dropped/blocked at this fraction of the path (shows ✕) */
  dropAt?: number;
}

export interface FlowStep {
  title: string;
  text: string;
  packets?: Packet[];
  /** ids of nodes / edges / groups to highlight during this step */
  focus?: string[];
  /** cumulative status changes (applied from this step onward) */
  set?: Record<string, Status>;
  /** text written to the event log */
  log?: string;
  /** ms at 1x speed (default 2600) */
  duration?: number;
  /** small badge texts shown next to nodes for this step only */
  badges?: Record<string, string>;
}

export interface FlowDef {
  id: string;
  title: string;
  description?: string;
  width?: number;
  height?: number;
  groups?: FlowGroup[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  steps: FlowStep[];
  /** initial statuses before step 0 */
  initial?: Record<string, Status>;
}
