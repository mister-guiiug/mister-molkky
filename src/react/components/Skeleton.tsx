interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Inert grey block that pulses softly — drop-in placeholder while a lazy
 * chunk loads or a data fetch is in flight. Defaults to a single line of
 * body text so the most common case is one prop ("Skeleton") instead of
 * a width/height dance.
 */
export function Skeleton({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = 'md',
}: SkeletonProps) {
  const radius = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];
  return (
    <span
      role="presentation"
      aria-hidden
      className={`mm-skeleton block ${radius} ${className}`}
      style={{ width, height, background: 'var(--surface-highlight)' }}
    />
  );
}

/**
 * Page-level fallback shown by <Suspense> while a route chunk loads.
 * Mimics the rough silhouette of every view: small header strip on
 * top + a few content blocks, so the layout doesn't pop when the real
 * view paints.
 */
export function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6" aria-busy="true">
      <div className="mb-6 flex items-center gap-3 pt-6">
        <Skeleton width={56} height={56} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton height={56} rounded="lg" />
        <Skeleton height={56} rounded="lg" />
        <Skeleton height={100} rounded="lg" />
      </div>
    </div>
  );
}
