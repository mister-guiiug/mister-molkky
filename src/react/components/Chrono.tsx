import { useEffect, useState } from 'react';

interface ChronoProps {
  /** Match start timestamp (ms since epoch). */
  startedAt: number;
  /** Pause the chrono when the match is over. */
  paused?: boolean;
  className?: string;
}

/**
 * Format a duration in milliseconds as `Mm` or `Hh Mm`. Stays compact
 * because it lives in the match header where every pixel counts.
 */
function fmt(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}h${m.toString().padStart(2, '0')}`;
  }
  // Show MM:SS while under an hour so the user gets second-level
  // feedback at the start of a match (and we don't tick every render).
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Live elapsed-time display. Ticks every second; the parent re-render
 * cost is negligible since this component is leaf-level. When `paused`
 * is true the interval is cancelled so finished matches don't keep
 * ticking forever in the background.
 */
export function Chrono({ startedAt, paused = false, className }: ChronoProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <time
      dateTime={`PT${Math.floor((now - startedAt) / 1000)}S`}
      className={className}
      aria-live="off"
    >
      {fmt(now - startedAt)}
    </time>
  );
}
