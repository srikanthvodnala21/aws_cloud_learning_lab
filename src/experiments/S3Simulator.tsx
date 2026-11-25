import { useEffect, useMemo, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { Upload, Trash2, Clock, History, Download, RotateCcw, Plus } from 'lucide-react';
import { S3_CLASSES, PRICING_DISCLAIMER, type S3ClassId } from '../data/pricing';
import { Badge, Callout, Field } from '../components/ui';

type Versioning = 'Unversioned' | 'Enabled' | 'Suspended';

interface Version {
  vid: string;
  size: number; // GB
  cls: S3ClassId;
  created: number; // sim day
  marker?: boolean;
  restore?: 'in-progress' | 'done';
}

interface Obj {
  key: string;
  versions: Version[]; // newest first
}

interface Rule {
  days: number;
  to: S3ClassId;
}

const SAMPLES = [
  { key: 'website/index.html', size: 0.002 },
  { key: 'reports/q3-2026.pdf', size: 0.05 },
  { key: 'logs/app-2026-10.tar.gz', size: 120 },
  { key: 'backups/db-2026-11-01.dump', size: 400 },
  { key: 'media/product-video.mp4', size: 8 },
];

const ORDER: S3ClassId[] = ['STANDARD', 'INTELLIGENT_TIERING', 'STANDARD_IA', 'ONEZONE_IA', 'GLACIER_IR', 'GLACIER', 'DEEP_ARCHIVE'];
const SHORT: Record<S3ClassId, string> = {
  STANDARD: 'Standard',
  INTELLIGENT_TIERING: 'Intelligent-Tiering',
  STANDARD_IA: 'Standard-IA',
  ONEZONE_IA: 'One Zone-IA',
  GLACIER_IR: 'Glacier Instant',
  GLACIER: 'Glacier Flexible',
  DEEP_ARCHIVE: 'Deep Archive',
};
const NEEDS_RESTORE = (c: S3ClassId) => c === 'GLACIER' || c === 'DEEP_ARCHIVE';
const TAKEN = ['test', 'my-bucket', 'photos', 'backup', 'data', 'aws'];

function validateBucket(name: string): string[] {
  const errs: string[] = [];
  if (name.length < 3 || name.length > 63) errs.push('Must be 3–63 characters long.');
  if (!/^[a-z0-9.-]*$/.test(name)) errs.push('Only lowercase letters, numbers, dots (.) and hyphens (-).');
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name)) errs.push('Must begin and end with a letter or number.');
  if (name.includes('..')) errs.push('Must not contain two adjacent dots.');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) errs.push('Must not be formatted as an IP address.');
  if (name.startsWith('xn--') || name.startsWith('sthree-')) errs.push('Must not start with a reserved prefix (xn--, sthree-).');
  if (name.endsWith('-s3alias') || name.endsWith('--ol-s3')) errs.push('Must not end with a reserved suffix.');
  if (TAKEN.includes(name)) errs.push('Already taken – bucket names are globally unique across all AWS accounts (in a partition).');
  return errs;
}

let vc = 1;
const newVid = () => `3HL4kqtJ${(vc++).toString(36).padStart(4, '0')}vlcuiE`;
const fmtGb = (g: number) => (g < 1 ? `${Math.round(g * 1024)} MB` : `${g} GB`);

