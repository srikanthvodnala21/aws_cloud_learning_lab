/**
 * Simplified IAM policy evaluator for learning.
 * Supports: Effect, Action / NotAction, Resource / NotResource (with * and ? wildcards),
 * and Bool / BoolIfExists / StringEquals / StringLike / IpAddress-free conditions on a small
 * request context. Implements the core rule: explicit Deny > explicit Allow > implicit Deny.
 * Real IAM also evaluates SCPs, RCPs, permissions boundaries, session policies, resource
 * policies across accounts, etc. – those are summarised in the UI, not fully modelled.
 */

export interface Statement {
  Sid?: string;
  Effect: 'Allow' | 'Deny';
  Action?: string | string[];
  NotAction?: string | string[];
  Resource?: string | string[];
  NotResource?: string | string[];
  Condition?: Record<string, Record<string, string | string[] | boolean>>;
  Principal?: unknown;
}

export interface Policy {
  Version?: string;
  Statement: Statement | Statement[];
}

export interface RequestCtx {
  action: string;
  resource: string;
  context: Record<string, string | undefined>; // e.g. { 'aws:MultiFactorAuthPresent': 'true' }
}

export interface StatementTrace {
  index: number;
  sid: string;
  effect: 'Allow' | 'Deny';
  actionMatch: boolean;
  resourceMatch: boolean;
  conditionMatch: boolean;
  applies: boolean;
  note: string;
  source: string;
}

export interface EvalResult {
  decision: 'Allow' | 'ExplicitDeny' | 'ImplicitDeny';
  traces: StatementTrace[];
  matched?: StatementTrace;
  error?: string;
}

const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function wildcardMatch(pattern: string, value: string, caseInsensitive = false) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${esc}$`, caseInsensitive ? 'i' : '').test(value);
}

function evalCondition(cond: Statement['Condition'], ctx: RequestCtx): { ok: boolean; note: string } {
  if (!cond) return { ok: true, note: '' };
  for (const [op, kv] of Object.entries(cond)) {
    for (const [key, expected] of Object.entries(kv)) {
      const actual = ctx.context[key];
      const ifExists = op.endsWith('IfExists');
      const base = op.replace(/IfExists$/, '');
      if (actual === undefined) {
        if (ifExists) continue;
        return { ok: false, note: `condition key ${key} not present in request` };
      }
      const exp = arr(expected as string | string[]).map(String);
      let ok = false;
      if (base === 'Bool' || base === 'StringEquals') ok = exp.some((e) => e.toLowerCase() === String(actual).toLowerCase());
      else if (base === 'StringNotEquals') ok = !exp.some((e) => e === actual);
      else if (base === 'StringLike') ok = exp.some((e) => wildcardMatch(e, String(actual)));
      else return { ok: false, note: `operator ${op} not supported in this simulator` };
      if (!ok) return { ok: false, note: `${op} ${key}: expected ${exp.join('|')}, got ${actual}` };
    }
  }
  return { ok: true, note: 'conditions satisfied' };
}

export function parsePolicy(text: string): { policy?: Policy; error?: string } {
  try {
    const p = JSON.parse(text) as Policy;
    if (!p || typeof p !== 'object' || !p.Statement) return { error: 'Policy must have a "Statement" element.' };
    for (const s of arr(p.Statement)) {
      if (s.Effect !== 'Allow' && s.Effect !== 'Deny') return { error: 'Each statement needs "Effect": "Allow" or "Deny".' };
      if (!s.Action && !s.NotAction) return { error: 'Each statement needs "Action" or "NotAction".' };
      if (!s.Resource && !s.NotResource) return { error: 'Identity-based statements need "Resource" or "NotResource".' };
    }
    return { policy: p };
  } catch (e) {
    return { error: `Invalid JSON: ${(e as Error).message}` };
  }
}

export function evaluate(policies: { name: string; policy: Policy }[], req: RequestCtx): EvalResult {
  const traces: StatementTrace[] = [];
  policies.forEach(({ name, policy }) => {
    arr(policy.Statement).forEach((s, i) => {
      const actionMatch = s.Action ? arr(s.Action).some((a) => wildcardMatch(a, req.action, true)) : !arr(s.NotAction).some((a) => wildcardMatch(a, req.action, true));
      const resourceMatch = s.Resource ? arr(s.Resource).some((r) => wildcardMatch(r, req.resource)) : !arr(s.NotResource).some((r) => wildcardMatch(r, req.resource));
      const c = actionMatch && resourceMatch ? evalCondition(s.Condition, req) : { ok: false, note: '' };
      const applies = actionMatch && resourceMatch && c.ok;
      let note = '';
      if (!actionMatch) note = `action ${req.action} not in ${JSON.stringify(s.Action ?? { NotAction: s.NotAction })}`;
      else if (!resourceMatch) note = `resource does not match ${JSON.stringify(s.Resource ?? { NotResource: s.NotResource })}`;
      else if (!c.ok) note = c.note;
      else note = `matches → ${s.Effect}`;
      traces.push({ index: i, sid: s.Sid ?? `Statement ${i + 1}`, effect: s.Effect, actionMatch, resourceMatch, conditionMatch: c.ok, applies, note, source: name });
    });
  });
  const deny = traces.find((t) => t.applies && t.effect === 'Deny');
  if (deny) return { decision: 'ExplicitDeny', traces, matched: deny };
  const allow = traces.find((t) => t.applies && t.effect === 'Allow');
  if (allow) return { decision: 'Allow', traces, matched: allow };
  return { decision: 'ImplicitDeny', traces };
}
