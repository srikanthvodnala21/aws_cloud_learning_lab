import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { SPEEDS, type Timeline } from './useTimeline';

export function PlaybackControls({ tl, total }: { tl: Timeline; total: number }) {
  const overall = total ? (tl.step + Math.min(1, tl.t)) / total : 0;
  return (
    <div className="border-t border-line bg-panel2 px-3 py-2">
      <div className="h-1 w-full rounded bg-panel3 overflow-hidden mb-2">
        <div className="h-full bg-accent transition-[width] duration-75" style={{ width: `${overall * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tl.playing ? (
          <button className="btn btn-sm btn-primary" onClick={tl.pause} aria-label="Pause">
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={tl.play} aria-label="Play">
            <Play size={14} /> {tl.done ? 'Replay' : 'Play'}
          </button>
        )}
        <button className="btn btn-sm" onClick={tl.restart} aria-label="Restart">
          <RotateCcw size={14} /> Restart
        </button>
        <button className="btn btn-sm" onClick={tl.prev} disabled={tl.step === 0} aria-label="Previous step">
          <SkipBack size={14} />
        </button>
        <button className="btn btn-sm" onClick={tl.next} disabled={tl.step >= total - 1 && tl.t >= 1} aria-label="Next step">
          <SkipForward size={14} /> Step
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[11px] text-muted mr-1">Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn btn-sm ${tl.speed === s ? 'btn-active' : ''}`} onClick={() => tl.setSpeed(s)}>
              {s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
