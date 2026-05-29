interface LogoProps {
  size?: number;
  className?: string;
}

const LOGO_SRC = `${import.meta.env.BASE_URL || '/'}icons/icon-192.png`;

export function Logo({ size = 40, className }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      className={className}
      alt="Mister Mölkky"
      decoding="async"
    />
  );
}
