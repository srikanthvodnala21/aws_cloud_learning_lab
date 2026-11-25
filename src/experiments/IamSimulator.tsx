import { useMemo, useState } from 'react';
import { CircleCheck, CircleX, RotateCcw, User } from 'lucide-react';
import { FlowPlayer } from '../animation/FlowPlayer';
import type { FlowDef } from '../animation/flowTypes';
import { e, g, n, p, r } from '../animation/builders';
import { evaluate, parsePolicy, type EvalResult } from '../simulations/iam';
import { S3_READ_ONLY_POLICY } from '../content/modules/m03-iam';
import { Badge, Callout, Toggle } from '../components/ui';

const DENY_DELETE_MFA = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyDeleteWithoutMFA",
      "Effect": "Deny",
      "Action": "s3:DeleteObject",
      "Resource": "arn:aws:s3:::company-reports/*",
      "Condition": { "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" } }
    }
  ]
}`;

const ACTIONS = [
  { id: 'read', label: 'Read object', verb: 'GET', action: 's3:GetObject', resource: 'arn:aws:s3:::company-reports/q1-report.pdf', cli: 'aws s3 cp s3://company-reports/q1-report.pdf .' },
  { id: 'upload', label: 'Upload object', verb: 'PUT', action: 's3:PutObject', resource: 'arn:aws:s3:::company-reports/q2-report.pdf', cli: 'aws s3 cp q2-report.pdf s3://company-reports/' },
  { id: 'delete', label: 'Delete object', verb: 'DELETE', action: 's3:DeleteObject', resource: 'arn:aws:s3:::company-reports/q1-report.pdf', cli: 'aws s3 rm s3://company-reports/q1-report.pdf' },
  { id: 'list', label: 'List bucket', verb: 'LIST', action: 's3:ListBucket', resource: 'arn:aws:s3:::company-reports', cli: 'aws s3 ls s3://company-reports/' },
  { id: 'other', label: 'Read another bucket', verb: 'GET', action: 's3:GetObject', resource: 'arn:aws:s3:::hr-payroll/salaries.csv', cli: 'aws s3 cp s3://hr-payroll/salaries.csv .' },
];

const PRESETS: Record<string, string> = {
  'S3 read-only (default)': S3_READ_ONLY_POLICY,
  'S3 read + write': S3_READ_ONLY_POLICY.replace('"s3:ListBucket"', '"s3:ListBucket",\n        "s3:PutObject",\n        "s3:DeleteObject"').replace('AllowS3ReadOnly', 'AllowS3ReadWrite'),
  'Wildcard s3:Get*': S3_READ_ONLY_POLICY.replace('"s3:GetObject"', '"s3:Get*"'),
  'All S3 on all buckets (too broad!)': `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:*", "Resource": "*" }
  ]
}`,
};

function buildFlow(act: (typeof ACTIONS)[number], res: EvalResult, attempt: number): FlowDef {
  const allowed = res.decision === 'Allow';
  const verdictText =
    res.decision === 'Allow'
      ? `Statement "${res.matched?.sid}" in ${res.matched?.source} allows ${act.action}. No Deny applies.`
      : res.decision === 'ExplicitDeny'
        ? `Statement "${res.matched?.sid}" in ${res.matched?.source} explicitly DENIES ${act.action}. Explicit deny always wins.`
        : `No statement allows ${act.action} on this resource → implicit deny (the default).`;
  return {
    id: `iam-${attempt}`,
    title: `${act.label}: ${act.action}`,
    description: act.resource,
    width: 820,
    height: 300,
    groups: [g('eng', 'IAM authorization', 230, 30, 380, 240, 'generic')],
    nodes: [
      n('dev', 'Developer', 90, 150, 'user', 'IAM user'),
      n('authn', 'Authenticate', 330, 90, 'security', 'SigV4 ✓', { icon: 'key' }),
      n('deny', 'Explicit Deny?', 510, 90, 'security', res.decision === 'ExplicitDeny' ? 'YES' : 'none found', { icon: 'shield' }),
      n('allow', 'Explicit Allow?', 510, 210, 'security', res.decision === 'Allow' ? 'YES' : res.decision === 'ExplicitDeny' ? 'skipped' : 'none found', { icon: 'shieldcheck' }),
      n('dec', allowed ? 'ALLOW' : 'DENY', 330, 210, 'security', res.decision, { icon: allowed ? 'check' : 'lock' }),
      n('s3', 'Amazon S3', 730, 150, 'storage', act.resource.split(':::')[1].split('/')[0]),
    ],
    edges: [e('a', 'dev', 'authn'), e('b', 'authn', 'deny'), e('c', 'deny', 'allow'), e('d', 'allow', 'dec'), e('dd', 'deny', 'dec'), e('s', 'dev', 's3', { curve: -150, dashed: true }), e('back', 'dec', 'dev')],
    initial: { s: allowed ? 'ok' : 'hidden' },
    steps: [
      { title: 'Signed request sent', text: `$ ${act.cli}`, packets: [p('a', 'blue', act.verb)], log: act.cli },
      { title: 'Check for explicit Deny', text: res.decision === 'ExplicitDeny' ? `A Deny statement matches: ${res.matched?.note}.` : 'All applicable policies are scanned for a matching Deny statement. None matches.', packets: [p('b', 'blue')], focus: ['deny'], set: res.decision === 'ExplicitDeny' ? { deny: 'fail' } : {} },
      ...(res.decision === 'ExplicitDeny'
        ? [{ title: 'Explicit deny – stop', text: verdictText, packets: [p('dd', 'red', 'DENY')], set: { dec: 'fail' as const } }]
        : [
            { title: 'Check for explicit Allow', text: allowed ? `Allowed by: ${res.matched?.sid} (${res.matched?.note}).` : 'No Allow statement matches the action and resource.', packets: [p('c', 'blue')], focus: ['allow'], set: allowed ? { allow: 'active' as const } : { allow: 'warn' as const } },
            { title: allowed ? 'Decision: Allow' : 'Decision: implicit Deny', text: verdictText, packets: [p('d', allowed ? 'green' : 'red', allowed ? 'ALLOW' : 'DENY')], set: allowed ? { dec: 'active' as const } : { dec: 'fail' as const } },
          ]),
      allowed
        ? { title: 'S3 performs the operation', text: `${act.action} succeeds and S3 returns 200 OK. The call is recorded in CloudTrail.`, packets: [p('s', 'green', act.verb, { span: 0.4 }), r('s', 'green', '200 OK', { at: 0.45, span: 0.35 })], log: `${act.action} → 200 OK` }
        : { title: 'AccessDenied returned', text: `An error occurred (AccessDenied) when calling the ${act.action.split(':')[1]} operation. S3 was never touched.`, packets: [p('back', 'red', '403 AccessDenied')], log: `${act.action} → AccessDenied (${res.decision})` },
    ],
  };
}

export default function IamSimulator() {
  const [policyText, setPolicyText] = useState(S3_READ_ONLY_POLICY);
  const [denyMfa, setDenyMfa] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [attempt, setAttempt] = useState<{ act: (typeof ACTIONS)[number]; res: EvalResult; n: number } | null>(null);
  const [history, setHistory] = useState<{ label: string; decision: string }[]>([]);

  const parsed = useMemo(() => parsePolicy(policyText), [policyText]);

  const run = (act: (typeof ACTIONS)[number]) => {
    if (!parsed.policy) return;
    const policies = [{ name: 'Developer identity policy', policy: parsed.policy }];
    if (denyMfa) policies.push({ name: 'DenyDeleteWithoutMFA policy', policy: parsePolicy(DENY_DELETE_MFA).policy! });
    const res = evaluate(policies, { action: act.action, resource: act.resource, context: { 'aws:MultiFactorAuthPresent': mfa ? 'true' : 'false' } });
    const nn = (attempt?.n ?? 0) + 1;
    setAttempt({ act, res, n: nn });
    setHistory((h) => [{ label: `${act.action} ${act.resource.replace('arn:aws:s3:::', '')}`, decision: res.decision }, ...h].slice(0, 8));
  };

  const flow = useMemo(() => (attempt ? buildFlow(attempt.act, attempt.res, attempt.n) : null), [attempt]);

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-panel2 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-sky/15 text-sky">
              <User size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">Developer</div>
              <div className="mono text-[11px] text-muted">arn:aws:iam::111122223333:user/Developer</div>
            </div>
            <Badge tone="sky">IAM user</Badge>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="label">Identity-based policy (editable JSON)</div>
              <button className="btn btn-sm" onClick={() => setPolicyText(S3_READ_ONLY_POLICY)}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {Object.entries(PRESETS).map(([k, v]) => (
                <button key={k} className={`btn btn-sm ${policyText === v ? 'btn-active' : ''}`} onClick={() => setPolicyText(v)}>
                  {k}
                </button>
              ))}
            </div>
            <textarea value={policyText} onChange={(ev) => setPolicyText(ev.target.value)} spellCheck={false} className="input mono w-full h-72 text-[12px] leading-relaxed" />
            {parsed.error ? <div className="mt-1 text-[12px] text-bad">{parsed.error}</div> : <div className="mt-1 text-[12px] text-ok">✓ Valid policy</div>}
          </div>
          <div className="space-y-2 rounded-lg border border-line p-3">
            <Toggle checked={denyMfa} onChange={setDenyMfa} label={<span>Attach a second policy: <b>Deny s3:DeleteObject unless MFA</b></span>} />
            <Toggle checked={mfa} onChange={setMfa} label={<span>Developer signed in with <b>MFA</b> (aws:MultiFactorAuthPresent)</span>} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="label">Try an action as Developer</div>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => (
              <button key={a.id} disabled={!parsed.policy} className="btn justify-start" onClick={() => run(a)}>
                <span className="mono text-[10px] text-accent w-12">{a.verb}</span> {a.label}
              </button>
            ))}
          </div>
          {attempt && (
            <div className={`rounded-lg border p-3 ${attempt.res.decision === 'Allow' ? 'border-ok/50 bg-ok/5' : 'border-bad/50 bg-bad/5'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {attempt.res.decision === 'Allow' ? <CircleCheck size={17} className="text-ok" /> : <CircleX size={17} className="text-bad" />}
                {attempt.res.decision === 'Allow' ? 'Allowed' : attempt.res.decision === 'ExplicitDeny' ? 'Denied – explicit deny' : 'Denied – implicit deny'}
              </div>
              <div className="mt-1 mono text-[11px] text-muted break-all">
                {attempt.act.action} on {attempt.act.resource}
              </div>
              <table className="lab-table mt-2">
                <thead>
                  <tr>
                    <th>Statement</th>
                    <th>Effect</th>
                    <th>Evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {attempt.res.traces.map((t, i) => (
                    <tr key={i} className={t.applies ? (t.effect === 'Deny' ? 'bg-bad/10' : 'bg-ok/10') : ''}>
                      <td className="text-[12px]">
                        {t.sid}
                        <div className="text-[10px] text-faint">{t.source}</div>
                      </td>
                      <td className="text-[12px]">{t.effect}</td>
                      <td className="text-[12px] text-muted">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {history.length > 0 && (
            <div>
              <div className="label mb-1">Attempt history</div>
              <ul className="space-y-1 text-[12px] mono">
                {history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-2 rounded border border-line px-2 py-1">
                    <span className="truncate text-muted">{h.label}</span>
                    <span className={h.decision === 'Allow' ? 'text-ok' : 'text-bad'}>{h.decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!attempt && <Callout kind="tip">Start with <b>Read object</b>, then <b>Upload</b> and <b>Delete</b>. Then switch the preset to read + write, and turn on the MFA deny policy to see an explicit deny override an allow.</Callout>}
        </div>
      </div>
      {flow && <FlowPlayer key={flow.id} def={flow} autoStart />}
      <Callout kind="info" title="What real IAM also evaluates">
        This simulator evaluates identity-based policies with Allow/Deny, wildcards and simple conditions. Real AWS also considers Service Control Policies and Resource Control Policies (AWS Organizations), permissions boundaries, session policies and resource-based policies such as bucket policies. An explicit Deny in any of them wins; SCPs, RCPs and boundaries can only restrict, never grant.
      </Callout>
    </div>
  );
}
