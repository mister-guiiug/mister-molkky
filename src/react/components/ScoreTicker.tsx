import { useEffect, useRef, useState } from 'react';

interface ScoreTickerProps {
  value: number;
  flash?: 'none' | 'win' | 'overshoot';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreTicker({
  value,
  flash = 'none',
  className = '',
  size = 'md',
}: ScoreTickerProps) {
  const prev = useRef(value);
  const [displayed, setDisplayed] = useState(value);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    if (value === prev.current) return;
    setBumping(true);
    const target = value;
    const start = prev.current;
    const delta = target - start;
    const duration = 380;
    const startedAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        setDisplayed(target);
        prev.current = target;
        setBumping(false);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const sizes = {
    sm: 'text-3xl',
    md: 'text-5xl',
    lg: 'text-6xl',
  };
  const colour =
    flash === 'win'
      ? 'var(--accent)'
      : flash === 'overshoot'
        ? 'var(--danger)'
        : 'var(--text)';

  return (
    <span
      aria-live="polite"
      className={`inline-block font-black tabular-nums ${sizes[size]} ${bumping ? 'mm-score-pop' : ''} ${className}`}
      style={{ color: colour, transition: 'color 220ms' }}
    >
      {displayed}
    </span>
  );
}
