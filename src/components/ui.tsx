import { useState, type ReactNode } from 'react';
import { Info, Lightbulb, TriangleAlert, FlaskConical, Copy, Check } from 'lucide-react';

export function PageHeader({ eyebrow, title, desc, right }: { eyebrow?: string; title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</div>}
        <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-tight">{title}</h1>
        {desc && <div className="mt-2 text-[14px] leading-relaxed text-muted">{desc}</div>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, sub, id }: { children: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-3 mt-10 first:mt-0 scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'ok' | 'bad' | 'warn' | 'sky' | 'violet' }) {
  const cls: Record<string, string> = {
    default: 'border-line text-muted',
    accent: 'border-accent/40 text-accent bg-accent-soft',
    ok: 'border-ok/40 text-ok bg-ok/10',
    bad: 'border-bad/40 text-bad bg-bad/10',
    warn: 'border-warn/40 text-warn bg-warn/10',
    sky: 'border-sky/40 text-sky bg-sky/10',
    violet: 'border-violet/40 text-violet bg-violet/10',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls[tone]}`}>{children}</span>;
}

export function Callout({ kind = 'info', title, children }: { kind?: 'info' | 'tip' | 'warn' | 'sim'; title?: string; children: ReactNode }) {
  const map = {
    info: { Icon: Info, cls: 'border-sky/35 bg-sky/5', ic: 'text-sky' },
    tip: { Icon: Lightbulb, cls: 'border-ok/35 bg-ok/5', ic: 'text-ok' },
    warn: { Icon: TriangleAlert, cls: 'border-warn/40 bg-warn/5', ic: 'text-warn' },
    sim: { Icon: FlaskConical, cls: 'border-violet/35 bg-violet/5', ic: 'text-violet' },
  }[kind];
  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-[13px] leading-relaxed ${map.cls}`}>
      <map.Icon size={17} className={`mt-0.5 shrink-0 ${map.ic}`} />
      <div className="min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

export function SimNote({ children }: { children?: ReactNode }) {
  return (
    <Callout kind="sim" title="Simulation">
      {children ?? 'This runs entirely in your browser with simplified logic. No AWS API calls are made and no real resources are created.'}
    </Callout>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel2 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${value === t.id ? 'bg-panel text-ink shadow-sm border border-line' : 'text-muted hover:text-ink border border-transparent'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function highlight(code: string, lang: string) {
  // tiny, dependency-free highlighter for JSON / YAML / shell
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (lang === 'json') {
    return esc
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span style="color:#7dd3fc">$1</span>$2')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span style="color:#fcd34d">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span style="color:#f472b6">$1</span>');
  }
  if (lang === 'yaml') {
    return esc
      .split('\n')
      .map((l) => {
        if (/^\s*#/.test(l)) return `<span style="color:#6b7f95">${l}</span>`;
        return l.replace(/^(\s*-?\s*)([A-Za-z0-9_.\-]+)(:)/, '$1<span style="color:#7dd3fc">$2</span>$3');
      })
      .join('\n');
  }
  return esc
    .split('\n')
    .map((l) => (/^\s*#/.test(l) ? `<span style="color:#6b7f95">${l}</span>` : l))
    .join('\n');
}

export function CodeBlock({ code, lang = 'text', title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-line overflow-hidden bg-[#0a0f17]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-[11px] text-slate-400">
        <span className="mono">{title ?? lang}</span>
        <button
          className="flex items-center gap-1 hover:text-white"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-auto p-3 text-[12px] leading-relaxed text-slate-200">
        <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
      </pre>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-panel3 overflow-hidden ${className ?? ''}`}>
      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-faint">{hint}</div>}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs mb-1">
        <span className="label">{label}</span>
        <span className="mono text-ink">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-panel3 border border-line'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

export function Loading() {
  return <div className="p-10 text-sm text-muted">Loading…</div>;
}