export default function S3Simulator() {
  const [bucketInput, setBucketInput] = useState('acme-media-assets-2026');
  const [bucket, setBucket] = useState<string | null>(null);
  const [versioning, setVersioning] = useState<Versioning>('Unversioned');
  const [objs, setObjs] = useState<Obj[]>([]);
  const [day, setDay] = useState(0);
  const [uploadCls, setUploadCls] = useState<S3ClassId>('STANDARD');
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleDays, setRuleDays] = useState(30);
  const [ruleTo, setRuleTo] = useState<S3ClassId>('STANDARD_IA');
  const [log, setLog] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const errs = validateBucket(bucketInput);
  const say = (m: string) => setLog((l) => [`Day ${day}: ${m}`, ...l].slice(0, 14));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const upload = (key: string, size: number) => {
    const vid = versioning === 'Enabled' ? newVid() : 'null';
    setObjs((os) => {
      const existing = os.find((o) => o.key === key);
      const v: Version = { vid, size, cls: uploadCls, created: day };
      if (!existing) return [...os, { key, versions: [v] }];
      return os.map((o) => {
        if (o.key !== key) return o;
        // unversioned / suspended: the "null" version is overwritten
        const others = vid === 'null' ? o.versions.filter((x) => x.vid !== 'null') : o.versions;
        return { ...o, versions: [v, ...others] };
      });
    });
    const exists = objs.some((o) => o.key === key);
    say(`PUT ${key} (${SHORT[uploadCls]})${exists ? (versioning === 'Enabled' ? ` → new version ${vid.slice(0, 10)}…; previous version kept as noncurrent` : ' → overwrote the existing object (no versioning)') : ''}`);
  };

  const del = (key: string) => {
    const o = objs.find((x) => x.key === key)!;
    if (versioning === 'Unversioned') {
      setObjs((os) => os.filter((x) => x.key !== key));
      say(`DELETE ${key} → permanently deleted (versioning was never enabled).`);
      return;
    }
    const marker: Version = { vid: versioning === 'Enabled' ? newVid() : 'null', size: 0, cls: 'STANDARD', created: day, marker: true };
    setObjs((os) => os.map((x) => (x.key === key ? { ...x, versions: [marker, ...(marker.vid === 'null' ? x.versions.filter((v) => v.vid !== 'null') : x.versions)] } : x)));
    say(`DELETE ${key} → delete marker added. ${o.versions.filter((v) => !v.marker).length} earlier version(s) still stored (and billed).`);
  };

  const deleteVersion = (key: string, vid: string) => {
    setObjs((os) => os.map((x) => (x.key === key ? { ...x, versions: x.versions.filter((v) => v.vid !== vid) } : x)).filter((x) => x.versions.length > 0));
    const v = objs.find((x) => x.key === key)?.versions.find((x) => x.vid === vid);
    say(v?.marker ? `DELETE ${key}?versionId=${vid.slice(0, 10)}… → delete marker removed: object restored!` : `DELETE ${key}?versionId=${vid.slice(0, 10)}… → that version permanently deleted.`);
  };

  const download = (o: Obj) => {
    const cur = o.versions[0];
    if (cur.marker) return setToast(`404 NoSuchKey – the current version of ${o.key} is a delete marker.`);
    if (NEEDS_RESTORE(cur.cls) && cur.restore !== 'done') return setToast(`403 InvalidObjectState – ${o.key} is in ${SHORT[cur.cls]}. Restore it first.`);
    setToast(`200 OK – downloaded ${o.key} (${fmtGb(cur.size)})${cur.cls === 'STANDARD_IA' || cur.cls === 'ONEZONE_IA' || cur.cls.startsWith('GLACIER') ? ' · retrieval fee applies' : ''}`);
    say(`GET ${o.key} → 200 OK`);
  };

  const restore = (o: Obj) => {
    setObjs((os) => os.map((x) => (x.key === o.key ? { ...x, versions: x.versions.map((v, i) => (i === 0 ? { ...v, restore: 'in-progress' } : v)) } : x)));
    say(`RestoreObject ${o.key} (Standard tier) → in progress. ${o.versions[0].cls === 'DEEP_ARCHIVE' ? 'Typically within 12 h.' : 'Typically 3–5 h.'} Simulated as 4 seconds.`);
    setTimeout(() => {
      setObjs((os) => os.map((x) => (x.key === o.key ? { ...x, versions: x.versions.map((v, i) => (i === 0 && v.restore === 'in-progress' ? { ...v, restore: 'done' } : v)) } : x)));
      setToast(`Restore complete: a temporary copy of ${o.key} is available to download.`);
    }, 4000);
  };

  const advance = (n: number) => {
    const nd = day + n;
    const msgs: string[] = [];
    const sorted = [...rules].sort((a, b) => a.days - b.days);
    setObjs(
      objs.map((o) => ({
        ...o,
        versions: o.versions.map((v, i) => {
          if (v.marker || i !== 0) return v;
          let cls = v.cls;
          for (const r of sorted) if (nd - v.created >= r.days && ORDER.indexOf(r.to) > ORDER.indexOf(cls)) cls = r.to;
          if (cls !== v.cls) msgs.push(`lifecycle: ${o.key} ${SHORT[v.cls]} → ${SHORT[cls]}`);
          return cls !== v.cls ? { ...v, cls, restore: undefined } : v;
        }),
      })),
    );
    setDay(nd);
    setLog((l) => [...msgs.map((m) => `Day ${nd}: ${m}`), `Day ${nd}: ⏩ advanced ${n} day(s)`, ...l].slice(0, 14));
  };

  const cost = useMemo(() => {
    let current = 0;
    let noncurrent = 0;
    objs.forEach((o) =>
      o.versions.forEach((v, i) => {
        if (v.marker) return;
        const price = S3_CLASSES.find((c) => c.id === v.cls)!.perGb * v.size;
        if (i === 0) current += price; // index 0 is current unless it is a delete marker (skipped above)
        else noncurrent += price;
      }),
    );
    return { current, noncurrent };
  }, [objs]);

  const ruleWarn = (ruleTo === 'STANDARD_IA' || ruleTo === 'ONEZONE_IA') && ruleDays < 30 ? 'S3 requires objects to be at least 30 days old before transitioning to Standard-IA or One Zone-IA.' : null;

  if (!bucket) {
    return (
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="text-[13px] font-semibold">Step 1 – Create a bucket</div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <Field label="Bucket name">
              <input className={`input w-full mono ${errs.length ? 'border-bad' : 'border-ok'}`} value={bucketInput} onChange={(e) => setBucketInput(e.target.value)} />
            </Field>
            <Field label="Region">
              <select className="select w-full" defaultValue="eu-west-1">
                <option value="us-east-1">us-east-1</option>
                <option value="eu-west-1">eu-west-1</option>
                <option value="ap-south-1">ap-south-1</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {['My-Bucket', 'ab', 'photos', '192.168.1.1', 'logs..archive', 'acme-logs-prod-001'].map((s) => (
                <button key={s} className="btn btn-sm mono" onClick={() => setBucketInput(s)}>
                  {s}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={errs.length > 0}
              onClick={() => {
                setBucket(bucketInput);
                setLog([`Day 0: CreateBucket ${bucketInput} → 200 OK. Block Public Access ON, SSE-S3 encryption ON by default.`]);
              }}
            >
              <Plus size={14} /> Create bucket
            </button>
          </div>
          <div className="space-y-1.5">
            {errs.length === 0 ? (
              <div className="text-[13px] text-ok">✓ Valid and available (simulated uniqueness check)</div>
            ) : (
              errs.map((e) => (
                <div key={e} className="text-[12.5px] text-bad">
                  ✕ {e}
                </div>
              ))
            )}
            <Callout kind="info">S3 is a Regional service: the bucket and its data live in the Region you choose, replicated across at least three AZs (except One Zone classes) – but the bucket <b>name</b> is global.</Callout>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[14px] font-semibold">s3://{bucket}</div>
          <div className="text-[12px] text-muted">
            Versioning: <Badge tone={versioning === 'Enabled' ? 'ok' : versioning === 'Suspended' ? 'warn' : 'default'}>{versioning}</Badge> · Simulated day <b className="mono text-ink">{day}</b>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-sm" disabled={versioning === 'Enabled'} onClick={() => { setVersioning('Enabled'); say('PutBucketVersioning Enabled'); }}>
            Enable versioning
          </button>
          <button className="btn btn-sm" disabled={versioning !== 'Enabled'} onClick={() => { setVersioning('Suspended'); say('PutBucketVersioning Suspended – existing versions are kept.'); }}>
            Suspend
          </button>
          {[1, 30, 90].map((d) => (
            <button key={d} className="btn btn-sm" onClick={() => advance(d)}>
              <Clock size={12} /> +{d} d
            </button>
          ))}
          <button
            className="btn btn-sm"
            onClick={() => {
              setBucket(null);
              setObjs([]);
              setVersioning('Unversioned');
              setDay(0);
              setRules([]);
              setLog([]);
            }}
          >
            <RotateCcw size={12} /> Start over
          </button>
        </div>
      </div>
      {versioning !== 'Unversioned' && <p className="-mt-3 text-[11.5px] text-faint">Once enabled, versioning can only be suspended – a bucket can never return to the unversioned state.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Upload as</span>
            <select className="select text-[12px]" value={uploadCls} onChange={(e) => setUploadCls(e.target.value as S3ClassId)}>
              {ORDER.map((c) => (
                <option key={c} value={c}>
                  {SHORT[c]}
                </option>
              ))}
            </select>
            {SAMPLES.map((s) => (
              <button key={s.key} className="btn btn-sm" onClick={() => upload(s.key, s.size)}>
                <Upload size={12} /> {s.key.split('/')[1]}
              </button>
            ))}
          </div>
          <LayoutGroup>
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] grid-cols-7 gap-1.5">
                {ORDER.map((c) => (
                  <div key={c} className="min-h-40 rounded-lg border border-line bg-panel2/50 p-1.5">
                    <div className="mb-1.5 text-center text-[10.5px] font-semibold text-muted">{SHORT[c]}</div>
                    <div className="mb-1 text-center mono text-[9.5px] text-faint">${S3_CLASSES.find((x) => x.id === c)!.perGb}/GB-mo</div>
                    <div className="space-y-1">
                      {objs
                        .filter((o) => !o.versions[0].marker && o.versions[0].cls === c)
                        .map((o) => (
                          <motion.button layout layoutId={o.key} key={o.key} onClick={() => setOpenKey(o.key)} className={`w-full rounded border px-1 py-1 text-left text-[10.5px] ${openKey === o.key ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`} transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
                            <div className="truncate font-medium">{o.key.split('/')[1]}</div>
                            <div className="text-faint">
                              {fmtGb(o.versions[0].size)} · {o.versions.length}v{o.versions[0].restore === 'in-progress' ? ' · restoring…' : o.versions[0].restore === 'done' ? ' · restored' : ''}
                            </div>
                          </motion.button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </LayoutGroup>
          {objs.some((o) => o.versions[0].marker) && (
            <div className="rounded-lg border border-dashed border-bad/40 p-2">
              <div className="label mb-1">Hidden by a delete marker (not listed by a normal LIST)</div>
              <div className="flex flex-wrap gap-1.5">
                {objs
                  .filter((o) => o.versions[0].marker)
                  .map((o) => (
                    <button key={o.key} className="btn btn-sm" onClick={() => setOpenKey(o.key)}>
                      {o.key}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {(() => {
            const o = objs.find((x) => x.key === openKey);
            if (!o) return objs.length === 0 ? <Callout kind="tip">Upload a few files, enable versioning, upload one again, delete it – then open it to see its versions and restore it.</Callout> : null;
            const cur = o.versions[0];
            return (
              <div className="rounded-lg border border-line p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="mono text-[13px] font-semibold">{o.key}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn btn-sm" onClick={() => download(o)}>
                      <Download size={12} /> GET
                    </button>
                    {!cur.marker && NEEDS_RESTORE(cur.cls) && !cur.restore && (
                      <button className="btn btn-sm btn-primary" onClick={() => restore(o)}>
                        Restore from archive
                      </button>
                    )}
                    {!cur.marker && (
                      <button className="btn btn-sm btn-danger" onClick={() => del(o.key)}>
                        <Trash2 size={12} /> DELETE (no version id)
                      </button>
                    )}
                  </div>
                </div>
                <table className="lab-table">
                  <thead>
                    <tr>
                      <th>
                        <History size={12} className="inline" /> Version ID
                      </th>
                      <th>Type</th>
                      <th>Class</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {o.versions.map((v, i) => (
                      <tr key={v.vid + i} className={i === 0 ? 'bg-accent-soft' : ''}>
                        <td className="mono text-[11px]">{v.vid === 'null' ? 'null' : `${v.vid.slice(0, 12)}…`}</td>
                        <td className="text-[12px]">{v.marker ? <Badge tone="bad">delete marker</Badge> : i === 0 ? <Badge tone="ok">current</Badge> : <Badge>noncurrent</Badge>}</td>
                        <td className="text-[12px]">{v.marker ? '–' : SHORT[v.cls]}</td>
                        <td className="text-[12px]">day {v.created}</td>
                        <td>
                          {versioning !== 'Unversioned' && (
                            <button className="btn btn-sm" onClick={() => deleteVersion(o.key, v.vid)}>
                              {v.marker ? 'Remove marker (undelete)' : 'Delete version'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {toast && <div className={`rounded-lg border px-3 py-2 text-[12.5px] mono ${toast.startsWith('200') || toast.startsWith('Restore') ? 'border-ok/50 text-ok' : 'border-bad/50 text-bad'}`}>{toast}</div>}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-line p-3 space-y-2">
            <div className="text-[13px] font-semibold">Lifecycle rules</div>
            {rules.length === 0 && <div className="text-[12px] text-faint">No rules. Objects stay in their class forever.</div>}
            {[...rules]
              .sort((a, b) => a.days - b.days)
              .map((r, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span>
                    After <b>{r.days}</b> days → <b>{SHORT[r.to]}</b>
                  </span>
                  <button className="btn btn-sm" onClick={() => setRules((rs) => rs.filter((x) => x !== r))} aria-label="Remove rule">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            <div className="flex gap-1.5">
              <input className="input w-16" type="number" min={0} value={ruleDays} onChange={(e) => setRuleDays(Number(e.target.value))} />
              <select className="select flex-1 text-[12px]" value={ruleTo} onChange={(e) => setRuleTo(e.target.value as S3ClassId)}>
                {ORDER.slice(1).map((c) => (
                  <option key={c} value={c}>
                    {SHORT[c]}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm" disabled={!!ruleWarn} onClick={() => setRules((rs) => [...rs, { days: ruleDays, to: ruleTo }])}>
                <Plus size={12} />
              </button>
            </div>
            {ruleWarn && <div className="text-[11.5px] text-warn">{ruleWarn}</div>}
            <button
              className="btn btn-sm w-full"
              onClick={() =>
                setRules([
                  { days: 30, to: 'STANDARD_IA' },
                  { days: 90, to: 'GLACIER' },
                  { days: 180, to: 'DEEP_ARCHIVE' },
                ])
              }
            >
              Use a typical log-archiving policy
            </button>
            <p className="text-[11px] text-faint">Then use +30 d / +90 d and watch objects move between columns.</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[13px] font-semibold">Sample monthly storage cost</div>
            <div className="mt-1 text-[12px] text-muted">
              Current versions: <b className="mono text-ink">${cost.current.toFixed(2)}</b>
            </div>
            <div className="text-[12px] text-muted">
              Noncurrent versions: <b className="mono text-ink">${cost.noncurrent.toFixed(2)}</b>
            </div>
            {cost.noncurrent > 0 && <div className="mt-1 text-[11.5px] text-warn">Old versions are billed too – add a NoncurrentVersionExpiration rule in real buckets.</div>}
            <p className="mt-1 text-[10.5px] text-faint">Storage only; excludes requests, retrieval, minimum-duration and transfer charges. {PRICING_DISCLAIMER}</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[13px] font-semibold mb-1">Event log</div>
            <div className="mono text-[11px] text-muted space-y-0.5 max-h-56 overflow-auto">
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-2">Storage classes compared</div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Sample $/GB-month</th>
                <th>First-byte latency</th>
                <th>Retrieval</th>
                <th>Min. duration</th>
                <th>AZs</th>
                <th>Use for</th>
              </tr>
            </thead>
            <tbody>
              {S3_CLASSES.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.label}</td>
                  <td className="mono">{c.perGb}</td>
                  <td className="text-muted">{c.latency}</td>
                  <td className="text-muted">{c.retrieval}</td>
                  <td>{c.minDays ? `${c.minDays} days` : '–'}</td>
                  <td>{c.azs}</td>
                  <td className="text-muted">{c.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
