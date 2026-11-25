import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Check, X, Pause } from 'lucide-react';
import { useInterval } from '../animation/useLoop';
import { Badge, Callout, Slider, Tabs, Toggle } from '../components/ui';

/* ------------------------------------------------------------ pipeline */

type SState = 'idle' | 'running' | 'ok' | 'fail' | 'waiting' | 'skipped' | 'rolledback';
const STAGES = [
  { id: 'source', label: 'Source', desc: 'git push to main triggers the pipeline (webhook).', ticks: 1 },
  { id: 'build', label: 'Build', desc: 'Compile and build the container image, tagged with the commit SHA.', ticks: 3 },
  { id: 'test', label: 'Unit & integration tests', desc: 'Fail fast, so broken code never ships.', ticks: 3 },
  { id: 'scan', label: 'Security scan', desc: 'Dependency (SCA), SAST and image scanning, for example with Amazon Inspector on ECR.', ticks: 2 },
  { id: 'staging', label: 'Deploy to staging', desc: 'Same artifact, staging account. Smoke tests run.', ticks: 3 },
  { id: 'approve', label: 'Manual approval', desc: 'A human gate before production (optional in continuous deployment).', ticks: 0 },
  { id: 'prod', label: 'Deploy to production', desc: 'Rolling or blue/green deployment with automatic rollback alarms.', ticks: 3 },
  { id: 'verify', label: 'Post-deploy monitoring', desc: 'CloudWatch alarms on 5xx and latency during a bake time.', ticks: 3 },
] as const;
type StageId = (typeof STAGES)[number]['id'];

