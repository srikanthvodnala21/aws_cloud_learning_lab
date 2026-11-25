/**
 * Small EventBridge event-pattern matcher for learning.
 * Supports: exact values (arrays = OR), nested objects, prefix, suffix, numeric ranges,
 * exists, anything-but (value, list, or {prefix}). Keys in a pattern are ANDed.
 */

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface MatchTrace {
  path: string;
  ok: boolean;
  why: string;
}

function matchOne(rule: Json, value: Json | undefined, present: boolean): { ok: boolean; why: string } {
  if (rule !== null && typeof rule === 'object' && !Array.isArray(rule)) {
    const [op, arg] = Object.entries(rule)[0] ?? [];
    switch (op) {
      case 'prefix':
        return { ok: typeof value === 'string' && value.startsWith(String(arg)), why: `prefix "${arg}"` };
      case 'suffix':
        return { ok: typeof value === 'string' && value.endsWith(String(arg)), why: `suffix "${arg}"` };
      case 'exists':
        return { ok: present === Boolean(arg), why: `exists: ${arg}` };
      case 'numeric': {
        if (typeof value !== 'number' || !Array.isArray(arg)) return { ok: false, why: 'numeric comparison on a non-number' };
        let ok = true;
        for (let i = 0; i < arg.length; i += 2) {
          const o = arg[i];
          const v = Number(arg[i + 1]);
          if (o === '>') ok &&= value > v;
          else if (o === '>=') ok &&= value >= v;
          else if (o === '<') ok &&= value < v;
          else if (o === '<=') ok &&= value <= v;
          else if (o === '=') ok &&= value === v;
        }
        return { ok, why: `numeric ${JSON.stringify(arg)}` };
      }
      case 'anything-but': {
        if (!present) return { ok: false, why: 'anything-but requires the field to exist' };
        if (arg && typeof arg === 'object' && !Array.isArray(arg) && 'prefix' in arg) return { ok: !(typeof value === 'string' && value.startsWith(String(arg.prefix))), why: `anything-but prefix "${arg.prefix}"` };
        const list = Array.isArray(arg) ? arg : [arg];
        return { ok: !list.some((x) => x === value), why: `anything-but ${JSON.stringify(arg)}` };
      }
      default:
        return { ok: false, why: `unsupported operator ${op}` };
    }
  }
  return { ok: present && value === rule, why: `equals ${JSON.stringify(rule)}` };
}

export function matchPattern(pattern: Json, event: Json, path = '', traces: MatchTrace[] = []): { ok: boolean; traces: MatchTrace[] } {
  if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern)) {
    traces.push({ path: path || '(root)', ok: false, why: 'pattern values must be objects or arrays' });
    return { ok: false, traces };
  }
  let all = true;
  for (const [k, rule] of Object.entries(pattern)) {
    const p = path ? `${path}.${k}` : k;
    const ev = event && typeof event === 'object' && !Array.isArray(event) ? (event as Record<string, Json>)[k] : undefined;
    const present = ev !== undefined;
    if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
      const sub = matchPattern(rule, ev ?? {}, p, traces);
      all &&= sub.ok;
      continue;
    }
    if (!Array.isArray(rule)) {
      traces.push({ path: p, ok: false, why: 'leaf values in a pattern must be arrays, e.g. ["value"]' });
      all = false;
      continue;
    }
    const values = Array.isArray(ev) ? ev : [ev];
    let ok = false;
    const whys: string[] = [];
    for (const r of rule) {
      for (const v of values) {
        const m = matchOne(r, v as Json, present);
        whys.push(m.why);
        if (m.ok) ok = true;
      }
      if (rule.length === 0) break;
    }
    traces.push({ path: p, ok, why: `${JSON.stringify(ev)} ${ok ? 'matches' : 'does not match'} [${[...new Set(whys)].join(' OR ')}]` });
    all &&= ok;
  }
  return { ok: all, traces };
}
