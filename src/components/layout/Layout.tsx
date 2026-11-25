import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Moon, Search, Sun, X, CircleCheck } from 'lucide-react';
import { MODULES } from '../../content/modules';
import { useProgress } from '../../store/progress';
import { Icon } from '../icons';
import { SearchDialog } from './SearchDialog';
import { ProgressBar } from '../ui';

const MAIN_NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/roadmap', label: 'Learning Roadmap', icon: 'map' },
  { to: '/modules', label: 'All Modules', icon: 'book' },
  { to: '/playground', label: 'Architecture Playground', icon: 'puzzle' },
  { to: '/scenarios', label: 'Scenario Lab', icon: 'flask' },
  { to: '/compare', label: 'Service Comparisons', icon: 'scale' },
  { to: '/cost', label: 'Cost Explorer', icon: 'calculator' },
  { to: '/services', label: 'Service Catalog', icon: 'layers' },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { completed } = useProgress();
  const pct = completed.length / MODULES.length;
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${isActive ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:text-ink hover:bg-panel2'}`;
  return (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-line">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon name="cloud" size={20} />
        </div>
        <div>
          <div className="text-[14px] font-bold leading-tight">AWS Cloud Learning Lab</div>
          <div className="text-[11px] text-muted">Learn AWS by seeing it work</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {MAIN_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link} onClick={onNavigate}>
              <Icon name={n.icon} size={16} /> {n.label}
            </NavLink>
          ))}
        </div>
        <div className="label px-2.5 mt-5 mb-1.5">Modules</div>
        <div className="space-y-0.5">
          {MODULES.map((m) => (
            <NavLink key={m.id} to={`/modules/${m.id}`} className={link} onClick={onNavigate}>
              <span className="w-5 text-right text-[11px] text-faint mono">{m.num}</span>
              <Icon name={m.icon} size={15} />
              <span className="flex-1 truncate">{m.short}</span>
              {completed.includes(m.id) && <CircleCheck size={14} className="text-ok shrink-0" />}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="border-t border-line p-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted">Progress</span>
          <span className="mono">
            {completed.length}/{MODULES.length}
          </span>
        </div>
        <ProgressBar value={pct} />
        <p className="mt-2 text-[10.5px] leading-snug text-faint">Educational simulator. Not affiliated with or endorsed by Amazon Web Services.</p>
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useProgress();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => setMobileOpen(false), [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-line bg-panel">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-line bg-panel">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/80 backdrop-blur px-3 sm:px-5">
          <button className="btn btn-sm lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <button onClick={() => setSearchOpen(true)} className="flex flex-1 max-w-xl items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-[13px] text-muted hover:border-faint">
            <Search size={15} />
            <span className="flex-1 text-left">Search services, topics, scenarios…</span>
            <kbd className="hidden sm:inline rounded border border-line px-1.5 text-[10px] mono">⌘K</kbd>
          </button>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 text-[11px] text-violet">
            <span className="h-1.5 w-1.5 rounded-full bg-violet" /> Simulated – no AWS calls
          </span>
          <button className="btn btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>
        <main id="main-scroll" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
