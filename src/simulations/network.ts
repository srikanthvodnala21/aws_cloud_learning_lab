/**
 * Educational VPC packet-path engine.
 * Implements: CIDR math, longest-prefix-match route selection, stateful security groups,
 * stateless network ACLs (ordered, first match wins), IGW 1:1 NAT, NAT Gateway source NAT.
 */

export const ipToInt = (ip: string) => ip.split('.').reduce((a, o) => ((a << 8) >>> 0) + (Number(o) & 255), 0) >>> 0;

export function parseCidr(cidr: string): { base: number; bits: number } | null {
  const m = cidr.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) return null;
  const bits = Number(m[2]);
  if (bits > 32 || m[1].split('.').some((o) => Number(o) > 255)) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { base: (ipToInt(m[1]) & mask) >>> 0, bits };
}

export function inCidr(ip: string, cidr: string) {
  const c = parseCidr(cidr);
  if (!c) return false;
  const mask = c.bits === 0 ? 0 : (~0 << (32 - c.bits)) >>> 0;
  return ((ipToInt(ip) & mask) >>> 0) === c.base;
}

export type Target = 'local' | 'igw' | 'nat' | 'pcx' | 'blackhole';

export interface Route {
  dest: string;
  target: Target;
}

export interface RouteLookup {
  candidates: { route: Route; matches: boolean; bits: number }[];
  chosen?: Route;
}

export function lookup(routes: Route[], ip: string): RouteLookup {
  const candidates = routes.map((r) => ({ route: r, matches: inCidr(ip, r.dest), bits: parseCidr(r.dest)?.bits ?? -1 }));
  const chosen = candidates.filter((c) => c.matches).sort((a, b) => b.bits - a.bits)[0]?.route;
  return { candidates, chosen };
}

export interface NaclRule {
  num: number;
  action: 'allow' | 'deny';
  ports: string; // "443", "1024-65535", "all"
  cidr: string;
}

export function portMatch(spec: string, port: number) {
  if (spec.trim() === 'all') return true;
  const [a, b] = spec.split('-').map((x) => Number(x.trim()));
  if (b !== undefined && !Number.isNaN(b)) return port >= a && port <= b;
  return a === port;
}

export function evalNacl(rules: NaclRule[], port: number, peerIp: string): { allowed: boolean; rule: string } {
  const sorted = [...rules].sort((a, b) => a.num - b.num);
  for (const r of sorted) {
    if (portMatch(r.ports, port) && inCidr(peerIp, r.cidr)) return { allowed: r.action === 'allow', rule: `rule ${r.num} (${r.action} ${r.ports} ${r.cidr})` };
  }
  return { allowed: false, rule: 'rule * (default deny)' };
}

export interface SgRule {
  ports: string;
  source: string; // CIDR or "sg:web-sg"
}

export function evalSg(rules: SgRule[], port: number, srcIp: string, srcSg?: string): { allowed: boolean; rule?: string } {
  const r = rules.find((x) => portMatch(x.ports, port) && (x.source.startsWith('sg:') ? x.source.slice(3) === srcSg : inCidr(srcIp, x.source)));
  return r ? { allowed: true, rule: `${r.ports} from ${r.source}` } : { allowed: false };
}

export const validCidr = (c: string) => !!parseCidr(c);