function Pipeline() {
  const [failTest, setFailTest] = useState(false);
  const [vuln, setVuln] = useState(false);
  const [badRelease, setBadRelease] = useState(false);
  const [states, setStates] = useState<Record<StageId, SState>>(() => Object.fromEntries(STAGES.map((s) => [s.id, 'idle'])) as Record<StageId, SState>);
  const [cur, setCur] = useState<number>(-1);
  const [left, setLeft] = useState(0);
  const [prodVersion, setProdVersion] = useState('v41');
  const [log, setLog] = useState<string[]>([]);
  const [runs, setRuns] = useState<{ n: number; result: string; ok: boolean }[]>([]);
  const runN = useRef(41);
  const version = `v${runN.current + 1}`;

  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 16));
  const finish = (result: string, ok: boolean) => {
    setCur(-1);
    setRuns((r) => [{ n: runN.current + 1, result, ok }, ...r].slice(0, 6));
    if (ok) runN.current += 1;
  };

  const start = () => {
    setStates(Object.fromEntries(STAGES.map((s) => [s.id, 'idle'])) as Record<StageId, SState>);
    setCur(0);
    setLeft(STAGES[0].ticks);
    setStates((s) => ({ ...s, source: 'running' }));
    setLog([`▶ Pipeline #${runN.current + 1} started for commit a1b2c3d (${version})`]);
  };

  useInterval(
    () => {
      if (cur < 0) return;
      const st = STAGES[cur];
      if (st.id === 'approve') return; // waiting for a human
      if (left > 1) return setLeft(left - 1);
      // stage completes – decide outcome
      let failed = false;
      let msg = `✓ ${st.label} succeeded`;
      if (st.id === 'test' && failTest) {
        failed = true;
        msg = '✕ Tests failed: OrderServiceTest.calculatesTax expected 8.25 but was 8.20';
      }
      if (st.id === 'scan' && vuln) {
        failed = true;
        msg = '✕ Security scan: CRITICAL CVE in a dependency (log4j-core 2.14.1) – pipeline blocked';
      }
      if (st.id === 'verify' && badRelease) {
        setStates((s) => ({ ...s, verify: 'fail', prod: 'rolledback' }));
        say('✕ Alarm "prod-5xx-rate" in ALARM during bake time');
        say(`↩ Automatic rollback: production returned to ${prodVersion}. Deployment marked FAILED.`);
        finish('rolled back', false);
        return;
      }
      if (failed) {
        setStates((s) => {
          const ns = { ...s, [st.id]: 'fail' as SState };
          STAGES.slice(cur + 1).forEach((x) => (ns[x.id] = 'skipped'));
          return ns;
        });
        say(msg);
        say('Pipeline stopped – nothing reached production.');
        finish(`failed at ${st.label}`, false);
        return;
      }
      say(msg);
      if (st.id === 'prod') {
        setProdVersion(version);
        say(`Production now running ${version}`);
      }
      const nx = cur + 1;
      if (nx >= STAGES.length) {
        setStates((s) => ({ ...s, [st.id]: 'ok' }));
        say(`✓ Pipeline #${runN.current + 1} succeeded`);
        finish('succeeded', true);
        return;
      }
      setStates((s) => ({ ...s, [st.id]: 'ok', [STAGES[nx].id]: STAGES[nx].id === 'approve' ? 'waiting' : 'running' }));
      if (STAGES[nx].id === 'approve') say('⏸ Waiting for manual approval…');
      setCur(nx);
      setLeft(STAGES[nx].ticks);
    },
    cur >= 0 ? 600 : null,
  );

  const decide = (ok: boolean) => {
    if (cur < 0 || STAGES[cur].id !== 'approve') return;
    if (!ok) {
      setStates((s) => ({ ...s, approve: 'fail', prod: 'skipped', verify: 'skipped' }));
      say('✕ Rejected by reviewer. Release stopped.');
      finish('rejected', false);
      return;
    }
    say('✓ Approved by release manager');
    setStates((s) => ({ ...s, approve: 'ok', prod: 'running' }));
    setCur(cur + 1);
    setLeft(STAGES[cur + 1].ticks);
  };

  const color: Record<SState, string> = { idle: 'border-line text-faint', running: 'border-sky text-sky', ok: 'border-ok text-ok', fail: 'border-bad text-bad', waiting: 'border-warn text-warn', skipped: 'border-line text-faint opacity-50', rolledback: 'border-warn text-warn' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={cur >= 0} onClick={start}>
          <Play size={14} /> Run pipeline ({version})
        </button>
        <Toggle checked={failTest} onChange={setFailTest} label="Inject failing test" />
        <Toggle checked={vuln} onChange={setVuln} label="Inject vulnerable dependency" />
        <Toggle checked={badRelease} onChange={setBadRelease} label="Release causes 5xx errors" />
        <span className="ml-auto text-[12px] text-muted">
          Production: <b className="mono text-ink">{prodVersion}</b>
        </span>
      </div>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {STAGES.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <motion.div animate={{ scale: states[s.id] === 'running' || states[s.id] === 'waiting' ? 1.04 : 1 }} className={`w-32 rounded-lg border-2 bg-panel p-2 ${color[states[s.id]]}`} title={s.desc}>
              <div className="text-[11.5px] font-semibold leading-tight">{s.label}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide">
                {states[s.id] === 'running' ? 'running…' : states[s.id] === 'rolledback' ? 'rolled back' : states[s.id]}
              </div>
              {s.id === 'approve' && states.approve === 'waiting' && (
                <div className="mt-1 flex gap-1">
                  <button className="btn btn-sm btn-primary px-1.5" onClick={() => decide(true)}>
                    <Check size={11} />
                  </button>
                  <button className="btn btn-sm btn-danger px-1.5" onClick={() => decide(false)}>
                    <X size={11} />
                  </button>
                </div>
              )}
            </motion.div>
            {i < STAGES.length - 1 && <span className="text-faint">→</span>}
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="mono text-[11px] text-muted h-44 overflow-auto rounded-lg border border-line p-2 space-y-0.5">
          {log.map((l, i) => (
            <div key={i} className={l.startsWith('✕') ? 'text-bad' : l.startsWith('✓') ? 'text-ok' : l.startsWith('↩') || l.startsWith('⏸') ? 'text-warn' : ''}>
              {l}
            </div>
          ))}
          {log.length === 0 && <div className="text-faint">Press “Run pipeline”. Hover a stage for its purpose.</div>}
        </div>
        <div className="rounded-lg border border-line p-2">
          <div className="label mb-1">Run history</div>
          {runs.map((r, i) => (
            <div key={i} className="flex justify-between text-[12px]">
              <span className="mono">#{r.n}</span>
              <span className={r.ok ? 'text-ok' : 'text-bad'}>{r.result}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------- deployment strategies */

type Strat = 'allatonce' | 'rolling' | 'bluegreen' | 'canary';
interface Frame {
  label: string;
  blue: number; // instances on v1 (serving)
  green: number; // instances on v2 (serving)
  down: number; // instances out of service
  idleGreen?: number; // green fleet up but not receiving traffic
  v2Share: number; // % of traffic on v2
  note: string;
}

function framesFor(s: Strat, buggy: boolean, N: number): Frame[] {
  const f: Frame[] = [{ label: 'Start', blue: N, green: 0, down: 0, v2Share: 0, note: `All ${N} instances run v1.` }];
  const detect = (fr: Frame[], share: number) => {
    fr.push({ ...fr[fr.length - 1], label: 'Alarm!', note: `Error-rate alarm fires: ${share}% of traffic is hitting buggy v2.` });
  };
  if (s === 'allatonce') {
    f.push({ label: 'Deploy', blue: 0, green: 0, down: N, v2Share: 0, note: 'Every instance is updated at once – the app is DOWN during the deploy.' });
    f.push({ label: 'Up on v2', blue: 0, green: N, down: 0, v2Share: 100, note: '100% of users are on v2 immediately.' });
    if (buggy) {
      detect(f, 100);
      f.push({ label: 'Redeploy v1', blue: 0, green: 0, down: N, v2Share: 0, note: 'Rollback means another full deployment – a second outage.' });
      f.push({ label: 'Back on v1', blue: N, green: 0, down: 0, v2Share: 0, note: 'Recovered, after two outages and 100% of users affected.' });
    }
  } else if (s === 'rolling') {
    const batch = 2;
    let g = 0;
    while (g < N) {
      const b = Math.min(batch, N - g);
      f.push({ label: `Batch ${g / batch + 1}`, blue: N - g - b, green: g, down: b, v2Share: Math.round((g / (N - b)) * 100), note: `Taking ${b} instances out of service to update them. Capacity is reduced to ${N - b}/${N}.` });
      g += b;
      const share = Math.round((g / N) * 100);
      f.push({ label: `Batch ${g / batch} done`, blue: N - g, green: g, down: 0, v2Share: share, note: `${g}/${N} instances on v2 (${share}% of traffic).` });
      if (buggy && g >= 4) {
        detect(f, share);
        f.push({ label: 'Roll back', blue: N - g, green: 0, down: g, v2Share: 0, note: 'Rolling back means redeploying v1 to every updated instance, batch by batch – it takes time.' });
        f.push({ label: 'Back on v1', blue: N, green: 0, down: 0, v2Share: 0, note: `Recovered. Roughly ${share}% of users were affected for several minutes.` });
        break;
      }
    }
  } else if (s === 'bluegreen') {
    f.push({ label: 'Launch green', blue: N, green: 0, down: 0, idleGreen: N, v2Share: 0, note: `A second full fleet (green) is launched with v2. Users still on blue. Double capacity costs extra during the switch.` });
    f.push({ label: 'Test green', blue: N, green: 0, down: 0, idleGreen: N, v2Share: 0, note: 'Run smoke tests against green through a test listener / URL.' });
    f.push({ label: 'Switch', blue: 0, green: N, down: 0, idleGreen: 0, v2Share: 100, note: 'Load balancer listener (or DNS weight) switches 100% of traffic to green in one step.' });
    if (buggy) {
      detect(f, 100);
      f.push({ label: 'Switch back', blue: N, green: 0, down: 0, idleGreen: N, v2Share: 0, note: 'Blue is still running, so rollback is just flipping traffic back – seconds, not minutes.' });
    } else f.push({ label: 'Retire blue', blue: 0, green: N, down: 0, v2Share: 100, note: 'After a bake time, the blue fleet is terminated.' });
  } else {
    f.push({ label: 'Canary 10%', blue: N - 1, green: 1, down: 0, v2Share: 10, note: '10% of traffic is shifted to v2 (for example a weighted target group or Lambda alias). Watch the alarms.' });
    if (buggy) {
      detect(f, 10);
      f.push({ label: 'Auto rollback', blue: N, green: 0, down: 0, v2Share: 0, note: 'The deployment automatically shifts the 10% back. Only a small slice of users ever saw the bug.' });
    } else {
      f.push({ label: 'Bake 10 min', blue: N - 1, green: 1, down: 0, v2Share: 10, note: 'Metrics look healthy during the bake time.' });
      f.push({ label: 'Shift 100%', blue: 0, green: N, down: 0, v2Share: 100, note: 'Remaining traffic is shifted to v2.' });
    }
  }
  return f;
}

const STRATS: Record<Strat, { label: string; rollback: string; cost: string; risk: string }> = {
  allatonce: { label: 'All at once', rollback: 'Slow (redeploy)', cost: 'Lowest', risk: 'Highest – downtime, everyone affected' },
  rolling: { label: 'Rolling', rollback: 'Slow (re-roll)', cost: 'Low (reduced capacity)', risk: 'Medium – a growing share affected' },
  bluegreen: { label: 'Blue/green', rollback: 'Instant (switch back)', cost: 'High during deploy (2× fleet)', risk: 'Low downtime, but 100% switch' },
  canary: { label: 'Canary', rollback: 'Fast, automatic', cost: 'Low', risk: 'Lowest – small blast radius' },
};

function Strategies() {
  const [strat, setStrat] = useState<Strat>('canary');
  const [buggy, setBuggy] = useState(true);
  const [N, setN] = useState(8);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const frames = useMemo(() => framesFor(strat, buggy, N), [strat, buggy, N]);
  const fr = frames[Math.min(i, frames.length - 1)];

  useInterval(() => setI((x) => (x + 1 < frames.length ? x + 1 : x)), playing ? 1600 : null);

  const affected = useMemo(() => {
    if (!buggy) return { maxShare: 0, downtime: frames.filter((x) => x.down === N).length };
    const shares = frames.slice(0, i + 1).map((x) => x.v2Share);
    return { maxShare: Math.max(0, ...shares), downtime: frames.slice(0, i + 1).filter((x) => x.down === N).length };
  }, [frames, i, buggy, N]);

  const reset = (s: Strat = strat, b = buggy) => {
    setStrat(s);
    setBuggy(b);
    setI(0);
    setPlaying(true);
  };

  const boxes = [...Array(fr.blue).fill('blue'), ...Array(fr.green).fill('green'), ...Array(fr.down).fill('down')] as ('blue' | 'green' | 'down')[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs tabs={(Object.keys(STRATS) as Strat[]).map((k) => ({ id: k, label: STRATS[k].label }))} value={strat} onChange={(v) => reset(v)} />
        <Toggle checked={buggy} onChange={(v) => reset(strat, v)} label="v2 has a bug" />
        <div className="w-40">
          <Slider label="Instances" value={N} min={4} max={12} step={2} onChange={(v) => { setN(v); setI(0); }} />
        </div>
        <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button className="btn btn-sm" onClick={() => reset()}>
          <RotateCcw size={12} /> Replay
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {frames.map((x, k) => (
          <button key={k} className={`btn btn-sm ${k === i ? 'btn-active' : ''} ${x.label === 'Alarm!' ? 'text-bad' : ''}`} onClick={() => { setI(k); setPlaying(false); }}>
            {k + 1}. {x.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-line bg-bg/60 p-4 space-y-4">
          <div>
            <div className="label mb-1">Traffic split</div>
            <div className="flex h-7 overflow-hidden rounded-md border border-line">
              <motion.div animate={{ width: `${fr.down === N ? 0 : 100 - fr.v2Share}%` }} className="grid place-items-center bg-sky/70 text-[11px] font-semibold text-white">
                {fr.down !== N && 100 - fr.v2Share > 8 ? `v1 ${100 - fr.v2Share}%` : ''}
              </motion.div>
              <motion.div animate={{ width: `${fr.down === N ? 0 : fr.v2Share}%` }} className={`grid place-items-center text-[11px] font-semibold text-white ${buggy ? 'bg-bad/80' : 'bg-ok/80'}`}>
                {fr.v2Share > 8 ? `v2 ${fr.v2Share}%` : ''}
              </motion.div>
              {fr.down === N && <div className="grid flex-1 place-items-center bg-bad/30 text-[11px] font-semibold text-bad">503 – no capacity</div>}
            </div>
          </div>
          <div>
            <div className="label mb-1">Serving fleet</div>
            <div className="flex flex-wrap gap-1.5">
              {boxes.map((b, k) => (
                <motion.div layout key={`${b}-${k}`} className={`grid h-12 w-14 place-items-center rounded-md border text-[10.5px] font-semibold ${b === 'blue' ? 'border-sky bg-sky/15 text-sky' : b === 'green' ? (buggy ? 'border-bad bg-bad/15 text-bad' : 'border-ok bg-ok/15 text-ok') : 'border-line bg-panel3 text-faint'}`}>
                  {b === 'blue' ? 'v1' : b === 'green' ? `v2${buggy ? ' 🐞' : ''}` : 'updating'}
                </motion.div>
              ))}
            </div>
          </div>
          {fr.idleGreen ? (
            <div>
              <div className="label mb-1">Green fleet (standby, no traffic)</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: fr.idleGreen }).map((_, k) => (
                  <div key={k} className={`grid h-10 w-14 place-items-center rounded-md border border-dashed text-[10.5px] ${fr.blue === N ? (fr.label === 'Switch back' ? 'border-bad text-bad' : 'border-ok text-ok') : ''}`}>
                    {fr.label === 'Switch back' ? 'v2 🐞' : 'v2'}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className={`rounded-md border px-3 py-2 text-[13px] ${fr.label === 'Alarm!' ? 'border-bad/60 bg-bad/10' : 'border-line'}`}>{fr.note}</div>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-line p-3 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-muted">Users exposed to the bug</span>
              <b className={affected.maxShare > 50 ? 'text-bad' : affected.maxShare > 0 ? 'text-warn' : 'text-ok'}>{buggy ? `${affected.maxShare}%` : 'n/a'}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Full outages</span>
              <b className={affected.downtime ? 'text-bad' : 'text-ok'}>{affected.downtime}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Rollback speed</span>
              <b>{STRATS[strat].rollback}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Extra infra cost</span>
              <b>{STRATS[strat].cost}</b>
            </div>
          </div>
          <table className="lab-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(STRATS) as Strat[]).map((k) => (
                <tr key={k} className={k === strat ? 'bg-accent-soft' : ''}>
                  <td className="text-[12px] font-medium">{STRATS[k].label}</td>
                  <td className="text-[11.5px] text-muted">{STRATS[k].risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-1">
            <Badge>CodeDeploy</Badge>
            <Badge>ECS blue/green</Badge>
            <Badge>Lambda aliases</Badge>
            <Badge>ALB weighted TGs</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CicdSimulator() {
  const [tab, setTab] = useState<'pipe' | 'strat'>('pipe');
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <Tabs
        tabs={[
          { id: 'pipe', label: 'CI/CD pipeline run' },
          { id: 'strat', label: 'Deployment strategies' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'pipe' ? <Pipeline /> : <Strategies />}
      <Callout kind="sim">The pipeline is simulated. In real setups you would use CodePipeline/CodeBuild/CodeDeploy, GitHub Actions or GitLab CI with OIDC federation to an IAM role – see the code examples above.</Callout>
    </div>
  );
}
