import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MODULES, MODULE_MAP } from '../../content/modules';
import { SERVICES } from '../../data/services';
import { SCENARIOS } from '../../data/scenarios';
import { COMPARISONS } from '../../data/comparisons';
import { Icon } from '../icons';

interface Hit {
  kind: 'Module' | 'Topic' | 'Service' | 'Scenario' | 'Comparison' | 'Page';
  title: string;
  sub: string;
  to: string;
  icon: string;
  text: string;
}

function buildIndex(): Hit[] {
  const hits: Hit[] = [];
  const pages: [string, string, string][] = [
    ['Dashboard', '/', 'dashboard'],
    ['Learning Roadmap', '/roadmap', 'map'],
    ['Architecture Playground', '/playground', 'puzzle'],
    ['Cost Explorer Simulator', '/cost', 'calculator'],
    ['Scenario Lab', '/scenarios', 'flask'],
    ['Service Comparisons', '/compare', 'scale'],
    ['Service Catalog', '/services', 'layers'],
  ];
  pages.forEach(([t, to, icon]) => hits.push({ kind: 'Page', title: t, sub: 'Lab page', to, icon, text: t.toLowerCase() }));
  MODULES.forEach((m) => {
    hits.push({ kind: 'Module', title: `${m.num}. ${m.title}`, sub: m.intro.slice(0, 90) + '…', to: `/modules/${m.id}`, icon: m.icon, text: `${m.title} ${m.short} ${m.intro}`.toLowerCase() });
    m.concepts.forEach((c, i) =>
      hits.push({ kind: 'Topic', title: c.term, sub: m.title, to: `/modules/${m.id}?c=${i}`, icon: m.icon, text: `${c.term} ${c.body}`.toLowerCase() }),
    );
  });
  SERVICES.forEach((s) =>
    hits.push({ kind: 'Service', title: s.name, sub: `${s.scope} · ${MODULE_MAP[s.module]?.short ?? ''}`, to: `/modules/${s.module}`, icon: 'layers', text: `${s.name} ${s.short} ${s.desc} ${s.category}`.toLowerCase() }),
  );
  SCENARIOS.forEach((s) => hits.push({ kind: 'Scenario', title: s.title, sub: s.goal, to: `/scenarios/${s.id}`, icon: s.icon, text: `${s.title} ${s.goal}`.toLowerCase() }));
  COMPARISONS.forEach((c) => hits.push({ kind: 'Comparison', title: c.title, sub: c.verdict, to: `/compare/${c.id}`, icon: 'scale', text: `${c.title} ${c.verdict}`.toLowerCase() }));
  return hits;
}

function score(h: Hit, terms: string[]) {
  let s = 0;
  const title = h.title.toLowerCase();
  for (const t of terms) {
    if (!h.text.includes(t) && !title.includes(t)) return 0;
    if (title.startsWith(t)) s += 10;
    else if (title.includes(t)) s += 6;
    else s += 1;
  }
  const kindBoost = { Module: 3, Service: 2, Page: 2, Scenario: 1, Comparison: 1, Topic: 0 }[h.kind];
  return s + kindBoost;
}

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const index = useMemo(buildIndex, []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return index.filter((h) => h.kind === 'Module' || h.kind === 'Page').slice(0, 14);
    return index
      .map((h) => ({ h, s: score(h, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((x) => x.h);
  }, [q, index]);

  useEffect(() => setSel(0), [q]);

  const go = (h: Hit) => {
    nav(h.to);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className="card w-full max-w-2xl overflow-hidden shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={17} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === 'Enter' && results[sel]) go(results[sel]);
            }}
            placeholder="Search e.g. NAT gateway, visibility timeout, Multi-AZ, Fargate…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none"
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted mono">ESC</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="p-6 text-center text-sm text-muted">No results for “{q}”.</li>}
          {results.map((h, i) => (
            <li key={`${h.kind}-${h.to}-${h.title}`}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(h)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? 'bg-accent-soft' : ''}`}
              >
                <Icon name={h.icon} size={16} className="mt-0.5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{h.title}</div>
                  <div className="text-[11.5px] text-muted truncate">{h.sub}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-faint shrink-0 mt-0.5">{h.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
