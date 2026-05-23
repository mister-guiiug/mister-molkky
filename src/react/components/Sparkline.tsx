interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = 'var(--primary)',
  max,
}: SparklineProps) {
  // Until the actor has thrown at least once we only have the starting
  // score in the history. Rendering the line + end-marker in that case
  // produces an orphan coloured dot under the scoreboard cards, which
  // reads as a visual glitch. Just emit an empty baseline instead.
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden className="block">
        <line
          x1={2}
          y1={height - 2}
          x2={width - 2}
          y2={height - 2}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const upper = max ?? Math.max(...values, 1);
  const dx = (width - 4) / (values.length - 1);
  const pad = 2;
  const points = values.map((v, i) => {
    const x = pad + i * dx;
    const y = height - pad - ((v / upper) * (height - pad * 2));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const lastX = pad + (values.length - 1) * dx;
  const lastY =
    height - pad - ((values[values.length - 1]! / upper) * (height - pad * 2));

  return (
    <svg width={width} height={height} aria-hidden className="block">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={color} />
    </svg>
  );
}
