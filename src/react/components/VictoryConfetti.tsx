import { useEffect, useMemo, useState } from 'react';

interface VictoryConfettiProps {
  pieces?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#4a7c2a', '#d4892b', '#3a7bd5', '#c0392b', '#fbbf24'];

export function VictoryConfetti({
  pieces,
  colors = DEFAULT_COLORS,
}: VictoryConfettiProps) {
  // Auto-throttle on mobile / when the user prefers reduced motion.
  // Fewer DOM nodes = no GPU layer storm on entry-level Android phones,
  // which is what users perceive as a "frozen screen" after a victory.
  const resolvedPieces = useMemo(() => {
    if (pieces !== undefined) return pieces;
    if (typeof window === 'undefined') return 40;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return 0;
    }
    return window.innerWidth < 640 ? 32 : 60;
  }, [pieces]);

  const [mounted, setMounted] = useState(true);

  // Tear down the DOM after the longest possible animation completes so
  // we don't leave 32+ animated nodes in the tree once the celebration
  // has played out.
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(false), 4500);
    return () => window.clearTimeout(id);
  }, []);

  const items = useMemo(
    () =>
      Array.from({ length: resolvedPieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 2 + Math.random() * 1.8,
        color: colors[i % colors.length]!,
        rotation: Math.random() * 360,
      })),
    [resolvedPieces, colors]
  );

  if (!mounted || resolvedPieces === 0) return null;

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
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
