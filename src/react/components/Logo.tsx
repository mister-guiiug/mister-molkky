interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Mister Mölkky"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-light)" />
        </linearGradient>
        <linearGradient id="logo-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="var(--wood-deep)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logo-bg)" />
      <g fill="url(#logo-pin)" stroke="var(--wood-shadow)" strokeWidth="0.7">
        <path d="M 22 28 L 24 22 L 28 22 L 30 28 L 30 48 L 22 48 Z" />
        <path d="M 34 28 L 36 22 L 40 22 L 42 28 L 42 48 L 34 48 Z" />
        <path d="M 28 16 L 30 10 L 34 10 L 36 16 L 36 26 L 28 26 Z" />
      </g>
    </svg>
  );
}
