import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  /** Skip the entry animation (e.g. for the live match view that should
   *  feel instant when navigating back to it). */
  noAnimate?: boolean;
}

export function PageContainer({
  children,
  className = '',
  noPadding = false,
  noAnimate = false,
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-2xl ${noPadding ? '' : 'p-4 sm:p-6'} ${noAnimate ? '' : 'mm-view-enter'} ${className}`}
    >
      {children}
    </div>
  );
}
