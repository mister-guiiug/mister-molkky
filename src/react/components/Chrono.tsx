import { useEffect, useState } from 'react';

interface ChronoProps {
  /** Match start timestamp (ms since epoch). */
  startedAt: number;
  /**
   * Epoch-ms timestamp of the current pause, or null/undefined while the
   * chrono is running. When set, the display freezes at that instant.
   */
  pausedAt?: number | null;
  /** Accumulated paused time from earlier pauses, in ms. */
  pausedTotalMs?: number;
  className?: string;
  'aria-label'?: string;
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
 * cost is negligible since this component is leaf-level.
 *
 * Pause-aware: elapsed = now − startedAt − pausedTotalMs. While paused
 * the interval is cancelled and the reference instant is frozen at
 * `pausedAt`, so a paused match shows a steady time and resumes from
 * exactly where it left off (the elapsed time excludes the break).
 */
export function Chrono({
  startedAt,
  pausedAt = null,
  pausedTotalMs = 0,
  className,
  'aria-label': ariaLabel,
}: ChronoProps) {
  // A bare tick counter drives the once-a-second re-render; the actual
  // time is read fresh from Date.now() during render. This keeps the
  // display correct the instant a pause resumes (no stale snapshot to
  // flush) and avoids a setState call in the effect body.
  const [, tick] = useState(0);
  const isPaused = pausedAt != null;

  useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(() => tick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isPaused]);

  const reference = isPaused ? pausedAt : Date.now();
  const elapsed = Math.max(0, reference - startedAt - pausedTotalMs);

  return (
    <time
      dateTime={`PT${Math.floor(elapsed / 1000)}S`}
      className={className}
      aria-label={ariaLabel}
      aria-live="off"
    >
      {fmt(elapsed)}
    </time>
  );
}
