import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContainer({
  children,
  className = '',
  noPadding = false,
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-2xl ${noPadding ? '' : 'p-4 sm:p-6'} ${className}`}
    >
      {children}
    </div>
  );
}
