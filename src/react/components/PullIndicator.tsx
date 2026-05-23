interface PullIndicatorProps {
  pulling: boolean;
  progress: number;
  refreshing: boolean;
  label: string;
}

/**
 * Tiny banner that sits at the top of the page while the user pulls down.
 * Shows the arrow rotating as the progress grows, then a spinner while
 * the refresh callback is running.
 */
export function PullIndicator({
  pulling,
  progress,
  refreshing,
  label,
}: PullIndicatorProps) {
  if (!pulling && !refreshing) return null;
  const visible = pulling || refreshing;
  const rotation = Math.min(180, progress * 180);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-2"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateY(${refreshing ? 0 : (pulling ? Math.min(progress, 1) * 20 - 20 : -20)}px)`,
        transition: 'opacity 200ms, transform 200ms',
      }}
    >
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--muted)',
        }}
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center"
          style={{
            transform: refreshing ? undefined : `rotate(${rotation}deg)`,
            transition: 'transform 100ms linear',
          }}
        >
          {refreshing ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2"
              style={{
                borderColor: 'var(--border)',
                borderTopColor: 'var(--primary)',
              }}
            />
          ) : (
            '↓'
          )}
        </span>
        {label}
      </div>
    </div>
  );
}
