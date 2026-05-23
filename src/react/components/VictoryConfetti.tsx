import { useMemo } from 'react';

interface VictoryConfettiProps {
  pieces?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#4a7c2a', '#d4892b', '#3a7bd5', '#c0392b', '#fbbf24'];

export function VictoryConfetti({
  pieces = 80,
  colors = DEFAULT_COLORS,
}: VictoryConfettiProps) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        color: colors[i % colors.length]!,
        rotation: Math.random() * 360,
      })),
    [pieces, colors]
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden
    >
      {items.map((it, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            top: '-5%',
            left: `${it.left}%`,
            width: 10,
            height: 14,
            background: it.color,
            transform: `rotate(${it.rotation}deg)`,
            borderRadius: 2,
            animation: `mm-confetti-fall ${it.duration}s linear ${it.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
